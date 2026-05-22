// 회사명 → DART corp_code 매핑.
// 1) corp_name 정확 일치 → 2) aliases JSONB 검색 → 3) 정규화 (공백/(주) 제거) 후 재시도
import { getDb } from '../db';

export interface CorpMapRow {
  id: number;
  corp_code: string;
  corp_name: string;
  aliases: string[];
  is_listed: boolean;
  industry: string | null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(주\)|주식회사|㈜/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export async function resolveCorpCode(name: string): Promise<CorpMapRow | null> {
  if (!name) return null;
  const pool = await getDb();

  // 1) 정확 일치
  const { rows: exact } = await pool.query(
    `SELECT id, corp_code, corp_name, aliases, is_listed, industry
     FROM dart_corp_map WHERE corp_name = $1 LIMIT 1`,
    [name]
  );
  if (exact.length > 0) return exact[0];

  // 2) aliases 매칭 (JSONB contains)
  const { rows: alias } = await pool.query(
    `SELECT id, corp_code, corp_name, aliases, is_listed, industry
     FROM dart_corp_map WHERE aliases @> $1::jsonb LIMIT 1`,
    [JSON.stringify([name])]
  );
  if (alias.length > 0) return alias[0];

  // 3) 정규화 매칭 (전체 스캔, 등록 회사 수가 적을 때만 효율적)
  const target = normalize(name);
  const { rows: all } = await pool.query(
    `SELECT id, corp_code, corp_name, aliases, is_listed, industry FROM dart_corp_map`
  );
  for (const r of all as CorpMapRow[]) {
    if (normalize(r.corp_name) === target) return r;
    for (const a of r.aliases ?? []) {
      if (normalize(a) === target) return r;
    }
  }
  return null;
}

export async function upsertCorpMap(input: {
  corp_code: string;
  corp_name: string;
  aliases?: string[];
  is_listed?: boolean;
  industry?: string | null;
}): Promise<CorpMapRow> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `INSERT INTO dart_corp_map (corp_code, corp_name, aliases, is_listed, industry)
     VALUES ($1,$2,$3::jsonb,$4,$5)
     ON CONFLICT (corp_code) DO UPDATE
       SET corp_name = EXCLUDED.corp_name,
           aliases = EXCLUDED.aliases,
           is_listed = EXCLUDED.is_listed,
           industry = EXCLUDED.industry,
           updated_at = NOW()
     RETURNING id, corp_code, corp_name, aliases, is_listed, industry`,
    [
      input.corp_code,
      input.corp_name,
      JSON.stringify(input.aliases ?? []),
      input.is_listed ?? true,
      input.industry ?? null,
    ]
  );
  return rows[0];
}

export async function listCorpMap(): Promise<CorpMapRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id, corp_code, corp_name, aliases, is_listed, industry
     FROM dart_corp_map ORDER BY corp_name ASC`
  );
  return rows;
}

export async function deleteCorpMap(corp_code: string): Promise<boolean> {
  const pool = await getDb();
  const r = await pool.query(`DELETE FROM dart_corp_map WHERE corp_code = $1`, [corp_code]);
  return (r.rowCount ?? 0) > 0;
}
