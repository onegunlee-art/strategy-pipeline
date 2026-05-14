import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tallyVotes } from '@/lib/voteTally';
import { pillarScoreFromSubs, pillarMultiplication } from '@/lib/pillars';
import { sigmaFromVoterSpread, monteCarloRun } from '@/lib/montecarlo';

export async function GET(
  _req: NextRequest,
  { params }: { params: { deal_id: string } }
) {
  const dealId = parseInt(params.deal_id, 10);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const db = await getDb();
  const { rows: dealRows } = await db.query('SELECT id, client_name FROM deals WHERE id = $1', [dealId]);
  if (dealRows.length === 0) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

  const tally = await tallyVotes(dealId);
  const pillarScores = pillarScoreFromSubs(tally.subs);
  const probability = pillarMultiplication(pillarScores);

  // MC σ를 voter spread에 연동
  const autoSigma = sigmaFromVoterSpread(0.5, tally.averageSpread);
  let ci: { p5: number; p95: number } | null = null;
  if (tally.voterCount > 0) {
    const mc = monteCarloRun(tally.subs, { iterations: 3000, subFactorStd: 0.5, voterSpread: tally.averageSpread });
    ci = { p5: mc.p5, p95: mc.p95 };
  }

  return NextResponse.json({
    deal_id: dealId,
    client_name: dealRows[0].client_name,
    voter_count: tally.voterCount,
    vote_count: tally.voteCount,
    subs: tally.subs,
    spread: tally.spread,
    average_spread: tally.averageSpread,
    pillar_scores: pillarScores,
    probability,
    confidence_interval: ci,
    auto_sigma: autoSigma,
    conflicts: tally.conflicts,
    heatmap: tally.heatmap,
  });
}
