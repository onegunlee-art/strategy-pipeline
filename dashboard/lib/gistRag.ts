const GIST_RAG_URL = process.env.GIST_RAG_URL ?? '';
const GIST_PARTNER_KEY = process.env.GIST_PARTNER_KEY ?? '';

const GIST_NEWS_BASE = 'https://www.thegist.co.kr/news';
const SIMILARITY_THRESHOLD = 0.35;

// Actual API response fields (as documented by the gist Partner RAG API)
export interface GistArticle {
  news_id: number;
  title: string;
  description?: string;
  published_at?: string;
  topic_category?: string;
  topic_label?: string;
  similarity?: number;
  category?: string;
}

export interface GistCluster {
  name: string;
  question: string;
  article_indices: number[];
  hero_index?: number;
}

// v2-ready analysis interface — full_text always present (v1 compat),
// alignment_points / conflict_points arrive in v2.
export interface GistAnalysis {
  full_text: string;
  synthesis?: string;
  alignment_points?: string[];
  conflict_points?: string[];
  outlook?: string;
}

export interface GistRagResult {
  search: {
    results: GistArticle[];
    insight: string;
    clusters: GistCluster[];
  };
  analysis?: GistAnalysis;
}

export interface GistRagRequest {
  query: string;
  limit?: number;
  include_analysis?: boolean;
  analysis_cluster_name?: string;
}

// Construct article URL from news_id
export function gistArticleUrl(article: GistArticle): string {
  return `${GIST_NEWS_BASE}/${article.news_id}`;
}

// Gist RAG 호출. 설정 없거나 실패 시 null 반환 (호출부에서 fallback 처리).
export async function queryGistRag(req: GistRagRequest): Promise<GistRagResult | null> {
  if (!GIST_RAG_URL || !GIST_PARTNER_KEY) return null;

  try {
    const res = await fetch(GIST_RAG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Key': GIST_PARTNER_KEY,
      },
      body: JSON.stringify({
        query: req.query,
        limit: req.limit ?? 10,
        include_analysis: req.include_analysis ?? false,
        analysis_cluster_name: req.analysis_cluster_name ?? '',
      }),
      signal: AbortSignal.timeout(60_000), // 60초 초과 시 건너뜀
    });

    if (!res.ok) {
      console.error(`[gistRag] HTTP ${res.status} for query="${req.query}"`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await res.json();

    // 응답 구조 진단 로그
    const allResults: unknown[] = Array.isArray(raw?.search?.results) ? raw.search.results : [];
    const filteredCount = allResults.filter((r: unknown) => {
      const a = r as Record<string, unknown>;
      return typeof a.similarity !== 'number' || a.similarity >= SIMILARITY_THRESHOLD;
    }).length;
    const hasInsight = typeof raw?.search?.insight === 'string' && (raw.search.insight as string).trim().length > 0;
    const hasClusters = Array.isArray(raw?.search?.clusters) && (raw.search.clusters as unknown[]).length > 0;
    const hasAnalysis = typeof raw?.analysis?.full_text === 'string' && (raw.analysis.full_text as string).trim().length > 0;
    console.log(`[gistRag] query="${req.query}" raw=${allResults.length} filtered(≥${SIMILARITY_THRESHOLD})=${filteredCount} insight=${hasInsight} clusters=${hasClusters} analysis=${hasAnalysis}`);

    // Filter low-similarity articles before returning
    if (Array.isArray(raw?.search?.results)) {
      raw.search.results = raw.search.results.filter((a: Record<string, unknown>) =>
        typeof a.similarity !== 'number' || a.similarity >= SIMILARITY_THRESHOLD
      );
    }

    if (filteredCount === 0 && !hasInsight && !hasAnalysis) {
      console.warn(`[gistRag] response has no usable content for query="${req.query}"`);
    }

    return raw as GistRagResult;
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    console.error(`[gistRag] ${isTimeout ? 'TIMEOUT (60s)' : 'fetch failed'} for query="${req.query}":`, e);
    return null;
  }
}

// RAG 결과를 Gemini 프롬프트에 주입할 텍스트 블록으로 변환.
// Gist 응답 형태가 예상과 달라도(필드 누락/타입 불일치) 절대 throw 하지 않는다.
export function formatGistContextForPrompt(rag: GistRagResult | null | undefined): string {
  if (!rag || typeof rag !== 'object') return '';
  const search = rag.search ?? ({} as Partial<GistRagResult['search']>);
  const lines: string[] = [];

  if (typeof search.insight === 'string' && search.insight.trim()) {
    lines.push(`[지스트 뉴스 핵심 인사이트]\n${search.insight.trim()}`);
  }

  const clusters = Array.isArray(search.clusters) ? search.clusters : [];
  if (clusters.length > 0) {
    lines.push('\n[주요 이슈 클러스터]');
    for (const c of clusters) {
      if (!c) continue;
      lines.push(`• ${c.name ?? ''}: ${c.question ?? ''}`);
    }
  }

  const results = Array.isArray(search.results) ? search.results : [];
  const articles = results.slice(0, 8);
  if (articles.length > 0) {
    lines.push('\n[관련 뉴스 기사]');
    for (const a of articles) {
      if (!a || !a.title) continue;
      const date = typeof a.published_at === 'string' ? a.published_at.slice(0, 10) : '';
      const src = a.topic_category ?? '';
      lines.push(`• [${date}${src ? ' ' + src : ''}] ${a.title}${a.description ? ' — ' + a.description : ''}`);
    }
  }

  if (rag.analysis) {
    const a = rag.analysis;
    if (a.alignment_points?.length || a.conflict_points?.length) {
      // v2 structured format
      if (a.synthesis) lines.push(`\n[핵심 결론]\n${a.synthesis}`);
      if (a.alignment_points?.length) {
        lines.push('\n[일치하는 점]');
        a.alignment_points.forEach(p => lines.push(`• ${p}`));
      }
      if (a.conflict_points?.length) {
        lines.push('\n[충돌하는 점]');
        a.conflict_points.forEach(p => lines.push(`• ${p}`));
      }
      if (a.outlook) lines.push(`\n[향후 전망]\n${a.outlook}`);
    } else if (typeof a.full_text === 'string' && a.full_text.trim()) {
      // v1 prose fallback
      lines.push(`\n[지스트 종합 분석 (일치·충돌)]\n${a.full_text.trim()}`);
    }
  }

  const result = lines.join('\n');
  if (!result) {
    console.warn('[gistRag] formatGistContextForPrompt: all sections empty — no usable content from Gist response');
  } else {
    console.log(`[gistRag] formatted context: ${lines.length} section(s), ${result.length} chars`);
  }
  return result;
}
