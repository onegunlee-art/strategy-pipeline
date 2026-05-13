import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { deal_id, actual_result } = await req.json() as {
      deal_id: number;
      actual_result: 0 | 1;
    };

    const db = await getDb();
    await db.query('INSERT INTO outcomes (deal_id, actual_result) VALUES ($1, $2)', [
      deal_id,
      actual_result,
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
