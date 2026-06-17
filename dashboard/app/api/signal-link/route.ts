import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealId, dealName, data } = body;

    if (!data) return NextResponse.json({ error: 'data required' }, { status: 400 });

    const pool = await getDb();
    const { rows } = await pool.query(
      `INSERT INTO signal_links (deal_id, deal_name, data)
       VALUES ($1, $2, $3)
       RETURNING token`,
      [dealId ?? null, dealName ?? null, JSON.stringify(data)]
    );

    const token = rows[0].token;
    return NextResponse.json({ token, url: `/s/${token}` });
  } catch (err) {
    console.error('[signal-link POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  try {
    const pool = await getDb();
    const { rows } = await pool.query(
      `SELECT token, deal_name, data, created_at FROM signal_links WHERE token = $1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('[signal-link GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
