import { Pool } from 'pg';

export interface GeoAggregateResult {
  drivers: Record<string, number>;
  geoProb: number;
  totalVotes: number;
  voteCounts: Record<number, number>; // cardId → count
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

  // cards with vote counts
  const { rows: cardRows } = await pool.query(
    `SELECT c.id, c.driver_deltas,
            COUNT(v.id)::integer AS vote_count
     FROM geo_signal_cards c
     LEFT JOIN geo_votes v ON v.card_id = c.id
     WHERE c.session_id = $1
     GROUP BY c.id, c.driver_deltas`,
    [sessionId]
  );

  const voteCounts: Record<number, number> = {};
  let totalVotes = 0;

  // accumulated deltas
  const accumulated: Record<string, number> = { ...base };

  for (const card of cardRows) {
    const count = card.vote_count as number;
    voteCounts[card.id as number] = count;
    totalVotes += count;

    const deltas: Record<string, number> = card.driver_deltas ?? {};
    for (const [key, delta] of Object.entries(deltas)) {
      if (key in accumulated) {
        accumulated[key] = clamp(0, 10, accumulated[key] + (delta as number) * count);
      }
    }
  }

  const d = accumulated;
  const raw = (d['외교채널'] + (10 - d['군사강도']) + (10 - d['경제압박']) + d['이란내부'] + (10 - d['호르무즈'])) / 5 * 10;
  const geoProb = clamp(5, 95, Math.round(raw));

  return { drivers: accumulated, geoProb, totalVotes, voteCounts };
}
