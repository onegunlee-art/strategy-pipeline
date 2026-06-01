// POST /api/admin/rescore — 기존 딜의 sub_scores를 수동 수정 후 재계산
// 새 prediction row를 같은 deal_id에 INSERT (이력 보존)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdminAuthed } from '@/lib/auth';
import { SubScores, defaultSubScores } from '@/lib/pillars';
import { computeEnsembleProb } from '@/lib/ensemble';

interface RescoreBody {
  deal_id: number;
  sub_scores: Partial<SubScores>;
  memo?: string;        // decision_traces 에 기록할 편집 메모
  risk?: number;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as RescoreBody;
    if (!body.deal_id) return NextResponse.json({ error: 'deal_id 필수' }, { status: 400 });

    const db = await getDb();

    // deal + 기존 경쟁사 로드
    const { rows: dealRows } = await db.query(
      `SELECT d.*, array_agg(dc.competitor_id) FILTER (WHERE dc.competitor_id IS NOT NULL) as competitor_ids
       FROM deals d LEFT JOIN deal_competitors dc ON dc.deal_id = d.id
       WHERE d.id = $1 GROUP BY d.id`,
      [body.deal_id]
    );
    if (dealRows.length === 0) return NextResponse.json({ error: '딜 없음' }, { status: 404 });
    const deal = dealRows[0];
    const competitorIds: number[] = deal.competitor_ids ?? [];

    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 공유 추론 파이프라인 (가중치 로드 → 4-method → ensemble)
    const {
      subWeights, pillarWeights, pillarScores, methodProbs,
      finalProb, mc, weaknesses, prior, ensWeights,
    } = await computeEnsembleProb(db, subs, {
      competitorIds,
      risk: body.risk ?? 3,
    });
    const { pillar: probPillar, bayesian: probBayesian, elo: probElo } = methodProbs;

    // 새 prediction row INSERT (같은 deal_id, 이력 보존)
    await db.query(
      `INSERT INTO predictions
        (deal_id, variables_json, predicted_probability, weights_used_json,
         sub_scores, pillar_scores, method_probs, confidence_low, confidence_high, competitor_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        body.deal_id, JSON.stringify(subs), finalProb * 100,
        JSON.stringify({ subWeights, pillarWeights, ensWeights }),
        JSON.stringify(subs), JSON.stringify(pillarScores),
        JSON.stringify(methodProbs), mc.p5 * 100, mc.p95 * 100, competitorIds,
      ]
    );

    // 편집 메모 decision_traces 기록
    if (body.memo?.trim()) {
      await db.query(
        `INSERT INTO decision_traces (deal_id, stage, decision, rationale) VALUES ($1, $2, $3, $4)`,
        [body.deal_id, 'proposal', '수동 점수 편집', body.memo]
      );
    }

    return NextResponse.json({
      ok: true,
      deal_id: body.deal_id,
      probability: Math.round(finalProb * 1000) / 10,
      method_probs: {
        pillar: Math.round(probPillar * 1000) / 10,
        bayesian: Math.round(probBayesian * 1000) / 10,
        elo: Math.round(probElo * 1000) / 10,
        monteCarlo: Math.round(mc.mean * 1000) / 10,
      },
      pillar_scores: pillarScores,
      confidence_interval: { low: Math.round(mc.p5 * 1000) / 10, high: Math.round(mc.p95 * 1000) / 10 },
      weaknesses,
      prior_base_rate: Math.round(prior * 1000) / 10,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
