// 4-Pillar 구조 — KT Win Ratio 프레임워크 기반
// Win Ratio = f(Value Impact × 가격경쟁력 × 차별화 × 실행경쟁력)

export type PillarId = 'V' | 'P' | 'D' | 'E';

export type SubFactorId =
  | 'v_customer_kpi' | 'v_problem_fit' | 'v_dm_empathy'
  | 'p_tco_advantage' | 'p_roi_clarity' | 'p_partner_cost'
  | 'd_why_us' | 'd_tech_edge' | 'd_references'
  | 'e_similar_cases' | 'e_risk_response' | 'e_aidd_productivity';

export interface SubFactorMeta {
  id: SubFactorId;
  pillar: PillarId;
  label: string;
  description: string;
  defaultWeight: number;
}

export const SUB_FACTORS: SubFactorMeta[] = [
  // V (Value Impact)
  { id: 'v_customer_kpi', pillar: 'V', label: '고객 KPI 적중도',
    description: '고객의 핵심 성과지표(비용/효율/매출/리스크)에 미치는 Impact가 명확한가',
    defaultWeight: 0.40 },
  { id: 'v_problem_fit', pillar: 'V', label: 'Problem-Solution Fit',
    description: '고객이 진짜 원하는 것을 터치했는가',
    defaultWeight: 0.30 },
  { id: 'v_dm_empathy', pillar: 'V', label: '의사결정자 공감',
    description: '의사결정자가 가치를 직접 체감하는가',
    defaultWeight: 0.30 },

  // P (Price)
  { id: 'p_tco_advantage', pillar: 'P', label: 'TCO 경쟁사 대비 우위',
    description: '경쟁사 대비 총비용을 낮출 수 있는가 (ROI/TCO 또는 Cost-driven 경쟁력)',
    defaultWeight: 0.40 },
  { id: 'p_roi_clarity', pillar: 'P', label: 'ROI 명확성',
    description: 'ROI를 정량적으로 제시할 수 있는가',
    defaultWeight: 0.30 },
  { id: 'p_partner_cost', pillar: 'P', label: '협력사 단가 우위',
    description: '협력사 단가 경쟁력 확보 여부',
    defaultWeight: 0.30 },

  // D (Differentiation)
  { id: 'd_why_us', pillar: 'D', label: 'Why Us 논리',
    description: '우리가 아니면 안되는 이유가 있는가 (Why KT, 타사 대비 선택/차별 요소)',
    defaultWeight: 0.40 },
  { id: 'd_tech_edge', pillar: 'D', label: '기술 차별화',
    description: 'PoC, 특허 등 기술적 우위 보유 여부',
    defaultWeight: 0.30 },
  { id: 'd_references', pillar: 'D', label: '레퍼런스 보유',
    description: '동일/유사 영역에서 검증된 레퍼런스 보유',
    defaultWeight: 0.30 },

  // E (Execution)
  { id: 'e_similar_cases', pillar: 'E', label: '유사사례 보유',
    description: '안정적 수행 신뢰 확보 가능 — 유사 레퍼런스, 리스크 제거',
    defaultWeight: 0.40 },
  { id: 'e_risk_response', pillar: 'E', label: '리스크 대응 설계',
    description: '리스크와 대응 전략을 사전에 제시할 수 있는가',
    defaultWeight: 0.30 },
  { id: 'e_aidd_productivity', pillar: 'E', label: 'AIDD 생산성',
    description: 'AIDD 기반 수행 생산성 근거 제시 가능',
    defaultWeight: 0.30 },
];

export const PILLAR_META: Record<PillarId, { label: string; description: string; defaultWeight: number }> = {
  V: { label: 'Value Impact', description: '고객 가치 영향 — 진짜 원하는 것을 터치했는가', defaultWeight: 0.25 },
  P: { label: 'Price', description: '가격 경쟁력 — 총비용 우위', defaultWeight: 0.25 },
  D: { label: 'Differentiation', description: '차별화 — Why Us', defaultWeight: 0.25 },
  E: { label: 'Execution', description: '실행 경쟁력 — 진짜 이행할 수 있는가', defaultWeight: 0.25 },
};

export type SubScores = Record<SubFactorId, number>;  // 각 값 1-10
export type PillarScores = Record<PillarId, number>;  // 각 값 0-1

export function subFactorsOf(pillar: PillarId): SubFactorMeta[] {
  return SUB_FACTORS.filter(s => s.pillar === pillar);
}

