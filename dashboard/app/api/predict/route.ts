import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { SubScores, defaultSubScores } from '@/lib/pillars';
import { computeEnsembleProb } from '@/lib/ensemble';
import { fetchResearch } from '@/lib/research';

interface PredictBody {
  client_name: string;
  deal_size?: string;
  industry?: string;
  expected_revenue?: number;
  risk?: number;        // 딜 리스크 레벨 1~5 (MC sigma 조정에 사용)
  sub_scores: Partial<SubScores>;
  competitor_ids?: number[];
  skip_qualitative?: boolean;  // 빠른 예측만 필요할 때 true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PredictBody;
    const db = await getDb();

    // 1) sub-scores 기본값 보강
    const subs: SubScores = { ...defaultSubScores(), ...body.sub_scores } as SubScores;

    // 2~7) 공유 추론 파이프라인 (가중치 로드 → 4-method → ensemble)
    const {
      subWeights, pillarWeights, pillarScores, methodProbs,
      finalProb, mc, weaknesses, prior, records, ensWeights,
    } = await computeEnsembleProb(db, subs, {
      competitorIds: body.competitor_ids,
      risk: body.risk,
    });
    const { pillar: probPillar, bayesian: probBayesian, elo: probElo, monteCarlo: probMC } = methodProbs;

    // 9) DB 저장
    const { rows: dealRows } = await db.query(
      `INSERT INTO deals (client_name, deal_size, industry, expected_revenue, source)
       VALUES ($1, $2, $3, $4, 'manual') RETURNING id`,
      [body.client_name, body.deal_size ?? null, body.industry ?? null, body.expected_revenue ?? null]
    );
    const dealId = dealRows[0].id;

    if (body.competitor_ids && body.competitor_ids.length > 0) {
      for (const cid of body.competitor_ids) {
        await db.query(
          'INSERT INTO deal_competitors (deal_id, competitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [dealId, cid]
        );
      }
    }

    await db.query(
      `INSERT INTO predictions
        (deal_id, variables_json, predicted_probability, weights_used_json,
         sub_scores, pillar_scores, method_probs, confidence_low, confidence_high, competitor_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dealId,
        JSON.stringify(subs),
        finalProb * 100,
        JSON.stringify({ subWeights, pillarWeights, ensWeights }),
        JSON.stringify(subs),
        JSON.stringify(pillarScores),
        JSON.stringify(methodProbs),
        mc.p5 * 100,
        mc.p95 * 100,
        body.competitor_ids ?? [],
      ]
    );

    // 10) 정성적 컨텍스트 (skip_qualitative 미지정 시 기본 스킵 — Gemini RPM 절약)
    const qualitative_context: {
      similar_deals: Record<string, unknown> | null;
      customer_signals: Record<string, unknown> | null;
    } = { similar_deals: null, customer_signals: null };

    if (body.skip_qualitative === false) {
      const pool = db;
      const [ragResult, dartResult] = await Promise.allSettled([
        fetchResearch(pool, dealId, {
          kind: 'internal_similar_deals',
          clientName: body.client_name,
          industry: body.industry,
        }),
        fetchResearch(pool, dealId, {
          kind: 'customer_dart_signals',
          clientName: body.client_name,
          days: 90,
          min_relevance: 50,
        }),
      ]);

      if (ragResult.status === 'fulfilled' && ragResult.value.json) {
        qualitative_context.similar_deals = ragResult.value.json as Record<string, unknown>;
      }
      if (dartResult.status === 'fulfilled' && dartResult.value.json) {
        qualitative_context.customer_signals = dartResult.value.json as Record<string, unknown>;
      }
    }

    return NextResponse.json({
      deal_id: dealId,
      probability: Math.round(finalProb * 1000) / 10,  // 0.0 ~ 100.0
      method_probs: {
        pillar: Math.round(probPillar * 1000) / 10,
        bayesian: Math.round(probBayesian * 1000) / 10,
        elo: Math.round(probElo * 1000) / 10,
        monteCarlo: Math.round(probMC * 1000) / 10,
      },
      pillar_scores: pillarScores,
      confidence_interval: {
        low: Math.round(mc.p5 * 1000) / 10,
        high: Math.round(mc.p95 * 1000) / 10,
      },
      mc_distribution: mc.distribution,
      weaknesses,
      prior_base_rate: Math.round(prior * 1000) / 10,
      data_points: records.length,
      mc_seed_hash: mc.seedPoolHash,
      qualitative_context,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
