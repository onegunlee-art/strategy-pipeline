// Voting v1 — Spread (stdev) + Conflict detection
import type { SubFactorId } from './pillars';
import type { VoterRole } from './voteWeights';

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface VoteEntry {
  role: VoterRole;
  subFactorId: SubFactorId;
  score: number;
  voterName: string;
}

export interface ConflictWarning {
  subFactorId: SubFactorId;
  highRole: VoterRole;
  highVoter: string;
  highScore: number;
  lowRole: VoterRole;
  lowVoter: string;
  lowScore: number;
  gap: number;
  message: string;
}

// 같은 sub-factor에 대해 역할 간 갭 >= threshold(=4) 면 충돌
export function detectConflicts(entries: VoteEntry[], gapThreshold = 4): ConflictWarning[] {
  const bySubFactor = new Map<SubFactorId, VoteEntry[]>();
  for (const e of entries) {
    const list = bySubFactor.get(e.subFactorId) ?? [];
    list.push(e);
    bySubFactor.set(e.subFactorId, list);
  }

  const warnings: ConflictWarning[] = [];
  for (const [sub, list] of bySubFactor) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.score - a.score);
    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    const gap = high.score - low.score;
    if (gap >= gapThreshold && high.role !== low.role) {
      warnings.push({
        subFactorId: sub,
        highRole: high.role,
        highVoter: high.voterName,
        highScore: high.score,
        lowRole: low.role,
        lowVoter: low.voterName,
        lowScore: low.score,
        gap,
        message: `${high.role}(${high.voterName})=${high.score} vs ${low.role}(${low.voterName})=${low.score} — 의견 ${gap}점 차이`,
      });
    }
  }
  return warnings;
}

export function spreadPerSubFactor(entries: VoteEntry[]): Record<string, number> {
  const out: Record<string, Map<SubFactorId, number[]>> = {};
  const map = new Map<SubFactorId, number[]>();
  for (const e of entries) {
    const arr = map.get(e.subFactorId) ?? [];
    arr.push(e.score);
    map.set(e.subFactorId, arr);
  }
  const result: Record<string, number> = {};
  for (const [sub, vals] of map) {
    result[sub] = stdev(vals);
  }
  void out;
  return result;
}
