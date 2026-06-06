import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0; let inString = false; let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) as unknown[]; } catch { return null; }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { topic, analysisText, driverScores, geoProb } = await req.json() as {
      topic: string;
      analysisText: string;
      driverScores: Record<string, number>;
      geoProb: number;
    };

    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    const db = await getDb();
    const token = randomBytes(10).toString('hex');

    // Insert session
    const { rows } = await db.query(
      `INSERT INTO geo_sessions (topic, analysis_text, driver_scores, geo_prob, token)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [topic, analysisText, JSON.stringify(driverScores), geoProb, token]
    );
    const sessionId: number = rows[0].id;

    // Generate signal cards via Gemini
    let cards: { label: string; description: string; driver_deltas: Record<string, number>; direction: string }[] = [];

    if (GEMINI_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `다음 지정학 분석 텍스트를 읽고 참가자들이 선택할 수 있는 시그널 카드를 4~6개 생성하세요.

분석 텍스트:
${analysisText}

드라이버 현황: ${JSON.stringify(driverScores)}

출력 규칙:
- JSON 배열만 출력 (마크다운 코드블록 없이)
- 각 카드: { "label": "짧은 제목(10자 이내)", "description": "설명(30자 이내)", "driver_deltas": { "외교채널": 숫자, "군사강도": 숫자, ... }, "direction": "agree" 또는 "conflict" }
- driver_deltas: 해당 카드 선택 시 각 드라이버의 변화량 (-3 ~ +3, 종전 가능성에 영향)
- direction: "agree"=종전 가능성 상승, "conflict"=종전 가능성 하락
- 드라이버 키: 외교채널, 군사강도, 경제압박, 이란내부, 호르무즈

예시:
[{"label":"오만 중재 성사","description":"오만 채널 통해 양측 대화 재개","driver_deltas":{"외교채널":2,"군사강도":-1},"direction":"agree"}]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = extractJsonArray(text);
        if (parsed && Array.isArray(parsed)) {
          cards = parsed as typeof cards;
        }
      } catch (e) {
        console.error('[geo/start] Gemini card generation failed:', e);
      }
    }

    // Insert cards
    if (cards.length > 0) {
      for (const card of cards) {
        await db.query(
          `INSERT INTO geo_signal_cards (session_id, label, description, driver_deltas, direction)
           VALUES ($1, $2, $3, $4, $5)`,
          [sessionId, card.label, card.description, JSON.stringify(card.driver_deltas), card.direction]
        );
      }
    }

    // Fetch inserted cards
    const { rows: cardRows } = await db.query(
      `SELECT id, label, description, driver_deltas, direction FROM geo_signal_cards WHERE session_id = $1 ORDER BY id`,
      [sessionId]
    );

    return NextResponse.json({ sessionId, token, cards: cardRows });
  } catch (e) {
    console.error('[geo/start]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
