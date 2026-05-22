import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { parseFile } from '@/lib/rag/pdfParser';
import { chunkText } from '@/lib/rag/chunker';
import { insertDocument, embedAndStoreChunks, markStatus, DocType } from '@/lib/rag/vectorStore';

export const runtime = 'nodejs';
export const maxDuration = 300;

const VALID_DOC_TYPES: DocType[] = ['rfp', 'loss_report', 'win_strategy', 'catalog', 'partner', 'other'];

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const doc_type = (form.get('doc_type') as string | null) ?? 'other';
  const title = (form.get('title') as string | null) ?? '';
  const customer = (form.get('customer') as string | null) || null;
  const industry = (form.get('industry') as string | null) || null;
  const deal_id_raw = form.get('deal_id') as string | null;
  const deal_id = deal_id_raw ? parseInt(deal_id_raw, 10) : null;
  const metadataRaw = form.get('metadata') as string | null;
  let metadata: Record<string, unknown> = {};
  if (metadataRaw) {
    try { metadata = JSON.parse(metadataRaw); } catch { /* ignore */ }
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!VALID_DOC_TYPES.includes(doc_type as DocType)) {
    return NextResponse.json({ error: `doc_type must be one of ${VALID_DOC_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseFile(file.name, buffer);

  if (parsed.wordCount < 30) {
    return NextResponse.json({
      error: 'extracted text too short',
      wordCount: parsed.wordCount,
      needsOcr: parsed.needsOcr,
    }, { status: 422 });
  }

  const docId = await insertDocument({
    doc_type: doc_type as DocType,
    title,
    source_path: file.name,
    deal_id,
    customer,
    industry,
    metadata: { ...metadata, pageCount: parsed.pageCount, needsOcr: parsed.needsOcr },
    raw_text: parsed.text,
    word_count: parsed.wordCount,
  });

  try {
    const chunks = chunkText(parsed.text);
    const inheritedMeta = {
      doc_type,
      customer,
      industry,
      deal_id,
      title,
    };
    const result = await embedAndStoreChunks(docId, chunks, inheritedMeta);

    return NextResponse.json({
      ok: true,
      document_id: docId,
      chunks_total: chunks.length,
      chunks_stored: result.stored,
      chunks_failed: result.failed,
      word_count: parsed.wordCount,
      needs_ocr: parsed.needsOcr,
    });
  } catch (e) {
    await markStatus(docId, 'failed');
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'embedding failed', detail: msg, document_id: docId }, { status: 500 });
  }
}
