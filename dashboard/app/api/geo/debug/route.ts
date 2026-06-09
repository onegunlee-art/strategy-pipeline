import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, GEMINI_KEY } from '@/lib/geminiModel';
import { getDb } from '@/lib/db';

// 환경·Gemini·DB 상태를 즉시 진단하는 읽기 전용 엔드포인트.
// 배포 후 /api/geo/debug 를 브라우저에서 열어 키/모델/DB를 확인.
export const maxDuration = 30;

const GEMINI_KEY_NAMES = [
  'GEMINI_API_KEY', 'GEMINI_KEY', 'Gemini_Api_Key', 'Gemini_API_Key',
  'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_GEMINI_API_KEY',
];

function resolveKeySource(): string | null {
  for (const name of GEMINI_KEY_NAMES) {
    if ((process.env[name] ?? '').trim().length > 0) return name;
  }
  return null;
}

export async function GET() {
  const geminiKeySource = resolveKeySource();
  const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash (default)';

  // Gemini ping
  let geminiPing: { ok: boolean; rawLen?: number; error?: string } = { ok: false };
  if (GEMINI_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent('Reply with exactly: {"ok":true}');
      const raw = result.response.text();
      geminiPing = { ok: true, rawLen: raw.length };
    } catch (e) {
      geminiPing = { ok: false, error: String(e) };
    }
  } else {
    geminiPing = { ok: false, error: 'GEMINI_KEY not set' };
  }

  // DB column check
  let dbColumns: string[] = [];
  let dbError: string | null = null;
  try {
    const db = await getDb();
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'geo_signal_cards' ORDER BY ordinal_position`
    );
    dbColumns = rows.map(r => r.column_name);
  } catch (e) {
    dbError = String(e);
  }

  return NextResponse.json({
    geminiKeySource,
    geminiModel,
    geminiPing,
    dbColumns,
    dbError,
  });
}
