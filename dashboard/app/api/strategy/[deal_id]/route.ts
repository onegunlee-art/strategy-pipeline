// 약점 분해 + 외부 리서치 + 유사 case_studies → Claude 전략 카드
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { SUB_FACTORS, SubFactorId } from '@/lib/pillars';
import { fetchResearch } from '@/lib/research';

interface WeaknessRow {
  sub_factor_id: SubFactorId;
  score: number;
  pillar: string;
  label: string;
  contribution: number;
}

function findWeaknesses(subScores: Record<string, number>): WeaknessRow[] {
  // 단순화: score가 낮을수록 약점. 점수 5 미만이면 약점 후보
  const sorted = SUB_FACTORS
    .map(f => ({
      sub_factor_id: f.id,
      score: subScores[f.id] ?? 5,
      pillar: f.pillar,
      label: f.label,
      contribution: Math.max(0, (5 - (subScores[f.id] ?? 5)) / 10),
    }))
    .sort((a, b) => a.score - b.score);
  return sorted.slice(0, 3);
}

export async function POST(req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const db = await getDb();

    // 1) 딜 + 최신 predictions
    const { rows: dealRows } = await db.query(
      `SELECT d.id, d.client_name, d.industry, d.deal_size, d.execution_unit,
              p.sub_scores, p.predicted_probability
       FROM deals d
       LEFT JOIN predictions p ON p.deal_id = d.id
       WHERE d.id = $1
       ORDER BY p.created_at DESC NULLS LAST
       LIMIT 1`,
      [dealId]
    );
    if (dealRows.length === 0) {
      return NextResponse.json({ error: 'deal not found' }, { status: 404 });
    }
    const deal = dealRows[0];
    const subScores = (typeof deal.sub_scores === 'string' ? JSON.parse(deal.sub_scores) : deal.sub_scores) ?? {};
    const weaknesses = findWeaknesses(subScores);

    // 2) 외부 리서치 (각 약점 + 고객 컨텍스트)
    const researchPromises = weaknesses.map(w =>
      fetchResearch(db, dealId, {
        kind: 'weakness',
        subFactorId: w.sub_factor_id,
        clientName: deal.client_name,
        industry: deal.industry ?? undefined,
      })
    );
    const customerCtxPromise = fetchResearch(db, dealId, {
      kind: 'customer_context',
      clientName: deal.client_name,
      industry: deal.industry ?? undefined,
    });
    const [researchResults, customerCtx] = await Promise.all([
      Promise.all(researchPromises),
      customerCtxPromise,
    ]);

    // 3) 유사 case_studies (outcome=loss, 같은 industry 우선)
    const { rows: similarCases } = await db.query(
      `SELECT cs.win_loss_cause, cs.lessons_learned, cs.competitors_named, d.client_name, d.industry
       FROM case_studies cs
       JOIN deals d ON d.id = cs.deal_id
       WHERE cs.outcome = 'loss'
       ORDER BY (d.industry = $1) DESC, cs.id DESC
       LIMIT 3`,
      [deal.industry ?? '']
    );

    // 4) Claude 호출 — 외부 리서치 + 유사 사례 + 약점
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        ok: true,
        weaknesses,
        research: researchResults,
        customer_context: customerCtx,
        similar_cases: similarCases,
        cards: [],
        note: 'ANTHROPIC_API_KEY 미설정 — 카드 미생성. 약점/리서치만 반환.',
      });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const weaknessBlock = weaknesses.map((w, i) => {
      const meta = SUB_FACTORS.find(f => f.id === w.sub_factor_id);
      const r = researchResults[i];
      return `약점 ${i + 1}: [${w.pillar}] ${w.label} (${w.sub_factor_id})
- 현재: ${w.score.toFixed(1)}/10
- 설명: ${meta?.description ?? ''}
- 외부 리서치: ${r.text.slice(0, 500) || '(없음)'}`;
    }).join('\n\n');

    const similarBlock = similarCases.map((c, i) =>
      `${i + 1}. ${c.client_name} (${c.industry}) — 실주 원인: ${c.win_loss_cause?.slice(0, 200) ?? ''}
   교훈: ${c.lessons_learned?.slice(0, 200) ?? ''}`
    ).join('\n');

    const prompt = `당신은 KT B2B 수주전략 전문가입니다. 다음 딜의 약점 3개에 대해 3주 내 실행 가능한 액션 카드를 작성하세요.

## 딜 정보
- 고객사: ${deal.client_name}
- 산업: ${deal.industry ?? '미상'}
- 현재 확률: ${deal.predicted_probability ?? 'N/A'}%
- 고객 컨텍스트 (외부 리서치): ${customerCtx.text.slice(0, 400) || '(없음)'}

## 약점 Top 3 + 외부 리서치
${weaknessBlock}

## 유사 실주 사례 (같은 산업 우선)
${similarBlock || '(유사 사례 없음)'}

## 출력 (JSON 배열만)
[
  {
    "sub_factor_id": "...",
    "label": "...",
    "current_score": 4.2,
    "cause_hypothesis": "1문장 핵심 원인",
    "external_evidence": "외부 리서치에서 활용한 핵심 한 줄",
    "actions": [
      { "step": "구체적 액션 (3주 내)", "owner": "담당", "duration": "X일" },
      { "step": "...", "owner": "...", "duration": "..." },
      { "step": "...", "owner": "...", "duration": "..." }
    ],
    "expected_score_lift": 2,
    "expected_probability_lift_pp": 8
  },
  ... (3개)
]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const match = text.match(/\[[\s\S]*\]/);
    let cards = [];
    if (match) {
      try { cards = JSON.parse(match[0]); } catch { cards = []; }
    }

    return NextResponse.json({
      ok: true,
      deal_id: dealId,
      weaknesses,
      research: researchResults,
      customer_context: customerCtx,
      similar_cases: similarCases,
      cards,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET — 캐시된 리서치만 조회
export async function GET(_req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT topic, source, result_text, result_json, created_at
       FROM external_research WHERE deal_id=$1 ORDER BY created_at DESC`,
      [dealId]
    );
    return NextResponse.json({ ok: true, research: rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
