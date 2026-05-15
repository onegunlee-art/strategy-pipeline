// 외부 리서치 라이브러리 — Google Gemini 2.5 Pro + Search Grounding
// 캐시: external_research 테이블 (UNIQUE deal_id + topic)
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Pool } from 'pg';
import type { SubFactorId } from './pillars';

export type ResearchTopic =
  | { kind: 'weakness'; subFactorId: SubFactorId; clientName?: string; industry?: string }
  | { kind: 'customer_context'; clientName: string; industry?: string }
  | { kind: 'competitor_elo'; competitorName: string }
  | { kind: 'similar_reference'; clientName: string; industry?: string }
  | { kind: 'market_base_rate'; industry: string }
  // v0.5 AI 컨텍스트 레이어 — Layer 2 (참고 전용)
  | { kind: 'kt_news' }
  | { kind: 'competitor_trend'; competitorName: string }
  | { kind: 'ai_mega_project'; industry?: string }
  | { kind: 'consortium_trend'; partnerName?: string };

export interface ResearchResult {
  text: string;
  json?: unknown;
  cached: boolean;
  source: string;
}

function serializeTopic(t: ResearchTopic): string {
  switch (t.kind) {
    case 'weakness': return `weakness:${t.subFactorId}`;
    case 'customer_context': return `customer_context`;
    case 'competitor_elo': return `competitor_elo:${t.competitorName}`;
    case 'similar_reference': return `similar_reference`;
    case 'market_base_rate': return `market_base_rate:${t.industry}`;
    case 'kt_news': return `kt_news`;
    case 'competitor_trend': return `competitor_trend:${t.competitorName}`;
    case 'ai_mega_project': return `ai_mega_project:${t.industry ?? 'general'}`;
    case 'consortium_trend': return `consortium_trend:${t.partnerName ?? 'general'}`;
  }
}

function buildPrompt(t: ResearchTopic): { prompt: string; useGrounding: boolean } {
  switch (t.kind) {
    case 'weakness':
      return {
        useGrounding: true,
        prompt: `당신은 한국 B2B SI 영업 전문가입니다. KT가 진행 중인 "${t.clientName ?? '딜'}" (산업: ${t.industry ?? '미상'}) 사업에서 다음 약점에 대한 외부 시장 컨텍스트를 조사하세요.

약점 영역: ${t.subFactorId}

다음 형식의 JSON으로만 응답하세요:
{
  "summary": "1~2문장 시장 컨텍스트",
  "evidence": ["관련 최근 사실 1", "관련 최근 사실 2", "관련 최근 사실 3"],
  "actionable_insight": "이 약점을 보완하기 위해 KT가 즉시 활용 가능한 1가지 단서"
}`,
      };

    case 'customer_context':
      return {
        useGrounding: true,
        prompt: `한국 B2B 영업 정보 수집. 고객사: "${t.clientName}" (산업: ${t.industry ?? '미상'}).

최근 1년 이내 다음 정보를 웹 검색으로 찾아 JSON으로 응답:
{
  "summary": "고객사 현황 1~2문장",
  "recent_news": ["최근 발표/뉴스 1", "최근 발표/뉴스 2"],
  "leadership_changes": "임원 변경 사항 (없으면 빈 문자열)",
  "it_budget_signals": "IT 예산/투자 신호",
  "decision_timing_hint": "발주 시점 예측 단서"
}`,
      };

    case 'competitor_elo':
      return {
        useGrounding: true,
        prompt: `한국 IT 기업 "${t.competitorName}"의 최근 1년 B2B 수주 실적과 강점 영역을 조사하세요. JSON으로 응답:
{
  "summary": "1~2문장 시장 포지션",
  "recent_wins": ["최근 수주 1", "최근 수주 2"],
  "strength_areas": ["강점 영역 1", "강점 영역 2"],
  "estimated_elo_range": [1400, 1750]
}`,
      };

    case 'similar_reference':
      return {
        useGrounding: false,
        prompt: `KT가 진행한 "${t.clientName}" (산업: ${t.industry ?? '미상'})과 유사한 B2B SI 사업 사례를 추론해서 응답하세요. JSON:
{
  "similar_segments": ["유사 영역 1", "유사 영역 2"],
  "common_winning_factors": ["일반적 수주 요인 1", "수주 요인 2"],
  "common_losing_factors": ["일반적 실주 요인 1"]
}`,
      };

    case 'market_base_rate':
      return {
        useGrounding: true,
        prompt: `한국 ${t.industry} 산업의 IT SI/구축 사업 시장 base rate (수주 기본 확률)를 조사하세요. JSON:
{
  "summary": "시장 특성 1~2문장",
  "estimated_win_rate_range": [0.2, 0.6],
  "key_dynamics": ["시장 역학 1", "시장 역학 2"]
}`,
      };

    case 'kt_news':
      return {
        useGrounding: true,
        prompt: `KT(케이티)의 최근 6개월 B2B/엔터프라이즈 사업 관련 뉴스, 신규 전략, 조직 변화, AI/클라우드 역량 발표를 검색하여 JSON으로 응답하세요:
{
  "summary": "KT B2B 현황 1~2문장",
  "recent_announcements": ["최근 발표 1", "최근 발표 2", "최근 발표 3"],
  "competitive_strengths": ["경쟁 강점 1", "경쟁 강점 2"],
  "watch_points": ["주의 사항 1", "주의 사항 2"]
}`,
      };

    case 'competitor_trend':
      return {
        useGrounding: true,
        prompt: `한국 IT 기업 "${t.competitorName}"의 최근 6개월 B2B 수주 동향, 신규 제품/서비스 발표, 전략 변화를 검색하여 JSON으로 응답하세요:
{
  "summary": "${t.competitorName} 최근 동향 1~2문장",
  "recent_wins": ["최근 수주/계약 1", "최근 수주/계약 2"],
  "new_capabilities": ["신규 역량/서비스 1", "신규 역량/서비스 2"],
  "strategic_direction": "전략 방향 1문장",
  "threat_level": "high|medium|low"
}`,
      };

    case 'ai_mega_project':
      return {
        useGrounding: true,
        prompt: `한국 ${t.industry ? `${t.industry} 산업` : '공공/금융/제조'} 분야의 최근 6개월 AI 대형 구축 사업 (100억원 이상) 동향을 검색하여 JSON으로 응답하세요:
{
  "summary": "AI 대형 사업 동향 1~2문장",
  "major_projects": ["주요 사업 1 (발주기관, 규모)", "주요 사업 2", "주요 사업 3"],
  "winning_vendors": ["수주 기업 1", "수주 기업 2"],
  "key_requirements": ["핵심 요구사항 1", "핵심 요구사항 2"],
  "market_trend": "시장 트렌드 1문장"
}`,
      };

    case 'consortium_trend':
      return {
        useGrounding: true,
        prompt: `한국 IT 프로젝트 컨소시엄 동향을 조사하세요. ${t.partnerName ? `특히 "${t.partnerName}"의 최근 컨소시엄 참여 현황을 포함하여 ` : ''}JSON으로 응답:
{
  "summary": "컨소시엄 동향 1~2문장",
  "active_partners": ["주요 협력사 1 (역할)", "주요 협력사 2 (역할)"],
  "recent_consortiums": ["최근 컨소시엄 사례 1", "최근 컨소시엄 사례 2"],
  "partnership_tips": ["파트너십 팁 1", "파트너십 팁 2"]
}`,
      };
  }
}

