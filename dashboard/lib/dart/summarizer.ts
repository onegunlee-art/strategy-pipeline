// DART 공시 요약 + 태깅 + relevance 채점. OpenAI gpt-4o-mini 사용.
import OpenAI from 'openai';
import type { DartFilingRaw } from './client';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface FilingSummary {
  summary: string;
  tags: string[];
  relevance_score: number;
}

const SYSTEM = `당신은 B2B 영업 인텔리전스 분석가입니다. DART 공시 한 건을 보고 한국 SI/IT 영업 관점에서 다음을 판단합니다.

상위 태그 후보 (해당하는 것만 선택):
- "임원변동" — CEO/CIO/CDO 등 의사결정자 변경
- "신규사업" — 신규 사업 진출, 사업 다각화
- "M&A" — 합병, 분할, 자회사 변동
- "IT투자" — IT/디지털/AI 관련 투자 공시
- "AI투자" — AI 전용 투자 공시
- "자본지출" — 시설/장비 등 capex 공시
- "공장신설" — 신규 공장/센터 건설
- "정정공시" — 단순 정정
- "일반보고" — 분기/연간 일반 보고

relevance_score 채점 기준 (0-100, B2B IT 영업 관점):
- 임원변동(CIO/CDO/IT 임원) → 70-90
- IT/AI 투자 공시 → 75-100
- M&A, 신규사업, 자본지출 → 60-80
- 일반 사업보고서/분기보고서 → 40-55
- 단순 정정/주식 관련 → 0-30`;

export async function summarizeFiling(raw: DartFilingRaw): Promise<FilingSummary> {
  const c = getClient();
  const userPrompt = `공시 정보:
- 회사: ${raw.corp_name}
- 공시명: ${raw.report_nm}
- 제출인: ${raw.flr_nm}
- 접수일: ${raw.rcept_dt}
- 비고: ${raw.rm || '-'}

JSON으로만 응답:
{
  "summary": "이 공시의 핵심을 1문장으로 (B2B IT 영업 관점 시사점 포함)",
  "tags": ["태그1", "태그2"],
  "relevance_score": 0-100
}`;

  const resp = await c.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = resp.choices[0].message.content ?? '{}';
  try {
    const parsed = JSON.parse(content) as Partial<FilingSummary>;
    return {
      summary: parsed.summary ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      relevance_score: Math.max(0, Math.min(100, Math.round(parsed.relevance_score ?? 0))),
    };
  } catch {
    return { summary: '', tags: [], relevance_score: 0 };
  }
}
