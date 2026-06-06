import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';

export async function POST(_req: NextRequest, ctx: { params: { session_id: string } }) {
  try {
    const sessionId = parseInt(ctx.params.session_id, 10);
    if (isNaN(sessionId)) return NextResponse.json({ error: 'invalid session_id' }, { status: 400 });

    const db = await getDb();

    const { rows } = await db.query(
      `SELECT id, topic, analysis_text, driver_scores, geo_prob FROM geo_sessions WHERE id = $1`,
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

    if (!GEMINI_KEY) {
      return NextResponse.json({
        topic: session.topic,
        geo_prob: agg.geoProb,
        driver_scores: agg.drivers,
        total_votes: agg.totalVotes,
        cards: cardRows,
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

    const driverSummary = Object.entries(agg.drivers)
      .map(([k, v]) => `${k}: ${(v as number).toFixed(1)}/10`)
      .join(', ');

    const prompt = `당신은 지정학 리스크 분석 전문가입니다. 다음 데이터를 바탕으로 간결하고 전문적인 지정학 분석 보고서를 작성하세요.

분석 주제: ${session.topic}
종전 가능성: ${agg.geoProb}%
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
  "recommendation": "정책/전략 권고사항 (2~3문장)"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let reportData: Record<string, string> = {};
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        reportData = JSON.parse(text.slice(start, end + 1));
      }
    } catch { /* fallback below */ }

    return NextResponse.json({
      topic: session.topic,
      geo_prob: agg.geoProb,
      driver_scores: agg.drivers,
      total_votes: agg.totalVotes,
      cards: cardRows,
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
