import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        d.id,
        d.client_name,
        d.deal_size,
        d.created_at,
        p.predicted_probability,
        p.variables_json,
        p.weights_used_json,
        o.actual_result,
        o.closed_at
      FROM deals d
      LEFT JOIN predictions p ON p.deal_id = d.id
      LEFT JOIN outcomes o ON o.deal_id = d.id
      ORDER BY d.created_at DESC
    `).all();

    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
