import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
import { randomBytes } from 'crypto';
import {
  SubScores, SubFactorId, PillarId,
  pillarScoreFromSubs, pillarMultiplication, findWeaknesses, defaultSubScores,
} from '@/lib/pillars';
import {
  bayesianProbability, computeBaseRate, buildLikelihoodTable, HistoricalRecord,
} from '@/lib/bayesian';
import { multiCompetitorWinProb } from '@/lib/elo';
import { monteCarloRun } from '@/lib/montecarlo';
import { ensemble, EnsembleWeights, MethodProbs } from '@/lib/ensemble';
import { computeRewardFactors } from '@/lib/mcReward';

interface RfpImportBody {
  client_name: string;
  deal_size?: string;
  industry?: string;
  duration_months?: number;
  risk?: number;
  competitors: string[];        // competitor names (will lookup/create)
  sub_scores: Partial<SubScores>;
  rfp_summary?: string;         // stored in decision_traces
  strategy_memo?: string;       // stored in decision_traces
  voting_days?: number;         // voting link expiry (default 7)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as RfpImportBody;
    if (!body.client_name) return NextResponse.json({ error: 'client_name 필수' }, { status: 400 });

    const db = await getDb();

    // 1) sub-scores 보강
    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 2) 가중치 로드
    const { rows: weightRows } = await db.query(`
      SELECT variable_id, weight_value FROM weights w
      WHERE updated_at = (SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id)
    `);
    const subWeights: Partial<Record<SubFactorId, number>> = {};
    const pillarWeights: Partial<Record<PillarId, number>> = {};
    for (const r of weightRows) {
      const id = r.variable_id as string;
      if (id.startsWith('pillar_')) pillarWeights[id.slice(7) as PillarId] = r.weight_value;
      else subWeights[id as SubFactorId] = r.weight_value;
    }

    // 3) Method A
    const pillarScores = pillarScoreFromSubs(subs, subWeights);
    const probPillar = pillarMultiplication(pillarScores, pillarWeights);

    // 4) Method B
    const { rows: histRows } = await db.query(`
      SELECT p.sub_scores, o.actual_result FROM predictions p
      JOIN outcomes o ON o.deal_id = p.deal_id WHERE p.sub_scores IS NOT NULL
    `);
    const records: HistoricalRecord[] = histRows.map((r: { sub_scores: Partial<SubScores>; actual_result: number }) => ({
      subs: r.sub_scores, actual: r.actual_result as 0 | 1,
    }));
    const prior = computeBaseRate(records);
    const lrTable = buildLikelihoodTable(records);
    const probBayesian = bayesianProbability(subs, lrTable, prior);

    // 5) Method C — competitor name → id lookup
    const competitorIds: number[] = [];
    for (const name of (body.competitors ?? [])) {
      const { rows: found } = await db.query(
        'SELECT id FROM competitors WHERE LOWER(name) = LOWER($1)', [name]
      );
      if (found.length > 0) competitorIds.push(found[0].id);
    }

    const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
    const ourElo = ourEloRow[0]?.elo ?? 1500;
    let probElo = 0.5;
    if (competitorIds.length > 0) {
      const { rows: compRows } = await db.query(
        'SELECT current_elo FROM competitors WHERE id = ANY($1::int[])', [competitorIds]
      );
      probElo = multiCompetitorWinProb(ourElo, compRows.map((r: { current_elo: number }) => r.current_elo));
    }

    // 6) Method D
    const rewardFactors = computeRewardFactors(records, { risk: body.risk ?? 3 });
    const mc = monteCarloRun(subs, {
      iterations: 5000,
      subFactorStd: 1.0,
      pillarWeights,
      subWeights,
      rewardFactors,
    });

    // 7) Ensemble
    const { rows: ensRow } = await db.query(
      'SELECT pillar_mult, bayesian, elo, monte_carlo FROM ensemble_weights ORDER BY version DESC LIMIT 1'
    );
    const ensWeights: EnsembleWeights = ensRow[0] ? {
      pillar: ensRow[0].pillar_mult, bayesian: ensRow[0].bayesian,
      elo: ensRow[0].elo, monteCarlo: ensRow[0].monte_carlo,
    } : { pillar: 0.40, bayesian: 0.20, elo: 0.20, monteCarlo: 0.20 };

    const methodProbs: MethodProbs = {
      pillar: probPillar, bayesian: probBayesian, elo: probElo, monteCarlo: mc.mean,
    };
    const finalProb = ensemble(methodProbs, ensWeights);
    const weaknesses = findWeaknesses(subs, 3, pillarWeights, subWeights);

    // 8) DB 저장 — deals
    const { rows: dealRows } = await db.query(
      `INSERT INTO deals (client_name, deal_size, industry, duration_months, source)
       VALUES ($1, $2, $3, $4, 'manual') RETURNING id`,
      [body.client_name, body.deal_size ?? null, body.industry ?? '금융', body.duration_months ?? null]
    );
    const dealId = dealRows[0].id;

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
