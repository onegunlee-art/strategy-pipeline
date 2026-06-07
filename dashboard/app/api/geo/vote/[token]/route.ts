import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { aggregate } from '@/lib/geoAggregate';
import { isVoterRole } from '@/lib/voteWeights';

export async function POST(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const { token } = ctx.params;
    const { cardId, voterName, voterRole } = await req.json() as {
      cardId: number; voterName?: string; voterRole?: string;
    };

    if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

    // 데모: 잘못되거나 누락된 역할은 reviewer(1.0×)로 폴백
    const role = voterRole && isVoterRole(voterRole) ? voterRole : 'reviewer';
    const name = (voterName ?? '').trim() || null;

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
      `INSERT INTO geo_votes (session_id, card_id, voter_name, voter_role)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, cardId, name, role]
    );

    const agg = await aggregate(db, sessionId);
    return NextResponse.json(agg);
  } catch (e) {
    console.error('[geo/vote]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
