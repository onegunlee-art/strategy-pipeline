import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';

export async function GET(_req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const { token } = ctx.params;
    const db = await getDb();

    const { rows } = await db.query(
      `SELECT id, topic, driver_scores, geo_prob, hypothesis, strategy_low, strategy_mid, strategy_high, prior_prob, facts FROM geo_sessions WHERE token = $1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 });

    const session = rows[0];
    const sessionId: number = session.id;

    const { rows: cardRows } = await db.query(
      `SELECT id, label, description, driver_deltas, direction, evidence FROM geo_signal_cards WHERE session_id = $1 ORDER BY id`,
      [sessionId]
    );

    const agg = await aggregate(db, sessionId);

    return NextResponse.json({
      sessionId,
      topic: session.topic,
      baseGeoProb: session.geo_prob,
      cards: cardRows,
      hypothesis: session.hypothesis ?? '',
      strategyLow: session.strategy_low ?? '',
      strategyMid: session.strategy_mid ?? '',
      strategyHigh: session.strategy_high ?? '',
      facts: session.facts ?? [],
      ...agg,
    });
  } catch (e) {
    console.error('[geo/session]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
