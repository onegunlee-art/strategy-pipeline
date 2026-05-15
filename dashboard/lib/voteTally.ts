// Voting 집계 — Role weight + Factor expertise bonus + Spread + Conflict
import { getDb } from './db';
import { SUB_FACTORS, SubScores, SubFactorId } from './pillars';
import { ROLE_WEIGHTS, ROLE_FACTOR_BONUS, isVoterRole, VoterRole } from './voteWeights';
import { detectConflicts, ConflictWarning, VoteEntry } from './voteSpread';

// v0.3 호환 (기존 사용처)
export const ROLE_DEFAULT_WEIGHTS: Record<string, number> = {
  leader: 2.0,
  reviewer: 1.5,
  member: 1.0,
};

export interface TallyResult {
  subs: SubScores;
  spread: Record<SubFactorId, number>;
  averageSpread: number;
  voterCount: number;
  voteCount: number;
  conflicts: ConflictWarning[];
  heatmap: HeatmapRow[];
}

export interface HeatmapRow {
  voter_id: number;
  voter_name: string;
  role: string;
  scores: Partial<Record<SubFactorId, number>>;
}

function stdev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

function v1Role(legacyRole: string): VoterRole {
  // v0.3 role(leader/reviewer/member)을 v1 role로 매핑
  if (isVoterRole(legacyRole)) return legacyRole;
  if (legacyRole === 'leader') return 'sales_rep';
  return 'reviewer';
}

export async function tallyVotes(dealId: number): Promise<TallyResult> {
  const db = await getDb();
  const { rows } = await db.query<{
    sub_factor_id: SubFactorId;
    score: number;
    legacy_weight: number;
    role: string;
    role_v1: string | null;
    voter_id: number;
    display_name: string;
  }>(
    `SELECT v.sub_factor_id, v.score,
            vt.weight as legacy_weight, vt.role, vt.role_v1,
            vt.id as voter_id, vt.display_name
     FROM votes v
     JOIN voters vt ON v.voter_id = vt.id
     WHERE vt.deal_id = $1`,
    [dealId]
  );

  const acc: Record<string, { wsum: number; wTotal: number; vals: number[] }> = {};
  const voterIds = new Set<number>();
  const entries: VoteEntry[] = [];
  const heatmapMap = new Map<number, HeatmapRow>();

  for (const r of rows) {
    voterIds.add(r.voter_id);
    // v1 role 우선 (role_v1 → role → 기본 reviewer)
    const role = v1Role(r.role_v1 ?? r.role);
    const meta = SUB_FACTORS.find(f => f.id === r.sub_factor_id);
    const bonus = meta ? (ROLE_FACTOR_BONUS[role][meta.pillar] ?? 1.0) : 1.0;
    const w = ROLE_WEIGHTS[role] * bonus;

    const a = acc[r.sub_factor_id] ?? (acc[r.sub_factor_id] = { wsum: 0, wTotal: 0, vals: [] });
    a.wsum += r.score * w;
    a.wTotal += w;
    a.vals.push(r.score);

    entries.push({
      role,
      subFactorId: r.sub_factor_id,
      score: r.score,
      voterName: r.display_name,
    });

    const hm = heatmapMap.get(r.voter_id) ?? {
      voter_id: r.voter_id, voter_name: r.display_name, role, scores: {},
    };
    hm.scores[r.sub_factor_id] = r.score;
    heatmapMap.set(r.voter_id, hm);
  }

  const subs: Partial<SubScores> = {};
  const spread: Partial<Record<SubFactorId, number>> = {};
  for (const f of SUB_FACTORS) {
    const a = acc[f.id];
    if (!a || a.wTotal === 0) {
      subs[f.id] = 5;
      spread[f.id] = 0;
    } else {
      subs[f.id] = a.wsum / a.wTotal;
      spread[f.id] = stdev(a.vals);
    }
  }
  const spreadVals = Object.values(spread).filter(v => v != null) as number[];
  const averageSpread = spreadVals.length > 0
    ? spreadVals.reduce((a, b) => a + b, 0) / spreadVals.length
    : 0;

  const conflicts = detectConflicts(entries, 4);

  return {
    subs: subs as SubScores,
    spread: spread as Record<SubFactorId, number>,
    averageSpread,
    voterCount: voterIds.size,
    voteCount: rows.length,
    conflicts,
    heatmap: Array.from(heatmapMap.values()),
  };
}
