import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { listArticles, upsertArticle, deleteArticle } from '@/lib/competitiveIntel';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const articles = await listArticles({
    entity_name: sp.get('entity_name') ?? undefined,
    entity_type: sp.get('entity_type') ?? undefined,
    stance: sp.get('stance') ?? undefined,
    days: sp.get('days') ? Number(sp.get('days')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 200,
  });
  return NextResponse.json({ articles });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.entity_type || !body.entity_name || !body.stance || !body.title) {
    return NextResponse.json({ error: 'entity_type, entity_name, stance, title 필수' }, { status: 400 });
  }
  const article = await upsertArticle({
    article_date: body.article_date ?? null,
    entity_type: body.entity_type,
    entity_name: body.entity_name,
    stance: body.stance,
    title: body.title,
    keywords: Array.isArray(body.keywords) ? body.keywords : [],
    content: body.content ?? null,
    source: body.source ?? null,
    url: body.url ?? null,
    attack_points: Array.isArray(body.attack_points) ? body.attack_points : [],
    strategy_tips: Array.isArray(body.strategy_tips) ? body.strategy_tips : [],
    fetch_source: body.fetch_source ?? 'manual',
  });
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
  await deleteArticle(id);
  return NextResponse.json({ ok: true });
}
