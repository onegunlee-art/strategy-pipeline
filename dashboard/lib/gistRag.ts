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

    return (await res.json()) as GistRagResult;
  } catch (e) {
    console.error('[gistRag] fetch failed:', e);
    return null;
  }
}

// RAG 결과를 Gemini 프롬프트에 주입할 텍스트 블록으로 변환
export function formatGistContextForPrompt(rag: GistRagResult): string {
  const lines: string[] = [];

  if (rag.search.insight) {
    lines.push(`[지스트 뉴스 핵심 인사이트]\n${rag.search.insight}`);
  }

  if (rag.search.clusters.length > 0) {
    lines.push('\n[주요 이슈 클러스터]');
    for (const c of rag.search.clusters) {
      lines.push(`• ${c.name}: ${c.question}`);
    }
  }

  const articles = rag.search.results.slice(0, 8);
  if (articles.length > 0) {
    lines.push('\n[관련 뉴스 기사]');
    for (const a of articles) {
      const date = a.published_at ? a.published_at.slice(0, 10) : '';
      const src = a.source ?? '';
      lines.push(`• [${date}${src ? ' ' + src : ''}] ${a.title}${a.summary ? ' — ' + a.summary : ''}`);
    }
  }

  if (rag.analysis?.full_text) {
    lines.push(`\n[지스트 전문 분석]\n${rag.analysis.full_text}`);
  }

  return lines.join('\n');
}
