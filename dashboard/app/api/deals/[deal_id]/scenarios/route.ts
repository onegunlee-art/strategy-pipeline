import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ deal_id: string }> };

// GET /api/deals/[deal_id]/scenarios — 저장된 시나리오 목록
export async function GET(_req: NextRequest, { params }: Params) {
  const { deal_id } = await params;
  const dealId = parseInt(deal_id);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, name, actions, prob_path, revenue_path, created_by, created_at
     FROM deal_scenarios
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  );
  return NextResponse.json({ scenarios: rows });
}

// POST /api/deals/[deal_id]/scenarios — 시나리오 저장
export async function POST(req: NextRequest, { params }: Params) {
  const { deal_id } = await params;
  const dealId = parseInt(deal_id);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const body = await req.json();
  const { name, actions, prob_path, revenue_path, created_by } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO deal_scenarios (deal_id, name, actions, prob_path, revenue_path, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [dealId, name,
     JSON.stringify(actions ?? []),
     JSON.stringify(prob_path ?? []),
     JSON.stringify(revenue_path ?? []),
     created_by ?? null]
  );
  return NextResponse.json({ id: rows[0].id, created_at: rows[0].created_at });
}

// DELETE /api/deals/[deal_id]/scenarios?id=123 — 시나리오 삭제
export async function DELETE(req: NextRequest, { params }: Params) {
  const { deal_id } = await params;
  const dealId = parseInt(deal_id);
  const scenarioId = parseInt(req.nextUrl.searchParams.get('id') ?? '');
  if (isNaN(dealId) || isNaN(scenarioId)) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  const db = await getDb();
  await db.query('DELETE FROM deal_scenarios WHERE id = $1 AND deal_id = $2', [scenarioId, dealId]);
  return NextResponse.json({ ok: true });
}
