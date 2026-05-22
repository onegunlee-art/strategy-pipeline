import { Pool } from 'pg';
import { getDb } from '../db';
import { Chunk } from './chunker';
import { embedBatch } from './embedder';

export type DocType = 'rfp' | 'loss_report' | 'win_strategy' | 'catalog' | 'partner' | 'other';

export interface DocumentInput {
  doc_type: DocType;
  title: string;
  source_path?: string | null;
  deal_id?: number | null;
  customer?: string | null;
  industry?: string | null;
  metadata?: Record<string, unknown>;
  raw_text: string;
  word_count: number;
}

export interface DocumentRow {
  id: number;
  doc_type: string;
  title: string;
  source_path: string | null;
  deal_id: number | null;
  customer: string | null;
  industry: string | null;
  metadata: Record<string, unknown> | null;
  word_count: number;
  status: string;
  chunk_count?: number;
  created_at: string;
  updated_at: string;
}

let pgvectorChecked = false;
let pgvectorAvailable = false;

async function hasPgvector(pool: Pool): Promise<boolean> {
  if (pgvectorChecked) return pgvectorAvailable;
  const { rows } = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1`);
  pgvectorAvailable = rows.length > 0;
  pgvectorChecked = true;
  return pgvectorAvailable;
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

export async function insertDocument(input: DocumentInput): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `INSERT INTO documents (doc_type, title, source_path, deal_id, customer, industry, metadata, raw_text, word_count, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
     RETURNING id`,
    [
      input.doc_type,
      input.title,
      input.source_path ?? null,
      input.deal_id ?? null,
      input.customer ?? null,
      input.industry ?? null,
      input.metadata ?? {},
      input.raw_text,
      input.word_count,
    ]
  );
  return rows[0].id;
}

export async function embedAndStoreChunks(
  documentId: number,
  chunks: Chunk[],
  inheritedMetadata: Record<string, unknown>
): Promise<{ stored: number; failed: number }> {
  const pool = await getDb();
  const pgv = await hasPgvector(pool);

  if (chunks.length === 0) return { stored: 0, failed: 0 };

  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts);

  // 기존 chunks 삭제 (재인덱싱 안전)
  await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

  let stored = 0;
  let failed = 0;
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedding = embeddings[i];
    if (!embedding) { failed++; continue; }

    const meta = { ...inheritedMetadata, chunk_index: c.index, chunk_total: total };

    try {
      if (pgv) {
        await pool.query(
          `INSERT INTO document_chunks (document_id, chunk_index, chunk_total, content, embedding, metadata, word_count)
           VALUES ($1,$2,$3,$4,$5::vector,$6,$7)`,
          [documentId, c.index, total, c.content, vectorLiteral(embedding), meta, c.wordCount]
        );
      } else {
        await pool.query(
          `INSERT INTO document_chunks (document_id, chunk_index, chunk_total, content, embedding, metadata, word_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [documentId, c.index, total, c.content, JSON.stringify(embedding), meta, c.wordCount]
        );
      }
      stored++;
    } catch (e) {
      console.error(`[vectorStore] chunk ${i} insert failed:`, e);
      failed++;
    }
  }

  await pool.query(
    `UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2`,
    [failed === 0 ? 'embedded' : 'partial', documentId]
  );

  return { stored, failed };
}

export async function listDocuments(filters: {
  doc_type?: string;
  customer?: string;
  status?: string;
  limit?: number;
} = {}): Promise<DocumentRow[]> {
  const pool = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.doc_type) { params.push(filters.doc_type); where.push(`d.doc_type = $${params.length}`); }
  if (filters.customer) { params.push(filters.customer); where.push(`d.customer = $${params.length}`); }
  if (filters.status) { params.push(filters.status); where.push(`d.status = $${params.length}`); }

  const sql = `
    SELECT d.id, d.doc_type, d.title, d.source_path, d.deal_id, d.customer, d.industry,
           d.metadata, d.word_count, d.status, d.created_at, d.updated_at,
           (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_id = d.id) AS chunk_count
    FROM documents d
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY d.created_at DESC
    LIMIT ${filters.limit ?? 100}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getDocument(id: number): Promise<DocumentRow | null> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT d.*, (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_id = d.id) AS chunk_count
     FROM documents d WHERE d.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteDocument(id: number): Promise<boolean> {
  const pool = await getDb();
  const res = await pool.query(`DELETE FROM documents WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function markStatus(id: number, status: string): Promise<void> {
  const pool = await getDb();
  await pool.query(`UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
}

export async function pgvectorAvailableNow(): Promise<boolean> {
  const pool = await getDb();
  return hasPgvector(pool);
}
