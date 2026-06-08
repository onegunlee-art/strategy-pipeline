import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';
import { contribution } from '@/lib/geoDrivers';

// Vercel 함수 타임아웃 — 기존 60초에서 대폭 상향 (플랫폼 상한까지).
// Gemini 응답 지연 시 504로 잘려 클라이언트 JSON 파싱이 폭발하던 문제 완화.
export const maxDuration = 300;

// Gemini 단일 호출에 자체 타임아웃을 둬서 함수가 무한 대기하지 않게 한다.
// 시간 초과/실패해도 보고서 골격은 반환하도록 race로 감싼다.
const GEMINI_TIMEOUT_MS = 240_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`gemini timeout after ${ms}ms`)), ms)),
  ]);
}

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

    if (!GEMINI_KEY) {
      return NextResponse.json({
        topic: session.topic,
        geo_prob: agg.geoProb,
        driver_scores: agg.drivers,
        driver_meta: agg.driverMeta,
        total_votes: agg.totalVotes,
        cards: cardRows,
        hypothesis: session.hypothesis ?? '',
        strategy: currentStrategy,
        executive_summary: '(GEMINI_API_KEY 미설정 — 텍스트 생성 불가)',
        driver_analysis: '',
        signal_summary: '',
        risk_scenarios: '',
        recommendation: '',
      });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const cardSummary = cardRows.map((c: { label: string; direction: string; vote_count: number }) =>
      `- [${c.direction === 'agree' ? '종전↑' : '긴장↑'}] ${c.label}: ${c.vote_count}표`
    ).join('\n');

    // 라벨 + 종전 기여도(invert 반영) 기준으로 요약
    const driverSummary = agg.driverMeta
      .map(m => `${m.labelKo}: ${contribution(m, agg.drivers[m.key] ?? 0).toFixed(1)}/10`)
      .join(', ');

    const strategyLabel = agg.geoProb < 40 ? '확률 상승 전략' : agg.geoProb < 65 ? '모멘텀 유지 전략' : '리스크 관리 전략';

    const prompt = `당신은 지정학 리스크 분석 전문가입니다. 다음 데이터를 바탕으로 간결하고 전문적인 지정학 분석 보고서를 작성하세요.

분석 주제: ${session.topic}
종전 가능성: ${agg.geoProb}%
전략 가설: ${session.hypothesis ?? '(없음)'}
${strategyLabel}: ${currentStrategy || '(없음)'}
총 참여 시그널: ${agg.totalVotes}건
드라이버 현황: ${driverSummary}

시그널 카드 투표 결과:
${cardSummary || '(투표 없음)'}

원본 분석 텍스트:
${session.analysis_text ?? ''}

다음 JSON 형식으로만 출력하세요 (마크다운 코드블록 없이):
{
  "executive_summary": "3~5문장의 핵심 요약",
  "driver_analysis": "각 드라이버별 현황과 시사점 (200자 이내)",
  "signal_summary": "시그널 투표 결과 해석 (100자 이내)",
  "risk_scenarios": "낙관/기준/비관 3개 시나리오 (각 1문장)",
  "recommendation": "가설과 전략을 반영한 최종 정책/전략 권고사항 (2~3문장)"
}`;

    let reportData: Record<string, string> = {};
    try {
      const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS);
      const text = result.response.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        reportData = JSON.parse(text.slice(start, end + 1));
      }
    } catch (genErr) {
      // Gemini 실패/타임아웃이어도 500을 내지 않고 골격 보고서를 반환한다.
      console.error('[geo-report] gemini generation failed:', genErr);
      reportData = {
        executive_summary: `종전 가능성 ${agg.geoProb}%. (AI 요약 생성 일시 실패 — 드라이버·시그널 데이터 기반 보고서)`,
      };
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
      executive_summary: reportData.executive_summary ?? '',
      driver_analysis: reportData.driver_analysis ?? '',
      signal_summary: reportData.signal_summary ?? '',
      risk_scenarios: reportData.risk_scenarios ?? '',
      recommendation: reportData.recommendation ?? '',
    });
  } catch (e) {
    console.error('[geo-report]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
