import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { generateStrategy } from '@/lib/competitiveIntel';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const strategy = await generateStrategy();
  return NextResponse.json({ ok: true, strategy });
}
