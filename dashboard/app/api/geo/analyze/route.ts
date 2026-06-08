import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { queryGistRag, formatGistContextForPrompt, GistArticle } from '@/lib/gistRag';
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

export async function POST(req: NextRequest) {
  try {
    const { topic: rawTopic } = await req.json() as { topic?: string };
    const topic = (rawTopic ?? '').trim();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    let driverMeta: GeoDriver[] = [];
    let driverScores: Record<string, number> = {};
    let gistArticles: GistArticle[] = [];
    let gistInsight = '';

    // Gist RAG: 기사 수집 (Gemini와 독립적으로 항상 시도)
    try {
      const gistRag = await queryGistRag({
        query: topic, limit: 10, include_analysis: true, analysis_cluster_name: topic,
      });
      if (gistRag?.search?.results) gistArticles = gistRag.search.results;
      if (gistRag?.search?.insight) gistInsight = gistRag.search.insight;
      if (!gistArticles.length && !gistInsight) {
        console.warn(`[geo/analyze] Gist returned no usable content for topic="${topic}"`);
      }
    } catch (gistErr) {
      const isTimeout = gistErr instanceof Error && gistErr.name === 'AbortError';
      console.error(`[geo/analyze] Gist ${isTimeout ? 'TIMEOUT' : 'ERROR'} for topic="${topic}":`, gistErr);
    }

    if (GEMINI_KEY) {
      try {
        // Gemini: 드라이버 5축 + 점수만 계산 (기사 텍스트는 Gemini가 재작성하지 않음)
        const gistContext = formatGistContextForPrompt({
          search: { results: gistArticles, insight: gistInsight, clusters: [] },
        });

        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `당신은 지정학 리스크 분석 전문가입니다. 주제 "${topic}"에 대해 JSON 하나만 출력하세요.
${gistContext ? `\n최신 뉴스 컨텍스트 (지스트 검색 — 아래를 드라이버 점수 산정에 적극 반영):\n${gistContext}\n` : ''}
이 주제에 가장 적합한 **5개의 평가 드라이버(축)를 직접 정의**하세요. 이란 전용 축(호르무즈 등)을 그대로 쓰지 말고 주제 맥락에 맞게 새로 만드세요.

출력 규칙 (마크다운 코드블록 없이 JSON만):
{
  "drivers": [
    { "key": "d1", "labelKo": "한글 축이름(8자 이내)", "labelEn": "Short English(12자 이내)", "invert": false, "score": 0 },
    { "key": "d2", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0 },
    { "key": "d3", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0 },
    { "key": "d4", "labelKo": "...", "labelEn": "...", "invert": false, "score": 0 },
    { "key": "d5", "labelKo": "...", "labelEn": "...", "invert": true, "score": 0 }
  ]
}

규칙:
- key는 반드시 d1,d2,d3,d4,d5 정확히 이 5개.
- invert=true 는 "값이 높을수록 종전/완화 가능성이 낮아지는" 축(예: 군사 강도, 외부 개입). invert=false 는 높을수록 가능성이 높아지는 축(예: 외교 채널, 협상 의지).
- score: 현재 뉴스 기사 기반 0~10 평가값(원점수). 뉴스가 없으면 중립값 5 사용.
- 최소 2개는 invert=false, 최소 2개는 invert=true 로 균형.`;

        const result = await model.generateContent(prompt);
        const parsed = extractJsonObject(result.response.text());
        if (parsed && Array.isArray(parsed.drivers)) {
          const meta: GeoDriver[] = [];
          const scores: Record<string, number> = {};
          (parsed.drivers as unknown[]).forEach((d: unknown, i: number) => {
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
      } catch (e) {
        console.error('[geo/analyze] Gemini generation failed:', e);
      }
    }

    // Fallback: AI 실패 시 범용 드라이버
    if (driverMeta.length === 0) {
      driverMeta = FALLBACK_DRIVER_META;
      driverScores = { ...FALLBACK_DRIVER_SCORES };
    }
    for (const m of driverMeta) {
      if (typeof driverScores[m.key] !== 'number') driverScores[m.key] = 5;
    }

    const geoProb = computeGeoProb(driverMeta, driverScores);

    return NextResponse.json({ gistArticles, gistInsight, driverMeta, driverScores, geoProb });
  } catch (e) {
    console.error('[geo/analyze]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
