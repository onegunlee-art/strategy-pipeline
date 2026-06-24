// 경쟁사 인텔리전스 수집·분류·전략 도출 모듈
// Layer 1: DART 공시 (오차 0)
// Layer 2: Gemini search grounding (실제 URL만 저장)
// Layer 3: 수동 입력
import type { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { GEMINI_MODEL, GEMINI_KEY } from './geminiModel';
import { getDb } from './db';

export interface IntelArticle {
  id?: number;
  article_date?: string | null;   // 'YYYY-MM-DD'
  entity_type: 'self' | 'competitor';
  entity_name: string;
  stance: '강점' | '약점';
  title: string;
  keywords: string[];
  content?: string | null;
  source?: string | null;         // 신문사명
  url?: string | null;
  attack_points: string[];
  strategy_tips: string[];
  fetch_source?: string;
  created_at?: string;
}

export interface IntelFilter {
  entity_name?: string;
  entity_type?: string;
  stance?: string;
  days?: number;
  limit?: number;
}

export interface StrategyOutput {
  attack_points: string[];
  defense_tips: string[];
  summary: string;
}

// ─── DB CRUD ──────────────────────────────────────────────────────────────────

export async function listArticles(filter: IntelFilter = {}): Promise<IntelArticle[]> {
  const pool = await getDb();
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filter.entity_name) {
    params.push(filter.entity_name);
    conditions.push(`entity_name = $${params.length}`);
  }
  if (filter.entity_type) {
    params.push(filter.entity_type);
    conditions.push(`entity_type = $${params.length}`);
  }
  if (filter.stance) {
    params.push(filter.stance);
    conditions.push(`stance = $${params.length}`);
  }
  if (filter.days) {
    conditions.push(`(article_date IS NULL OR article_date >= NOW() - INTERVAL '${Number(filter.days)} days')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filter.limit ? `LIMIT ${Number(filter.limit)}` : 'LIMIT 200';

  const { rows } = await pool.query<IntelArticle>(
    `SELECT * FROM competitive_intel_articles ${where} ORDER BY article_date DESC NULLS LAST, created_at DESC ${limitClause}`,
    params
  );
  return rows;
}

export async function upsertArticle(article: IntelArticle): Promise<IntelArticle> {
  const pool = await getDb();
  const { rows } = await pool.query<IntelArticle>(
    `INSERT INTO competitive_intel_articles
      (article_date, entity_type, entity_name, stance, title, keywords, content, source, url, attack_points, strategy_tips, fetch_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (entity_name, url) WHERE url IS NOT NULL
     DO UPDATE SET
       stance = EXCLUDED.stance,
       title = EXCLUDED.title,
       keywords = EXCLUDED.keywords,
       content = EXCLUDED.content,
       source = EXCLUDED.source,
       attack_points = EXCLUDED.attack_points,
       strategy_tips = EXCLUDED.strategy_tips
     RETURNING *`,
    [
      article.article_date || null,
      article.entity_type,
      article.entity_name,
      article.stance,
      article.title,
      JSON.stringify(article.keywords ?? []),
      article.content || null,
      article.source || null,
      article.url || null,
      JSON.stringify(article.attack_points ?? []),
      JSON.stringify(article.strategy_tips ?? []),
      article.fetch_source ?? 'manual',
    ]
  );
  return rows[0];
}

export async function deleteArticle(id: number): Promise<void> {
  const pool = await getDb();
  await pool.query(`DELETE FROM competitive_intel_articles WHERE id = $1`, [id]);
}

// ─── Claude Haiku: 기사 분류 ─────────────────────────────────────────────────

async function classifyArticle(
  title: string,
  content: string,
  entityName: string,
  entityType: 'self' | 'competitor'
): Promise<Pick<IntelArticle, 'stance' | 'keywords' | 'attack_points' | 'strategy_tips'>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { stance: '강점', keywords: [], attack_points: [], strategy_tips: [] };
  }
  const client = new Anthropic({ apiKey });
  const entityLabel = entityType === 'self' ? '자사 (KT)' : `경쟁사 (${entityName})`;
  const prompt = `회사: ${entityLabel}
기사 제목: ${title}
기사 내용: ${content.slice(0, 600)}

위 기사를 한국 B2B IT 영업 관점에서 분석하세요. JSON으로만 응답:
{
  "stance": "강점" 또는 "약점",
  "keywords": ["핵심키워드1","핵심키워드2","핵심키워드3"],
  "attack_points": ["공격포인트 (경쟁사 약점 활용, 자사 강점 부각) — 없으면 빈 배열"],
  "strategy_tips": ["대응전략 1문장 — 없으면 빈 배열"]
}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(m[0]) as any;
    return {
      stance: parsed.stance === '약점' ? '약점' : '강점',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
      attack_points: Array.isArray(parsed.attack_points) ? parsed.attack_points : [],
      strategy_tips: Array.isArray(parsed.strategy_tips) ? parsed.strategy_tips : [],
    };
  } catch {
    return { stance: '강점', keywords: [], attack_points: [], strategy_tips: [] };
  }
}

// ─── Layer 2: Gemini Search Grounding ────────────────────────────────────────

export async function fetchGeminiNews(
  entityName: string,
  entityType: 'self' | 'competitor'
): Promise<{ saved: number; errors: string[] }> {
  if (!GEMINI_KEY) {
    return { saved: 0, errors: ['GEMINI_API_KEY 미설정 — Gemini 수집 건너뜀'] };
  }

  const entityLabel = entityType === 'self' ? `${entityName} (KT)` : entityName;
  const recentMonths = entityType === 'self' ? 6 : 6;
  const prompt = `한국 IT 기업 "${entityLabel}"의 최근 ${recentMonths}개월 B2B 사업 관련 뉴스 기사를 검색하세요.

다음 JSON 형식으로만 응답하세요. 반드시 실제 기사에 근거한 내용만 포함하세요:
{
  "articles": [
    {
      "date": "YYYY-MM-DD",
      "title": "기사 제목 (정확한 원문 제목)",
      "content": "기사 핵심 내용 2~3문장",
      "source": "신문사명",
      "stance_hint": "강점" 또는 "약점",
      "url_hint": "기사 URL (알고 있으면)"
    }
  ]
}

강점 예시: 대형 수주, AI/클라우드 투자, MOU 체결, 신규 사업, 조직 강화
약점 예시: 장애/사고, 실적 부진, 규제 제재, 인력 감소, 경쟁 패배
기사는 최대 8건만 포함하고, 반드시 실제 언론에 보도된 것만 포함하세요.`;

  const errors: string[] = [];
  let articles: IntelArticle[] = [];

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    // @ts-expect-error — tools 키는 SDK 타입에 미반영
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, tools: [{ google_search: {} }] });
    const resp = await model.generateContent(prompt);

    // 실제 URL 추출 (groundingMetadata — 할루시네이션 방지 핵심)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidate = (resp.response as any).candidates?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groundingChunks: Array<{ web?: { uri?: string; title?: string } }> =
      candidate?.groundingMetadata?.groundingChunks ?? [];
    const realUrls = groundingChunks
      .filter(c => c.web?.uri)
      .map(c => ({ url: c.web!.uri!, title: c.web!.title ?? '' }));

    const text = resp.response.text();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON 파싱 실패');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(m[0]) as { articles?: any[] };
    const rawArticles = Array.isArray(parsed.articles) ? parsed.articles : [];

    // 각 기사에 실제 URL 매핑 (title 유사도 기반) + AI 분류
    for (let i = 0; i < rawArticles.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = rawArticles[i] as any;
      if (!a.title) continue;

      // URL: grounding chunks에서 인덱스 기반 매핑 (순서 보존)
      const matchedUrl = realUrls[i]?.url ?? a.url_hint ?? null;

      const classification = await classifyArticle(
        a.title,
        a.content ?? '',
        entityName,
        entityType
      );

      articles.push({
        article_date: a.date || null,
        entity_type: entityType,
        entity_name: entityName,
        stance: a.stance_hint === '약점' ? '약점' : classification.stance,
        title: a.title,
        keywords: classification.keywords,
        content: a.content || null,
        source: a.source || null,
        url: matchedUrl,
        attack_points: classification.attack_points,
        strategy_tips: classification.strategy_tips,
        fetch_source: 'gemini_search',
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${entityName} Gemini 수집 오류: ${msg}`);
    return { saved: 0, errors };
  }

  // DB 저장 (중복 URL은 ON CONFLICT로 업데이트)
  let saved = 0;
  for (const article of articles) {
    try {
      await upsertArticle(article);
      saved++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`저장 실패 (${article.title.slice(0, 40)}): ${msg}`);
    }
  }

  return { saved, errors };
}

// ─── Layer 1: DART 공시 → intel 테이블 동기화 ────────────────────────────────

export async function syncDartToIntel(pool?: Pool): Promise<{ synced: number; errors: string[] }> {
  const db = pool ?? (await getDb());
  const errors: string[] = [];

  // DART 공시에서 relevance_score >= 50 인 것만 가져옴
  const { rows: filings } = await db.query(`
    SELECT f.rcept_no, f.corp_name, f.rcept_dt, f.report_nm, f.summary, f.tags, f.relevance_score,
           m.entity_type_hint
    FROM dart_filings f
    LEFT JOIN (
      SELECT corp_name,
             CASE WHEN corp_name ILIKE '%KT%' OR corp_name = 'KT' THEN 'self' ELSE 'competitor' END as entity_type_hint
      FROM dart_corp_map
    ) m ON m.corp_name = f.corp_name
    WHERE f.relevance_score >= 50
      AND NOT EXISTS (
        SELECT 1 FROM competitive_intel_articles
        WHERE fetch_source = 'dart' AND url = 'dart:' || f.rcept_no
      )
    ORDER BY f.rcept_dt DESC
    LIMIT 100
  `);

  let synced = 0;
  for (const f of filings) {
    try {
      const tags: string[] = Array.isArray(f.tags) ? f.tags : [];
      // 강점/약점 추론: 정정공시, 일반보고 → 약점 가능성, IT/AI투자 → 강점
      const weakTags = ['정정공시', '이슈', '제재', '처분'];
      const stance: '강점' | '약점' = tags.some(t => weakTags.includes(t)) ? '약점' : '강점';

      await upsertArticle({
        article_date: f.rcept_dt ? String(f.rcept_dt).slice(0, 10) : null,
        entity_type: (f.entity_type_hint as 'self' | 'competitor') ?? 'competitor',
        entity_name: f.corp_name,
        stance,
        title: f.report_nm ?? '(제목 없음)',
        keywords: tags,
        content: f.summary ?? null,
        source: 'DART 공시',
        url: `dart:${f.rcept_no}`,
        attack_points: [],
        strategy_tips: [],
        fetch_source: 'dart',
      });
      synced++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`DART 동기화 실패 (${f.rcept_no}): ${msg}`);
    }
  }

  return { synced, errors };
}

// ─── 전략 도출 (Claude Haiku) ─────────────────────────────────────────────────

export async function generateStrategy(): Promise<StrategyOutput> {
  const db = await getDb();

  // 최근 90일 기사 집계
  const { rows } = await db.query(`
    SELECT entity_type, entity_name, stance, title, keywords, content, attack_points, strategy_tips
    FROM competitive_intel_articles
    WHERE article_date >= NOW() - INTERVAL '90 days' OR article_date IS NULL
    ORDER BY article_date DESC NULLS LAST
    LIMIT 50
  `);

  if (rows.length === 0) {
    return {
      attack_points: ['수집된 기사가 없습니다. 뉴스 자동 수집을 먼저 실행하세요.'],
      defense_tips: [],
      summary: '',
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      attack_points: ['ANTHROPIC_API_KEY 미설정'],
      defense_tips: [],
      summary: '전략 분석을 위해 API 키를 설정하세요.',
    };
  }

  const selfItems = rows.filter(r => r.entity_type === 'self');
  const compItems = rows.filter(r => r.entity_type === 'competitor');

  const selfSummary = selfItems.map(r => `[자사 ${r.stance}] ${r.title}: ${r.content ?? ''}`).join('\n');
  const compSummary = compItems.map(r => `[${r.entity_name} ${r.stance}] ${r.title}: ${r.content ?? ''}`).join('\n');

  const client = new Anthropic({ apiKey });
  const prompt = `당신은 KT B2B 영업 전략가입니다. 아래 최근 기사 분석을 바탕으로 공격포인트와 경쟁전략을 도출하세요.

[자사 (KT) 동향]
${selfSummary || '데이터 없음'}

[경쟁사 동향]
${compSummary || '데이터 없음'}

다음 JSON으로만 응답하세요:
{
  "attack_points": ["공격포인트 1 (경쟁사 약점 활용 또는 자사 강점 부각)", "공격포인트 2", "공격포인트 3"],
  "defense_tips": ["방어 전략 1 (자사 약점 보완 또는 경쟁사 강점 대응)", "방어 전략 2", "방어 전략 3"],
  "summary": "종합 전략 방향 2~3문장"
}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(m[0]) as any;
    return {
      attack_points: Array.isArray(parsed.attack_points) ? parsed.attack_points : [],
      defense_tips: Array.isArray(parsed.defense_tips) ? parsed.defense_tips : [],
      summary: parsed.summary ?? '',
    };
  } catch (e) {
    return {
      attack_points: [],
      defense_tips: [],
      summary: `전략 생성 오류: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
