import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length === 0) return NextResponse.json({ participants: [] });

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT name, voter_role FROM demo_participants WHERE name LIKE $1 ORDER BY name LIMIT 8`,
    [`${q}%`]
  );
  return NextResponse.json({ participants: rows });
}
