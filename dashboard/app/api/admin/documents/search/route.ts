import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { searchChunks } from '@/lib/rag/search';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const query = body.query as string | undefined;
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }
  try {
    const hits = await searchChunks(query, {
      doc_type: body.doc_type,
      customer: body.customer,
      industry: body.industry,
      deal_id: body.deal_id,
      match_count: body.match_count ?? 5,
    });
    return NextResponse.json({ hits });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'search failed', detail: msg }, { status: 500 });
  }
}
