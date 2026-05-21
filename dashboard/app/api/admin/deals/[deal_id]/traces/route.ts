import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deal_id } = await params;
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, stage, decision, rationale, created_at FROM decision_traces
     WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [Number(deal_id)]
  );
  return NextResponse.json(rows);
}
