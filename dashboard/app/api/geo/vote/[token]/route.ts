import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';
import { isVoterRole } from '@/lib/voteWeights';

export async function POST(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const { token } = ctx.params;
    const body = await req.json() as {
      cardIds?: number[]; cardId?: number; voterName?: string; voterRole?: string;
    };

    // Accept both cardIds[] (multi-select) and legacy cardId (single)
    const ids: number[] = body.cardIds ?? (body.cardId ? [body.cardId] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'cardIds required' }, { status: 400 });
    if (ids.length < 2) return NextResponse.json({ error: 'minimum 2 cards required' }, { status: 400 });

    const role = body.voterRole && isVoterRole(body.voterRole) ? body.voterRole : 'reviewer';
    const name = (body.voterName ?? '').trim() || null;

    const db = await getDb();

    const { rows } = await db.query(
      `SELECT id FROM geo_sessions WHERE token = $1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'session not found' }, { status: 404 });

    const sessionId: number = rows[0].id;

    // Verify all cards belong to this session in one query
    const { rows: cardCheck } = await db.query(
      `SELECT id FROM geo_signal_cards WHERE id = ANY($1::int[]) AND session_id = $2`,
      [ids, sessionId]
    );
    if (cardCheck.length !== ids.length) {
      return NextResponse.json({ error: 'one or more cards not found' }, { status: 404 });
    }

    // Insert one vote row per card (independent weighted accumulation)
    for (const cardId of ids) {
      await db.query(
        `INSERT INTO geo_votes (session_id, card_id, voter_name, voter_role)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, cardId, name, role]
      );
    }

    const agg = await aggregate(db, sessionId);
    return NextResponse.json(agg);
  } catch (e) {
    console.error('[geo/vote]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
