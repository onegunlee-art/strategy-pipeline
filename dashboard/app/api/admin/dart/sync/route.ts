import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { syncFilings } from '@/lib/dart/enricher';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const results = await syncFilings({
      corp_code: body.corp_code,
      customer_name: body.customer_name,
      days: body.days ?? 90,
      skip_summary: body.skip_summary ?? false,
    });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'sync failed', detail: msg }, { status: 500 });
  }
}
