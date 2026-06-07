export type PolyCategory = '지정학' | 'AI' | '글로벌경제';

export interface PolyMeta {
  label: string;
  category: PolyCategory;
  ourProb?: true; // mark if our geoProb is the comparison value
}

// Market slugs used to search gamma-api.polymarket.com
// Slug = last path segment of the Polymarket URL (e.g. polymarket.com/event/<slug>)
export const POLYMARKET_SLUGS: Record<string, PolyMeta> = {
  // ── 지정학 ─────────────────────────────────────────────────────────────────
  'will-iran-and-the-us-reach-a-nuclear-deal-in-2025': {
    label: '이란-미국 핵합의 2025',
    category: '지정학',
    ourProb: true,
  },
  'will-there-be-a-ceasefire-in-ukraine-by-end-of-2025': {
    label: '우크라이나 휴전 2025년 내',
    category: '지정학',
  },
  'will-there-be-a-ceasefire-in-gaza-by-end-of-2025': {
    label: '가자 휴전 2025년 내',
    category: '지정학',
  },
  'will-north-korea-conduct-a-nuclear-test-in-2025': {
    label: '북한 핵실험 2025',
    category: '지정학',
  },
  'will-china-invade-taiwan-before-2028': {
    label: '중국 대만 침공 2028 이전',
    category: '지정학',
  },
  'will-the-strait-of-hormuz-be-blocked-in-2025': {
    label: '호르무즈 봉쇄 2025',
    category: '지정학',
    ourProb: true,
  },
  'will-iran-launch-a-direct-attack-on-israel-in-2025': {
    label: '이란 이스라엘 직접 공격 2025',
    category: '지정학',
  },
  // ── AI ──────────────────────────────────────────────────────────────────────
  'will-openai-release-gpt-5-by-end-of-2025': {
    label: 'GPT-5 2025년 내 출시',
    category: 'AI',
  },
  'will-agi-be-achieved-by-2026': {
    label: 'AGI 달성 2026 이전',
    category: 'AI',
  },
  'will-us-pass-federal-ai-regulation-in-2025': {
    label: '미국 연방 AI 규제법 통과 2025',
    category: 'AI',
  },
  'will-openai-go-public-in-2025': {
    label: '오픈AI IPO 2025',
    category: 'AI',
  },
  'will-china-ai-surpass-us-ai-by-2026': {
    label: '중국 AI 미국 추월 2026',
    category: 'AI',
  },
  'will-anthropic-release-claude-4-in-2025': {
    label: 'Anthropic Claude 4 출시 2025',
    category: 'AI',
  },
  // ── 글로벌경제 ───────────────────────────────────────────────────────────────
  'will-the-fed-cut-rates-in-2025': {
    label: '미 연준 금리 인하 2025',
    category: '글로벌경제',
  },
  'will-oil-reach-100-per-barrel-in-2025': {
    label: '유가 $100 돌파 2025',
    category: '글로벌경제',
  },
  'will-the-us-and-china-reach-a-trade-deal-in-2025': {
    label: '미중 무역합의 2025',
    category: '글로벌경제',
  },
  'will-the-us-enter-a-recession-in-2025': {
    label: '미국 경기침체 2025',
    category: '글로벌경제',
  },
  'will-bitcoin-reach-200k-in-2025': {
    label: '비트코인 $200K 돌파 2025',
    category: '글로벌경제',
  },
  'will-the-euro-reach-parity-with-the-dollar-in-2025': {
    label: '유로-달러 패리티 2025',
    category: '글로벌경제',
  },
  'will-eu-face-a-financial-crisis-in-2025': {
    label: 'EU 재정위기 2025',
    category: '글로벌경제',
  },
};
