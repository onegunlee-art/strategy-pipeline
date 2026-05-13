// Bayesian Update — 과거 base rate(prior) + 현재 evidence
// P(win | evidence) = P(evidence | win) × P(win) / P(evidence)

import { SubScores, SUB_FACTORS } from './pillars';

export const DEFAULT_PRIOR = 0.28;  // 일반적 B2B 수주율 (데이터 없을 때)

// 핵심 식: odds × likelihood ratio
export function bayesianPosterior(prior: number, likelihoodRatio: number): number {
  const p = Math.max(0.001, Math.min(0.999, prior));
  const priorOdds = p / (1 - p);
  const postOdds = priorOdds * likelihoodRatio;
  return postOdds / (1 + postOdds);
}

// 과거 데이터에서 sub-factor별 win/loss 평균 점수 차이를 normal-CDF로 LR 변환
// records: 과거 딜의 sub-factor 점수 + actual_result (0/1)
export interface HistoricalRecord {
  subs: Partial<SubScores>;
  actual: 0 | 1;
}

export interface LikelihoodTable {
  // 각 sub-factor별: win 그룹 평균/표준편차, loss 그룹 평균/표준편차
  [key: string]: { winMean: number; winStd: number; lossMean: number; lossStd: number };
}

export function buildLikelihoodTable(records: HistoricalRecord[]): LikelihoodTable {
  const table: LikelihoodTable = {};
  for (const f of SUB_FACTORS) {
    const wins: number[] = [], losses: number[] = [];
    for (const r of records) {
      const v = r.subs[f.id];
      if (v == null) continue;
      (r.actual === 1 ? wins : losses).push(v);
    }
    table[f.id] = {
      winMean: mean(wins, 5), winStd: std(wins, 2),
      lossMean: mean(losses, 5), lossStd: std(losses, 2),
    };
  }
  return table;
}

function mean(arr: number[], fallback: number): number {
  return arr.length === 0 ? fallback : arr.reduce((a, b) => a + b, 0) / arr.length;
}
function std(arr: number[], fallback: number): number {
  if (arr.length < 2) return fallback;
  const m = mean(arr, 0);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

// 정규분포 PDF
function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / Math.max(0.1, sigma);
  return Math.exp(-0.5 * z * z) / (Math.max(0.1, sigma) * Math.sqrt(2 * Math.PI));
}

// 현재 sub-factor 점수들로 LR 계산: ∏ P(score | win) / P(score | loss)
// log-space로 곱셈하여 overflow 방지
export function computeLikelihoodRatio(
  subs: SubScores,
  table: LikelihoodTable
): number {
  let logLR = 0;
  for (const f of SUB_FACTORS) {
    const entry = table[f.id];
    if (!entry) continue;
    const v = subs[f.id];
    if (v == null) continue;
    const pWin = normalPdf(v, entry.winMean, entry.winStd);
    const pLoss = normalPdf(v, entry.lossMean, entry.lossStd);
    if (pWin <= 0 || pLoss <= 0) continue;
    logLR += Math.log(pWin / pLoss);
  }
  // clip to avoid extreme values
  return Math.exp(Math.max(-5, Math.min(5, logLR)));
}

// 통합: prior + 현재 점수 + table → posterior
export function bayesianProbability(
  subs: SubScores,
  table: LikelihoodTable | null,
  prior: number = DEFAULT_PRIOR
): number {
  if (!table || Object.keys(table).length === 0) {
    // 데이터 없으면 prior 그대로
    return prior;
  }
  const lr = computeLikelihoodRatio(subs, table);
  return bayesianPosterior(prior, lr);
}

// 과거 데이터에서 base rate (단순 win 비율)
export function computeBaseRate(records: HistoricalRecord[]): number {
  if (records.length === 0) return DEFAULT_PRIOR;
  const wins = records.filter(r => r.actual === 1).length;
  // Laplace smoothing (won + 1) / (total + 2)
  return (wins + 1) / (records.length + 2);
}
