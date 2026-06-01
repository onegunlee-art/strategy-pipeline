import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
import { randomBytes } from 'crypto';
import { SubScores, defaultSubScores } from '@/lib/pillars';
import { computeEnsembleProb } from '@/lib/ensemble';

interface RfpImportBody {
  client_name: string;
  deal_size?: string;
  industry?: string;
  duration_months?: number;
  risk?: number;
  competitors: string[];
  sub_scores: Partial<SubScores>;
  rfp_summary?: string;
  strategy_memo?: string;
  voting_days?: number;
  importance_stars?: number;
  bid_timeline?: { rfp_published?: string; bid_deadline?: string; pt_date?: string; announcement_date?: string };
  team_size?: number;
  partners_list?: { name: string; role: string; task_scope?: string }[];
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as RfpImportBody;
    if (!body.client_name) return NextResponse.json({ error: 'client_name 필수' }, { status: 400 });

    const db = await getDb();

    // 1) sub-scores 보강
    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 2) competitor name → id lookup (rfp-import 고유: 이름으로 등록)
    const competitorIds: number[] = [];
    for (const name of (body.competitors ?? [])) {
      const { rows: found } = await db.query(
        'SELECT id FROM competitors WHERE LOWER(name) = LOWER($1)', [name]
      );
      if (found.length > 0) competitorIds.push(found[0].id);
    }

    // 3~7) 공유 추론 파이프라인 (가중치 로드 → 4-method → ensemble)
    const {
      subWeights, pillarWeights, pillarScores, methodProbs,
      finalProb, mc, weaknesses, prior, records, ensWeights,
    } = await computeEnsembleProb(db, subs, {
      competitorIds,
      risk: body.risk ?? 3,
    });
    const { pillar: probPillar, bayesian: probBayesian, elo: probElo } = methodProbs;

    // 8) DB 저장 — deals
    const { rows: dealRows } = await db.query(
      `INSERT INTO deals (client_name, deal_size, industry, duration_months, source)
       VALUES ($1, $2, $3, $4, 'manual') RETURNING id`,
      [body.client_name, body.deal_size ?? null, body.industry ?? '금융', body.duration_months ?? null]
    );
    const dealId = dealRows[0].id;

    // 8b) 신규 필드 업데이트 (importance_stars, bid_timeline, team_size, partners)
    const newFieldSets: string[] = [];
    const newFieldVals: unknown[] = [];
    let fi = 1;
    if (body.importance_stars != null) { newFieldSets.push(`importance_stars=$${fi++}`); newFieldVals.push(body.importance_stars); }
    if (body.bid_timeline && Object.keys(body.bid_timeline).length > 0) { newFieldSets.push(`bid_timeline=$${fi++}`); newFieldVals.push(JSON.stringify(body.bid_timeline)); }
    if (body.team_size != null) { newFieldSets.push(`team_size=$${fi++}`); newFieldVals.push(body.team_size); }
    if (body.partners_list && body.partners_list.length > 0) { newFieldSets.push(`partners=$${fi++}`); newFieldVals.push(JSON.stringify(body.partners_list.map(p => ({ name: p.name, role: p.role, task_scope: p.task_scope })))); }
    if (newFieldSets.length > 0) {
      newFieldVals.push(dealId);
      await db.query(`UPDATE deals SET ${newFieldSets.join(', ')} WHERE id=$${fi}`, newFieldVals);
    }

    // 9) deal_competitors
    for (const cid of competitorIds) {
      await db.query(
        'INSERT INTO deal_competitors (deal_id, competitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [dealId, cid]
      );
    }

    // 10) predictions
    await db.query(
      `INSERT INTO predictions
        (deal_id, variables_json, predicted_probability, weights_used_json,
         sub_scores, pillar_scores, method_probs, confidence_low, confidence_high, competitor_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dealId, JSON.stringify(subs), finalProb * 100,
        JSON.stringify({ subWeights, pillarWeights, ensWeights }),
        JSON.stringify(subs), JSON.stringify(pillarScores),
        JSON.stringify(methodProbs), mc.p5 * 100, mc.p95 * 100, competitorIds,
      ]
    );

    // 11) decision_traces — RFP 분석 + 전략 메모 저장
    if (body.rfp_summary || body.strategy_memo) {
      await db.query(
        `INSERT INTO decision_traces (deal_id, stage, decision, rationale) VALUES ($1, $2, $3, $4)`,
        [dealId, 'scouting', 'RFP 분석 기반 딜 등록',
          [body.rfp_summary, body.strategy_memo].filter(Boolean).join('\n\n---\n\n')]
      );
    }

    // 12) voting link (closes_at = N일 후)
    const token = randomBytes(10).toString('hex');
    const closesAt = new Date();
    closesAt.setDate(closesAt.getDate() + (body.voting_days ?? 7));
    await db.query(
      `INSERT INTO voting_links (deal_id, token, closes_at)
       VALUES ($1, $2, $3) ON CONFLICT (deal_id) DO UPDATE SET token=$2, closes_at=$3`,
      [dealId, token, closesAt]
    );

    return NextResponse.json({
      ok: true,
      deal_id: dealId,
      probability: Math.round(finalProb * 1000) / 10,
      method_probs: {
        pillar: Math.round(probPillar * 1000) / 10,
        bayesian: Math.round(probBayesian * 1000) / 10,
        elo: Math.round(probElo * 1000) / 10,
        monteCarlo: Math.round(mc.mean * 1000) / 10,
      },
      pillar_scores: pillarScores,
      confidence_interval: {
        low: Math.round(mc.p5 * 1000) / 10,
        high: Math.round(mc.p95 * 1000) / 10,
      },
      weaknesses,
      prior_base_rate: Math.round(prior * 1000) / 10,
      data_points: records.length,
      voting_token: token,
      voting_url: `/vote/${token}`,
      competitor_ids: competitorIds,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
