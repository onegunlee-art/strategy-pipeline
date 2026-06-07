import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface CalibrationEntry {
  topic: string;
  predictedProb: number;
  priorProb: number;
  actualOutcome: string;
  resolvedAt: string;
  correct: boolean;
  note: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  ceasefire_extended: '휴전 연장 ✓',
  no_blockade: '봉쇄 미발생 ✓',
  talks_failed: '협상 결렬',
  conflict_escalated: '갈등 고조',
  ceasefire_broken: '휴전 파기',
};

function isCorrect(prob: number, outcome: string): boolean {
  const positive = ['ceasefire_extended', 'no_blockade', 'ceasefire_signed'];
  const negative = ['talks_failed', 'conflict_escalated', 'ceasefire_broken'];
  if (positive.includes(outcome)) return prob >= 50;
  if (negative.includes(outcome)) return prob < 50;
  return false;
}

export async function GET() {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT topic, geo_prob, prior_prob, actual_outcome, resolved_at, analysis_text
     FROM geo_sessions
     WHERE actual_outcome IS NOT NULL AND resolved_at IS NOT NULL
     ORDER BY resolved_at DESC
     LIMIT 10`
  );

  const entries: CalibrationEntry[] = rows.map(r => ({
    topic: r.topic,
    predictedProb: r.geo_prob ?? 0,
    priorProb: r.prior_prob ?? r.geo_prob ?? 0,
    actualOutcome: OUTCOME_LABELS[r.actual_outcome] ?? r.actual_outcome,
    resolvedAt: r.resolved_at ? (r.resolved_at as Date).toISOString().slice(0, 10) : '',
    correct: isCorrect(r.geo_prob ?? 0, r.actual_outcome),
    note: r.analysis_text ?? '',
  }));

  const totalCount = entries.length;
  const correctCount = entries.filter(e => e.correct).length;
  const brierScore = totalCount > 0
    ? entries.reduce((sum, e) => {
        const p = e.predictedProb / 100;
        const o = e.correct ? 1 : 0;
        return sum + Math.pow(p - o, 2);
      }, 0) / totalCount
    : null;

  return NextResponse.json({ entries, totalCount, correctCount, brierScore });
}
