import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { brierScore, VARIABLE_META } from '@/lib/algorithm';
import Anthropic from '@anthropic-ai/sdk';

interface PredictionRow {
  deal_id: number;
  client_name: string;
  predicted_probability: number;
  variables_json: string;
  weights_used_json: string;
  actual_result: number;
  closed_at: string;
}

export async function POST() {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        d.id as deal_id,
        d.client_name,
        p.predicted_probability,
        p.variables_json,
        p.weights_used_json,
        o.actual_result,
        o.closed_at
      FROM outcomes o
      JOIN deals d ON d.id = o.deal_id
      JOIN predictions p ON p.deal_id = o.deal_id
      ORDER BY o.closed_at DESC
      LIMIT 50
    `).all() as PredictionRow[];

    if (rows.length < 3) {
      return NextResponse.json({
        ok: false,
        message: '학습에 최소 3건의 결과 데이터가 필요합니다.',
        current: rows.length,
      });
    }

    const cases = rows.map(r => ({
      client_name: r.client_name,
      predicted: r.predicted_probability,
      actual: r.actual_result,
      brier: brierScore(r.predicted_probability, r.actual_result),
      variables: JSON.parse(r.variables_json),
      weights_used: JSON.parse(r.weights_used_json),
    }));

    const currentWeightRows = db.prepare(`
      SELECT variable_id, weight_value FROM weights w
      WHERE updated_at = (
        SELECT MAX(updated_at) FROM weights w2 WHERE w2.variable_id = w.variable_id
      )
    `).all() as { variable_id: string; weight_value: number }[];

    const currentWeights: Record<string, number> = {};
    currentWeightRows.forEach(r => { currentWeights[r.variable_id] = r.weight_value; });

    const avgBrier = cases.reduce((s, c) => s + c.brier, 0) / cases.length;

    const variableLabels = Object.entries(VARIABLE_META)
      .map(([k, v]) => `  - ${k} (${v.label}, invert=${v.invert}): 현재 가중치 ${((currentWeights[k] ?? v.defaultWeight) * 100).toFixed(1)}%`)
      .join('\n');

    const casesSummary = cases.slice(0, 20).map((c, i) =>
      `  ${i + 1}. ${c.client_name}: 예측 ${c.predicted.toFixed(1)}% → 실제 ${c.actual === 1 ? '수주' : '실패'} (Brier: ${c.brier.toFixed(3)})`
    ).join('\n');

    const prompt = `당신은 B2B 영업 수주 예측 모델의 가중치를 최적화하는 전문가입니다.

## 현재 변수 및 가중치
${variableLabels}

## 최근 예측 결과 (${cases.length}건, 평균 Brier Score: ${avgBrier.toFixed(3)})
${casesSummary}

## 임무
위 데이터를 분석하여 예측 정확도를 높이기 위한 새로운 가중치를 JSON으로 반환하세요.

규칙:
- 모든 가중치 합계 = 1.0
- 각 가중치 범위: 0.05 ~ 0.35
- 오차가 큰 케이스에서 어떤 변수가 잘못 평가되었는지 분석
- invert=true 변수(위협도)는 높을수록 불리하므로 이를 고려

다음 JSON 형식으로만 응답하세요 (설명 없이):
{
  "weights": {
    "decision_maker_access": 0.22,
    "past_win_history": 0.15,
    "price_competitiveness": 0.18,
    "tech_differentiation": 0.13,
    "lg_cns_threat": 0.14,
    "samsung_sds_threat": 0.10,
    "budget_confirmed": 0.08
  },
  "reasoning": "한국어로 2-3문장 설명"
}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, message: 'Claude 응답 파싱 실패', raw: responseText }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { weights: Record<string, number>; reasoning: string };

    const total = Object.values(parsed.weights).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 1.0) > 0.05) {
      return NextResponse.json({ ok: false, message: `가중치 합계 오류: ${total}` }, { status: 500 });
    }

    const currentVersion = (db.prepare('SELECT MAX(version) as v FROM weights').get() as { v: number }).v ?? 1;
    const newVersion = currentVersion + 1;

    const insert = db.prepare(
      'INSERT INTO weights (variable_id, weight_value, version) VALUES (?, ?, ?)'
    );
    const insertAll = db.transaction(() => {
      Object.entries(parsed.weights).forEach(([varId, val]) => {
        insert.run(varId, val, newVersion);
      });
    });
    insertAll();

    return NextResponse.json({
      ok: true,
      version: newVersion,
      cases_analyzed: cases.length,
      avg_brier: avgBrier,
      new_weights: parsed.weights,
      reasoning: parsed.reasoning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
