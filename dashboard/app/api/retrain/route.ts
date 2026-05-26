// 재학습: Pillar weight + Ensemble weight + Sub-factor weight (Gemini)
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL } from '@/lib/geminiModel';
import { SUB_FACTORS, SubFactorId, PillarId, PILLAR_META } from '@/lib/pillars';
import { learnEnsembleWeights, TrainingCase, MethodProbs, brierScore } from '@/lib/ensemble';

export async function POST() {
  try {
    const db = await getDb();

    // 1) 학습 데이터 수집 (predicted_probability >= 0 = 실제 예측된 딜)
    const { rows } = await db.query(`
      SELECT
        d.id as deal_id, d.client_name,
        p.predicted_probability,
        p.sub_scores, p.method_probs,
        o.actual_result, o.closed_at
      FROM outcomes o
      JOIN deals d ON d.id = o.deal_id
      JOIN predictions p ON p.deal_id = o.deal_id
      WHERE p.predicted_probability >= 0
      ORDER BY o.closed_at DESC
      LIMIT 200
    `);

    if (rows.length < 3) {
      return NextResponse.json({
        ok: false,
        message: '학습에 최소 3건의 예측+결과 데이터가 필요합니다.',
        current: rows.length,
      });
    }

    // 2) Ensemble weight 학습 (Brier minimize)
    const cases: TrainingCase[] = rows
      .filter((r: { method_probs: MethodProbs | null }) => r.method_probs != null)
      .map((r: { method_probs: MethodProbs; actual_result: number }) => ({
        probs: r.method_probs,
        actual: r.actual_result as 0 | 1,
      }));

    let newEnsWeights = null;
    if (cases.length >= 3) {
      newEnsWeights = learnEnsembleWeights(cases, 0.1);
      const { rows: verRow } = await db.query('SELECT MAX(version) as v FROM ensemble_weights');
      const newVersion = (verRow[0].v ?? 1) + 1;
      await db.query(
        `INSERT INTO ensemble_weights (pillar_mult, bayesian, elo, monte_carlo, version)
         VALUES ($1, $2, $3, $4, $5)`,
        [newEnsWeights.pillar, newEnsWeights.bayesian, newEnsWeights.elo, newEnsWeights.monteCarlo, newVersion]
      );
    }

    // 3) Sub-factor + Pillar weight 재학습 (Claude)
    const { rows: currentWeightRows } = await db.query(`
      SELECT variable_id, weight_value FROM weights w
      WHERE updated_at = (
        SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
      )
    `);
    const currentWeights = Object.fromEntries(
      currentWeightRows.map((r: { variable_id: string; weight_value: number }) =>
        [r.variable_id, r.weight_value])
    );

    const avgBrier =
      cases.reduce((s, c) => s + brierScore(c.probs.pillar, c.actual), 0) / cases.length;

    const subFactorList = SUB_FACTORS.map(f =>
      `  - ${f.id} (${f.pillar}, ${f.label}): 현재 가중치 ${((currentWeights[f.id] ?? f.defaultWeight) * 100).toFixed(1)}%`
    ).join('\n');

    const casesSummary = rows.slice(0, 20).map((r: { client_name: string; predicted_probability: number; actual_result: number }, i: number) =>
      `  ${i + 1}. ${r.client_name}: 예측 ${r.predicted_probability.toFixed(1)}% → 실제 ${r.actual_result === 1 ? '수주' : '실패'}`
    ).join('\n');

    const prompt = `당신은 KT B2B 수주 예측 모델의 가중치를 최적화하는 전문가입니다.

## 5-Pillar 구조 (S/V/D/P/E)
- S (사전영업): ${PILLAR_META.S.description}
- V (Value Impact): ${PILLAR_META.V.description}
- D (차별화): ${PILLAR_META.D.description}
- P (가격경쟁력): ${PILLAR_META.P.description}
- E (Delivery): ${PILLAR_META.E.description}

## 현재 Sub-Factor 가중치 (15개, pillar별 sum=1.0)
${subFactorList}

## 현재 Pillar 가중치 (sum=1.0)
- pillar_S: ${((currentWeights.pillar_S ?? 0.20) * 100).toFixed(1)}%
- pillar_V: ${((currentWeights.pillar_V ?? 0.20) * 100).toFixed(1)}%
- pillar_D: ${((currentWeights.pillar_D ?? 0.20) * 100).toFixed(1)}%
- pillar_P: ${((currentWeights.pillar_P ?? 0.20) * 100).toFixed(1)}%
- pillar_E: ${((currentWeights.pillar_E ?? 0.20) * 100).toFixed(1)}%

## 최근 ${cases.length}건 (Pillar method 평균 Brier: ${avgBrier.toFixed(3)})
${casesSummary}

## 임무
예측 정확도를 높이기 위한 새 가중치를 JSON으로 반환하세요.

규칙:
- pillar_S + pillar_V + pillar_D + pillar_P + pillar_E = 1.0 (각 0.10 ~ 0.35)
- 각 pillar 내부 sub-factor 3개 합 = 1.0 (각 0.15 ~ 0.50)
- 오차가 큰 케이스의 패턴 분석 반영

JSON 형식만 출력:
{
  "pillar_weights": { "S": 0.20, "V": 0.20, "D": 0.20, "P": 0.20, "E": 0.20 },
  "sub_weights": {
    "s_key_man_contact": 0.40, "s_evaluator_rfp": 0.40, "s_poc_proposal": 0.20,
    "v_needs_painpoint": 0.40, "v_value_proposition": 0.40, "v_presentation": 0.20,
    "d_competitive_strategy": 0.40, "d_tech_reference": 0.40, "d_partner": 0.20,
    "p_budget_fit": 0.30, "p_price_competition": 0.40, "p_cost_value": 0.30,
    "e_track_record": 0.40, "e_risk_management": 0.40, "e_execution_team": 0.20
  },
  "reasoning": "한국어 2-3문장 핵심 이유"
}`;

    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.Gemini_API_Key ?? process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 503 });
    }
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ ok: false, message: 'Gemini 응답 파싱 실패', raw: text }, { status: 500 });
    }
    const parsed = JSON.parse(match[0]) as {
      pillar_weights: Record<PillarId, number>;
      sub_weights: Record<SubFactorId, number>;
      reasoning: string;
    };

    // 검증
    const pSum = Object.values(parsed.pillar_weights).reduce((s, v) => s + v, 0);
    if (Math.abs(pSum - 1.0) > 0.05) {
      return NextResponse.json({ ok: false, message: `pillar 합계 오류: ${pSum}` }, { status: 500 });
    }

    // 저장
    const { rows: verRow } = await db.query('SELECT MAX(version) as v FROM weights');
    const newVersion = ((verRow[0].v as number) ?? 2) + 1;

    for (const [pid, v] of Object.entries(parsed.pillar_weights)) {
      await db.query(
        'INSERT INTO weights (variable_id, weight_value, version) VALUES ($1, $2, $3)',
        [`pillar_${pid}`, v, newVersion]
      );
    }
    for (const [sid, v] of Object.entries(parsed.sub_weights)) {
      await db.query(
        'INSERT INTO weights (variable_id, weight_value, version) VALUES ($1, $2, $3)',
        [sid, v, newVersion]
      );
    }

    return NextResponse.json({
      ok: true,
      version: newVersion,
      cases_analyzed: cases.length,
      avg_brier: avgBrier,
      ensemble_weights: newEnsWeights,
      pillar_weights: parsed.pillar_weights,
      sub_weights: parsed.sub_weights,
      reasoning: parsed.reasoning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
