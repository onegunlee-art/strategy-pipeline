// 실데이터 기반 per-risk, per-pillar sigma 스케일 팩터
// 중심값(mean)은 변경하지 않고 sigma(CI 폭)만 조정 — Calibration 보호

import { PillarId } from './pillars';

export interface RewardFactors {
  riskSigmaScale: number;
  pillarSigmaWeights: Record<PillarId, number>;
  seedPoolHash: string;
}

export interface DealMeta {
  risk?: number;  // 1~5
}

// V pillar: 고객 접근은 외부 변수 많아 불확실성 높음
// P pillar: 가격은 상대적으로 예측 가능
export const PILLAR_SIGMA_WEIGHTS: Record<PillarId, number> = {
  V: 1.2,
  E: 1.1,
  D: 1.0,
  P: 0.8,
};

const RISK_SIGMA_MAP: Record<number, number> = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};

// 재현성 보장: 동일 pool → 동일 hash → 동일 CI 산출
function hashPool(records: object[]): string {
  const n = records.length;
  const first = n > 0 ? JSON.stringify(records[0]).slice(0, 20) : '';
  const last = n > 0 ? JSON.stringify(records[n - 1]).slice(0, 20) : '';
  return `n${n}:${first}:${last}`;
}

export function computeRewardFactors(pool: object[], dealMeta: DealMeta): RewardFactors {
  const risk = Math.min(5, Math.max(1, Math.round(dealMeta.risk ?? 3)));
  return {
    riskSigmaScale: RISK_SIGMA_MAP[risk] ?? 1.0,
    pillarSigmaWeights: PILLAR_SIGMA_WEIGHTS,
    seedPoolHash: hashPool(pool),
  };
}
