import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';
// Gist RAG not called here — analysisText from geo/analyze already contains gistAnalysis
import { GeoDriver, normalizeDriverMeta } from '@/lib/geoDrivers';

// Gist RAG(최대 60s) + Gemini 호출이 직렬로 이어지므로 함수 타임아웃을 상향 (Vercel Pro).
export const maxDuration = 300;

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
    const { topic, analysisText, driverScores, geoProb, driverMeta: rawDriverMeta } = await req.json() as {
      topic: string;
      analysisText: string;
      driverScores: Record<string, number>;
      geoProb: number;
      driverMeta?: unknown;
    };

    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    const driverMeta: GeoDriver[] = normalizeDriverMeta(rawDriverMeta);

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
      console.log(`[geo/start] GEMINI_KEY present, analysisText length=${analysisText.length}, driverMeta keys=${driverMeta.map(m=>m.key).join(',')}`);
      try {
        // analysisText already contains gistAnalysis from geo/analyze — no second Gist call needed.
        const driverKeyList = driverMeta.map(m => m.key).join(', ');
        const driverLegend = driverMeta.map(m => `${m.key}=${m.labelKo}(${m.invert ? '높을수록 가능성↓' : '높을수록 가능성↑'})`).join(', ');
        const d1 = driverMeta[0]?.key ?? 'd1';
        const d2 = driverMeta[1]?.key ?? 'd2';
        const d3 = driverMeta[2]?.key ?? 'd3';
        const d4 = driverMeta[3]?.key ?? 'd4';
        const d5 = driverMeta[4]?.key ?? 'd5';

        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { maxOutputTokens: 4096 },
        });
        const prompt = `당신은 지정학 리스크 분석 전문가입니다. 다음 분석 내용을 읽고 JSON 하나만 출력하세요. 마크다운 코드블록 없이 JSON만 출력하세요.

분석 내용:
${analysisText.slice(0, 3000)}

드라이버 정의: ${driverLegend}
드라이버 현황 (원점수 0~10): ${JSON.stringify(driverScores)}
현재 종전/완화 가능성: ${geoProb}%

출력 형식 (이 구조 그대로):
{
  "hypothesis": "분석 기반 핵심 가설 1~2문장",
  "strategy_low": "가능성 낮을 때(<40%) 전략 2문장",
  "strategy_mid": "가능성 중간(40~65%) 전략 2문장",
  "strategy_high": "가능성 높을 때(>65%) 전략 2문장",
  "facts": [
    { "type": "driver", "key": "드라이버 한글명", "value": "현재값", "source": "출처" },
    { "type": "event", "key": "사건명", "value": "긍정/부정/중립", "source": "날짜+출처" }
  ],
  "cards": [
    { "label": "제목(10자이내)", "description": "설명(30자이내)", "evidence": "근거1문장", "driver_deltas": {"${d1}": 1, "${d2}": -1, "${d3}": 0, "${d4}": 1, "${d5}": -1}, "direction": "agree" },
    { "label": "제목(10자이내)", "description": "설명(30자이내)", "evidence": "근거1문장", "driver_deltas": {"${d1}": -1, "${d2}": 2, "${d3}": -1, "${d4}": 0, "${d5}": 1}, "direction": "conflict" },
    { "label": "제목(10자이내)", "description": "설명(30자이내)", "evidence": "근거1문장", "driver_deltas": {"${d1}": 0, "${d2}": -2, "${d3}": 1, "${d4}": 1, "${d5}": 0}, "direction": "agree" },
    { "label": "제목(10자이내)", "description": "설명(30자이내)", "evidence": "근거1문장", "driver_deltas": {"${d1}": 1, "${d2}": 0, "${d3}": -1, "${d4}": -1, "${d5}": 2}, "direction": "conflict" }
  ]
}

규칙:
- cards는 반드시 4개. driver_deltas 키는 반드시 이 5개만: ${driverKeyList}
- direction: "agree" 또는 "conflict" 중 하나
- facts: 총 6~7개 (driver 5개 + event 1~2개)`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`[geo/start] Gemini response length=${text.length}, preview="${text.slice(0, 200)}"`);
        const parsed = extractJsonObject(text);
        if (parsed) {
          console.log(`[geo/start] Parsed OK — cards=${Array.isArray(parsed.cards) ? (parsed.cards as unknown[]).length : 'none'} facts=${Array.isArray(parsed.facts) ? (parsed.facts as unknown[]).length : 'none'}`);
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
        } else {
          console.error(`[geo/start] extractJsonObject FAILED — raw response: "${text.slice(0, 500)}"`);
        }
      } catch (e) {
        console.error('[geo/start] Gemini generation failed:', e);
      }
    } else {
      console.error('[geo/start] GEMINI_KEY missing — skipping card/fact/hypothesis generation');
    }

    // Insert session with hypothesis + strategy + prior_prob + facts + driver_meta
    const { rows } = await db.query(
      `INSERT INTO geo_sessions (topic, analysis_text, driver_scores, geo_prob, token, hypothesis, strategy_low, strategy_mid, strategy_high, prior_prob, facts, driver_meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [topic, analysisText, JSON.stringify(driverScores), geoProb, token,
       hypothesis || null, strategyLow || null, strategyMid || null, strategyHigh || null,
       geoProb, facts.length > 0 ? JSON.stringify(facts) : null, JSON.stringify(driverMeta)]
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

    return NextResponse.json({ sessionId, token, cards: cardRows, hypothesis, strategyLow, strategyMid, strategyHigh, priorProb: geoProb, facts, driverMeta });
  } catch (e) {
    console.error('[geo/start]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
