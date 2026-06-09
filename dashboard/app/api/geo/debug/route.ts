import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDb } from '@/lib/db';

// 환경·OpenAI·DB 상태를 즉시 진단하는 읽기 전용 엔드포인트.
// 배포 후 /api/geo/debug 를 브라우저에서 열어 키/모델/DB를 확인.
export const maxDuration = 30;

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'o4-mini';
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim() || undefined;

export async function GET() {
  const openaiModel = OPENAI_MODEL;
  const openaiKeyPresent = !!OPENAI_KEY;

  // OpenAI ping
  let openaiPing: { ok: boolean; rawLen?: number; error?: string } = { ok: false };
  if (OPENAI_KEY) {
    try {
      const client = new OpenAI({ apiKey: OPENAI_KEY });
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0]?.message?.content ?? '';
      openaiPing = { ok: true, rawLen: raw.length };
    } catch (e) {
      openaiPing = { ok: false, error: String(e) };
    }
  } else {
    openaiPing = { ok: false, error: 'OPENAI_API_KEY not set' };
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
    openaiKeyPresent,
    openaiModel,
    openaiPing,
    dbColumns,
    dbError,
  });
}
