import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ deal_id: string }> };

// GET /api/deals/[deal_id]/action-log — 실행된 액션 이력
export async function GET(_req: NextRequest, { params }: Params) {
  const { deal_id } = await params;
  const dealId = parseInt(deal_id);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, action_id, taken_at, taken_by, notes,
            sub_scores_before, sub_scores_after
     FROM action_log
     WHERE deal_id = $1
     ORDER BY taken_at DESC`,
    [dealId]
  );
  return NextResponse.json({ action_log: rows });
}

// POST /api/deals/[deal_id]/action-log — 액션 실행 기록
export async function POST(req: NextRequest, { params }: Params) {
  const { deal_id } = await params;
  const dealId = parseInt(deal_id);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const body = await req.json();
  const { action_id, taken_by, notes, sub_scores_before, sub_scores_after } = body;
  if (!action_id) return NextResponse.json({ error: 'action_id required' }, { status: 400 });

  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO action_log (deal_id, action_id, taken_by, notes, sub_scores_before, sub_scores_after)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, taken_at`,
    [dealId, action_id, taken_by ?? null, notes ?? null,
     sub_scores_before ? JSON.stringify(sub_scores_before) : null,
     sub_scores_after ? JSON.stringify(sub_scores_after) : null]
  );
  return NextResponse.json({ id: rows[0].id, taken_at: rows[0].taken_at });
}
