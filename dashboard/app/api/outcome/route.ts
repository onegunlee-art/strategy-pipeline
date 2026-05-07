import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { deal_id, actual_result } = await req.json() as {
      deal_id: number;
      actual_result: 0 | 1;
    };

    const db = getDb();
    db.prepare('INSERT INTO outcomes (deal_id, actual_result) VALUES (?, ?)').run(
      deal_id,
      actual_result
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
