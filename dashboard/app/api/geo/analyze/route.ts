import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { queryGistRag, formatGistContextForPrompt } from '@/lib/gistRag';
import {
  GeoDriver, computeGeoProb, normalizeDriverMeta,
  FALLBACK_DRIVER_META, FALLBACK_DRIVER_SCORES,
} from '@/lib/geoDrivers';

export const maxDuration = 300;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0; let inString = false; let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>; } catch { return null; }
      }
    }
  }
  return null;
}

// 토픽 기반 범용 fallback 분석 텍스트 (AI 실패 시 빈 화면 방지)
function fallbackAnalysisText(topic: string): string {
  return `분석 주제: ${topic}\n\n━━ 핵심 결론 ━━\n현재 ${topic} 관련 정세는 외교·군사·경제 변수가 복합적으로 작용하고 있습니다. 실시간 데이터 수집이 일시적으로 제한되어 범용 프레임으로 분석합니다.\n\n━━ 종합 판단 ━━\n단기 종전/완화 가능성은 군사적 긴장 수준과 외교 채널 가동 여부에 좌우됩니다. 경제 압박이 심화될수록 협상 유인이 커지는 구조입니다.`;
}

export async function POST(req: NextRequest) {
  try {
    const { topic: rawTopic } = await req.json() as { topic?: string };
    const topic = (rawTopic ?? '').trim();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    let analysisText = '';
    let driverMeta: GeoDriver[] = [];
    let driverScores: Record<string, number> = {};

    if (GEMINI_KEY) {
      try {
        // Gist RAG: 실제 뉴스 컨텍스트 (실패해도 Gemini는 진행)
        let gistContext = '';
        try {
          const gistRag = await queryGistRag({
            query: topic, limit: 10, include_analysis: true, analysis_cluster_name: topic,
          });
          gistContext = formatGistContextForPrompt(gistRag);
          if (!gistContext) console.warn(`[geo/analyze] Gist returned no usable content for topic="${topic}"`);
        } catch (gistErr) {
          const isTimeout = gistErr instanceof Error && gistErr.name === 'AbortError';
          console.error(`[geo/analyze] Gist ${isTimeout ? 'TIMEOUT' : 'ERROR'} for topic="${topic}":`, gistErr);
        }

        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `당신은 지정학 리스크 분석 전문가입니다. 주제 "${topic}"에 대해 JSON 하나만 출력하세요.
${gistContext ? `\n최신 뉴스 컨텍스트 (지스트 검색 — 아래를 분석과 드라이버 점수에 적극 반영):\n${gistContext}\n` : ''}
이 주제에 가장 적합한 **5개의 평가 드라이버(축)를 직접 정의**하세요. 이란 전용 축(호르무즈 등)을 그대로 쓰지 말고 주제 맥락에 맞게 새로 만드세요.

출력 규칙 (마크다운 코드블록 없이 JSON만):
{
  "analysisText": "분석 보고서 본문. 다음 구조를 줄바꿈(\\n)으로 포함: '분석 주제: ${topic}', '━━ 핵심 결론 ━━' 3~4문장, '━━ 일치 신호 (종전/완화 가능성 ↑) ━━' 3개 불릿(• 로 시작), '━━ 충돌 신호 (가능성 ↓) ━━' 3개 불릿, '━━ 종합 판단 ━━' 2~3문장. 실제 날짜·기관 포함.",
  "drivers": [
    { "key": "d1", "labelKo": "한글 축이름(8자 이내)", "labelEn": "Short English(12자 이내)", "invert": false, "score": 0~10 },
    { "key": "d2", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0~10 },
    { "key": "d3", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0~10 },
    { "key": "d4", "labelKo": "...", "labelEn": "...", "invert": false, "score": 0~10 },
    { "key": "d5", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0~10 }
  ]
}

규칙:
- key는 반드시 d1,d2,d3,d4,d5 정확히 이 5개.
- invert=true 는 "값이 높을수록 종전/완화 가능성이 낮아지는" 축(예: 군사 강도, 외부 개입). invert=false 는 높을수록 가능성이 높아지는 축(예: 외교 채널, 협상 의지).
- score: 현재 상황의 0~10 평가값(원점수).
- 최소 2개는 invert=false, 최소 2개는 invert=true 로 균형.`;

        const result = await model.generateContent(prompt);
        const parsed = extractJsonObject(result.response.text());
        if (parsed) {
          if (typeof parsed.analysisText === 'string') analysisText = parsed.analysisText;
          if (Array.isArray(parsed.drivers)) {
            const meta: GeoDriver[] = [];
            const scores: Record<string, number> = {};
            parsed.drivers.forEach((d: unknown, i: number) => {
              const dd = d as Record<string, unknown>;
              const key = typeof dd.key === 'string' && dd.key ? dd.key : `d${i + 1}`;
              meta.push({
                key,
                labelKo: typeof dd.labelKo === 'string' ? dd.labelKo : `드라이버 ${i + 1}`,
                labelEn: typeof dd.labelEn === 'string' ? dd.labelEn : `Driver ${i + 1}`,
                invert: dd.invert === true,
              });
              const s = typeof dd.score === 'number' ? dd.score : 5;
              scores[key] = Math.max(0, Math.min(10, s));
            });
            driverMeta = normalizeDriverMeta(meta);
            driverScores = scores;
          }
        }
      } catch (e) {
        console.error('[geo/analyze] Gemini generation failed:', e);
      }
    }

    // Fallback: AI 실패/부분실패 시 빈 화면 방지
    if (!analysisText) analysisText = fallbackAnalysisText(topic);
    if (driverMeta.length === 0) {
      driverMeta = FALLBACK_DRIVER_META;
      driverScores = { ...FALLBACK_DRIVER_SCORES };
    }
    // 점수 누락 키 보정
    for (const m of driverMeta) {
      if (typeof driverScores[m.key] !== 'number') driverScores[m.key] = 5;
    }

    const geoProb = computeGeoProb(driverMeta, driverScores);

    return NextResponse.json({ analysisText, driverMeta, driverScores, geoProb });
  } catch (e) {
    console.error('[geo/analyze]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
