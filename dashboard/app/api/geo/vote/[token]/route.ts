import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';

export async function POST(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const { token } = ctx.params;
    const { cardId } = await req.json() as { cardId: number };

    if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

    const db = await getDb();

    const { rows } = await db.query(
      `SELECT id FROM geo_sessions WHERE token = $1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 });

    const sessionId: number = rows[0].id;

    // Verify card belongs to session
    const { rows: cardCheck } = await db.query(
      `SELECT id FROM geo_signal_cards WHERE id = $1 AND session_id = $2`,
      [cardId, sessionId]
    );
    if (cardCheck.length === 0) return NextResponse.json({ error: 'card not found' }, { status: 404 });

    await db.query(
      `INSERT INTO geo_votes (session_id, card_id) VALUES ($1, $2)`,
      [sessionId, cardId]
    );

    const agg = await aggregate(db, sessionId);
    return NextResponse.json(agg);
  } catch (e) {
    console.error('[geo/vote]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
