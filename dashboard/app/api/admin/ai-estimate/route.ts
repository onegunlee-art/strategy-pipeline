import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

function parseJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// GET /api/admin/ai-estimate?type=elo&name=LG+CNS
// GET /api/admin/ai-estimate?type=prior&industry=금융
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = req.nextUrl.searchParams.get('type');
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 503 });

  const genAI = new GoogleGenerativeAI(apiKey);
  // @ts-expect-error — tools 키는 SDK 타입에 미반영
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', tools: [{ google_search: {} }] });

  if (type === 'elo') {
    const name = req.nextUrl.searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const prompt = `한국 IT 기업 "${name}"의 최근 1년 B2B 수주 실적과 강점 영역을 조사하세요. JSON으로만 응답:
{
  "summary": "1~2문장 시장 포지션",
  "recent_wins": ["최근 수주 1", "최근 수주 2"],
  "strength_areas": ["강점 영역 1", "강점 영역 2"],
  "estimated_elo_range": [1400, 1750]
}`;
    try {
      const resp = await model.generateContent(prompt);
      const text = resp.response.text();
      const estimate = parseJson(text);
      return NextResponse.json({ estimate, cached: false });
    } catch (e) {
      console.error('[ai-estimate/elo]', e);
      return NextResponse.json({ error: 'Gemini call failed' }, { status: 500 });
    }
  }

  if (type === 'prior') {
    const industry = req.nextUrl.searchParams.get('industry');
    if (!industry) return NextResponse.json({ error: 'industry required' }, { status: 400 });

    const prompt = `한국 ${industry} 산업의 IT SI/구축 사업 시장 base rate (수주 기본 확률)를 조사하세요. JSON으로만 응답:
{
  "summary": "시장 특성 1~2문장",
  "estimated_win_rate_range": [0.2, 0.6],
  "key_dynamics": ["시장 역학 1", "시장 역학 2"]
}`;
    try {
      const resp = await model.generateContent(prompt);
      const text = resp.response.text();
      const estimate = parseJson(text);
      return NextResponse.json({ estimate, cached: false });
    } catch (e) {
      console.error('[ai-estimate/prior]', e);
      return NextResponse.json({ error: 'Gemini call failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'type must be elo or prior' }, { status: 400 });
}
