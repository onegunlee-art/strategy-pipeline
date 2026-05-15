// 약점 분해 + 외부 리서치 + 유사 case_studies → SCQA 추론 구조 전략 카드 (SSE 스트리밍)
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { SUB_FACTORS, SubFactorId } from '@/lib/pillars';
import { fetchResearch } from '@/lib/research';

interface WeaknessRow {
  sub_factor_id: SubFactorId;
  score: number;
  pillar: string;
  label: string;
  contribution: number;
}

function findWeaknesses(subScores: Record<string, number>): WeaknessRow[] {
  const sorted = SUB_FACTORS
    .map(f => ({
      sub_factor_id: f.id,
      score: subScores[f.id] ?? 5,
      pillar: f.pillar,
      label: f.label,
      contribution: Math.max(0, (5 - (subScores[f.id] ?? 5)) / 10),
    }))
    .sort((a, b) => a.score - b.score);
  return sorted.slice(0, 3);
}

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const db = await getDb();

    // 1) 딜 + 최신 predictions
    const { rows: dealRows } = await db.query(
      `SELECT d.id, d.client_name, d.industry, d.deal_size, d.execution_unit,
              p.sub_scores, p.predicted_probability
       FROM deals d
       LEFT JOIN predictions p ON p.deal_id = d.id
       WHERE d.id = $1
       ORDER BY p.created_at DESC NULLS LAST
       LIMIT 1`,
      [dealId]
    );
    if (dealRows.length === 0) {
      return NextResponse.json({ error: 'deal not found' }, { status: 404 });
    }
    const deal = dealRows[0];
    const subScores = (typeof deal.sub_scores === 'string' ? JSON.parse(deal.sub_scores) : deal.sub_scores) ?? {};
    const weaknesses = findWeaknesses(subScores);

    // 2) 외부 리서치 + 고객 컨텍스트 병렬 fetch
    const researchPromises = weaknesses.map(w =>
      fetchResearch(db, dealId, {
        kind: 'weakness',
        subFactorId: w.sub_factor_id,
        clientName: deal.client_name,
        industry: deal.industry ?? undefined,
      })
    );
    const customerCtxPromise = fetchResearch(db, dealId, {
      kind: 'customer_context',
      clientName: deal.client_name,
      industry: deal.industry ?? undefined,
    });
    const [researchResults, customerCtx] = await Promise.all([
      Promise.all(researchPromises),
      customerCtxPromise,
    ]);

    // 3) 유사 case_studies (outcome=loss, 같은 industry 우선)
    const { rows: similarCases } = await db.query(
      `SELECT cs.win_loss_cause, cs.lessons_learned, cs.competitors_named, d.client_name, d.industry
       FROM case_studies cs
       JOIN deals d ON d.id = cs.deal_id
       WHERE cs.outcome = 'loss'
       ORDER BY (d.industry = $1) DESC, cs.id DESC
       LIMIT 3`,
      [deal.industry ?? '']
    );

    // API 키 없으면 SSE로 빈 카드 반환 (dev 환경)
    if (!process.env.ANTHROPIC_API_KEY) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseEvent({
            type: 'meta', weaknesses, similar_cases: similarCases,
          })));
          controller.enqueue(encoder.encode(sseEvent({
            type: 'done', note: 'ANTHROPIC_API_KEY 미설정',
          })));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // 4) SCQA 프롬프트 구성
    const weaknessBlock = weaknesses.map((w, i) => {
      const meta = SUB_FACTORS.find(f => f.id === w.sub_factor_id);
      const r = researchResults[i];
      return `약점 ${i + 1}: [${w.pillar}] ${w.label} (${w.sub_factor_id})
- 현재 점수: ${w.score.toFixed(1)}/10
- 설명: ${meta?.description ?? ''}
- 외부 리서치: ${r.text.slice(0, 500) || '(없음)'}`;
    }).join('\n\n');

    const similarBlock = similarCases.map((c, i) =>
      `[사례 ${i + 1}] ${c.client_name} (${c.industry ?? '산업 미상'})
   실주 원인: ${c.win_loss_cause?.slice(0, 200) ?? ''}
   교훈: ${c.lessons_learned?.slice(0, 200) ?? ''}`
    ).join('\n\n');

    const prompt = `당신은 KT B2B 수주전략 전문가입니다. Minto Pyramid의 SCQA 구조(Situation→Complication→Question→Answer)로 전략 카드를 작성하세요.

## 딜 정보 (Situation 작성 시 이 데이터만 활용 — 추측 금지)
- 고객사: ${deal.client_name}
- 산업: ${deal.industry ?? '미상'}
- 현재 수주 확률: ${deal.predicted_probability ?? 'N/A'}%
- 고객 컨텍스트: ${customerCtx.text.slice(0, 400) || '(없음)'}

## 약점 Top 3 + 외부 리서치
${weaknessBlock}

## 유사 실주 사례 (Complication 근거로 사례 번호 인용)
${similarBlock || '(유사 사례 없음)'}

## 출력 규칙
- JSON 배열만 출력 (설명 텍스트, 마크다운 코드블록 없음)
- 각 텍스트 필드는 50자 이내 (토큰 절약, 3개 카드 완성 필수)
- reasoning_trace.situation: 딜 메타에서 추출한 현황 1문장만 (새로운 사실 생성 금지)
- reasoning_trace.complication: 핵심 장애물 1문장 + 유사 사례 인용 시 [사례 N] 번호 명시
- reasoning_trace.question: Complication에서 도출되는 핵심 질문 1문장
- reasoning_trace.answer_summary: 아래 actions의 한줄 요약

## 출력 (JSON 배열)
[
  {
    "sub_factor_id": "...",
    "label": "...",
    "current_score": 4.2,
    "reasoning_trace": {
      "situation": "딜 현황 1-2문장",
      "complication": "핵심 장애물 (유사 사례 [사례 N] 인용)",
      "question": "극복 방향을 묻는 핵심 질문 1문장",
      "answer_summary": "아래 3개 액션의 한줄 요약"
    },
    "cause_hypothesis": "1문장 핵심 원인",
    "external_evidence": "외부 리서치에서 활용한 핵심 한 줄",
    "actions": [
      { "step": "구체적 액션 (3주 내)", "owner": "담당", "duration": "X일" },
      { "step": "...", "owner": "...", "duration": "..." },
      { "step": "...", "owner": "...", "duration": "..." }
    ],
    "expected_score_lift": 2,
    "expected_probability_lift_pp": 8,
    "kt_framework_reference": "KT 프레임워크 참조"
  }
]`;

    // 5) Claude 스트리밍 호출 + SSE 응답
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 메타 이벤트 먼저 전송 (약점 + 유사 사례 즉시 노출)
          controller.enqueue(encoder.encode(sseEvent({
            type: 'meta',
            deal_id: dealId,
            weaknesses,
            similar_cases: similarCases,
          })));

          const stream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          });

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(sseEvent({
                type: 'delta',
                text: event.delta.text,
              })));
            }
          }

          controller.enqueue(encoder.encode(sseEvent({ type: 'done' })));
        } catch (err) {
          controller.enqueue(encoder.encode(sseEvent({
            type: 'error',
            message: String(err),
          })));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET — 캐시된 리서치만 조회
export async function GET(_req: NextRequest, ctx: { params: { deal_id: string } }) {
  try {
    const dealId = parseInt(ctx.params.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'invalid deal_id' }, { status: 400 });
    }
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT topic, source, result_text, result_json, created_at
       FROM external_research WHERE deal_id=$1 ORDER BY created_at DESC`,
      [dealId]
    );
    return NextResponse.json({ ok: true, research: rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
