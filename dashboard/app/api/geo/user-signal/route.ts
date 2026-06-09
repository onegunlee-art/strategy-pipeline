import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDb } from '@/lib/db';

export const maxDuration = 60;

const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'o4-mini';

export async function POST(req: NextRequest) {
  try {
    const { token, userText } = await req.json() as { token?: string; userText?: string };
    if (!token || !userText?.trim()) {
      return NextResponse.json({ error: 'token and userText required' }, { status: 400 });
    }

    const db = await getDb();

    // 세션 조회
    const { rows } = await db.query(
      `SELECT id, topic, driver_meta, driver_scores FROM geo_sessions WHERE token = $1 LIMIT 1`,
      [token]
    );
    if (!rows[0]) return NextResponse.json({ error: 'session not found' }, { status: 404 });

    const sessionId: number = rows[0].id;
    const topic: string = rows[0].topic;
    const driverMeta: Array<{ key: string; labelKo: string; labelEn: string; invert: boolean }> = rows[0].driver_meta ?? [];
    const driverScores: Record<string, number> = rows[0].driver_scores ?? {};
    const driverKeyList = driverMeta.map(m => m.key).join(', ');

    let card: { label: string; description: string; direction: string; driver_deltas: Record<string, number> } | null = null;

    if (OPENAI_KEY && driverMeta.length > 0) {
      const driverLegend = driverMeta.map(m => `${m.key}=${m.labelKo}(invert=${m.invert})`).join(', ');
      const client = new OpenAI({ apiKey: OPENAI_KEY });

      const prompt = `당신은 지정학 전략 분석가입니다. 모든 출력은 반드시 한국어로 작성하세요.

분석 주제: "${topic}"
드라이버 정의: ${driverLegend}
현재 드라이버 점수: ${JSON.stringify(driverScores)}

아래는 현장 참여자가 직접 작성한 의견입니다:
"${userText.trim()}"

이 의견에서 핵심 신호를 추출하여 하나의 시그널 카드로 변환하세요.
- label: 8자 이내의 핵심 키워드
- description: 이 의견이 달성 가능성에 미치는 영향을 2문장으로 설명
- direction: "agree"(가능성 상승) 또는 "conflict"(가능성 하락)
- driver_deltas: 영향받는 드라이버 키(${driverKeyList}) 중 관련 있는 것만 -2~+2 정수로 표기`;

      const driverDeltasProperties: Record<string, { type: string }> = {};
      for (const m of driverMeta) driverDeltasProperties[m.key] = { type: 'number' };

      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'user_signal_card',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                label:         { type: 'string' },
                description:   { type: 'string' },
                direction:     { type: 'string' },
                driver_deltas: { type: 'object', properties: driverDeltasProperties, required: Object.keys(driverDeltasProperties), additionalProperties: false },
              },
              required: ['label', 'description', 'direction', 'driver_deltas'],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
      if (parsed.label && parsed.description) {
        card = {
          label: parsed.label,
          description: parsed.description,
          direction: parsed.direction === 'agree' ? 'agree' : 'conflict',
          driver_deltas: parsed.driver_deltas ?? {},
        };
      }
    }

    // fallback
    if (!card) {
      card = {
        label: '현장 의견',
        description: `참여자 의견: "${userText.trim().slice(0, 60)}"`,
        direction: 'agree',
        driver_deltas: {},
      };
    }

    // DB 저장
    const { rows: inserted } = await db.query(
      `INSERT INTO geo_signal_cards (session_id, label, description, driver_deltas, direction, evidence)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [sessionId, card.label, card.description, JSON.stringify(card.driver_deltas), card.direction, `[현장 의견] ${userText.trim().slice(0, 100)}`]
    );

    return NextResponse.json({ ok: true, cardId: inserted[0].id, card });
  } catch (e) {
    console.error('[user-signal]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
