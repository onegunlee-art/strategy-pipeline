import { NextResponse } from 'next/server';
import { POLYMARKET_SLUGS, PolyMeta } from '@/lib/polymarketMeta';

export const revalidate = 300; // 5-minute cache

export interface PolyMarketItem {
  slug: string;
  label: string;
  category: PolyMeta['category'];
  ourProb: boolean;
  question: string;
  yesPrice: number | null; // 0–100
  endDate: string | null;
}

export async function GET() {
  const slugs = Object.keys(POLYMARKET_SLUGS);

  // Try gamma API: fetch events by slug
  const results: PolyMarketItem[] = [];

  try {
    const slugList = slugs.join(',');
    const url = `https://gamma-api.polymarket.com/events?slug=${slugList}&limit=50`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; StrategyPipeline/1.0)',
        'Origin': 'https://polymarket.com',
        'Referer': 'https://polymarket.com/',
      },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const events = await res.json() as Array<{
        slug: string;
        title: string;
        endDate?: string;
        markets?: Array<{ outcomePrices?: string; question: string }>;
      }>;

      for (const event of events) {
        const meta = POLYMARKET_SLUGS[event.slug];
        if (!meta) continue;
        const market = event.markets?.[0];
        let yesPrice: number | null = null;
        if (market?.outcomePrices) {
          try {
            const prices = JSON.parse(market.outcomePrices) as string[];
            yesPrice = Math.round(parseFloat(prices[0]) * 100);
          } catch { /* skip */ }
        }
        results.push({
          slug: event.slug,
          label: meta.label,
          category: meta.category,
          ourProb: meta.ourProb ?? false,
          question: event.title || market?.question || meta.label,
          yesPrice,
          endDate: event.endDate ?? null,
        });
      }
    }
  } catch { /* fallback below */ }

  // Supplement any missing slugs with static metadata (no price data)
  const found = new Set(results.map(r => r.slug));
  for (const [slug, meta] of Object.entries(POLYMARKET_SLUGS)) {
    if (!found.has(slug)) {
      results.push({
        slug,
        label: meta.label,
        category: meta.category,
        ourProb: meta.ourProb ?? false,
        question: meta.label,
        yesPrice: null,
        endDate: null,
      });
    }
  }

  // Sort by category order then label
  const ORDER: Record<string, number> = { '지정학': 0, 'AI': 1, '글로벌경제': 2 };
  results.sort((a, b) => (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9) || a.label.localeCompare(b.label, 'ko'));

  return NextResponse.json(results);
}
