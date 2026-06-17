import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';

export const maxDuration = 60;

const PILLAR_LABELS: Record<string, string> = {
  S: '사전영업 수준',
  V: 'Value Impact',
  D: '차별화',
  P: '가격경쟁력',
  E: 'Delivery 경쟁력',
};

export async function POST(req: NextRequest) {
  try {
    const { dealId, stage, pillarScores, weaknesses, nextMoves, deal } = await req.json();

    if (!dealId || !stage) {
      return NextResponse.json({ error: 'dealId and stage required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build per-pillar context for LLM
    const pillarContext = (['S', 'V', 'D', 'P', 'E'] as const).map(pid => {
      const score = Math.round((pillarScores?.[pid] ?? 0) * 100 * 10) / 10;
      const weakList = (weaknesses ?? [])
        .filter((w: { pillar: string }) => w.pillar === pid)
        .map((w: { label: string; score: number }) => `${w.label}(${w.score}/10)`)
        .join(', ') || '없음';
      return `- ${PILLAR_LABELS[pid]}(${pid}): 평가점수 ${score}점, Weak Point: ${weakList}`;
    }).join('\n');

    const clientName = deal?.client_name ?? '고객사';
    const dealSize = deal?.deal_size ?? '미기재';
    const evalCriteria = deal?.customer_eval_criteria ?? '미기재';

    const prompt = `당신은 B2B 수주전략 전문가입니다.
아래는 "${clientName}" 사업의 ${stage} 단계 수주 분석 결과입니다.

사업 개요:
- 사업 규모: ${dealSize}
- 평가 기준: ${evalCriteria}

Pillar별 평가 현황:
${pillarContext}

각 Pillar에 대해 "현재 단계 현수준"을 2~3문장으로 서술해 주세요.
문체 예시: "수요처 의사결정 구조를 개략적으로만 파악하고 있음. Key Man 접촉은 실무 수준에 머물러 있으며, 최종 의사결정권자와의 관계 형성이 미흡함."

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "S": "현수준 2~3문장",
  "V": "현수준 2~3문장",
  "D": "현수준 2~3문장",
  "P": "현수준 2~3문장",
  "E": "현수준 2~3문장"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let narratives: Record<string, string> = {};
    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) narratives = JSON.parse(jsonMatch[0]);
    } catch {
      // fallback: score-based defaults
      (['S', 'V', 'D', 'P', 'E'] as const).forEach(pid => {
        const score = Math.round((pillarScores?.[pid] ?? 0) * 100);
        narratives[pid] = `현재 ${PILLAR_LABELS[pid]} 영역의 평가 점수는 ${score}점 수준으로, 개선이 필요한 항목이 존재함.`;
      });
    }

    // Save snapshot to DB
    const pool = await getDb();
    const snapshotJson = { pillarScores, weaknesses, nextMoves, deal };
    const { rows } = await pool.query(
      `INSERT INTO stage_snapshots (deal_id, stage, snapshot_json, narrative_json)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [dealId, stage, JSON.stringify(snapshotJson), JSON.stringify(narratives)]
    );

    return NextResponse.json({ narratives, snapshotId: rows[0].id });
  } catch (err) {
    console.error('[stage-snapshot]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
