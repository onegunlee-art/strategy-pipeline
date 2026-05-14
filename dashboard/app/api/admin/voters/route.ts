import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

// GET /api/admin/voters?deal_id=123
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dealId = req.nextUrl.searchParams.get('deal_id');
  const db = await getDb();

  const { rows } = dealId
    ? await db.query(
        `SELECT vt.*, COUNT(v.sub_factor_id)::int as vote_count
         FROM voters vt
         LEFT JOIN votes v ON v.voter_id = vt.id
         WHERE vt.deal_id = $1
         GROUP BY vt.id ORDER BY vt.created_at DESC`,
        [dealId]
      )
    : await db.query(
        `SELECT vt.*, COUNT(v.sub_factor_id)::int as vote_count
         FROM voters vt
         LEFT JOIN votes v ON v.voter_id = vt.id
         GROUP BY vt.id ORDER BY vt.created_at DESC`
      );
  return NextResponse.json(rows);
}

// PUT /api/admin/voters — update role/weight
export async function PUT(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { voter_id, role, weight } = await req.json();
  const db = await getDb();
  await db.query(
    'UPDATE voters SET role = COALESCE($2, role), weight = COALESCE($3, weight) WHERE id = $1',
    [voter_id, role ?? null, weight ?? null]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/voters — remove voter + their votes
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { voter_id } = await req.json();
  const db = await getDb();
  await db.query('DELETE FROM voters WHERE id = $1', [voter_id]);
  return NextResponse.json({ ok: true });
}
