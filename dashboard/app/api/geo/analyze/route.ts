import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { queryGistRag, formatGistContextForPrompt, GistArticle, GistCluster } from '@/lib/gistRag';
import {
  GeoDriver, computeGeoProb, normalizeDriverMeta,
  FALLBACK_DRIVER_META, FALLBACK_DRIVER_SCORES,
} from '@/lib/geoDrivers';

export const maxDuration = 300;

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'o4-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;

export async function POST(req: NextRequest) {
  try {
    const { topic: rawTopic } = await req.json() as { topic?: string };
    const topic = (rawTopic ?? '').trim();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    let driverMeta: GeoDriver[] = [];
    let driverScores: Record<string, number> = {};
    let gistArticles: GistArticle[] = [];
    let gistInsight = '';
    let gistAnalysis = '';
    let gistClusters: GistCluster[] = [];
    let gistAlignment: string[] = [];
    let gistConflict: string[] = [];

    // Gist RAG: 기사 수집
    try {
      const gistRag = await queryGistRag({
        query: topic, limit: 10, include_analysis: true, analysis_cluster_name: topic,
      });
      if (gistRag?.search?.results) gistArticles = gistRag.search.results;
      if (gistRag?.search?.insight) gistInsight = gistRag.search.insight;
      if (gistRag?.analysis?.full_text) gistAnalysis = gistRag.analysis.full_text;
      if (Array.isArray(gistRag?.search?.clusters)) gistClusters = gistRag.search.clusters;
      if (Array.isArray(gistRag?.analysis?.alignment_points)) gistAlignment = gistRag.analysis.alignment_points;
      if (Array.isArray(gistRag?.analysis?.conflict_points)) gistConflict = gistRag.analysis.conflict_points;
      console.log(`[geo/analyze] Gist alignment=${gistAlignment.length} conflict=${gistConflict.length}`);
      if (!gistArticles.length && !gistInsight && !gistAnalysis) {
        console.warn(`[geo/analyze] Gist returned no usable content for topic="${topic}"`);
      }
    } catch (gistErr) {
      const isTimeout = gistErr instanceof Error && gistErr.name === 'AbortError';
      console.error(`[geo/analyze] Gist ${isTimeout ? 'TIMEOUT' : 'ERROR'} for topic="${topic}":`, gistErr);
    }

    if (OPENAI_KEY) {
      try {
        const gistContext = formatGistContextForPrompt({
          search: { results: gistArticles, insight: gistInsight, clusters: gistClusters },
          analysis: gistAnalysis ? { full_text: gistAnalysis } : undefined,
        });

        const client = new OpenAI({ apiKey: OPENAI_KEY });

        const alignmentSection = gistAlignment.length > 0
          ? `\n[가능성 상승 근거 — 아래 각 항목이 지지하는 드라이버 score를 +0.5~1 높여서 반영]\n` +
            gistAlignment.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
          : '';
        const conflictSection = gistConflict.length > 0
          ? `\n[가능성 저하 근거 — 아래 각 항목이 관련된 드라이버 score를 -0.5~1 낮춰서 반영]\n` +
            gistConflict.map((p, i) => `  ${i + 1}. ${p}`).join('\n')
          : '';

        const prompt = `당신은 FA(Foreign Affairs)·이코노미스트·FT 등 글로벌 미디어를 분석하는 수석 전략 컨설턴트입니다. 모든 출력은 반드시 한국어로 작성하세요.

분석 주제: "${topic}"
${gistContext ? `\n최신 뉴스 컨텍스트 (아래 기사를 드라이버 점수 산정에 적극 반영):\n${gistContext}\n` : ''}${alignmentSection}${conflictSection}

이 주제에 가장 적합한 5개의 평가 드라이버를 정의하고, 위 기사 내용을 기반으로 각 드라이버의 현재 점수를 산정하세요.
위의 [가능성 상승 근거]와 [가능성 저하 근거]를 반드시 드라이버 score에 반영하세요.

규칙:
- key는 반드시 d1, d2, d3, d4, d5 (이 순서대로)
- labelKo: 한글 축이름 8자 이내
- labelEn: 영문 12자 이내
- invert: true면 "값이 높을수록 달성 가능성↓" (예: 군사 강도, 외부 개입), false면 "높을수록↑" (예: 외교 채널, 협상 의지)
- score: 기사 분석 기반 0~10 정수. 기사가 없으면 5 사용. 주제 맥락에 맞게 신중하게 차별화하여 점수 부여
- 최소 2개 invert=false, 최소 2개 invert=true
- 이란 전용 축(호르무즈 등)처럼 특정 주제에 편향된 드라이버 사용 금지 — 주제 맥락에 맞게 새로 정의`;

        const response = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'geo_drivers',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  drivers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key:     { type: 'string' },
                        labelKo: { type: 'string' },
                        labelEn: { type: 'string' },
                        invert:  { type: 'boolean' },
                        score:   { type: 'number' },
                      },
                      required: ['key', 'labelKo', 'labelEn', 'invert', 'score'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['drivers'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawText = response.choices[0]?.message?.content ?? '';
        console.log(`[geo/analyze] OpenAI response length=${rawText.length}`);
        const parsed = JSON.parse(rawText) as { drivers: Array<{ key: string; labelKo: string; labelEn: string; invert: boolean; score: number }> };

        if (Array.isArray(parsed.drivers) && parsed.drivers.length > 0) {
          const meta: GeoDriver[] = [];
          const scores: Record<string, number> = {};
          parsed.drivers.forEach((d, i) => {
            const key = d.key || `d${i + 1}`;
            meta.push({
              key,
              labelKo: d.labelKo || `드라이버 ${i + 1}`,
              labelEn: d.labelEn || `Driver ${i + 1}`,
              invert: d.invert === true,
            });
            scores[key] = Math.max(0, Math.min(10, Math.round(d.score ?? 5)));
          });
          driverMeta = normalizeDriverMeta(meta);
          driverScores = scores;
          console.log(`[geo/analyze] drivers OK — scores=${JSON.stringify(scores)}`);
        }
      } catch (e) {
        console.error('[geo/analyze] OpenAI generation failed:', e);
      }
    }

    // Fallback: AI 실패 시 범용 드라이버
    if (driverMeta.length === 0) {
      driverMeta = FALLBACK_DRIVER_META;
      driverScores = { ...FALLBACK_DRIVER_SCORES };
      console.warn('[geo/analyze] Using fallback drivers (no OpenAI key or generation failed)');
    }
    for (const m of driverMeta) {
      if (typeof driverScores[m.key] !== 'number') driverScores[m.key] = 5;
    }

    const geoProb = computeGeoProb(driverMeta, driverScores);
    console.log(`[geo/analyze] geoProb=${geoProb}%`);

    return NextResponse.json({ gistArticles, gistInsight, gistAnalysis, gistClusters, driverMeta, driverScores, geoProb });
  } catch (e) {
    console.error('[geo/analyze]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
