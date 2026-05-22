// 사내 수주전략 문서 시드 — data/seed/strategy_docs/*.md 를 documents 테이블에 적재.
// 임베딩은 별도 수행 (OPENAI_API_KEY 필요). 시드 시점에는 status='pending'.
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface FrontMatter {
  doc_type?: string;
  title?: string;
  customer?: string;
  industry?: string;
}

function parseFrontMatter(content: string): { meta: FrontMatter; body: string } {
  const meta: FrontMatter = {};
  const lines = content.split('\n');
  let body = content;
  const titleMatch = lines.find((l) => l.startsWith('# '));
  if (titleMatch) meta.title = titleMatch.replace(/^#\s+/, '').trim();
  for (const l of lines.slice(0, 20)) {
    const m = l.match(/^(doc_type|customer|industry):\s*(.+)$/);
    if (m) (meta as Record<string, string>)[m[1]] = m[2].trim();
  }
  return { meta, body };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function seedStrategyDocs(pool: Pool): Promise<{ inserted: number; skipped: number }> {
  const dir = path.join(process.cwd(), 'data', 'seed', 'strategy_docs');
  if (!fs.existsSync(dir)) return { inserted: 0, skipped: 0 };

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { meta, body } = parseFrontMatter(content);
    const title = meta.title || file.replace(/\.md$/, '');
    const docType = meta.doc_type || 'win_strategy';

    // 동일 source_path가 이미 있으면 skip (idempotent)
    const { rows: existing } = await pool.query(
      `SELECT id FROM documents WHERE source_path = $1 LIMIT 1`,
      [`seed/${file}`]
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO documents (doc_type, title, source_path, customer, industry, metadata, raw_text, word_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
      [
        docType,
        title,
        `seed/${file}`,
        meta.customer ?? null,
        meta.industry ?? null,
        { seed: true, source_file: file },
        body,
        countWords(body),
      ]
    );
    inserted++;
  }

  return { inserted, skipped };
}
