import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import OpenAI from 'openai';
import { getDb } from '@/lib/db';
// Gist RAG not called here — analysisText from geo/analyze already contains gistAnalysis
import { GeoDriver, normalizeDriverMeta, buildFallbackCards, buildFallbackFacts } from '@/lib/geoDrivers';

export const maxDuration = 300;

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'o4-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;

type Card = { label: string; description: string; evidence: string; driver_deltas: Record<string, number>; direction: string };
type Fact = { type: string; key: string; value: string; source: string };

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

    let cards: Card[] = [];
    let hypothesis = '';
    let strategyLow = '';
    let strategyMid = '';
    let strategyHigh = '';
    let facts: Fact[] = [];
    let aiError: string | null = null;
    let aiRawLen = 0;

    if (OPENAI_KEY) {
      console.log(`[geo/start] OPENAI_KEY present, model=${OPENAI_MODEL}, analysisText length=${analysisText?.length ?? 0}`);
      try {
        const driverKeyList = driverMeta.map(m => m.key).join(', ');
        const driverLegend = driverMeta.map(m => `${m.key}=${m.labelKo}(${m.invert ? '높을수록 가능성↓' : '높을수록 가능성↑'})`).join(', ');
        const d1 = driverMeta[0]?.key ?? 'd1';
        const d2 = driverMeta[1]?.key ?? 'd2';
        const d3 = driverMeta[2]?.key ?? 'd3';
        const d4 = driverMeta[3]?.key ?? 'd4';
        const d5 = driverMeta[4]?.key ?? 'd5';

        const driverDeltasProperties: Record<string, { type: 'number' }> = {};
        for (const m of driverMeta) {
          driverDeltasProperties[m.key] = { type: 'number' };
        }

        const client = new OpenAI({ apiKey: OPENAI_KEY });

        const prompt = `당신은 글로벌 전략 컨설턴트입니다. 모든 출력(label, description, evidence, hypothesis, strategy, facts의 key/value/source 포함)은 반드시 한국어로 작성하세요.

분석 주제: ${topic}

분석 내용:
${(analysisText ?? '').slice(0, 3000)}

드라이버 정의: ${driverLegend}
드라이버 현황 (원점수 0~10): ${JSON.stringify(driverScores)}
현재 달성 가능성: ${geoProb}%

다음을 생성하세요:
- hypothesis: 현재 가능성을 결정짓는 핵심 가설 1~2문장 (확률 관점에서 서술)
- strategy_low: 가능성이 낮을 때(<40%), 확률을 65% 이상으로 끌어올리기 위한 즉각 실행 전략 2문장. 반드시 행동 지향·긍정 어조("~를 선점하라", "~를 즉시 실행하라" 등)로 작성.
- strategy_mid: 가능성이 중간(40~65%)일 때, 확률을 80% 이상으로 높이기 위한 핵심 레버 2문장. 반드시 행동 지향·긍정 어조로 작성.
- strategy_high: 가능성이 높을 때(>65%), 이 모멘텀을 굳혀 90% 이상 확보하기 위한 전략 2문장. 반드시 행동 지향·긍정 어조로 작성.
- facts: 6~7개 (driver 5개는 type="driver", event 1~2개는 type="event")
- cards: 반드시 4개. driver_deltas 키는 반드시 이 5개만: ${driverKeyList}. direction은 "agree" 또는 "conflict".
  예시: {"${d1}": 1, "${d2}": -1, "${d3}": 0, "${d4}": 1, "${d5}": -1}`;

        const response = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'geo_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  hypothesis:    { type: 'string' },
                  strategy_low:  { type: 'string' },
                  strategy_mid:  { type: 'string' },
                  strategy_high: { type: 'string' },
                  facts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type:   { type: 'string' },
                        key:    { type: 'string' },
                        value:  { type: 'string' },
                        source: { type: 'string' },
                      },
                      required: ['type', 'key', 'value', 'source'],
                      additionalProperties: false,
                    },
                  },
                  cards: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label:         { type: 'string' },
                        description:   { type: 'string' },
                        evidence:      { type: 'string' },
                        direction:     { type: 'string' },
                        driver_deltas: {
                          type: 'object',
                          properties: driverDeltasProperties,
                          required: driverMeta.map(m => m.key),
                          additionalProperties: false,
                        },
                      },
                      required: ['label', 'description', 'evidence', 'direction', 'driver_deltas'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['hypothesis', 'strategy_low', 'strategy_mid', 'strategy_high', 'facts', 'cards'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawText = response.choices[0]?.message?.content ?? '';
        aiRawLen = rawText.length;
        console.log(`[geo/start] OpenAI response length=${rawText.length}, preview="${rawText.slice(0, 200)}"`);

        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          aiError = `parse failed — raw: ${rawText.slice(0, 300)}`;
          console.error(`[geo/start] JSON parse FAILED — raw: "${rawText.slice(0, 500)}"`);
        }

        if (parsed) {
          const parsedCards = Array.isArray(parsed.cards) ? parsed.cards : [];
          const parsedFacts = Array.isArray(parsed.facts) ? parsed.facts : [];
          console.log(`[geo/start] Parsed OK — cards=${parsedCards.length} facts=${parsedFacts.length}`);
          if (parsedCards.length > 0) cards = parsedCards as Card[];
          if (parsedFacts.length > 0) facts = parsedFacts as Fact[];
          hypothesis = (parsed.hypothesis as string) ?? '';
          strategyLow = (parsed.strategy_low as string) ?? '';
          strategyMid = (parsed.strategy_mid as string) ?? '';
          strategyHigh = (parsed.strategy_high as string) ?? '';
        }
      } catch (e) {
        aiError = String(e);
        console.error('[geo/start] OpenAI generation failed:', e);
      }
    } else {
      aiError = 'OPENAI_API_KEY missing';
      console.error('[geo/start] OPENAI_API_KEY missing — skipping card/fact/hypothesis generation');
    }

    // 결정론적 Fallback: AI 실패해도 카드/팩트가 항상 존재하도록 보장
    const cardSource = cards.length > 0 ? 'openai' : 'fallback';
    if (cards.length === 0) {
      cards = buildFallbackCards(driverMeta, driverScores);
      console.log(`[geo/start] Using fallback cards (${cards.length}개)`);
    }
    if (facts.length === 0) {
      facts = buildFallbackFacts(driverMeta, driverScores);
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
    for (const card of cards) {
      await db.query(
        `INSERT INTO geo_signal_cards (session_id, label, description, driver_deltas, direction, evidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, card.label, card.description, JSON.stringify(card.driver_deltas), card.direction, card.evidence || null]
      );
    }

    // Fetch inserted cards
    const { rows: cardRows } = await db.query(
      `SELECT id, label, description, driver_deltas, direction, evidence FROM geo_signal_cards WHERE session_id = $1 ORDER BY id`,
      [sessionId]
    );

    return NextResponse.json({
      sessionId, token, cards: cardRows, hypothesis, strategyLow, strategyMid, strategyHigh,
      priorProb: geoProb, facts, driverMeta,
      _debug: { cardSource, aiError, aiRawLen },
    });
  } catch (e) {
    console.error('[geo/start]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
