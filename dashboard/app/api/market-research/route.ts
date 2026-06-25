import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

async function fetchNaverNews(company: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(company + ' IT 사업')}&display=10&sort=date`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: NaverNewsItem) => ({
      ...item,
      title: item.title.replace(/<[^>]+>/g, ''),
      description: item.description.replace(/<[^>]+>/g, ''),
    }));
  } catch {
    return [];
  }
}

function buildPrompt(
  projectName: string,
  customerName: string,
  businessDesc: string,
  competitors: string[],
  newsMap: Record<string, NaverNewsItem[]>,
): string {
  const newsSection = competitors.map(c => {
    const items = newsMap[c] ?? [];
    const headlines = items.slice(0, 5).map(i => `- ${i.title} (${i.pubDate})`).join('\n');
    return `[${c} 최근 뉴스]\n${headlines || '(뉴스 없음)'}`;
  }).join('\n\n');

  return `당신은 KT B2B 영업 전략 전문가입니다.
아래 사업 정보와 경쟁사 뉴스를 분석하여 수주전략 리서치를 작성하세요.

사업명: ${projectName}
고객사: ${customerName}
사업 내용/RFP 핵심: ${businessDesc}
경쟁사: ${competitors.join(', ')}

${newsSection}

아래 JSON 형식으로만 응답하세요. 추가 설명 없이 JSON만:
{
  "analysis_3c": {
    "company": {
      "strengths": ["KT 강점1", "KT 강점2", "KT 강점3"],
      "positioning": "KT의 이 사업에서의 포지셔닝 1~2문장"
    },
    "customer": {
      "needs": ["고객 핵심 니즈1", "니즈2", "니즈3"],
      "eval_criteria": ["평가기준1", "평가기준2", "평가기준3"]
    },
    "competitors": [${competitors.map(c => JSON.stringify({name:c,strategy:"예상 전략",strengths:["강점1","강점2"],weaknesses:["약점1","약점2"]})).join(',')}]
  },
  "swot": {
    "strengths": ["KT 강점1", "강점2", "강점3"],
    "weaknesses": ["KT 약점1", "약점2"],
    "opportunities": ["기회1", "기회2", "기회3"],
    "threats": ["위협1", "위협2"]
  },
  "opportunity": {
    "key_opportunities": ["핵심 기회1", "기회2", "기회3"],
    "differentiation": ["KT 차별화 포인트1", "포인트2", "포인트3"],
    "strategy": "종합 수주전략 방향 2~3문장"
  }
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { projectName, customerName, businessDesc, competitors } = await req.json() as {
      projectName: string;
      customerName: string;
      businessDesc: string;
      competitors: string[];
    };

    if (!competitors?.length) {
      return NextResponse.json({ ok: false, error: '경쟁사를 1개 이상 입력하세요.' }, { status: 400 });
    }

    // Step 1: Naver News 병렬 수집
    const newsResults = await Promise.allSettled(
      competitors.map(c => fetchNaverNews(c))
    );
    const newsMap: Record<string, NaverNewsItem[]> = {};
    competitors.forEach((c, i) => {
      const r = newsResults[i];
      newsMap[c] = r.status === 'fulfilled' ? r.value : [];
    });

    // Step 2: Claude Haiku로 분석
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY 미설정' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(projectName, customerName, businessDesc, competitors, newsMap);

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) {
      return NextResponse.json({ ok: false, error: 'AI 응답 파싱 실패', raw }, { status: 500 });
    }

    const parsed = JSON.parse(m[0]);

    return NextResponse.json({
      ok: true,
      newsMap,
      analysis_3c: parsed.analysis_3c,
      swot: parsed.swot,
      opportunity: parsed.opportunity,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
