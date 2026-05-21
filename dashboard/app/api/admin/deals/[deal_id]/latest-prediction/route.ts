import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deal_id } = await params;
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, sub_scores, pillar_scores, method_probs, predicted_probability, confidence_low, confidence_high, created_at
     FROM predictions WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [Number(deal_id)]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'No prediction' }, { status: 404 });
  return NextResponse.json(rows[0]);
}
