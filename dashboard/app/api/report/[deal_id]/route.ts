import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL } from '@/lib/geminiModel';
import {
  SubScores, findWeaknesses, migrateLegacySubScores,
  pillarScoreFromSubs, PILLAR_META, PILLAR_IDS,
} from '@/lib/pillars';
import { buildStrategyPath } from '@/lib/strategyPath';
import { Pool } from 'pg';

// RFP 원문 청크를 deal_id 기준으로 가져옴 (pgvector 불필요 — 순서대로 전부 읽음)
async function fetchRfpContext(pool: Pool, dealId: number, clientName: string): Promise<string> {
  try {
    // 1순위: deal_id 직접 연결된 문서
    const { rows } = await pool.query(
      `SELECT c.content
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE d.deal_id = $1
       ORDER BY c.document_id, c.chunk_index
       LIMIT 30`,
      [dealId]
    );
    if (rows.length > 0) {
      return rows.map((r: { content: string }) => r.content).join('\n\n').slice(0, 6000);
    }
    // 2순위: 고객사명으로 검색
    const { rows: byCustomer } = await pool.query(
      `SELECT c.content
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE LOWER(d.customer) LIKE LOWER($1) OR LOWER(d.title) LIKE LOWER($1)
       ORDER BY c.document_id, c.chunk_index
       LIMIT 20`,
      [`%${clientName}%`]
    );
    return byCustomer.map((r: { content: string }) => r.content).join('\n\n').slice(0, 6000);
  } catch {
    return '';
  }
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST /api/report/[deal_id] — SG 8장 보고서 자동 생성 (정량 주입 + LLM 서술, 24h 캐시)
// ?refresh=1 로 캐시 무효화
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  const { deal_id: dealIdStr } = await params;
  const dealId = parseInt(dealIdStr);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const refresh = req.nextUrl.searchParams.get('refresh') === '1';
  const pool = await getDb();

  // 캐시 (24h)
  if (!refresh) {
    const { rows: cached } = await pool.query(
      `SELECT result_json FROM external_research
       WHERE deal_id=$1 AND topic='sg_report' AND created_at > NOW() - INTERVAL '24 hours'`,
      [dealId]
    );
    if (cached.length > 0 && cached[0].result_json?.win_assessment) {
      return NextResponse.json({ ...cached[0].result_json, cached: true });
    }
  }

  // 딜 + 최신 예측
  const { rows: dealRows } = await pool.query(
    `SELECT d.*, p.predicted_probability, p.method_probs, p.sub_scores,
            p.confidence_low, p.confidence_high
     FROM deals d
     LEFT JOIN predictions p ON p.deal_id = d.id
     WHERE d.id = $1
     ORDER BY p.created_at DESC LIMIT 1`,
    [dealId]
  );
  if (!dealRows.length) return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  const deal = dealRows[0];

  // 경쟁사 (Elo + 메모/위협)
  const { rows: competitors } = await pool.query(
    `SELECT c.name, c.current_elo, dc.notes, dc.risk_level
     FROM deal_competitors dc JOIN competitors c ON c.id = dc.competitor_id
     WHERE dc.deal_id = $1`,
    [dealId]
  );

  const { rows: voterRows } = await pool.query(
    `SELECT COUNT(DISTINCT id)::int as voter_count FROM voters WHERE deal_id = $1`,
    [dealId]
  );
  const voterCount = voterRows[0]?.voter_count ?? 0;

  // 정량 코어 (DB 주입 — LLM이 만들지 않음)
  const subScores: SubScores = migrateLegacySubScores(deal.sub_scores ?? {});
  const pillarScores = pillarScoreFromSubs(subScores);
  const weaknesses = findWeaknesses(subScores, 3);
  const winProb = Number(deal.predicted_probability ?? 0);
  const ciLow = Number(deal.confidence_low ?? 0);
  const ciHigh = Number(deal.confidence_high ?? 0);
  const methodProbs = deal.method_probs ?? {};
  const partners = deal.partners ?? [];
  const risks = deal.risks ?? [];
  const teamMembers = deal.team_members ?? [];
  const bidTimeline = deal.bid_timeline ?? {};

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.Gemini_API_Key ?? process.env.GOOGLE_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 503 });

  // RFP 원문 컨텍스트 — RAG에서 가져옴
  const rfpContext = await fetchRfpContext(pool, dealId, deal.client_name ?? '');

  // ── Reason Chain (LLM이 건드리지 못하는 권위값) ──────────────────────────────
  const strategyPath = buildStrategyPath(subScores, deal.expected_revenue ?? null);
  const pillarLine = PILLAR_IDS.map(p =>
    `${p}(${PILLAR_META[p].label})=${((pillarScores[p] ?? 0) * 10).toFixed(1)}/10`
  ).join(', ');
  const stepsLine = strategyPath.steps.map((s, i) =>
    `  ${i + 1}. [${s.pillar}] ${s.label} → +${s.delta_pp}%p (effort ${s.effort}, 담당: ${s.owner})`
  ).join('\n');
  const evLine = deal.expected_revenue
    ? `기대매출: ${strategyPath.baseline_ev}억 → ${strategyPath.target_ev}억 (+${strategyPath.ev_delta}억)`
    : '기대매출 미입력';

  // 정량 수치는 권위값 — LLM은 서술/전략만
  const rfpSection = rfpContext
    ? `\n## RFP 원문 발췌 (이 내용을 기반으로 CFS·제안전략 도출)\n${rfpContext}\n`
    : '';

  const prompt = `당신은 KT B2B 수주전략팀의 보고서 작성 전문가입니다.
아래 정량 분석 데이터와 RFP 원문을 바탕으로 전략 보고서 서술 부분을 작성하세요.

**원칙:**
- 정량 수치(확률, Pillar 점수, 전략 경로)는 절대 변경하지 마세요.
- RFP 원문이 있으면 반드시 그 내용을 근거로 CFS(고객 핵심성공요소)와 제안전략 카테고리를 도출하세요.
- 없으면 제공된 사실(경쟁사·파트너·리스크)만 활용하세요.
- 각 텍스트는 간결하게 (1~2문장).

## 딜 정보
- 고객사: ${deal.client_name}
- 산업: ${deal.industry ?? '미상'}
- 사업 규모: ${deal.deal_size ?? '미상'}
- 중요도: ${deal.importance_stars ?? 3}/5
${rfpSection}
## 정량 분석 (자체 데이터 — 신뢰)
- 수주 확률: ${winProb.toFixed(1)}% (95% CI: ${ciLow.toFixed(1)}~${ciHigh.toFixed(1)}%)
- Pillar 점수: ${pillarLine}
- 주요 약점 Top3: ${weaknesses.map(w => `${w.label}(${w.score.toFixed(1)}/10)`).join(', ')}
- Voting 참여: ${voterCount}명

## 전략 실행 경로 (Reason Chain — 이 숫자를 보고서에 직접 반영)
- 현재 확률: ${strategyPath.baseline_prob}% → 전략 실행 후: ${strategyPath.target_prob}% (+${strategyPath.total_delta_pp}%p)
- ${evLine}
- 권고 판단(기계적): ${strategyPath.go_nogo} — ${strategyPath.go_nogo_rationale}
- 최우선 실행 액션:
${stepsLine || '  (예측 데이터 없음)'}

## 경쟁 구도
${competitors.map(c => `- ${c.name} (Elo ${Number(c.current_elo).toFixed(0)}, 위협도 ${c.risk_level ?? 'medium'})${c.notes ? `: ${c.notes}` : ''}`).join('\n') || '- 경쟁사 미입력'}

## 협력 구도 (파트너)
${partners.map((p: { name: string; role?: string; task_scope?: string }) => `- ${p.name} (${p.role ?? ''}): ${p.task_scope ?? ''}`).join('\n') || '- 파트너 미입력'}

## 수행 리스크
${risks.map((r: { name: string; level?: string }) => `- ${r.name} (${r.level ?? 'medium'})`).join('\n') || '- 리스크 미입력'}

다음 JSON 형식으로만 응답하세요 (한국어):
{
  "business_objective": { "summary": "사업 목표·배경 2~3문장" },
  "winning_points": [
    { "customer_cfs": "고객 핵심성공요소 (RFP에서 도출)", "winning_point": "KT의 차별적 응답 (구체적 수치·레퍼런스 포함)" }
  ],
  "competition": {
    "competitors": [ { "name": "경쟁사명", "strength": "강점 1문장", "threat": "위협 1문장" } ],
    "positioning": "우리의 경쟁 포지셔닝 2문장"
  },
  "proposal_strategy": [
    {
      "category": "RFP 과업 범위 기반 카테고리명 (예: [인프라구축] / [SW구축] / [운영안정화])",
      "how_to": ["실행 방법 1 (구체적)", "2"],
      "value_proposition": "고객이 체감하는 정량적·정성적 가치 1문장",
      "pillar": "S|V|D|P|E",
      "expected_delta_pp": 0.0
    }
  ],
  "pillar_rationale": {
    "S": { "reason": "사전영업 점수 근거 1문장", "action": "개선 액션 1문장" },
    "V": { "reason": "고객가치 점수 근거 1문장", "action": "개선 액션 1문장" },
    "D": { "reason": "차별화 점수 근거 1문장", "action": "개선 액션 1문장" },
    "P": { "reason": "가격경쟁력 점수 근거 1문장", "action": "개선 액션 1문장" },
    "E": { "reason": "실행신뢰 점수 근거 1문장", "action": "개선 액션 1문장" }
  },
  "execution_risks": [ { "name": "리스크명", "level": "high|medium|low", "mitigation": "대응 방안 1문장" } ],
  "recommendation": "${strategyPath.go_nogo}",
  "recommendation_rationale": "권고 근거 2~3문장 (기계적 판단 근거 포함)"
}

winning_points는 RFP 원문의 고객 평가기준/요구사항에서 CFS를 도출하고, 5쌍 내외로 작성하세요.
proposal_strategy는 RFP 과업 범위(인프라/SW/운영 등)를 카테고리로 삼아 3~5개 작성하세요.`;

  let llmJson: Record<string, unknown> = {};
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in response');
    llmJson = JSON.parse(m[0]);
  } catch (e) {
    return NextResponse.json({ error: `보고서 생성 실패: ${String(e)}` }, { status: 500 });
  }

  // D-day 계산 (입찰 마감 기준)
  const dDay = bidTimeline.bid_deadline
    ? Math.ceil((new Date(bidTimeline.bid_deadline).getTime() - Date.now()) / 86400000)
    : null;

  // 정량 코어는 DB 권위값으로 강제 주입 (LLM 값 무시)
  const output = {
    deal_id: dealId,
    generated_at: new Date().toISOString(),
    business_objective: {
      client_name: deal.client_name,
      deal_size: deal.deal_size,
      industry: deal.industry,
      importance_stars: deal.importance_stars ?? 3,
      summary: (llmJson.business_objective as { summary?: string })?.summary ?? '',
    },
    bid_timeline: { ...bidTimeline, d_day: dDay, pt_format: deal.pt_format ?? null },
    // KT 매출 표 (PDF 섹션 2) — 수동 입력 정량값
    revenue_metrics: {
      expected_revenue: deal.expected_revenue ?? null,
      margin_rate: deal.margin_rate ?? null,
      contribution_margin: deal.contribution_margin ?? null,
      subcontract_rate: deal.subcontract_rate ?? null,
      risk_grade: deal.risk_grade ?? null,
      vdc_a: deal.vdc_a ?? null,
    },
    competition: {
      ...((llmJson.competition as Record<string, unknown>) ?? { competitors: [], positioning: '' }),
      eval_criteria: deal.customer_eval_criteria ?? null,
    },
    collaboration: { partners },
    // 수동 winning_points(2열) 우선 → LLM {customer_cfs,winning_point}[] → 구형 string[] 폴백
    winning_points: (() => {
      if (Array.isArray(deal.winning_points) && deal.winning_points.length > 0) return deal.winning_points;
      const llmWp = llmJson.winning_points;
      if (!Array.isArray(llmWp)) return [];
      if (llmWp.length === 0) return [];
      if (typeof llmWp[0] === 'object' && llmWp[0] !== null) return llmWp;
      return (llmWp as string[]).map((w) => ({ customer_cfs: '', winning_point: w }));
    })(),
    rfp_context_used: rfpContext.length > 0,
    vdc_b_result: Array.isArray(deal.vdc_b_result) ? deal.vdc_b_result : [],
    qna_items: Array.isArray(deal.qna_items) ? deal.qna_items : [],
    win_assessment: {
      probability: winProb,
      ci_low: ciLow,
      ci_high: ciHigh,
      pillar_scores: pillarScores,
      method_probs: methodProbs,
      weaknesses,
      voter_count: voterCount,
    },
    // ── Reason Chain (엔진 계산값 — LLM이 만들지 않음) ──────────────────────
    strategy_path: strategyPath,
    proposal_strategy: llmJson.proposal_strategy ?? [],
    pillar_rationale: llmJson.pillar_rationale ?? {},
    execution_risks: llmJson.execution_risks ?? risks.map((r: { name: string; level?: string }) => ({ name: r.name, level: r.level ?? 'medium', mitigation: '' })),
    team: {
      size: deal.team_size,
      members: teamMembers,
      execution_unit: deal.execution_unit,
      pm: deal.pm,
    },
    // go_nogo는 엔진 기계적 판단 — LLM recommendation_rationale은 서술만
    recommendation: strategyPath.go_nogo,
    recommendation_rationale: llmJson.recommendation_rationale ?? strategyPath.go_nogo_rationale,
    cached: false,
  };

  try {
    await pool.query(
      `INSERT INTO external_research (deal_id, topic, source, result_text, result_json)
       VALUES ($1, 'sg_report', $2, $3, $4)
       ON CONFLICT (deal_id, topic) DO UPDATE
       SET result_text = EXCLUDED.result_text, result_json = EXCLUDED.result_json, created_at = NOW()`,
      [dealId, GEMINI_MODEL, '', JSON.stringify(output)]
    );
  } catch (e) {
    console.error('[report] cache save failed:', e);
  }

  return NextResponse.json(output);
}
