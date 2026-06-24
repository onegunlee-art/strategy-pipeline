import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { fetchGeminiNews, syncDartToIntel } from '@/lib/competitiveIntel';

export const runtime = 'nodejs';
export const maxDuration = 120;

const DEFAULT_ENTITIES: Array<{ name: string; type: 'self' | 'competitor' }> = [
  { name: 'KT', type: 'self' },
  { name: 'LG CNS', type: 'competitor' },
  { name: 'Samsung SDS', type: 'competitor' },
  { name: 'SKT', type: 'competitor' },
];

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: Array<{ name: string; type: 'self' | 'competitor' }> = Array.isArray(body.entities)
    ? body.entities
    : DEFAULT_ENTITIES;

  const results: Array<{ entity: string; saved: number; errors: string[] }> = [];

  // 각 회사 순차 처리 (Gemini rate limit 방지)
  for (const entity of entities) {
    const result = await fetchGeminiNews(entity.name, entity.type);
    results.push({ entity: entity.name, ...result });
    // 400ms 딜레이 (Gemini rate limit)
    await new Promise(r => setTimeout(r, 400));
  }

  // DART 공시 동기화
  const dartResult = await syncDartToIntel();

  const totalSaved = results.reduce((s, r) => s + r.saved, 0) + dartResult.synced;
  const allErrors = [
    ...results.flatMap(r => r.errors),
    ...dartResult.errors,
  ];

  return NextResponse.json({
    ok: true,
    total_saved: totalSaved,
    dart_synced: dartResult.synced,
    entities: results,
    errors: allErrors,
  });
}
