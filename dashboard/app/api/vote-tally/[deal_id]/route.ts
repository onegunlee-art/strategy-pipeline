import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tallyVotes } from '@/lib/voteTally';
import { pillarScoreFromSubs, pillarMultiplication } from '@/lib/pillars';

export async function GET(
  _req: NextRequest,
  { params }: { params: { deal_id: string } }
) {
  const dealId = parseInt(params.deal_id, 10);
  if (isNaN(dealId)) return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });

  const db = await getDb();

  // 딜 존재 확인
  const { rows: dealRows } = await db.query('SELECT id, client_name FROM deals WHERE id = $1', [dealId]);
  if (dealRows.length === 0) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

  const tally = await tallyVotes(dealId);
  const pillarScores = pillarScoreFromSubs(tally.subs);
  const probability = pillarMultiplication(pillarScores);

  // MC σ를 spread 평균에 비례 (의견 갈리면 CI 자동 확대)
  const spreadValues = Object.values(tally.spread);
  const avgSpread = spreadValues.length > 0
    ? spreadValues.reduce((a, b) => a + b, 0) / spreadValues.length
    : 0;
  const autoSigma = Math.max(0.5, Math.min(2.5, avgSpread * 0.5));

  return NextResponse.json({
    deal_id: dealId,
    client_name: dealRows[0].client_name,
    voter_count: tally.voterCount,
    vote_count: tally.voteCount,
    subs: tally.subs,
    spread: tally.spread,
    pillar_scores: pillarScores,
    probability: probability,
    auto_sigma: autoSigma,
  });
}
