const GIST_RAG_URL = process.env.GIST_RAG_URL ?? '';
const GIST_PARTNER_KEY = process.env.GIST_PARTNER_KEY ?? '';

export interface GistArticle {
  id: number;
  title: string;
  summary?: string;
  published_at?: string;
  source?: string;
  url?: string;
}

export interface GistCluster {
  name: string;
  question: string;
  article_indices: number[];
}

export interface GistRagResult {
  search: {
    results: GistArticle[];
    insight: string;
    clusters: GistCluster[];
  };
  analysis?: {
    full_text: string;
  };
}

export interface GistRagRequest {
  query: string;
  limit?: number;
  include_analysis?: boolean;
  analysis_cluster_name?: string;
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

    // 응답 구조 진단 로그 — 어떤 필드가 실제로 왔는지 기록
    const articlesCount = Array.isArray(raw?.search?.results) ? (raw.search.results as unknown[]).length : 0;
    const hasInsight = typeof raw?.search?.insight === 'string' && (raw.search.insight as string).trim().length > 0;
    const hasClusters = Array.isArray(raw?.search?.clusters) && (raw.search.clusters as unknown[]).length > 0;
    const hasAnalysis = typeof raw?.analysis?.full_text === 'string' && (raw.analysis.full_text as string).trim().length > 0;
    console.log(`[gistRag] query="${req.query}" articles=${articlesCount} insight=${hasInsight} clusters=${hasClusters} analysis=${hasAnalysis}`);
    if (articlesCount === 0 && !hasInsight && !hasAnalysis) {
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
// 여기서 예외가 나면 호출부에서 Gemini 생성 전체가 스킵되므로 방어가 중요.
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
      const src = a.source ?? '';
      lines.push(`• [${date}${src ? ' ' + src : ''}] ${a.title}${a.summary ? ' — ' + a.summary : ''}`);
    }
  }

  if (rag.analysis && typeof rag.analysis.full_text === 'string' && rag.analysis.full_text.trim()) {
    lines.push(`\n[지스트 전문 분석]\n${rag.analysis.full_text.trim()}`);
  }

  const result = lines.join('\n');
  if (!result) {
    console.warn('[gistRag] formatGistContextForPrompt: all sections empty — no usable content from Gist response');
  } else {
    console.log(`[gistRag] formatted context: ${lines.length} section(s), ${result.length} chars`);
  }
  return result;
}
