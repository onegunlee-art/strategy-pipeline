import { Pool } from 'pg';
import { ROLE_WEIGHTS, VoterRole } from './voteWeights';
import { GeoDriver, computeGeoProb, normalizeDriverMeta, FALLBACK_DRIVER_META } from './geoDrivers';

export interface GeoAggregateResult {
  drivers: Record<string, number>;
  driverMeta: GeoDriver[];
  geoProb: number;
  priorProb: number;
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
  // base driver_scores + driver_meta from session
  const { rows: sessionRows } = await pool.query(
    `SELECT driver_scores, driver_meta, prior_prob, geo_prob FROM geo_sessions WHERE id = $1`,
    [sessionId]
  );
  // 동적 드라이버 메타. 없으면(레거시/시드) 범용 fallback.
  const driverMeta: GeoDriver[] = sessionRows[0]?.driver_meta
    ? normalizeDriverMeta(sessionRows[0].driver_meta)
    : FALLBACK_DRIVER_META;
  // base 점수: 없으면 메타 키 기준 중립값(5)으로 채운다 (이란 기본값 제거).
  const base: Record<string, number> = sessionRows[0]?.driver_scores
    ?? Object.fromEntries(driverMeta.map(m => [m.key, 5]));
  const priorProb: number = sessionRows[0]?.prior_prob ?? sessionRows[0]?.geo_prob ?? 50;

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

  // Bayesian updating: AI prior = PRIOR_STRENGTH표짜리 가중치로 취급.
  // posterior[key] = prior[key] + Σ(delta×w) / (PRIOR_STRENGTH + totalVoteWeight)
  // 효과: 초기엔 AI 판단이 지배 → 투표 누적될수록 집단 신호 반영.
  // 1표(w=1) 최대 확률 이동 ≈ 10/(PRIOR_STRENGTH+1) % = ~0.9% (< 2%)
  const PRIOR_STRENGTH = 10;

  const totalVoteWeight = Object.values(weightedCounts).reduce((a, b) => a + b, 0);

  // 드라이버별 투표 가중합 델타 계산
  const voteWeightedDelta: Record<string, number> = Object.fromEntries(
    Object.keys(base).map(key => [key, 0])
  );
  for (const [cardIdStr, deltas] of Object.entries(deltasByCard)) {
    const w = weightedCounts[Number(cardIdStr)] ?? 0;
    for (const [key, delta] of Object.entries(deltas)) {
      if (key in voteWeightedDelta) {
        voteWeightedDelta[key] += (delta as number) * w;
      }
    }
  }

  // Bayesian posterior
  const accumulated: Record<string, number> = {};
  for (const key of Object.keys(base)) {
    const posterior = base[key] + voteWeightedDelta[key] / (PRIOR_STRENGTH + totalVoteWeight);
    accumulated[key] = clamp(0, 10, posterior);
  }

  const geoProb = computeGeoProb(driverMeta, accumulated);

  return { drivers: accumulated, driverMeta, geoProb, priorProb, totalVotes, voteCounts, roleCounts };
}
