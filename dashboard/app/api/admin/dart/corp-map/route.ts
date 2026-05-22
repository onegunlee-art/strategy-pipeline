import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { listCorpMap, upsertCorpMap } from '@/lib/dart/entityResolver';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const corps = await listCorpMap();
  return NextResponse.json({ corps });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const corp_code = (body.corp_code as string | undefined)?.trim();
  const corp_name = (body.corp_name as string | undefined)?.trim();
  if (!corp_code || !corp_name) {
    return NextResponse.json({ error: 'corp_code and corp_name are required' }, { status: 400 });
  }
  const aliases = Array.isArray(body.aliases) ? body.aliases.filter(Boolean) : [];
  const row = await upsertCorpMap({
    corp_code,
    corp_name,
    aliases,
    is_listed: body.is_listed ?? true,
    industry: body.industry ?? null,
  });
  return NextResponse.json({ ok: true, corp: row });
}
