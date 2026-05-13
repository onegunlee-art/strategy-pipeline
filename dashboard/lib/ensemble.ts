// Ensemble — 4 method 결합 + Brier minimize 학습

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

export const DEFAULT_WEIGHTS: EnsembleWeights = {
  pillar: 0.45,      // KT 4-Pillar 본질 — 가장 큰 비중
  bayesian: 0.30,    // 시장/산업 base rate — 경험치 보정
  elo: 0.20,         // 경쟁구도 — 대칭 압력
  monteCarlo: 0.05,  // 불확실성 레이어 — confidence modifier
};

export function ensemble(probs: MethodProbs, weights: EnsembleWeights = DEFAULT_WEIGHTS): number {
  const total = weights.pillar + weights.bayesian + weights.elo + weights.monteCarlo;
  if (total === 0) return 0.5;
  return (
    probs.pillar * weights.pillar +
    probs.bayesian * weights.bayesian +
    probs.elo * weights.elo +
    probs.monteCarlo * weights.monteCarlo
  ) / total;
}

// Brier minimize via grid search (간단함 우선)
// step 0.1 → 11×11×11×11 = 14641 조합, sum=1.0 제약 적용
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
      for (let c = 0; c <= 1 - a - b + 1e-9; c += step) {
        const d = 1 - a - b - c;
        if (d < -1e-9 || d > 1 + 1e-9) continue;
        const w: EnsembleWeights = { pillar: a, bayesian: b, elo: c, monteCarlo: Math.max(0, d) };
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
