import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
import { getLabels } from '@/lib/labels';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const labels = await getLabels();
  return NextResponse.json(labels);
}

export async function PUT(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // body: [{ scope, key, field, value }]
  const updates: { scope: string; key: string; field: string; value: string }[] = await req.json();
  const db = await getDb();

  for (const u of updates) {
    await db.query(
      `INSERT INTO label_overrides (scope, key, field, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (scope, key, field) DO UPDATE SET value = $4, updated_at = NOW()`,
      [u.scope, u.key, u.field, u.value]
    );
  }
  return NextResponse.json({ ok: true, updated: updates.length });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { scope, key, field } = await req.json();
  const db = await getDb();
  await db.query(
    'DELETE FROM label_overrides WHERE scope = $1 AND key = $2 AND ($3::text IS NULL OR field = $3)',
    [scope, key, field ?? null]
  );
  return NextResponse.json({ ok: true });
}
