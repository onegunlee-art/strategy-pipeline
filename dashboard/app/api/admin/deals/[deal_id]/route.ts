import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

const ALLOWED = new Set([
  'partners', 'risks', 'milestones', 'competitive_positioning',
  'execution_unit', 'pm', 'duration_months', 'industry', 'deal_size',
  'client_name', 'due_date',
  'importance_stars', 'bid_timeline', 'team_size', 'team_members',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { deal_id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    sets.push(`${k} = $${i++}`);
    values.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
  }
  if (sets.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  values.push(Number(deal_id));
  const db = await getDb();
  await db.query(`UPDATE deals SET ${sets.join(', ')} WHERE id = $${i}`, values);
  return NextResponse.json({ ok: true });
}
