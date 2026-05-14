// PDF Import 확정 — 검수된 데이터를 DB에 저장하고 Bayesian prior 재계산
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { SUB_FACTORS } from '@/lib/pillars';

interface ImportRow {
  client_name: string;
  industry: string;
  risk: number;         // 1~5
  result: string;       // 'win' | 'loss' | '수의' | 'drop' | 'unknown'
  announced_at: string | null;
  profit_rate: number | null;
}

// Risk (1~5) → sub-factor score: Risk 1=9, Risk 5=3
function riskToScore(risk: number): number {
  const r = Math.max(1, Math.min(5, Math.round(risk)));
  return Math.max(3, Math.round(10 - (r - 1) * 1.75));
}

// risk-based sub_scores JSONB (모든 12개 sub에 동일 점수)
function buildSubScores(risk: number): Record<string, number> {
  const score = riskToScore(risk);
  return Object.fromEntries(SUB_FACTORS.map(f => [f.id, score]));
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rows: importRows }: { rows: ImportRow[] } = await req.json();
    if (!Array.isArray(importRows) || importRows.length === 0) {
      return NextResponse.json({ error: 'rows 배열 필수' }, { status: 400 });
    }

    const db = await getDb();
    let inserted = 0;
    let skipped = 0;

    for (const row of importRows) {
      // 제외 조건: drop, unknown, 발표일 없음(미종결)
      if (row.result === 'drop' || row.result === 'unknown') { skipped++; continue; }
      if (!row.announced_at) { skipped++; continue; }

      const actualResult = (row.result === 'win' || row.result === '수의') ? 1 : 0;
      const subScores = buildSubScores(row.risk ?? 3);
      const subScoresJson = JSON.stringify(subScores);
      // risk-based 예측 확률: win=risk낮을수록 높음
      const riskScore = riskToScore(row.risk ?? 3);
      const estimatedProb = (riskScore / 10) * 100;

      // deals INSERT (source='import')
      const { rows: dealRows } = await db.query(
        `INSERT INTO deals (client_name, source, industry, created_at)
         VALUES ($1, 'import', $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [row.client_name.trim(), row.industry?.trim() ?? null, row.announced_at]
      );

      if (dealRows.length === 0) { skipped++; continue; }
      const dealId = dealRows[0].id;

      // predictions INSERT (risk-based sub_scores)
      await db.query(
        `INSERT INTO predictions
           (deal_id, variables_json, predicted_probability, weights_used_json, sub_scores, created_at)
         VALUES ($1, $2, $3, '{}', $4, $5)`,
        [
          dealId,
          JSON.stringify({ risk: row.risk }),
          estimatedProb,
          subScoresJson,
          row.announced_at,
        ]
      );

      // outcomes INSERT
      await db.query(
        `INSERT INTO outcomes (deal_id, actual_result, closed_at)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [dealId, actualResult, row.announced_at]
      );

      inserted++;
    }

    // Bayesian prior 재계산: 업종별 + 전체 win율을 label_overrides에 저장
    const { rows: priorRows } = await db.query(`
      SELECT
        d.industry,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE o.actual_result = 1) as wins
      FROM deals d
      JOIN outcomes o ON o.deal_id = d.id
      WHERE d.source = 'import' AND d.industry IS NOT NULL
      GROUP BY d.industry
    `);

    for (const pr of priorRows) {
      // Laplace smoothing
      const smoothed = (Number(pr.wins) + 1) / (Number(pr.total) + 2);
      await db.query(
        `INSERT INTO label_overrides (scope, key, field, value, updated_at)
         VALUES ('prior', $1, 'win_rate', $2, NOW())
         ON CONFLICT (scope, key, field) DO UPDATE SET value = $2, updated_at = NOW()`,
        [pr.industry, String(smoothed)]
      );
    }

    // 전체 win율 (fallback prior)
    const { rows: totalRow } = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE o.actual_result = 1) as wins
      FROM deals d JOIN outcomes o ON o.deal_id = d.id
      WHERE d.source = 'import'
    `);
    if (totalRow[0].total > 0) {
      const smoothed = (Number(totalRow[0].wins) + 1) / (Number(totalRow[0].total) + 2);
      await db.query(
        `INSERT INTO label_overrides (scope, key, field, value, updated_at)
         VALUES ('prior', '_global', 'win_rate', $1, NOW())
         ON CONFLICT (scope, key, field) DO UPDATE SET value = $1, updated_at = NOW()`,
        [String(smoothed)]
      );
    }

    // 재학습 트리거 (≥5건이면 자동)
    let retrained = false;
    if (inserted >= 5) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
        await fetch(`${baseUrl}/api/retrain`, { method: 'POST' });
        retrained = true;
      } catch {
        // 재학습 실패해도 import는 성공
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      skipped,
      retrained,
      message: `${inserted}건 저장 완료, ${skipped}건 제외`,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
