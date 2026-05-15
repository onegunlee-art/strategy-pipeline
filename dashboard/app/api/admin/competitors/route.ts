import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

// GET /api/admin/competitors — 전체 경쟁사 목록
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, name, current_elo, match_count FROM competitors ORDER BY current_elo DESC`
  );
  return NextResponse.json(rows);
}

// PUT /api/admin/competitors — Elo 수동 업데이트 (어드민 AI 추정값 채택 시)
export async function PUT(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, current_elo } = await req.json();
  if (!id || current_elo == null) return NextResponse.json({ error: 'id and current_elo required' }, { status: 400 });
  const db = await getDb();
  await db.query(
    `UPDATE competitors SET current_elo = $2 WHERE id = $1`,
    [id, current_elo]
  );
  return NextResponse.json({ ok: true });
}
