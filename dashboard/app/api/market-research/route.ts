import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface IntelItem {
  date: string;
  category: '자사강점' | '자사약점' | '경쟁사강점' | '경쟁사약점';
  subject: string;
  title: string;
  keywords: string;
  content: string;
  source: string;
  link: string;
}

function buildAnalysisPrompt(
  projectName: string,
  customerName: string,
  businessDesc: string,
  competitors: string[],
): string {
  return `당신은 KT B2B 영업 전략 전문가입니다.
아래 사업 정보를 분석하여 수주전략 리서치를 작성하세요.

사업명: ${projectName}
고객사: ${customerName}
사업 내용/RFP 핵심: ${businessDesc}
경쟁사: ${competitors.join(', ')}

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

function buildIntelPrompt(
  projectName: string,
  customerName: string,
  businessDesc: string,
  competitors: string[],
): string {
  return `당신은 KT B2B 수주 전략 전문가입니다.
아래 사업 정보를 바탕으로, KT(자사)와 경쟁사에 관한 IT/비즈니스 뉴스 인텔리전스 아이템을 생성하세요.
실제 언론에서 보도될 법한 구체적인 내용으로 작성하고, 자사(KT) 강점/약점과 경쟁사 강점/약점으로 분류하세요.

사업명: ${projectName}
고객사: ${customerName}
사업내용: ${businessDesc}
경쟁사: ${competitors.join(', ')}

아래 JSON 배열 형식으로만 응답하세요. 추가 설명 없이 JSON 배열만:
[
  {
    "date": "2025-11",
    "category": "자사강점",
    "subject": "KT",
    "title": "기사 제목",
    "keywords": "핵심 키워드1, 키워드2",
    "content": "기사 핵심 내용 2~3문장. 구체적인 수치나 사업명 포함.",
    "source": "전자신문",
    "link": ""
  }
]

규칙:
- category는 반드시 "자사강점", "자사약점", "경쟁사강점", "경쟁사약점" 중 하나
- subject: 자사 항목은 "KT", 경쟁사 항목은 해당 회사명
- KT 자사강점 2건, KT 자사약점 2건, 각 경쟁사별 강점 1~2건 + 약점 1건씩 포함
- 총 10~14건
- source는 실제 IT 언론사명 (전자신문, ZDNet Korea, 아이뉴스24, 디지털데일리, 연합뉴스, 뉴스1, 조선비즈 등)
- 사업 도메인(${customerName}, ${projectName})에 맞는 구체적인 내용으로 작성`;
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY 미설정' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const [analysisMsg, intelMsg] = await Promise.all([
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildAnalysisPrompt(projectName, customerName, businessDesc, competitors) }],
      }),
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: buildIntelPrompt(projectName, customerName, businessDesc, competitors) }],
      }),
    ]);

    const analysisRaw = analysisMsg.content[0]?.type === 'text' ? analysisMsg.content[0].text : '';
    const analysisMatch = analysisRaw.match(/\{[\s\S]*\}/);
    if (!analysisMatch) {
      return NextResponse.json({ ok: false, error: 'AI 분석 응답 파싱 실패', raw: analysisRaw }, { status: 500 });
    }
    const parsed = JSON.parse(analysisMatch[0]);

    const intelRaw = intelMsg.content[0]?.type === 'text' ? intelMsg.content[0].text : '';
    let newsItems: IntelItem[] = [];
    const intelMatch = intelRaw.match(/\[[\s\S]*\]/);
    if (intelMatch) {
      try {
        newsItems = JSON.parse(intelMatch[0]);
      } catch {
        newsItems = [];
      }
    }

    return NextResponse.json({
      ok: true,
      newsItems,
      analysis_3c: parsed.analysis_3c,
      swot: parsed.swot,
      opportunity: parsed.opportunity,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
