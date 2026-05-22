import { getDb } from '../db';
import type { DartFilingRaw } from './client';
import type { FilingSummary } from './summarizer';

export interface FilingRow {
  id: number;
  corp_code: string;
  corp_name: string;
  rcept_no: string;
  report_nm: string | null;
  flr_nm: string | null;
  rcept_dt: string;
  summary: string | null;
  tags: string[];
  relevance_score: number;
  created_at: string;
}

export async function existsByRceptNo(rcept_no: string): Promise<boolean> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT 1 FROM dart_filings WHERE rcept_no = $1 LIMIT 1`,
    [rcept_no]
  );
  return rows.length > 0;
}

export async function saveFiling(
  raw: DartFilingRaw,
  summary: FilingSummary | null
): Promise<void> {
  const pool = await getDb();
  // rcept_dt: "YYYYMMDD" → "YYYY-MM-DD"
  const dt = raw.rcept_dt && raw.rcept_dt.length === 8
    ? `${raw.rcept_dt.slice(0, 4)}-${raw.rcept_dt.slice(4, 6)}-${raw.rcept_dt.slice(6, 8)}`
    : null;

  await pool.query(
    `INSERT INTO dart_filings
       (corp_code, corp_name, rcept_no, report_nm, flr_nm, rcept_dt,
        summary, raw_json, relevance_score, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (rcept_no) DO UPDATE
       SET summary = EXCLUDED.summary,
           relevance_score = EXCLUDED.relevance_score,
           tags = EXCLUDED.tags`,
    [
      raw.corp_code,
      raw.corp_name,
      raw.rcept_no,
      raw.report_nm ?? null,
      raw.flr_nm ?? null,
      dt,
      summary?.summary ?? null,
      JSON.stringify(raw),
      summary?.relevance_score ?? 0,
      JSON.stringify(summary?.tags ?? []),
    ]
  );
}

export async function listFilings(filter: {
  corp_code?: string;
  customer?: string;
  days?: number;
  min_relevance?: number;
  limit?: number;
}): Promise<FilingRow[]> {
  const pool = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.corp_code) {
    params.push(filter.corp_code);
    where.push(`corp_code = $${params.length}`);
  }
  if (filter.customer) {
    params.push(filter.customer);
    where.push(`corp_name = $${params.length}`);
  }
  if (filter.days) {
    params.push(filter.days);
    where.push(`rcept_dt >= NOW()::date - $${params.length}::int`);
  }
  if (filter.min_relevance !== undefined) {
    params.push(filter.min_relevance);
    where.push(`relevance_score >= $${params.length}`);
  }

  const sql = `
    SELECT id, corp_code, corp_name, rcept_no, report_nm, flr_nm,
           rcept_dt, summary, tags, relevance_score, created_at
    FROM dart_filings
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY rcept_dt DESC, id DESC
    LIMIT ${filter.limit ?? 100}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}
