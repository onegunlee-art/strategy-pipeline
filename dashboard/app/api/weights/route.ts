// 가중치 + Elo + Ensemble + Calibration 통합 정보 반환
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { calibrationData } from '@/lib/ensemble';

export async function GET() {
  try {
    const db = await getDb();

    // 1) Pillar + Sub-factor 가중치 (최신)
    const { rows: weightRows } = await db.query(`
      SELECT variable_id, weight_value, version, updated_at FROM weights w
      WHERE updated_at = (
        SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
      )
      ORDER BY variable_id
    `);

    // 2) Ensemble weight (최신)
    const { rows: ensRows } = await db.query(`
      SELECT pillar_mult, bayesian, elo, monte_carlo, version, updated_at
      FROM ensemble_weights ORDER BY version DESC LIMIT 1
    `);

    // 3) 경쟁사 Elo
    const { rows: compRows } = await db.query(`
      SELECT id, name, current_elo, match_count FROM competitors ORDER BY current_elo DESC
    `);

    // 4) 우리 Elo
    const { rows: ourRows } = await db.query('SELECT elo, updated_at FROM our_elo WHERE id=1');

    // 5) Calibration 데이터
    const { rows: predRows } = await db.query(`
      SELECT p.predicted_probability, o.actual_result
      FROM predictions p
      JOIN outcomes o ON o.deal_id = p.deal_id
      WHERE p.predicted_probability >= 0
    `);
    const calibPoints = calibrationData(
      predRows.map((r: { predicted_probability: number; actual_result: number }) => ({
        predicted: r.predicted_probability / 100,
        actual: r.actual_result as 0 | 1,
      }))
    );

    // 6) 종합 통계
    const totalDeals = predRows.length;
    const winRate = totalDeals > 0
      ? predRows.filter((r: { actual_result: number }) => r.actual_result === 1).length / totalDeals
      : 0;
    const avgBrier = totalDeals > 0
      ? predRows.reduce((s: number, r: { predicted_probability: number; actual_result: number }) =>
          s + (r.predicted_probability / 100 - r.actual_result) ** 2, 0) / totalDeals
      : 0;

    return NextResponse.json({
      sub_weights: weightRows.filter((w: { variable_id: string }) => !w.variable_id.startsWith('pillar_')),
      pillar_weights: weightRows.filter((w: { variable_id: string }) => w.variable_id.startsWith('pillar_')),
      ensemble_weights: ensRows[0] ?? null,
      competitors: compRows,
      our_elo: ourRows[0]?.elo ?? 1500,
      calibration: calibPoints,
      stats: {
        total_deals: totalDeals,
        win_rate: winRate,
        avg_brier: avgBrier,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
