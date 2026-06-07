import { Pool } from 'pg';
import { ROLE_WEIGHTS, VoterRole } from './voteWeights';

export interface GeoAggregateResult {
  drivers: Record<string, number>;
  geoProb: number;
  totalVotes: number;
  voteCounts: Record<number, number>; // cardId → headcount
  roleCounts: Record<string, number>; // voterRole → headcount
}

function roleWeight(role: string | null): number {
  return role && role in ROLE_WEIGHTS ? ROLE_WEIGHTS[role as VoterRole] : 1.0;
}

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

export async function aggregate(pool: Pool, sessionId: number): Promise<GeoAggregateResult> {
  // base driver_scores from session
  const { rows: sessionRows } = await pool.query(
    `SELECT driver_scores FROM geo_sessions WHERE id = $1`,
    [sessionId]
  );
  const base: Record<string, number> = sessionRows[0]?.driver_scores ?? {
    외교채널: 2, 군사강도: 8, 경제압박: 8, 이란내부: 3, 호르무즈: 7,
  };

  // cards with per-role vote counts (역할 가중치 집계용)
  const { rows: voteRows } = await pool.query(
    `SELECT c.id, c.driver_deltas, v.voter_role,
            COUNT(v.id)::integer AS cnt
     FROM geo_signal_cards c
     LEFT JOIN geo_votes v ON v.card_id = c.id
     WHERE c.session_id = $1
     GROUP BY c.id, c.driver_deltas, v.voter_role
     ORDER BY c.id`,
    [sessionId]
  );

  const voteCounts: Record<number, number> = {};       // 표시용 headcount
  const weightedCounts: Record<number, number> = {};    // delta 누적용 가중합
  const roleCounts: Record<string, number> = {};        // 역할별 참여자 수
  const deltasByCard: Record<number, Record<string, number>> = {};
  let totalVotes = 0;

  for (const row of voteRows) {
    const cardId = row.id as number;
    const cnt = row.cnt as number;
    deltasByCard[cardId] = row.driver_deltas ?? {};
    voteCounts[cardId] = voteCounts[cardId] ?? 0;
    weightedCounts[cardId] = weightedCounts[cardId] ?? 0;

    // voter_role이 null이면 실제 투표가 없는 카드(LEFT JOIN) → cnt=0
    if (cnt > 0 && row.voter_role !== null) {
      voteCounts[cardId] += cnt;
      weightedCounts[cardId] += cnt * roleWeight(row.voter_role);
      roleCounts[row.voter_role] = (roleCounts[row.voter_role] ?? 0) + cnt;
      totalVotes += cnt;
    } else if (cnt > 0 && row.voter_role === null) {
      // 레거시 익명 표(역할 미기록) → 기본 가중치 1.0
      voteCounts[cardId] += cnt;
      weightedCounts[cardId] += cnt * 1.0;
      roleCounts['미지정'] = (roleCounts['미지정'] ?? 0) + cnt;
      totalVotes += cnt;
    }
  }

  // accumulated deltas (가중합 기반)
  const accumulated: Record<string, number> = { ...base };
  for (const [cardIdStr, deltas] of Object.entries(deltasByCard)) {
    const w = weightedCounts[Number(cardIdStr)] ?? 0;
    for (const [key, delta] of Object.entries(deltas)) {
      if (key in accumulated) {
        accumulated[key] = clamp(0, 10, accumulated[key] + (delta as number) * w);
      }
    }
  }

  const d = accumulated;
  const raw = (d['외교채널'] + (10 - d['군사강도']) + (10 - d['경제압박']) + d['이란내부'] + (10 - d['호르무즈'])) / 5 * 10;
  const geoProb = clamp(5, 95, Math.round(raw));

  return { drivers: accumulated, geoProb, totalVotes, voteCounts, roleCounts };
}
