// Ensemble — 4 method 결합 + Brier minimize 학습

import {
  SubScores, SubFactorId, PillarId, PillarScores,
  pillarScoreFromSubs, pillarMultiplication, findWeaknesses,
} from './pillars';
import {
  bayesianProbability, computeBaseRate, buildLikelihoodTable, HistoricalRecord,
} from './bayesian';
import { multiCompetitorWinProb } from './elo';
import { monteCarloRun, MonteCarloResult } from './montecarlo';
import { computeRewardFactors } from './mcReward';

export type Method = 'pillar' | 'bayesian' | 'elo' | 'monteCarlo';

export interface MethodProbs {
  pillar: number;       // A. Pillar Multiplication
  bayesian: number;     // B. Bayesian Update
  elo: number;          // C. Competitor Elo Matchup
  monteCarlo: number;   // D. Monte Carlo Mean
}

export interface EnsembleWeights {
  pillar: number;
  bayesian: number;
  elo: number;
  monteCarlo: number;
}

// 점추정 결합에 쓰는 가중치. monteCarlo는 0 — MC 평균은 Pillar에 대칭 노이즈만
// 더한 값이라 새 정보가 없고(상관신호), 오직 CI(신뢰구간) 산출에만 쓴다.
export const DEFAULT_WEIGHTS: EnsembleWeights = {
  pillar: 0.33,      // KT 5-Pillar 구조 신호
  bayesian: 0.45,    // 시장/산업 base rate — 경험치 보정
  elo: 0.22,         // 경쟁구도 — 유일하게 독립적인 외부 신호
  monteCarlo: 0,     // CI 전용 (점추정 결합에서 제외)
};

// 정보가 독립적인 세 신호(Pillar·Bayesian·Elo)만 가중 결합한다.
// MonteCarlo는 의도적으로 제외 — 점추정에 중복 신호를 더하는 착시를 제거.
export function ensemble(probs: MethodProbs, weights: EnsembleWeights = DEFAULT_WEIGHTS): number {
  const total = weights.pillar + weights.bayesian + weights.elo;
  if (total === 0) return 0.5;
  return (
    probs.pillar * weights.pillar +
    probs.bayesian * weights.bayesian +
    probs.elo * weights.elo
  ) / total;
}

// Brier minimize via grid search — 정보 독립적인 3 신호(Pillar·Bayesian·Elo)만 탐색.
// monteCarlo는 점추정에서 제외되므로 학습 대상이 아님 (항상 0).
// step 0.1 → pillar+bayesian+elo = 1.0 제약 하에서 ~66 조합.
export interface TrainingCase {
  probs: MethodProbs;
  actual: 0 | 1;
}

export function learnEnsembleWeights(cases: TrainingCase[], step: number = 0.1): EnsembleWeights {
  if (cases.length < 3) return DEFAULT_WEIGHTS;

  let bestBrier = Infinity;
  let best: EnsembleWeights = DEFAULT_WEIGHTS;

  for (let a = 0; a <= 1 + 1e-9; a += step) {
    for (let b = 0; b <= 1 - a + 1e-9; b += step) {
      const c = 1 - a - b;
      if (c < -1e-9 || c > 1 + 1e-9) continue;
      const w: EnsembleWeights = { pillar: a, bayesian: b, elo: Math.max(0, c), monteCarlo: 0 };
      let brier = 0;
      for (const tc of cases) {
        const p = ensemble(tc.probs, w);
        brier += (p - tc.actual) ** 2;
      }
      brier /= cases.length;
      if (brier < bestBrier) {
        bestBrier = brier;
        best = w;
      }
    }
  }
  return best;
}

// Calibration: 예측 확률을 10% bucket으로 묶어 실제 win rate 계산
export interface CalibrationPoint {
  bucket: string;    // '0-10%', '10-20%', ...
  predicted: number; // bucket 중앙값
  actual: number;    // 해당 bucket의 실제 win rate
  count: number;
}

