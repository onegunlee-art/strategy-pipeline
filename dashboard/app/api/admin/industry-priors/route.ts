import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';

// GET /api/admin/industry-priors — 산업별 자체 Win율
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT d.industry,
           COUNT(*) FILTER (WHERE o.actual_result = 1)::float / NULLIF(COUNT(*), 0) as win_rate,
           COUNT(*)::int as deal_count
    FROM deals d
    JOIN outcomes o ON o.deal_id = d.id
    WHERE d.industry IS NOT NULL
    GROUP BY d.industry
    ORDER BY deal_count DESC
  `);
  return NextResponse.json(rows);
}
