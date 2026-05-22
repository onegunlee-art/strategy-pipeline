import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { deleteCorpMap } from '@/lib/dart/entityResolver';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: { corp_code: string } }) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ok = await deleteCorpMap(params.corp_code);
  return NextResponse.json({ ok });
}
