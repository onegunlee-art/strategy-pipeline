import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';
import { contribution } from '@/lib/geoDrivers';

export const maxDuration = 300;

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'o4-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;

type ReportItem = { tag: string; content: string; badge: string };

const ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    tag:     { type: 'string' as const },
    content: { type: 'string' as const },
    badge:   { type: 'string' as const },
  },
  required: ['tag', 'content', 'badge'] as string[],
  additionalProperties: false,
};

export async function POST(_req: NextRequest, ctx: { params: { session_id: string } }) {
  try {
    const sessionId = parseInt(ctx.params.session_id, 10);
    if (isNaN(sessionId)) return NextResponse.json({ error: 'invalid session_id' }, { status: 400 });

    const db = await getDb();

    const { rows } = await db.query(
      `SELECT id, topic, analysis_text, driver_scores, geo_prob, hypothesis, strategy_low, strategy_mid, strategy_high FROM geo_sessions WHERE id = $1`,
      [sessionId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 });

    const session = rows[0];

    const { rows: cardRows } = await db.query(
      `SELECT c.id, c.label, c.description, c.direction,
              COUNT(v.id)::integer AS vote_count
       FROM geo_signal_cards c
       LEFT JOIN geo_votes v ON v.card_id = c.id
       WHERE c.session_id = $1
       GROUP BY c.id, c.label, c.description, c.direction
       ORDER BY vote_count DESC`,
      [sessionId]
    );

    const agg = await aggregate(db, sessionId);

    const pickStrategy = (prob: number) => {
      if (prob < 40) return session.strategy_low ?? '';
      if (prob < 65) return session.strategy_mid ?? '';
      return session.strategy_high ?? '';
    };
    const currentStrategy = pickStrategy(agg.geoProb);
    const strategyLabel = agg.geoProb < 40 ? 'ACTION REQUIRED' : agg.geoProb < 65 ? 'PUSH — MOMENTUM' : 'LOCK IT IN';
    const targetProb = agg.geoProb < 40 ? 65 : agg.geoProb < 65 ? 80 : 90;

    const driverSummary = agg.driverMeta
      .map(m => `${m.labelKo}: ${contribution(m, agg.drivers[m.key] ?? 0).toFixed(1)}/10`)
      .join(', ');

    const cardSummary = cardRows.map((c: { label: string; direction: string; vote_count: number }) =>
      `- [${c.direction === 'agree' ? '가능성↑' : '가능성↓'}] ${c.label}: ${c.vote_count}표`
    ).join('\n');

    let reportData: {
      overview: string;
      analysis_items: ReportItem[];
      resistance_items: ReportItem[];
      strategy_items: ReportItem[];
    } = {
      overview: `${session.topic} — 현재 달성 가능성 ${agg.geoProb}%. (AI 보고서 생성 실패 — 기본 데이터 표시)`,
      analysis_items: [],
      resistance_items: [],
      strategy_items: [],
    };

    if (OPENAI_KEY) {
      try {
        const client = new OpenAI({ apiKey: OPENAI_KEY });

        const prompt = `당신은 FA(Foreign Affairs)·이코노미스트·FT 등 글로벌 매체를 분석하는 수석 전략 컨설턴트입니다.
모든 출력은 반드시 한국어로 작성하세요.

## 분석 주제
${session.topic}

## 현재 달성 가능성
${agg.geoProb}% → 목표: ${targetProb}%

## 전략 가설
${session.hypothesis ?? '(없음)'}

## 드라이버 현황
${driverSummary}

## 시그널 투표 결과 (총 ${agg.totalVotes}건)
${cardSummary || '(투표 없음)'}

## 수집된 글로벌 기사 (FA·이코노미스트 중심)
${(session.analysis_text ?? '').slice(0, 5000)}

## 출력 규칙 (반드시 준수)
- badge 값: "우위"(가능성 상승 요인), "열위"(가능성 저하 요인), "리스크"(위험 요소), "추가발굴"(전략 보강 필요), ""(중립 사실)
- content 종결 어미: ~원함/~필요/~인식/~예상/~가능/~보유 중 하나 사용 (다짐형·주관형 금지)
- 정량 수치 최소 5개 이상 포함 (%, 날짜, 횟수, 규모 등)
- FA·이코노미스트 기사 실명 인용 최소 3건 (예: "FA 2026년 5월호에 따르면", "이코노미스트 최신호 분석")

## 섹션별 생성 지침
1. overview: 주제 + 현재 달성가능성 + 핵심 변수를 담은 1~2문장 사업 개요
2. analysis_items: 현재 가능성에 영향을 미치는 핵심 현황 사실 7~9개 (badge: 우위/열위/리스크/"")
3. resistance_items: 확률을 떨어뜨리는 저항·경쟁·리스크 요인 5~7개 (badge: 열위/리스크/추가발굴 위주)
4. strategy_items: 달성 확률을 ${targetProb}%+ 로 끌어올리기 위한 구체적 실행 전략 7~9개 (badge: 우위/"" 위주, FA·이코노미스트 기사 근거 포함)`;

        const response = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'geo_report',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  overview:          { type: 'string' },
                  analysis_items:    { type: 'array', items: ITEM_SCHEMA },
                  resistance_items:  { type: 'array', items: ITEM_SCHEMA },
                  strategy_items:    { type: 'array', items: ITEM_SCHEMA },
                },
                required: ['overview', 'analysis_items', 'resistance_items', 'strategy_items'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawText = response.choices[0]?.message?.content ?? '';
        console.log(`[geo-report] OpenAI response length=${rawText.length}`);
        reportData = JSON.parse(rawText);
      } catch (e) {
        console.error('[geo-report] OpenAI generation failed:', e);
        reportData.overview = `${session.topic} — 달성 가능성 ${agg.geoProb}%. (AI 요약 생성 일시 실패 — 드라이버·시그널 데이터 기반 보고서)`;
      }
    }

    return NextResponse.json({
      topic: session.topic,
      geo_prob: agg.geoProb,
      driver_scores: agg.drivers,
      driver_meta: agg.driverMeta,
      total_votes: agg.totalVotes,
      cards: cardRows,
      hypothesis: session.hypothesis ?? '',
      strategy: currentStrategy,
      strategy_label: strategyLabel,
      target_prob: targetProb,
      overview: reportData.overview,
      analysis_items: reportData.analysis_items,
      resistance_items: reportData.resistance_items,
      strategy_items: reportData.strategy_items,
    });
  } catch (e) {
    console.error('[geo-report]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
