// Portfolio View — EV 계산 + Recommendation

export type Recommendation = 'NO_GO' | 'PRIORITY' | 'WATCH';

export interface PortfolioDeal {
  id: number;
  client_name: string;
  industry: string | null;
  deal_size_eok: number;
  win_probability: number;     // 0~100
  ev_eok: number;              // EV (억원) = win_prob × deal_size
  risk: number | null;
  average_spread: number;      // 0~10 (voter spread 평균, 없으면 0)
  voter_count: number;
  recommendation: Recommendation;
  source: string;              // 'manual' | 'import' | 'seed_2025Q4'
}

// 규칙: NO_GO: prob < 30%, PRIORITY: prob ≥ 60% AND spread ≤ 1.5 AND EV ≥ 상위 30%
//       WATCH: 그 외
export function computeRecommendation(
  winProb: number,
  evEok: number,
  spread: number,
  evCutoffTop30: number
): Recommendation {
  if (winProb < 30) return 'NO_GO';
  if (winProb >= 60 && spread <= 1.5 && evEok >= evCutoffTop30) return 'PRIORITY';
  return 'WATCH';
}

export function deriveRecommendations(deals: Omit<PortfolioDeal, 'recommendation'>[]): PortfolioDeal[] {
  if (deals.length === 0) return [];
  // EV 상위 30% 컷
  const sortedEv = [...deals].map(d => d.ev_eok).sort((a, b) => b - a);
  const topIdx = Math.max(0, Math.floor(deals.length * 0.30) - 1);
  const cutoff = sortedEv[topIdx] ?? sortedEv[0] ?? 0;

  return deals.map(d => ({
    ...d,
    recommendation: computeRecommendation(d.win_probability, d.ev_eok, d.average_spread, cutoff),
  }));
}
