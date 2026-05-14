import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
import { randomBytes } from 'crypto';

function generateToken(): string {
  return randomBytes(10).toString('hex'); // 20-char hex token
}

// GET /api/admin/voting-links — list all links with deal info
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT vl.*, d.client_name, d.deal_size, d.due_date,
           COUNT(DISTINCT vt.id)::int as voter_count
    FROM voting_links vl
    JOIN deals d ON d.id = vl.deal_id
    LEFT JOIN voters vt ON vt.deal_id = vl.deal_id
    GROUP BY vl.deal_id, vl.token, vl.closes_at, vl.created_at, d.client_name, d.deal_size, d.due_date
    ORDER BY vl.created_at DESC
  `);
  return NextResponse.json(rows);
}

// POST /api/admin/voting-links — create or regenerate link for a deal
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deal_id, closes_at } = await req.json();
  if (!deal_id) return NextResponse.json({ error: 'deal_id 필수' }, { status: 400 });

  const db = await getDb();
  const token = generateToken();

  const { rows } = await db.query(
    `INSERT INTO voting_links (deal_id, token, closes_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (deal_id) DO UPDATE SET token = $2, closes_at = $3, created_at = NOW()
     RETURNING *`,
    [deal_id, token, closes_at ?? null]
  );
  return NextResponse.json(rows[0]);
}

// DELETE /api/admin/voting-links — remove link (closes voting)
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deal_id } = await req.json();
  const db = await getDb();
  await db.query('DELETE FROM voting_links WHERE deal_id = $1', [deal_id]);
  return NextResponse.json({ ok: true });
}
