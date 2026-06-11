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
      `SELECT c.id, c.label, c.description, c.direction, c.evidence,
              COUNT(v.id)::integer AS vote_count
       FROM geo_signal_cards c
       LEFT JOIN geo_votes v ON v.card_id = c.id
       WHERE c.session_id = $1
       GROUP BY c.id, c.label, c.description, c.direction, c.evidence
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

    // 현장 의견 (QR 투표 페이지 자유 입력 → 시그널 변환된 카드)
    const fieldOpinions = cardRows
      .filter((c: { evidence: string | null }) => c.evidence?.startsWith('[현장 의견]'))
      .map((c: { label: string; description: string; evidence: string }) =>
        `- ${c.label}: ${c.description} (원문: ${c.evidence.replace('[현장 의견]', '').trim()})`)
      .join('\n');

    // 결정론적 개선 레버 계산 — P = mean(contribution) × 10 이므로
    // 드라이버 1개의 기여도 +Δc는 확률을 (Δc / n) × 10 pp 올린다.
    const nDrivers = Math.max(1, agg.driverMeta.length);
    const levers = agg.driverMeta
      .map(m => {
        const c = contribution(m, agg.drivers[m.key] ?? 0);
        const targetC = Math.min(c + 3, 9);
        const dpp = ((targetC - c) / nDrivers) * 10;
        return { label: m.labelKo, contrib: c, targetC, dpp };
      })
      .sort((a, b) => a.contrib - b.contrib);

    const leverSummary = levers
      .map(l => `- ${l.label}: 현재 기여도 ${l.contrib.toFixed(1)}/10 → ${l.targetC.toFixed(1)} 달성 시 확률 약 +${l.dpp.toFixed(1)}pp`)
      .join('\n');

    let reportData: {
      overview: string;
      strategy_summary: string;
      analysis_items: ReportItem[];
      resistance_items: ReportItem[];
      strategy_items: ReportItem[];
    } = {
      overview: `${session.topic} — 현재 달성 가능성 ${agg.geoProb}%. (AI 보고서 생성 실패 — 기본 데이터 표시)`,
      strategy_summary: '',
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

## 시그널 투표 결과 (총 ${agg.totalVotes}건) — 집단 판단이 반영된 최종 데이터
${cardSummary || '(투표 없음)'}

## 현장 의견 (참여자 직접 입력 — 전략에 반드시 반영)
${fieldOpinions || '(없음)'}

## 확률 개선 레버 (엔진 계산값 — 기여도 낮은 순. 이 수치를 그대로 사용할 것)
${leverSummary}

## 수집된 글로벌 기사 (FA·이코노미스트 중심)
${(session.analysis_text ?? '').slice(0, 5000)}

## 출력 규칙 (반드시 준수)
- badge 값: "우위"(가능성 상승 요인), "열위"(가능성 저하 요인), "리스크"(위험 요소), "추가발굴"(전략 보강 필요), ""(중립 사실)
- content 종결 어미: ~원함/~필요/~인식/~예상/~가능/~보유 중 하나 사용 (다짐형·주관형 금지)
- 정량 수치 최소 5개 이상 포함 (%, 날짜, 횟수, 규모 등)
- FA·이코노미스트 기사 실명 인용 최소 3건 (예: "FA 2026년 5월호에 따르면", "이코노미스트 최신호 분석")
- "협력 강화", "지속적 모니터링", "적극 대응" 등 어느 주제에나 통하는 무내용 표현 금지

## 섹션별 생성 지침
1. overview: 주제 + 현재 달성가능성 + 핵심 변수를 담은 1~2문장 사업 개요
2. strategy_summary: **핵심 전략 요약** — 번호 매긴 3~5개 항목. 각 항목은 반드시 "[드라이버명 기여도 x.x→y.y · 예상 +z.zpp]"로 시작하고, 위 "확률 개선 레버"의 수치를 그대로 인용할 것. 기여도가 가장 낮은 드라이버 2~3개를 우선 공략. 투표에서 가능성↓ 표가 많았던 시그널과 현장 의견의 우려를 직접 다룰 것. 어조는 제안형(~제안, ~권고, ~검토). 예시: "1. [경제 압박 3.2→6.0 · 예상 +5.6pp] FA 5월호가 지적한 제재 완화 신호를 활용해 ○○ 채널 재개를 제안"
3. analysis_items: 현재 가능성에 영향을 미치는 핵심 현황 사실 7~9개 (badge: 우위/열위/리스크/"")
4. resistance_items: 확률을 떨어뜨리는 저항·경쟁·리스크 요인 5~7개 (badge: 열위/리스크/추가발굴 위주)
5. strategy_items: 달성 확률을 ${targetProb}%+ 로 끌어올리기 위한 구체적 실행 전략 7~9개. tag는 개선 대상 드라이버명, content에는 예상 +pp 효과 포함 (badge: 우위/"" 위주, FA·이코노미스트 기사 근거 포함)`;

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
                  strategy_summary:  { type: 'string' },
                  analysis_items:    { type: 'array', items: ITEM_SCHEMA },
                  resistance_items:  { type: 'array', items: ITEM_SCHEMA },
                  strategy_items:    { type: 'array', items: ITEM_SCHEMA },
                },
                required: ['overview', 'strategy_summary', 'analysis_items', 'resistance_items', 'strategy_items'],
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
      // 발행 시점 재생성 전략(Posterior·투표·현장의견 반영) 우선, 실패 시 세션 시작 시점 전략으로 fallback
      strategy: reportData.strategy_summary?.trim() || currentStrategy,
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
