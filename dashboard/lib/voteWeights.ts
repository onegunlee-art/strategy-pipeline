// Voting v1 — Role weight + Factor expertise bonus
import type { PillarId, SubFactorId } from './pillars';
import { SUB_FACTORS } from './pillars';

export type VoterRole = 'executive' | 'sales_rep' | 'proposal_pm' | 'bm' | 'pmo' | 'reviewer';

export const ROLE_WEIGHTS: Record<VoterRole, number> = {
  executive: 2.5,
  sales_rep: 2.3,
  proposal_pm: 2.0,
  bm: 1.8,
  pmo: 1.6,
  reviewer: 1.0,
};

export const ROLE_LABEL: Record<VoterRole, string> = {
  executive: '임원',
  sales_rep: '영업대표',
  proposal_pm: '제안 PM',
  bm: 'BM',
  pmo: 'PMO',
  reviewer: '검토자',
};

// 역할별 pillar 보정 — 영업대표 V 1.3, BM P 1.5, PMO E 1.3 등
export const ROLE_FACTOR_BONUS: Record<VoterRole, Partial<Record<PillarId, number>>> = {
  sales_rep:   { V: 1.3, P: 1.0, D: 1.0, E: 0.9 },
  proposal_pm: { V: 1.0, P: 1.0, D: 1.1, E: 1.4 },
  bm:          { V: 1.0, P: 1.5, D: 1.0, E: 1.0 },
  pmo:         { V: 1.0, P: 1.0, D: 1.0, E: 1.3 },
  executive:   { V: 1.2, P: 1.1, D: 1.1, E: 1.1 },
  reviewer:    { V: 1.0, P: 1.0, D: 1.0, E: 1.0 },
};

export function isVoterRole(s: string): s is VoterRole {
  return s in ROLE_WEIGHTS;
}

export function effectiveWeight(role: VoterRole, subFactorId: SubFactorId): number {
  const f = SUB_FACTORS.find(x => x.id === subFactorId);
  if (!f) return ROLE_WEIGHTS[role];
  const bonus = ROLE_FACTOR_BONUS[role][f.pillar] ?? 1.0;
  return ROLE_WEIGHTS[role] * bonus;
}
