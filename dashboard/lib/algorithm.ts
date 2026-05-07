export interface Variables {
  decision_maker_access: number;
  past_win_history: number;
  price_competitiveness: number;
  tech_differentiation: number;
  lg_cns_threat: number;
  samsung_sds_threat: number;
  budget_confirmed: number;
}

export interface WeightMap {
  [key: string]: number;
}

export const VARIABLE_META: Record<
  keyof Variables,
  { label: string; invert: boolean; defaultWeight: number }
> = {
  decision_maker_access: { label: '의사결정자 접근', invert: false, defaultWeight: 0.22 },
  past_win_history: { label: '과거 수주 이력', invert: false, defaultWeight: 0.15 },
  price_competitiveness: { label: '가격 경쟁력', invert: false, defaultWeight: 0.18 },
  tech_differentiation: { label: '기술 차별화', invert: false, defaultWeight: 0.13 },
  lg_cns_threat: { label: 'LG CNS 위협도', invert: true, defaultWeight: 0.14 },
  samsung_sds_threat: { label: 'Samsung SDS 위협도', invert: true, defaultWeight: 0.10 },
  budget_confirmed: { label: '예산 확정 여부', invert: false, defaultWeight: 0.08 },
};

export function calculateProbability(vars: Variables, weights: WeightMap): number {
  let score = 0;
  let totalWeight = 0;

  for (const key of Object.keys(vars) as (keyof Variables)[]) {
    const meta = VARIABLE_META[key];
    const w = weights[key] ?? meta.defaultWeight;
    const raw = vars[key]; // 1-10
    const normalized = meta.invert ? (11 - raw) / 10 : raw / 10;
    score += normalized * w;
    totalWeight += w;
  }

  const raw = totalWeight > 0 ? score / totalWeight : 0;

  // Logistic squish to avoid extremes
  const logit = (raw - 0.5) * 6;
  const probability = 1 / (1 + Math.exp(-logit));

  return Math.round(probability * 1000) / 10;
}

export function brierScore(predicted: number, actual: number): number {
  const p = predicted / 100;
  return Math.pow(p - actual, 2);
}
