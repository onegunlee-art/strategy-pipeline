import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { listFilings } from '@/lib/dart/filingCache';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const customer = searchParams.get('customer') ?? undefined;
  const corp_code = searchParams.get('corp_code') ?? undefined;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : 90;
  const min_relevance = searchParams.get('min_relevance')
    ? parseInt(searchParams.get('min_relevance')!, 10)
    : undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;

  const filings = await listFilings({ customer, corp_code, days, min_relevance, limit });
  return NextResponse.json({ filings });
}
