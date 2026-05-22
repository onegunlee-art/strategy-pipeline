import { getDb } from '../db';
import { embedText } from './embedder';
import { pgvectorAvailableNow } from './vectorStore';

export interface SearchFilters {
  doc_type?: string | string[];
  customer?: string;
  industry?: string;
  deal_id?: number;
  match_count?: number;
}

export interface SearchHit {
  chunk_id: number;
  document_id: number;
  document_title: string;
  doc_type: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

export async function searchChunks(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchHit[]> {
  const pool = await getDb();
  const queryEmbedding = await embedText(query);
  const matchCount = filters.match_count ?? 5;
  const pgv = await pgvectorAvailableNow();

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.doc_type) {
    const arr = Array.isArray(filters.doc_type) ? filters.doc_type : [filters.doc_type];
    params.push(arr);
    where.push(`d.doc_type = ANY($${params.length}::text[])`);
  }
  if (filters.customer) {
    params.push(filters.customer);
    where.push(`d.customer = $${params.length}`);
  }
  if (filters.industry) {
    params.push(filters.industry);
    where.push(`d.industry = $${params.length}`);
  }
  if (filters.deal_id !== undefined) {
    params.push(filters.deal_id);
    where.push(`d.deal_id = $${params.length}`);
  }

  if (pgv) {
    params.push(vectorLiteral(queryEmbedding));
    const embedParam = `$${params.length}::vector`;
    params.push(matchCount);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT c.id AS chunk_id, c.document_id, c.content, c.metadata,
             d.title AS document_title, d.doc_type,
             1 - (c.embedding <=> ${embedParam}) AS similarity
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.embedding <=> ${embedParam}
      LIMIT ${limitParam}
    `;
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  // pgvector 미설치 fallback — JS에서 cosine 계산 (개발용, 느림)
  const sql = `
    SELECT c.id AS chunk_id, c.document_id, c.content, c.metadata, c.embedding,
           d.title AS document_title, d.doc_type
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  const { rows } = await pool.query(sql, params);
  const scored = rows
    .map((r) => {
      const emb = typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding;
      return { ...r, similarity: cosineSim(queryEmbedding, emb), embedding: undefined };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
  return scored;
}
