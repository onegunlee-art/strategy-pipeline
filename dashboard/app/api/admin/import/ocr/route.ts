// PDF OCR — Claude vision으로 수주/실주 데이터 추출
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const OCR_PROMPT = `당신은 B2B 영업 데이터 추출 전문가입니다.
아래 문서는 수주/실주 현황 표입니다. 모든 데이터 행을 JSON 배열로 추출하세요.

출력 스키마 (각 행):
{
  "client_name": "사업명 또는 고객사명 (텍스트 그대로)",
  "industry": "본부명 또는 사업부명",
  "risk": 정수 1~5 (없으면 3),
  "result": "win" | "loss" | "수의" | "drop" | "unknown",
  "announced_at": "YYYY-MM-DD" 또는 null,
  "profit_rate": 소수 0.0~1.0 또는 null
}

결과 분류 규칙:
- 수주, 낙찰, 선정 → "win"
- 실주, 탈락, 낙찰실패 → "loss"
- 수의계약, 수의 → "수의"
- 포기, 철수, Drop → "drop"
- 발표일 없거나 미확정 → announced_at: null
- 이익율은 "15%" → 0.15 형태로 변환, 없으면 null
- Risk 컬럼이 없으면 모든 행에 null 대신 3 사용

반드시 JSON 배열만 출력하세요. 헤더행·합계행은 제외하세요.`;

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file 필드 없음' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    if (!ext || !allowedTypes.includes(ext)) {
      return NextResponse.json({ error: 'PDF 또는 이미지 파일만 지원합니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const isPdf = ext === 'pdf';
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const contentBlock = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (
              ext === 'png' ? 'image/png' :
              ext === 'webp' ? 'image/webp' : 'image/jpeg'
            ) as 'image/png' | 'image/jpeg' | 'image/webp',
            data: base64,
          },
        };

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: OCR_PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    // JSON 배열 파싱
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({
        error: 'JSON 배열 파싱 실패',
        raw: text.slice(0, 500),
      }, { status: 422 });
    }

    const rows = JSON.parse(match[0]) as Array<{
      client_name: string;
      industry: string;
      risk: number;
      result: string;
      announced_at: string | null;
      profit_rate: number | null;
    }>;

    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
