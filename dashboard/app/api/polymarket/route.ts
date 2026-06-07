import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface PolyMarketItem {
  slug: string;
  label: string;
  category: '지정학' | 'AI' | '글로벌경제';
  ourProb: boolean;
  question: string;
  yesPrice: number | null;
  endDate: string | null;
  volumeUsd: number | null;
}

export async function GET() {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, label, category, question, yes_price_pct, end_date, our_prob, volume_usd
     FROM polymarket_markets
     ORDER BY category, end_date ASC NULLS LAST`
  );

  const items: PolyMarketItem[] = rows.map(r => ({
    slug: String(r.id),
    label: r.label,
    category: r.category as PolyMarketItem['category'],
    ourProb: r.our_prob,
    question: r.question ?? r.label,
    yesPrice: r.yes_price_pct ?? null,
    endDate: r.end_date ? (r.end_date as Date).toISOString().slice(0, 10) : null,
    volumeUsd: r.volume_usd ? Number(r.volume_usd) : null,
  }));

  return NextResponse.json(items);
}
