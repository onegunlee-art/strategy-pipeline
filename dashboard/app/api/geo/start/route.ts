import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';

export const maxDuration = 60;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0; let inString = false; let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>; } catch { return null; }
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

    // Gemini: 카드 + 가설 + 전략 + 팩트 + 에비던스 한 번에 생성
    let cards: { label: string; description: string; evidence: string; driver_deltas: Record<string, number>; direction: string }[] = [];
    let hypothesis = '';
    let strategyLow = '';
    let strategyMid = '';
    let strategyHigh = '';
    let facts: Array<{ type: string; key: string; value: string; source: string }> = [];

    if (GEMINI_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `당신은 지정학 리스크 분석 전문가입니다. 다음 분석 텍스트와 드라이버 현황을 바탕으로 JSON 하나를 출력하세요.

분석 텍스트:
${analysisText}

드라이버 현황 (0~10, 종전 기여도 기준): ${JSON.stringify(driverScores)}
현재 종전 가능성: ${geoProb}%

출력 규칙 (마크다운 코드블록 없이 JSON만):
{
  "facts": [
    { "type": "driver", "key": "드라이버 이름", "value": "수치 또는 상태", "source": "근거 출처" },
    { "type": "event", "key": "사건명", "value": "긍정/부정/중립", "source": "날짜 + 출처" },
    { "type": "market", "key": "지표명", "value": "수치", "source": "데이터 출처" }
  ],
  "cards": [
    { "label": "짧은 제목(10자 이내)", "description": "설명(30자 이내)", "evidence": "출처 근거 1문장 (날짜+기관)", "driver_deltas": {"외교채널": 숫자, "군사강도": 숫자, "경제압박": 숫자, "이란내부": 숫자, "호르무즈": 숫자}, "direction": "agree 또는 conflict" }
  ],
  "hypothesis": "분석 기반 핵심 전략 가설 1~2문장",
  "strategy_low": "종전 가능성이 낮을 때(< 40%) 확률을 올리기 위한 구체적 행동 전략 2~3문장",
  "strategy_mid": "종전 가능성이 40~65%일 때 모멘텀 유지 및 가설 검증 전략 2~3문장",
  "strategy_high": "종전 가능성이 높을 때(> 65%) 리스크 관리 및 승기 확보 전략 2~3문장"
}

facts 규칙:
- 6~8개 생성 (driver 5개 + event 1~3개)
- driver type: 5개 드라이버 각각 현재 수치와 의미 설명
- event type: 분석 텍스트에서 핵심 사건 1~3개 (실제 날짜 포함)
- source: 가능한 한 구체적으로 (예: "Reuters 2026.06.05", "오만 외무부 발표 2026.05.28")

cards 규칙:
- 4~6개 생성
- evidence: 해당 카드 선택 근거가 되는 실제 또는 유사 출처 1문장
- driver_deltas 값: -3 ~ +3
- direction: "agree"=종전 가능성 상승, "conflict"=종전 가능성 하락
- 드라이버 키: 외교채널, 군사강도, 경제압박, 이란내부, 호르무즈`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = extractJsonObject(text);
        if (parsed) {
          if (Array.isArray(parsed.cards)) {
            cards = parsed.cards as typeof cards;
          }
          if (Array.isArray(parsed.facts)) {
            facts = parsed.facts as typeof facts;
          }
          hypothesis = (parsed.hypothesis as string) ?? '';
          strategyLow = (parsed.strategy_low as string) ?? '';
          strategyMid = (parsed.strategy_mid as string) ?? '';
          strategyHigh = (parsed.strategy_high as string) ?? '';
        }
      } catch (e) {
        console.error('[geo/start] Gemini generation failed:', e);
      }
    }

    // Insert session with hypothesis + strategy + prior_prob + facts
    const { rows } = await db.query(
      `INSERT INTO geo_sessions (topic, analysis_text, driver_scores, geo_prob, token, hypothesis, strategy_low, strategy_mid, strategy_high, prior_prob, facts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [topic, analysisText, JSON.stringify(driverScores), geoProb, token,
       hypothesis || null, strategyLow || null, strategyMid || null, strategyHigh || null,
       geoProb, facts.length > 0 ? JSON.stringify(facts) : null]
    );
    const sessionId: number = rows[0].id;

    // Insert cards with evidence
    if (cards.length > 0) {
      for (const card of cards) {
        await db.query(
          `INSERT INTO geo_signal_cards (session_id, label, description, driver_deltas, direction, evidence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sessionId, card.label, card.description, JSON.stringify(card.driver_deltas), card.direction, card.evidence || null]
        );
      }
    }

    // Fetch inserted cards
    const { rows: cardRows } = await db.query(
      `SELECT id, label, description, driver_deltas, direction, evidence FROM geo_signal_cards WHERE session_id = $1 ORDER BY id`,
      [sessionId]
    );

    return NextResponse.json({ sessionId, token, cards: cardRows, hypothesis, strategyLow, strategyMid, strategyHigh, priorProb: geoProb, facts });
  } catch (e) {
    console.error('[geo/start]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
