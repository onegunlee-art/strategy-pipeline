// Monte Carlo Simulation — 변수 불확실성 정량화
// 각 sub-factor에 정규분포 noise 추가 후 pillar mult로 10,000회 확률 분포 도출

import { SubScores, SUB_FACTORS, pillarMultiplication, pillarScoreFromSubs, PillarId, SubFactorId } from './pillars';

export interface MonteCarloResult {
  mean: number;        // 평균 확률
  median: number;
  p5: number;          // 5th percentile
  p95: number;         // 95th percentile
  std: number;
  distribution: number[];  // 100 bin 히스토그램 (각 bin의 개수)
}

// Box-Muller 변환으로 정규분포 샘플
function gaussianSample(mean: number, std: number): number {
  let u1 = Math.random();
  if (u1 < 1e-10) u1 = 1e-10;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export interface MonteCarloOptions {
  iterations?: number;
  subFactorStd?: number;  // 각 sub-factor noise σ (1.0 = ±1점)
  pillarWeights?: Partial<Record<PillarId, number>>;
  subWeights?: Partial<Record<SubFactorId, number>>;
  voterSpread?: number;   // voting 평균 spread — sigma 보정에 사용
}

// Voting spread → MC sigma 변환: baseSigma + averageSpread * 0.25
export function sigmaFromVoterSpread(baseSigma: number, voterSpread: number): number {
  return baseSigma + voterSpread * 0.25;
}

export function monteCarloRun(subs: SubScores, opts: MonteCarloOptions = {}): MonteCarloResult {
  const iterations = opts.iterations ?? 10000;
  const baseSigma = opts.subFactorStd ?? 1.0;
  const sigma = opts.voterSpread != null
    ? sigmaFromVoterSpread(baseSigma, opts.voterSpread)
    : baseSigma;

  const results: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const noisy: SubScores = {} as SubScores;
    for (const f of SUB_FACTORS) {
      const raw = subs[f.id] ?? 5;
      noisy[f.id] = Math.max(1, Math.min(10, gaussianSample(raw, sigma)));
    }
    const pillars = pillarScoreFromSubs(noisy, opts.subWeights);
    results[i] = pillarMultiplication(pillars, opts.pillarWeights);
  }

  results.sort((a, b) => a - b);
  const mean = results.reduce((a, b) => a + b, 0) / iterations;
  const median = results[Math.floor(iterations / 2)];
  const p5 = results[Math.floor(iterations * 0.05)];
  const p95 = results[Math.floor(iterations * 0.95)];
  const variance = results.reduce((s, v) => s + (v - mean) ** 2, 0) / iterations;
  const std = Math.sqrt(variance);

  // 100 bin 히스토그램
  const bins = 100;
  const distribution = new Array(bins).fill(0);
  for (const v of results) {
    const idx = Math.min(bins - 1, Math.floor(v * bins));
    distribution[idx]++;
  }

  return { mean, median, p5, p95, std, distribution };
}
