import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { getDocument, embedAndStoreChunks, markStatus } from '@/lib/rag/vectorStore';
import { chunkText } from '@/lib/rag/chunker';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const rawText = (doc as unknown as { raw_text?: string }).raw_text;
  if (!rawText) return NextResponse.json({ error: 'no raw_text on document' }, { status: 422 });

  try {
    const chunks = chunkText(rawText);
    const inheritedMeta = {
      doc_type: doc.doc_type,
      customer: doc.customer,
      industry: doc.industry,
      deal_id: doc.deal_id,
      title: doc.title,
    };
    const result = await embedAndStoreChunks(id, chunks, inheritedMeta);
    return NextResponse.json({
      ok: true,
      document_id: id,
      chunks_total: chunks.length,
      chunks_stored: result.stored,
      chunks_failed: result.failed,
    });
  } catch (e) {
    await markStatus(id, 'failed');
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'reindex failed', detail: msg }, { status: 500 });
  }
}
