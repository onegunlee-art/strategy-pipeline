// 외부 리서치 API — 특정 topic 호출 또는 캐시 조회
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchResearch, ResearchTopic } from '@/lib/research';

export async function POST(req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const body = (await req.json()) as { topic: ResearchTopic };
    if (!body.topic) {
      return NextResponse.json({ error: 'topic 필드 필수' }, { status: 400 });
    }
    const db = await getDb();
    const result = await fetchResearch(db, dealId, body.topic);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT topic, source, result_text, result_json, created_at
       FROM external_research WHERE deal_id=$1 ORDER BY created_at DESC`,
      [dealId]
    );
    return NextResponse.json({ ok: true, research: rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