function parseJsonFromText(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function fetchResearch(
  pool: Pool,
  dealId: number,
  topic: ResearchTopic
): Promise<ResearchResult> {
  const topicKey = serializeTopic(topic);

  // 1) 캐시 확인
  const { rows: cached } = await pool.query(
    `SELECT result_text, result_json, source FROM external_research
     WHERE deal_id=$1 AND topic=$2`,
    [dealId, topicKey]
  );
  if (cached.length > 0) {
    return {
      text: cached[0].result_text ?? '',
      json: cached[0].result_json,
      cached: true,
      source: cached[0].source,
    };
  }

  // 2) Gemini 호출 (API 키 없으면 빈 결과)
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { text: '', json: null, cached: false, source: 'unavailable' };
  }

  const { prompt, useGrounding } = buildPrompt(topic);

  let text = '';
  let source = 'gemini-2.5-pro';
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelConfig: Parameters<typeof genAI.getGenerativeModel>[0] = {
      model: 'gemini-2.5-pro',
    };
    if (useGrounding) {
      // @ts-expect-error — tools 키는 SDK 타입에 미반영
      modelConfig.tools = [{ google_search: {} }];
      source = 'gemini-2.5-pro-grounded';
    }
    const model = genAI.getGenerativeModel(modelConfig);
    const resp = await model.generateContent(prompt);
    text = resp.response.text();
  } catch (e) {
    console.error('[research] Gemini error:', e);
    return { text: '', json: null, cached: false, source: 'error' };
  }

  const json = parseJsonFromText(text);

  // 3) 저장
  try {
    await pool.query(
      `INSERT INTO external_research (deal_id, topic, source, query, result_text, result_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (deal_id, topic) DO UPDATE
       SET result_text = EXCLUDED.result_text,
           result_json = EXCLUDED.result_json,
           created_at = NOW()`,
      [dealId, topicKey, source, prompt.slice(0, 500), text, json ? JSON.stringify(json) : null]
    );
  } catch (e) {
    console.error('[research] save failed:', e);
  }

  return { text, json: json ?? undefined, cached: false, source };
}
