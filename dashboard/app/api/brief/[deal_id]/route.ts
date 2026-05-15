import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchResearch } from '@/lib/research';
import Anthropic from '@anthropic-ai/sdk';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST /api/brief/[deal_id] — Executive Brief 생성 (24h 캐시)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  const { deal_id: dealIdStr } = await params;
  const dealId = parseInt(dealIdStr);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const pool = await getDb();

  // 캐시 확인 (24h 이내)
  const { rows: cached } = await pool.query(
    `SELECT result_json, created_at FROM external_research
     WHERE deal_id=$1 AND topic='brief' AND created_at > NOW() - INTERVAL '24 hours'`,
    [dealId]
  );
  if (cached.length > 0 && cached[0].result_json) {
    return NextResponse.json({ ...cached[0].result_json, cached: true });
  }

  // 1) 딜 정보
  const { rows: dealRows } = await pool.query(
    `SELECT d.*, o.actual_result,
            p.predicted_probability, p.method_probs, p.pillar_scores,
            p.sub_scores, p.confidence_low, p.confidence_high
     FROM deals d
     LEFT JOIN outcomes o ON o.deal_id = d.id
     LEFT JOIN predictions p ON p.deal_id = d.id
     WHERE d.id = $1
     ORDER BY p.created_at DESC LIMIT 1`,
    [dealId]
  );
  if (!dealRows.length) return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  const deal = dealRows[0];

  // 2) Voting 집계
  const { rows: voterRows } = await pool.query(
    `SELECT COUNT(DISTINCT vt.id)::int as voter_count
     FROM voters vt WHERE vt.deal_id = $1`,
    [dealId]
  );
  const voterCount = voterRows[0]?.voter_count ?? 0;

  // 3) 약점 Top 3 (sub_scores 기반 낮은 점수 3개)
  const subScores: Record<string, number> = deal.sub_scores ?? {};
  const weaknesses = Object.entries(subScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([id, score]) => ({ id, score }));

  // 4) 외부 리서치 수집 (병렬)
  const researchPromises = [
    fetchResearch(pool, dealId, { kind: 'customer_context', clientName: deal.client_name, industry: deal.industry }),
    fetchResearch(pool, dealId, { kind: 'similar_reference', clientName: deal.client_name, industry: deal.industry }),
    fetchResearch(pool, dealId, { kind: 'kt_news' }),
    fetchResearch(pool, dealId, { kind: 'competitor_trend', competitorName: 'LG CNS' }),
    fetchResearch(pool, dealId, { kind: 'competitor_trend', competitorName: 'Samsung SDS' }),
    fetchResearch(pool, dealId, { kind: 'ai_mega_project', industry: deal.industry }),
    fetchResearch(pool, dealId, { kind: 'consortium_trend' }),
    ...weaknesses.map(w =>
      fetchResearch(pool, dealId, {
        kind: 'weakness',
        subFactorId: w.id as import('@/lib/pillars').SubFactorId,
        clientName: deal.client_name,
        industry: deal.industry,
      })
    ),
  ];
  const researchResults = await Promise.all(researchPromises);

  const [customerCtx, similarRef, ktNews, lgCnsTrend, samsungTrend, aiMega, consortiumTrend, ...weaknessResearch] =
    researchResults;

  // 5) 유사 사례 3건
  const { rows: caseStudies } = await pool.query(
    `SELECT cs.outcome, cs.win_loss_cause, cs.lessons_learned, cs.competitors_named, d.client_name, d.industry
     FROM case_studies cs JOIN deals d ON d.id = cs.deal_id
     WHERE d.industry = $1 OR $1 IS NULL
     ORDER BY cs.created_at DESC LIMIT 3`,
    [deal.industry]
  );

  // 6) 경쟁사 정보
  const { rows: competitors } = await pool.query(
    `SELECT c.name, c.current_elo
     FROM deal_competitors dc JOIN competitors c ON c.id = dc.competitor_id
     WHERE dc.deal_id = $1`,
    [dealId]
  );

  // 7) Claude 브리프 생성
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
  }

  const winProb = (deal.predicted_probability ?? 0) * 100;
  const ciLow = (deal.confidence_low ?? 0) * 100;
  const ciHigh = (deal.confidence_high ?? 0) * 100;
  const pillarScores: Record<string, number> = deal.pillar_scores ?? {};

  const promptContext = `
## 딜 정보
- 고객사: ${deal.client_name}
- 산업: ${deal.industry ?? '미상'}
- 딜 규모: ${deal.deal_size ?? '미상'}

## 정량 분석 결과 (🟢 자체 데이터 기반 — 신뢰)
- 최종 수주 확률: ${winProb.toFixed(1)}% (95% CI: ${ciLow.toFixed(1)}%~${ciHigh.toFixed(1)}%)
- Pillar 점수: V=${((pillarScores.V ?? 0) * 10).toFixed(1)}/10, P=${((pillarScores.P ?? 0) * 10).toFixed(1)}/10, D=${((pillarScores.D ?? 0) * 10).toFixed(1)}/10, E=${((pillarScores.E ?? 0) * 10).toFixed(1)}/10
- Voting 참여자: ${voterCount}명
- 주요 약점: ${weaknesses.map(w => `${w.id}(${w.score.toFixed(1)}/10)`).join(', ')}
- 경쟁사: ${competitors.map(c => `${c.name}(Elo ${c.current_elo.toFixed(0)})`).join(', ') || '미확인'}

## AI 컨텍스트 (🟡 참고용 — Gemini 분석)
### 고객사 현황
${customerCtx.text.slice(0, 500)}

### KT 최근 동향
${ktNews.text.slice(0, 400)}

### 경쟁사 동향
LG CNS: ${lgCnsTrend.text.slice(0, 300)}
Samsung SDS: ${samsungTrend.text.slice(0, 300)}

### AI 대형 사업 트렌드
${aiMega.text.slice(0, 400)}

### 컨소시엄 동향
${consortiumTrend.text.slice(0, 300)}

### 유사 레퍼런스
${similarRef.text.slice(0, 400)}

### 약점별 외부 근거
${weaknesses.map((w, i) => `${w.id}: ${weaknessResearch[i]?.text?.slice(0, 200) ?? 'N/A'}`).join('\n')}

## 유사 사례 (자체 DB)
${caseStudies.map(c => `- [${c.outcome}] ${c.client_name}(${c.industry}): ${c.win_loss_cause ?? c.lessons_learned ?? ''}`).join('\n')}
`;

  const briefPrompt = `당신은 KT 수주전략팀의 임원 보고서 작성 전문가입니다.
아래 딜 분석 데이터를 바탕으로 임원용 Executive Brief를 작성하세요.

**중요 원칙:**
- 🟢 정량 수치(확률, Pillar 점수)는 "자체 데이터 기반"임을 명시
- 🟡 AI 컨텍스트(경쟁사 동향, 시장 트렌드)는 "참고 분석"임을 명시
- 5페이지 이내, 임원이 5분 안에 읽을 수 있는 분량

${promptContext}

다음 JSON 형식으로만 응답하세요 (한국어):
{
  "executive_summary": "3~4문장 임원 요약. 수주 확률과 핵심 판단 근거 포함",
  "win_probability_assessment": {
    "probability": ${winProb.toFixed(1)},
    "ci_low": ${ciLow.toFixed(1)},
    "ci_high": ${ciHigh.toFixed(1)},
    "data_source": "자체 ${80}건 수주 이력 + Voting ${voterCount}명",
    "key_drivers": ["주요 동인 1", "주요 동인 2", "주요 동인 3"]
  },
  "strategy_actions": [
    {
      "weakness_area": "약점 영역명",
      "current_score": 0.0,
      "hypothesis": "핵심 원인 가설 1문장",
      "actions": [
        {"timeline": "Day 1-3", "action": "즉시 실행 액션", "owner": "담당"},
        {"timeline": "Day 4-10", "action": "단기 액션", "owner": "담당"},
        {"timeline": "Day 11-21", "action": "중기 액션", "owner": "담당"}
      ],
      "expected_uplift": "+N%",
      "external_evidence": "외부 근거 1문장 (AI 추정)"
    }
  ],
  "competitive_landscape": {
    "main_threats": ["위협 1", "위협 2"],
    "our_advantages": ["우위 1", "우위 2"],
    "ai_context_note": "AI 기반 경쟁사 동향 요약 (참고)"
  },
  "recommendation": "GO|NO_GO|CONDITIONAL_GO",
  "recommendation_rationale": "권고 이유 2~3문장",
  "sources": ["출처 URL 또는 근거 1", "출처 2"]
}`;

  let briefJson: Record<string, unknown> = {};
  let briefText = '';
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: briefPrompt }],
    });
    briefText = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const m = briefText.match(/\{[\s\S]*\}/);
    if (m) briefJson = JSON.parse(m[0]);
  } catch (e) {
    console.error('[brief] Claude error:', e);
    return NextResponse.json({ error: 'brief generation failed' }, { status: 500 });
  }

  const output = {
    deal_id: dealId,
    client_name: deal.client_name,
    industry: deal.industry,
    generated_at: new Date().toISOString(),
    layer1_quant: {
      win_probability: winProb,
      ci_low: ciLow,
      ci_high: ciHigh,
      pillar_scores: pillarScores,
      voter_count: voterCount,
      weaknesses,
    },
    layer2_ai_context: {
      kt_news: ktNews.json,
      competitor_trends: { lg_cns: lgCnsTrend.json, samsung_sds: samsungTrend.json },
      ai_mega_project: aiMega.json,
      consortium_trend: consortiumTrend.json,
    },
    ...briefJson,
  };

  // 캐시 저장
  await pool.query(
    `INSERT INTO external_research (deal_id, topic, source, result_text, result_json)
     VALUES ($1, 'brief', 'claude-sonnet-4-6', $2, $3)
     ON CONFLICT (deal_id, topic) DO UPDATE
     SET result_text = EXCLUDED.result_text,
         result_json = EXCLUDED.result_json,
         created_at = NOW()`,
    [dealId, briefText.slice(0, 2000), JSON.stringify(output)],
  );

  return NextResponse.json({ ...output, cached: false });
}

// GET /api/brief/[deal_id] — 캐시된 브리프 반환
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  const { deal_id: dealIdStr } = await params;
  const dealId = parseInt(dealIdStr);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT result_json, created_at FROM external_research
     WHERE deal_id=$1 AND topic='brief'`,
    [dealId]
  );
  if (!rows.length || !rows[0].result_json) {
    return NextResponse.json({ error: 'no brief found' }, { status: 404 });
  }
  const ageMs = Date.now() - new Date(rows[0].created_at).getTime();
  return NextResponse.json({ ...rows[0].result_json, cached: true, stale: ageMs > CACHE_TTL_MS });
}
