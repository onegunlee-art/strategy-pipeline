import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { findWeaknesses, defaultSubScores, SubScores } from '@/lib/pillars';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deal_id: string }> }
) {
  try {
    const { deal_id } = await params;
    const dealId = Number(deal_id);
    const db = await getDb();

    const { rows: dealRows } = await db.query(
      `SELECT id, client_name, deal_size, industry, execution_unit, pm,
              duration_months, due_date, partners, risks, milestones,
              competitive_positioning, importance_stars, bid_timeline,
              team_size, team_members, created_at
       FROM deals WHERE id = $1`,
      [dealId]
    );
    if (dealRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const raw = dealRows[0];

    // pg returns JSONB as objects already
    const deal = {
      id: raw.id,
      client_name: raw.client_name,
      deal_size: raw.deal_size,
      industry: raw.industry,
      execution_unit: raw.execution_unit,
      pm: raw.pm,
      duration_months: raw.duration_months,
      due_date: raw.due_date,
      created_at: raw.created_at,
      partners: raw.partners ?? [],
      risks: raw.risks ?? [],
      milestones: raw.milestones ?? [],
      competitive_positioning: raw.competitive_positioning ?? {},
      importance_stars: raw.importance_stars ?? 3,
      bid_timeline: raw.bid_timeline ?? {},
      team_size: raw.team_size ?? null,
      team_members: raw.team_members ?? [],
    };

    // Latest prediction
    const { rows: predRows } = await db.query(
      `SELECT predicted_probability, method_probs, pillar_scores, sub_scores,
              confidence_low, confidence_high, created_at
       FROM predictions WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );

    let prediction = null;
    if (predRows.length > 0) {
      const p = predRows[0];
      const subs: SubScores = {
        ...defaultSubScores(),
        ...(p.sub_scores ?? {}),
      } as SubScores;
      const weaknesses = findWeaknesses(subs, 3);

      prediction = {
        probability: Number(p.predicted_probability),
        method_probs: p.method_probs ?? {},
        pillar_scores: p.pillar_scores ?? {},
        weaknesses: weaknesses.map(w => ({
          id: w.id,
          label: w.label,
          pillar: w.pillar,
          score: w.score,
          contribution: w.contribution,
        })),
        confidence_interval: {
          low: Number(p.confidence_low ?? 0),
          high: Number(p.confidence_high ?? 100),
        },
        created_at: p.created_at,
      };
    }

    // Portfolio rank among active (no outcome) deals
    const { rows: rankRows } = await db.query(`
      SELECT d.id
      FROM deals d
      LEFT JOIN LATERAL (
        SELECT predicted_probability FROM predictions p2
        WHERE p2.deal_id = d.id ORDER BY p2.created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN outcomes o ON o.deal_id = d.id
      WHERE o.id IS NULL
      ORDER BY p.predicted_probability DESC NULLS LAST
    `);
    const rankIdx = rankRows.findIndex(r => r.id === dealId);

    return NextResponse.json({
      deal,
      prediction,
      portfolio_rank: rankIdx >= 0 ? rankIdx + 1 : rankRows.length + 1,
      portfolio_size: rankRows.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