// sub-factor 점수(1-10)들을 normalize 가중평균 → [0,1] pillar score
export function pillarScoreFromSubs(
  subs: SubScores,
  subWeights?: Partial<Record<SubFactorId, number>>
): PillarScores {
  const out: PillarScores = { V: 0, P: 0, D: 0, E: 0 };
  for (const p of ['V', 'P', 'D', 'E'] as PillarId[]) {
    const factors = subFactorsOf(p);
    let weighted = 0, totalW = 0;
    for (const f of factors) {
      const w = subWeights?.[f.id] ?? f.defaultWeight;
      const v = subs[f.id] ?? 5;
      weighted += (v / 10) * w;
      totalW += w;
    }
    out[p] = totalW > 0 ? weighted / totalW : 0.5;
  }
  return out;
}

// log-space 곱셈 → sigmoid squish
// 한 축이라도 낮으면 전체 확률 급락 (KT 핵심 철학)
export function pillarMultiplication(
  pillarScores: PillarScores,
  pillarWeights?: Partial<Record<PillarId, number>>
): number {
  const epsilon = 0.05;
  const w = {
    V: pillarWeights?.V ?? PILLAR_META.V.defaultWeight,
    P: pillarWeights?.P ?? PILLAR_META.P.defaultWeight,
    D: pillarWeights?.D ?? PILLAR_META.D.defaultWeight,
    E: pillarWeights?.E ?? PILLAR_META.E.defaultWeight,
  };
  // 로그 곱: 가중치 × log(score+ε) 합산 후 sigmoid
  const logSum =
    Math.log(pillarScores.V + epsilon) * w.V +
    Math.log(pillarScores.P + epsilon) * w.P +
    Math.log(pillarScores.D + epsilon) * w.D +
    Math.log(pillarScores.E + epsilon) * w.E;
  const totalW = w.V + w.P + w.D + w.E;
  const avgLog = logSum / totalW;
  // avgLog ∈ [log(0.05), log(1.05)] ≈ [-3.0, 0.05]
  // 매핑: -3.0 → 약 0.05, 0.05 → 약 0.95
  const scaled = (avgLog + 1.5) * 3;
  return 1 / (1 + Math.exp(-scaled));
}

// 평균 5점 baseline에서 각 sub-factor 하나만 현재값으로 바꿀 때 확률 변화량
// SHAP-식 간이 분해 → Top 3 약점 도출용
export function subFactorContributions(
  subs: SubScores,
  pillarWeights?: Partial<Record<PillarId, number>>,
  subWeights?: Partial<Record<SubFactorId, number>>
): { id: SubFactorId; label: string; pillar: PillarId; score: number; contribution: number }[] {
  // baseline: 전부 5점일 때 확률
  const baselineSubs = Object.fromEntries(SUB_FACTORS.map(f => [f.id, 5])) as SubScores;
  const baseline = pillarMultiplication(pillarScoreFromSubs(baselineSubs, subWeights), pillarWeights);

  return SUB_FACTORS.map(f => {
    // 이 sub-factor만 현재값, 나머지는 5점일 때 확률
    const test: SubScores = { ...baselineSubs, [f.id]: subs[f.id] };
    const probWith = pillarMultiplication(pillarScoreFromSubs(test, subWeights), pillarWeights);
    return {
      id: f.id,
      label: f.label,
      pillar: f.pillar,
      score: subs[f.id],
      contribution: probWith - baseline,  // 양수 = 끌어올림, 음수 = 끌어내림
    };
  });
}

// 약점 Top N (contribution이 가장 음수인 항목)
export function findWeaknesses(
  subs: SubScores,
  topN = 3,
  pillarWeights?: Partial<Record<PillarId, number>>,
  subWeights?: Partial<Record<SubFactorId, number>>
) {
  const contribs = subFactorContributions(subs, pillarWeights, subWeights);
  return contribs.sort((a, b) => a.contribution - b.contribution).slice(0, topN);
}

// 기본값(5점) sub-scores 생성
export function defaultSubScores(): SubScores {
  return Object.fromEntries(SUB_FACTORS.map(f => [f.id, 5])) as SubScores;
}

// 레거시 7-변수 → 4-Pillar sub-factor 매핑 (마이그레이션용)
export function migrateLegacyVariables(legacy: Record<string, number>): SubScores {
  const out = defaultSubScores();
  if (legacy.decision_maker_access != null) out.v_dm_empathy = legacy.decision_maker_access;
  if (legacy.past_win_history != null) out.d_references = legacy.past_win_history;
  if (legacy.price_competitiveness != null) out.p_tco_advantage = legacy.price_competitiveness;
  if (legacy.tech_differentiation != null) out.d_tech_edge = legacy.tech_differentiation;
  if (legacy.budget_confirmed != null) out.v_problem_fit = legacy.budget_confirmed;
  // lg_cns_threat, samsung_sds_threat은 경쟁사 Elo 모델로 이전 — sub-factor에 매핑 안 함
  return out;
}