export function calibrationData(
  predictions: { predicted: number; actual: 0 | 1 }[]
): CalibrationPoint[] {
  const buckets: { sum: number; count: number; wins: number }[] = Array.from({ length: 10 }, () => ({
    sum: 0, count: 0, wins: 0,
  }));
  for (const p of predictions) {
    const idx = Math.min(9, Math.floor(p.predicted * 10));
    buckets[idx].count++;
    buckets[idx].sum += p.predicted;
    if (p.actual === 1) buckets[idx].wins++;
  }
  return buckets.map((b, i) => ({
    bucket: `${i * 10}-${(i + 1) * 10}%`,
    predicted: b.count > 0 ? b.sum / b.count : (i + 0.5) / 10,
    actual: b.count > 0 ? b.wins / b.count : 0,
    count: b.count,
  })).filter(p => p.count > 0);
}

export function brierScore(predicted: number, actual: number): number {
  return (predicted - actual) ** 2;
}

// ── 공유 추론 파이프라인 ──────────────────────────────────────────────
// predict 와 admin/rfp-import 가 동일하게 쓰던 4-method 계산을 단일화.
// 가중치 로드 → Pillar/Bayesian/Elo/MonteCarlo → 앙상블 결합까지 일괄 수행.

export interface EnsembleComputation {
  subWeights: Partial<Record<SubFactorId, number>>;
  pillarWeights: Partial<Record<PillarId, number>>;
  pillarScores: PillarScores;
  methodProbs: MethodProbs;
  finalProb: number;             // 0~1
  mc: MonteCarloResult;
  weaknesses: ReturnType<typeof findWeaknesses>;
  prior: number;
  records: HistoricalRecord[];
  ensWeights: EnsembleWeights;
}

export async function computeEnsembleProb(
  db: import('pg').Pool,
  subs: SubScores,
  opts: { competitorIds?: number[]; risk?: number; mcIterations?: number } = {}
): Promise<EnsembleComputation> {
  // 1) 가중치 로드 (sub-factor + pillar, 최신 버전)
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

  // 2) Method A — Pillar Multiplication
  const pillarScores = pillarScoreFromSubs(subs, subWeights);
  const probPillar = pillarMultiplication(pillarScores, pillarWeights);

  // 3) Method B — Bayesian (과거 데이터 prior + LR)
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

  // 4) Method C — Competitor Elo Matchup
  const { rows: ourEloRow } = await db.query('SELECT elo FROM our_elo WHERE id=1');
  const ourElo = ourEloRow[0]?.elo ?? 1500;
  let probElo = 0.5;
  const competitorIds = opts.competitorIds ?? [];
  if (competitorIds.length > 0) {
    const { rows: compRows } = await db.query(
      'SELECT current_elo FROM competitors WHERE id = ANY($1::int[])', [competitorIds]
    );
    probElo = multiCompetitorWinProb(ourElo, compRows.map((r: { current_elo: number }) => r.current_elo));
  }

  // 5) Method D — Monte Carlo (sigma 차등, mean은 점추정)
  const rewardFactors = computeRewardFactors(records, { risk: opts.risk });
  const mc = monteCarloRun(subs, {
    iterations: opts.mcIterations ?? 5000,
    subFactorStd: 1.0,
    pillarWeights,
    subWeights,
    rewardFactors,
  });

  // 6) Ensemble 결합 (DB 최신 가중치 또는 fallback)
  const { rows: ensRow } = await db.query(
    'SELECT pillar_mult, bayesian, elo, monte_carlo FROM ensemble_weights ORDER BY version DESC LIMIT 1'
  );
  const ensWeights: EnsembleWeights = ensRow[0] ? {
    pillar: ensRow[0].pillar_mult, bayesian: ensRow[0].bayesian,
    elo: ensRow[0].elo, monteCarlo: ensRow[0].monte_carlo,
  } : { ...DEFAULT_WEIGHTS };

  const methodProbs: MethodProbs = {
    pillar: probPillar, bayesian: probBayesian, elo: probElo, monteCarlo: mc.mean,
  };
  const finalProb = ensemble(methodProbs, ensWeights);
  const weaknesses = findWeaknesses(subs, 3, pillarWeights, subWeights);

  return {
    subWeights, pillarWeights, pillarScores, methodProbs,
    finalProb, mc, weaknesses, prior, records, ensWeights,
  };
}
