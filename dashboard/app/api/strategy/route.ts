// 약점 sub-factor → Gemini API → 액션 카드 생성
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL } from '@/lib/geminiModel';
import { SUB_FACTORS, SubFactorId } from '@/lib/pillars';

interface StrategyBody {
  client_name: string;
  deal_size?: string;
  industry?: string;
  weaknesses: Array<{
    id: SubFactorId;
    label: string;
    pillar: string;
    score: number;
    contribution: number;
  }>;
  current_probability: number;
  competitors?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as StrategyBody;
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.Gemini_API_Key ?? process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const weaknessSummary = body.weaknesses.map((w, i) => {
      const meta = SUB_FACTORS.find(f => f.id === w.id);
      return `${i + 1}. [${w.pillar}] ${w.label} (${w.id})
   현재: ${w.score}/10
   설명: ${meta?.description ?? ''}
   확률 끌어내림: ${(w.contribution * 100).toFixed(1)}%p`;
    }).join('\n\n');

    const prompt = `당신은 KT B2B 수주전략 전문가입니다. Win Ratio 제고를 위해 가장 약한 sub-factor 3개에 대한 액션 카드를 작성하세요.

## 딜 정보
- 고객사: ${body.client_name}
- 딜 규모: ${body.deal_size ?? '미상'}
- 산업: ${body.industry ?? '미상'}
- 현재 수주 확률: ${body.current_probability.toFixed(1)}%
- 경쟁사: ${body.competitors?.join(', ') ?? '미상'}

## 약점 Top 3
${weaknessSummary}

## 임무
각 약점에 대해 3주 내 실행 가능한 액션을 제안하고, 예상 효과를 정량적으로 추정하세요.

## 출력 형식 (JSON 배열, 다른 텍스트 없이)
[
  {
    "sub_factor_id": "v_customer_kpi",
    "cause_hypothesis": "한 문장으로 핵심 원인",
    "actions": [
      { "step": "구체적 액션 1 (3주 내)", "owner": "담당 역할", "duration": "X일" },
      { "step": "구체적 액션 2", "owner": "...", "duration": "..." },
      { "step": "구체적 액션 3", "owner": "...", "duration": "..." }
    ],
    "expected_score_lift": 2,
    "expected_probability_lift_pp": 8,
    "kt_framework_reference": "KT 문서의 어느 부분과 연결되는지 (Deal Selection / 제안 경쟁력 / 실행 경쟁력 중 하나)"
  }
]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ ok: false, message: 'Gemini 응답 파싱 실패', raw: text }, { status: 500 });
    }
    const cards = JSON.parse(match[0]);

    return NextResponse.json({ ok: true, cards });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
