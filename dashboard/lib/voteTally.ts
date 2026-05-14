// 역할 가중평균으로 votes 집계 → SubScores 계산
import { getDb } from './db';
import { SUB_FACTORS, SubScores, SubFactorId } from './pillars';

export const ROLE_DEFAULT_WEIGHTS: Record<string, number> = {
  leader: 2.0,
  reviewer: 1.5,
  member: 1.0,
};

export interface TallyResult {
  subs: SubScores;
  spread: Record<SubFactorId, number>;
  voterCount: number;
  voteCount: number;
}

function stdev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
}

export async function tallyVotes(dealId: number): Promise<TallyResult> {
  const db = await getDb();
  const { rows } = await db.query<{
    sub_factor_id: string; score: number; weight: number; voter_id: number;
  }>(
    `SELECT v.sub_factor_id, v.score, vt.weight, vt.id as voter_id
     FROM votes v
     JOIN voters vt ON v.voter_id = vt.id
     WHERE vt.deal_id = $1`,
    [dealId]
  );

  const acc: Record<string, { wsum: number; wTotal: number; vals: number[] }> = {};
  const voterIds = new Set<number>();

  for (const r of rows) {
    voterIds.add(r.voter_id);
    const a = acc[r.sub_factor_id] ?? (acc[r.sub_factor_id] = { wsum: 0, wTotal: 0, vals: [] });
    a.wsum += r.score * r.weight;
    a.wTotal += r.weight;
    a.vals.push(r.score);
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

  return {
    subs: subs as SubScores,
    spread: spread as Record<SubFactorId, number>,
    voterCount: voterIds.size,
    voteCount: rows.length,
  };
}
