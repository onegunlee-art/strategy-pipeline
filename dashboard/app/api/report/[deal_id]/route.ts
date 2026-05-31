import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL } from '@/lib/geminiModel';
import {
  SubScores, findWeaknesses, migrateLegacySubScores,
  pillarScoreFromSubs, PILLAR_META, PILLAR_IDS,
} from '@/lib/pillars';

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

  const pillarLine = PILLAR_IDS.map(p =>
    `${p}(${PILLAR_META[p].label})=${((pillarScores[p] ?? 0) * 10).toFixed(1)}/10`
  ).join(', ');

  // 정량 수치는 권위값 — LLM은 서술/전략만
  const prompt = `당신은 KT B2B 수주전략팀의 보고서 작성 전문가입니다.
아래 정량 분석 데이터를 바탕으로 "SG 완성 보고서" 형식의 전략 보고서 서술 부분을 작성하세요.

**원칙:**
- 아래 정량 수치(확률, Pillar 점수)는 자체 데이터 기반이며 절대 바꾸지 마세요.
- 제공된 사실(경쟁사, 파트너, 리스크)만 사용하고 새로운 사실을 지어내지 마세요.
- 각 텍스트는 간결하게 (1~2문장).

## 딜 정보
- 고객사: ${deal.client_name}
- 산업: ${deal.industry ?? '미상'}
- 사업 규모: ${deal.deal_size ?? '미상'}
- 중요도: ${deal.importance_stars ?? 3}/5

## 정량 분석 (자체 데이터 — 신뢰)
- 수주 확률: ${winProb.toFixed(1)}% (95% CI: ${ciLow.toFixed(1)}~${ciHigh.toFixed(1)}%)
- Pillar 점수: ${pillarLine}
- 주요 약점 Top3: ${weaknesses.map(w => `${w.label}(${w.score.toFixed(1)}/10)`).join(', ')}
- Voting 참여: ${voterCount}명

## 경쟁 구도
${competitors.map(c => `- ${c.name} (Elo ${Number(c.current_elo).toFixed(0)}, 위협도 ${c.risk_level ?? 'medium'})${c.notes ? `: ${c.notes}` : ''}`).join('\n') || '- 경쟁사 미입력'}

## 협력 구도 (파트너)
${partners.map((p: { name: string; role?: string; task_scope?: string }) => `- ${p.name} (${p.role ?? ''}): ${p.task_scope ?? ''}`).join('\n') || '- 파트너 미입력'}

## 수행 리스크
${risks.map((r: { name: string; level?: string }) => `- ${r.name} (${r.level ?? 'medium'})`).join('\n') || '- 리스크 미입력'}

다음 JSON 형식으로만 응답하세요 (한국어):
{
  "business_objective": { "summary": "사업 목표·배경 2~3문장" },
  "winning_points": ["핵심 수주 논리 1", "2", "3", "4", "5"],
  "competition": {
    "competitors": [ { "name": "경쟁사명", "strength": "강점 1문장", "threat": "위협 1문장" } ],
    "positioning": "우리의 경쟁 포지셔닝 2문장"
  },
  "proposal_strategy": [
    { "pillar": "S|V|D|P|E", "how_to": ["실행 방법 1", "2"], "value_proposition": "고객 가치 제안 1문장" }
  ],
  "execution_risks": [ { "name": "리스크명", "level": "high|medium|low", "mitigation": "대응 방안 1문장" } ],
  "recommendation": "GO|CONDITIONAL_GO|NO_GO",
  "recommendation_rationale": "권고 근거 2~3문장"
}

proposal_strategy는 점수가 낮은 약점 Pillar 위주로 3~5개 작성하세요.`;

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
    bid_timeline: { ...bidTimeline, d_day: dDay },
    competition: llmJson.competition ?? { competitors: [], positioning: '' },
    collaboration: { partners },
    winning_points: llmJson.winning_points ?? [],
    win_assessment: {
      probability: winProb,
      ci_low: ciLow,
      ci_high: ciHigh,
      pillar_scores: pillarScores,
      method_probs: methodProbs,
      weaknesses,
      voter_count: voterCount,
    },
    proposal_strategy: llmJson.proposal_strategy ?? [],
    execution_risks: llmJson.execution_risks ?? risks.map((r: { name: string; level?: string }) => ({ name: r.name, level: r.level ?? 'medium', mitigation: '' })),
    team: {
      size: deal.team_size,
      members: teamMembers,
      execution_unit: deal.execution_unit,
      pm: deal.pm,
    },
    recommendation: llmJson.recommendation ?? 'CONDITIONAL_GO',
    recommendation_rationale: llmJson.recommendation_rationale ?? '',
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
