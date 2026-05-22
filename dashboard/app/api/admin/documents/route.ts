import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { listDocuments } from '@/lib/rag/vectorStore';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const docs = await listDocuments({
    doc_type: searchParams.get('doc_type') ?? undefined,
    customer: searchParams.get('customer') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100,
  });
  return NextResponse.json({ documents: docs });
}
