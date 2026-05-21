// POST /api/admin/rescore — 기존 딜의 sub_scores를 수동 수정 후 재계산
// 새 prediction row를 같은 deal_id에 INSERT (이력 보존)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
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

interface RescoreBody {
  deal_id: number;
  sub_scores: Partial<SubScores>;
  memo?: string;        // decision_traces 에 기록할 편집 메모
  risk?: number;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as RescoreBody;
    if (!body.deal_id) return NextResponse.json({ error: 'deal_id 필수' }, { status: 400 });

    const db = await getDb();

    // deal + 기존 경쟁사 로드
    const { rows: dealRows } = await db.query(
      `SELECT d.*, array_agg(dc.competitor_id) FILTER (WHERE dc.competitor_id IS NOT NULL) as competitor_ids
       FROM deals d LEFT JOIN deal_competitors dc ON dc.deal_id = d.id
       WHERE d.id = $1 GROUP BY d.id`,
      [body.deal_id]
    );
    if (dealRows.length === 0) return NextResponse.json({ error: '딜 없음' }, { status: 404 });
    const deal = dealRows[0];
    const competitorIds: number[] = deal.competitor_ids ?? [];

    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 가중치 로드
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

    const pillarScores = pillarScoreFromSubs(subs, subWeights);
    const probPillar = pillarMultiplication(pillarScores, pillarWeights);

    const { rows: histRows } = await db.query(`
      SELECT p.sub_scores, o.actual_result FROM predictions p
      JOIN outcomes o ON o.deal_id = p.deal_id WHERE p.sub_scores IS NOT NULL
    `);
    const records: HistoricalRecord[] = histRows.map((r: { sub_scores: Partial<SubScores>; actual_result: number }) => ({
      subs: r.sub_scores, actual: r.actual_result as 0 | 1,
    }));
    const prior = computeBaseRate(records);
    const probBayesian = bayesianProbability(subs, buildLikelihoodTable(records), prior);

    const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
    const ourElo = ourEloRow[0]?.elo ?? 1500;
    let probElo = 0.5;
    if (competitorIds.length > 0) {
      const { rows: compRows } = await db.query(
        'SELECT current_elo FROM competitors WHERE id = ANY($1::int[])', [competitorIds]
      );
      probElo = multiCompetitorWinProb(ourElo, compRows.map((r: { current_elo: number }) => r.current_elo));
    }

    const rewardFactors = computeRewardFactors(records, { risk: body.risk ?? 3 });
    const mc = monteCarloRun(subs, { iterations: 5000, subFactorStd: 1.0, pillarWeights, subWeights, rewardFactors });

    const { rows: ensRow } = await db.query('SELECT pillar_mult, bayesian, elo, monte_carlo FROM ensemble_weights ORDER BY version DESC LIMIT 1');
    const ensWeights: EnsembleWeights = ensRow[0]
      ? { pillar: ensRow[0].pillar_mult, bayesian: ensRow[0].bayesian, elo: ensRow[0].elo, monteCarlo: ensRow[0].monte_carlo }
      : { pillar: 0.30, bayesian: 0.40, elo: 0.20, monteCarlo: 0.10 };

    const methodProbs: MethodProbs = { pillar: probPillar, bayesian: probBayesian, elo: probElo, monteCarlo: mc.mean };
    const finalProb = ensemble(methodProbs, ensWeights);
    const weaknesses = findWeaknesses(subs, 3, pillarWeights, subWeights);

    // 새 prediction row INSERT (같은 deal_id, 이력 보존)
    await db.query(
      `INSERT INTO predictions
        (deal_id, variables_json, predicted_probability, weights_used_json,
         sub_scores, pillar_scores, method_probs, confidence_low, confidence_high, competitor_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        body.deal_id, JSON.stringify(subs), finalProb * 100,
        JSON.stringify({ subWeights, pillarWeights, ensWeights }),
        JSON.stringify(subs), JSON.stringify(pillarScores),
        JSON.stringify(methodProbs), mc.p5 * 100, mc.p95 * 100, competitorIds,
      ]
    );

    // 편집 메모 decision_traces 기록
    if (body.memo?.trim()) {
      await db.query(
        `INSERT INTO decision_traces (deal_id, stage, decision, rationale) VALUES ($1, $2, $3, $4)`,
        [body.deal_id, 'proposal', '수동 점수 편집', body.memo]
      );
    }

    return NextResponse.json({
      ok: true,
      deal_id: body.deal_id,
      probability: Math.round(finalProb * 1000) / 10,
      method_probs: {
        pillar: Math.round(probPillar * 1000) / 10,
        bayesian: Math.round(probBayesian * 1000) / 10,
        elo: Math.round(probElo * 1000) / 10,
        monteCarlo: Math.round(mc.mean * 1000) / 10,
      },
      pillar_scores: pillarScores,
      confidence_interval: { low: Math.round(mc.p5 * 1000) / 10, high: Math.round(mc.p95 * 1000) / 10 },
      weaknesses,
      prior_base_rate: Math.round(prior * 1000) / 10,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
