import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
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

interface PredictBody {
  client_name: string;
  deal_size?: string;
  industry?: string;
  expected_revenue?: number;
  sub_scores: Partial<SubScores>;
  competitor_ids?: number[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PredictBody;
    const db = await getDb();

    // 1) sub-scores 기본값 보강
    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 2) 가중치 로드 (sub-factor + pillar)
    const { rows: weightRows } = await db.query(`
      SELECT variable_id, weight_value FROM weights w
      WHERE updated_at = (
        SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
      )
    `);
    const subWeights: Partial<Record<SubFactorId, number>> = {};
    const pillarWeights: Partial<Record<PillarId, number>> = {};
    for (const r of weightRows) {
      const id = r.variable_id as string;
      if (id.startsWith('pillar_')) {
        pillarWeights[id.slice(7) as PillarId] = r.weight_value;
      } else {
        subWeights[id as SubFactorId] = r.weight_value;
      }
    }

    // 3) Method A: Pillar Multiplication
    const pillarScores = pillarScoreFromSubs(subs, subWeights);
    const probPillar = pillarMultiplication(pillarScores, pillarWeights);

    // 4) Method B: Bayesian (과거 데이터로 prior + LR)
    const { rows: histRows } = await db.query(`
      SELECT p.sub_scores, o.actual_result
      FROM predictions p
      JOIN outcomes o ON o.deal_id = p.deal_id
      WHERE p.sub_scores IS NOT NULL
    `);
    const records: HistoricalRecord[] = histRows.map((r: { sub_scores: Partial<SubScores>; actual_result: number }) => ({
      subs: r.sub_scores,
      actual: r.actual_result as 0 | 1,
    }));
    const prior = computeBaseRate(records);
    const lrTable = buildLikelihoodTable(records);
    const probBayesian = bayesianProbability(subs, lrTable, prior);

    // 5) Method C: Competitor Elo Matchup
    const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
    const ourElo = ourEloRow[0]?.elo ?? 1500;
    let probElo = 0.5;
    if (body.competitor_ids && body.competitor_ids.length > 0) {
      const { rows: compRows } = await db.query(
        'SELECT id, current_elo FROM competitors WHERE id = ANY($1::int[])',
        [body.competitor_ids]
      );
      const elos = compRows.map((r: { current_elo: number }) => r.current_elo);
      probElo = multiCompetitorWinProb(ourElo, elos);
    }

    // 6) Method D: Monte Carlo
    const mc = monteCarloRun(subs, {
      iterations: 5000,  // serverless 응답시간 고려
      subFactorStd: 1.0,
      pillarWeights,
      subWeights,
    });
    const probMC = mc.mean;

    // 7) Ensemble
    const { rows: ensRow } = await db.query(`
      SELECT pillar_mult, bayesian, elo, monte_carlo FROM ensemble_weights
      ORDER BY version DESC LIMIT 1
    `);
    const ensWeights: EnsembleWeights = ensRow[0] ? {
      pillar: ensRow[0].pillar_mult,
      bayesian: ensRow[0].bayesian,
      elo: ensRow[0].elo,
      monteCarlo: ensRow[0].monte_carlo,
    } : { pillar: 0.40, bayesian: 0.20, elo: 0.20, monteCarlo: 0.20 };

    const methodProbs: MethodProbs = {
      pillar: probPillar, bayesian: probBayesian, elo: probElo, monteCarlo: probMC,
    };
    const finalProb = ensemble(methodProbs, ensWeights);

    // 8) 약점 Top 3
    const weaknesses = findWeaknesses(subs, 3, pillarWeights, subWeights);

    // 9) DB 저장
    const { rows: dealRows } = await db.query(
      `INSERT INTO deals (client_name, deal_size, industry, expected_revenue, source)
       VALUES ($1, $2, $3, $4, 'manual') RETURNING id`,
      [body.client_name, body.deal_size ?? null, body.industry ?? null, body.expected_revenue ?? null]
    );
    const dealId = dealRows[0].id;

    if (body.competitor_ids && body.competitor_ids.length > 0) {
      for (const cid of body.competitor_ids) {
        await db.query(
          'INSERT INTO deal_competitors (deal_id, competitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [dealId, cid]
        );
      }
    }

    await db.query(
      `INSERT INTO predictions
        (deal_id, variables_json, predicted_probability, weights_used_json,
         sub_scores, pillar_scores, method_probs, confidence_low, confidence_high, competitor_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dealId,
        JSON.stringify(subs),
        finalProb * 100,
        JSON.stringify({ subWeights, pillarWeights, ensWeights }),
        JSON.stringify(subs),
        JSON.stringify(pillarScores),
        JSON.stringify(methodProbs),
        mc.p5 * 100,
        mc.p95 * 100,
        body.competitor_ids ?? [],
      ]
    );

    return NextResponse.json({
      deal_id: dealId,
      probability: Math.round(finalProb * 1000) / 10,  // 0.0 ~ 100.0
      method_probs: {
        pillar: Math.round(probPillar * 1000) / 10,
        bayesian: Math.round(probBayesian * 1000) / 10,
        elo: Math.round(probElo * 1000) / 10,
        monteCarlo: Math.round(probMC * 1000) / 10,
      },
      pillar_scores: pillarScores,
      confidence_interval: {
        low: Math.round(mc.p5 * 1000) / 10,
        high: Math.round(mc.p95 * 1000) / 10,
      },
      mc_distribution: mc.distribution,
      weaknesses,
      prior_base_rate: Math.round(prior * 1000) / 10,
      data_points: records.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
