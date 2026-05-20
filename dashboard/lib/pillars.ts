// 5-Pillar 구조 — Win Possibility Framework (PDF v1)
// S(사전영업) × V(Value Impact) × D(차별화) × P(가격경쟁력) × E(Delivery)
// 각 Pillar 동일 가중치 20%

export type PillarId = 'S' | 'V' | 'D' | 'P' | 'E';

export type SubFactorId =
  // S — 사전영업
  | 's_key_man_contact' | 's_evaluator_rfp' | 's_poc_proposal'
  // V — Value Impact
  | 'v_needs_painpoint' | 'v_value_proposition' | 'v_presentation'
  // D — 차별화
  | 'd_competitive_strategy' | 'd_tech_reference' | 'd_partner'
  // P — 가격경쟁력
  | 'p_budget_fit' | 'p_price_competition' | 'p_cost_value'
  // E — Delivery
  | 'e_track_record' | 'e_risk_management' | 'e_execution_team';

export interface SubFactorMeta {
  id: SubFactorId;
  pillar: PillarId;
  label: string;
  description: string;
  defaultWeight: number;
}

export const SUB_FACTORS: SubFactorMeta[] = [
  // S 사전영업
  { id: 's_key_man_contact', pillar: 'S', label: 'Key Man 접촉',
    description: 'Key Man 발굴·접촉·관계 형성 여부', defaultWeight: 0.40 },
  { id: 's_evaluator_rfp', pillar: 'S', label: '평가자·RFP 파악',
    description: '평가자 파악 및 RFP 사전 확인 여부', defaultWeight: 0.40 },
  { id: 's_poc_proposal', pillar: 'S', label: 'PoC·제안 기회',
    description: 'PoC·파일럿·제안 기회 확보 여부', defaultWeight: 0.20 },

  // V Value Impact
  { id: 'v_needs_painpoint', pillar: 'V', label: '니즈·Pain Point',
    description: '고객 핵심 니즈·Pain Point 파악 깊이', defaultWeight: 0.40 },
  { id: 'v_value_proposition', pillar: 'V', label: '가치 제안',
    description: '고객 KPI 연계 가치 제안 명확성', defaultWeight: 0.40 },
  { id: 'v_presentation', pillar: 'V', label: 'C-Level 발표',
    description: 'C-Level 프레젠테이션 기회 및 임팩트', defaultWeight: 0.20 },

  // D 차별화
  { id: 'd_competitive_strategy', pillar: 'D', label: '차별화 전략',
    description: '경쟁사 대비 차별화·Why Us 논리 강도', defaultWeight: 0.40 },
  { id: 'd_tech_reference', pillar: 'D', label: '기술·레퍼런스',
    description: '기술 우위(PoC·특허)·유사 레퍼런스 보유', defaultWeight: 0.40 },
  { id: 'd_partner', pillar: 'D', label: '파트너·컨소시엄',
    description: '파트너·컨소시엄 구성 차별성 및 보완성', defaultWeight: 0.20 },

  // P 가격경쟁력
  { id: 'p_budget_fit', pillar: 'P', label: '예산 적합성',
    description: '고객 예산 규모 파악 및 사업 규모 적합성', defaultWeight: 0.30 },
  { id: 'p_price_competition', pillar: 'P', label: '경쟁 가격 우위',
    description: '경쟁사·협력사 단가 대비 가격 경쟁력', defaultWeight: 0.40 },
  { id: 'p_cost_value', pillar: 'P', label: 'ROI·TCO',
    description: 'ROI·TCO 정량 제시 및 가성비 논리', defaultWeight: 0.30 },

  // E Delivery
  { id: 'e_track_record', pillar: 'E', label: '수주·이행 실적',
    description: '동종 사업 수주·이행 실적 및 레퍼런스', defaultWeight: 0.40 },
  { id: 'e_risk_management', pillar: 'E', label: '리스크 관리',
    description: '리스크 사전 식별 및 대응 방안 구체화', defaultWeight: 0.40 },
  { id: 'e_execution_team', pillar: 'E', label: '전담팀·PM',
    description: '전담 수행팀 구성 및 PM·AIDD 생산성', defaultWeight: 0.20 },
];

export const PILLAR_META: Record<PillarId, { label: string; description: string; defaultWeight: number }> = {
  S: { label: '사전영업', description: 'Key Man 접촉·평가자 파악·PoC 기회 확보', defaultWeight: 0.20 },
  V: { label: 'Value Impact', description: '고객 니즈·Pain Point·KPI 연계 가치 제안', defaultWeight: 0.20 },
  D: { label: '차별화', description: 'Why Us·기술 우위·파트너 차별성', defaultWeight: 0.20 },
  P: { label: '가격경쟁력', description: '예산 적합·가격 우위·ROI·TCO', defaultWeight: 0.20 },
  E: { label: 'Delivery', description: '이행 실적·리스크 관리·전담팀 역량', defaultWeight: 0.20 },
};

export const PILLAR_COLORS: Record<PillarId, string> = {
  S: '#7c3aed',
  V: '#0ea5e9',
  D: '#10b981',
  P: '#f59e0b',
  E: '#ef4444',
};

export type SubScores = Record<SubFactorId, number>;   // 각 값 1-10
export type PillarScores = Record<PillarId, number>;   // 각 값 0-1

export const PILLAR_IDS: PillarId[] = ['S', 'V', 'D', 'P', 'E'];

export function subFactorsOf(pillar: PillarId): SubFactorMeta[] {
  return SUB_FACTORS.filter(s => s.pillar === pillar);
}

// sub-factor 점수(1-10)를 normalize 가중평균 → [0,1] pillar score
export function pillarScoreFromSubs(
  subs: SubScores,
  subWeights?: Partial<Record<SubFactorId, number>>
): PillarScores {
  const out: PillarScores = { S: 0, V: 0, D: 0, P: 0, E: 0 };
  for (const p of PILLAR_IDS) {
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
  const epsilon = 0.01;
  let logSum = 0, totalW = 0;
  for (const p of PILLAR_IDS) {
    const w = pillarWeights?.[p] ?? PILLAR_META[p].defaultWeight;
    logSum += Math.log((pillarScores[p] ?? 0) + epsilon) * w;
    totalW += w;
  }
  const avgLog = totalW > 0 ? logSum / totalW : logSum;
  // 보정: offset=0.6 → 5/10 중립 입력 시 ~50%, 7/10 → ~68%, 9/10 → ~82%
  const scaled = (avgLog + 0.6) * 3;
  return 1 / (1 + Math.exp(-scaled));
}

// 평균 5점 baseline에서 각 sub-factor 하나만 현재값으로 바꿀 때 확률 변화량
// SHAP-식 간이 분해 → Top 3 약점 도출용
export function subFactorContributions(
  subs: SubScores,
  pillarWeights?: Partial<Record<PillarId, number>>,
  subWeights?: Partial<Record<SubFactorId, number>>
): { id: SubFactorId; label: string; pillar: PillarId; score: number; contribution: number }[] {
  const baselineSubs = Object.fromEntries(SUB_FACTORS.map(f => [f.id, 5])) as SubScores;
  const baseline = pillarMultiplication(pillarScoreFromSubs(baselineSubs, subWeights), pillarWeights);

  return SUB_FACTORS.map(f => {
    const test: SubScores = { ...baselineSubs, [f.id]: subs[f.id] };
    const probWith = pillarMultiplication(pillarScoreFromSubs(test, subWeights), pillarWeights);
    return {
      id: f.id,
      label: f.label,
      pillar: f.pillar,
      score: subs[f.id],
      contribution: probWith - baseline,
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

// 구버전(4-Pillar 12개) → 신버전(5-Pillar 15개) 매핑
export function migrateLegacySubScores(legacy: Record<string, number>): SubScores {
  const out = defaultSubScores();
  // V pillar 매핑
  if (legacy.v_customer_kpi != null) out.v_needs_painpoint = legacy.v_customer_kpi;
  if (legacy.v_problem_fit != null) out.v_value_proposition = legacy.v_problem_fit;
  if (legacy.v_dm_empathy != null) out.v_presentation = legacy.v_dm_empathy;
  // P pillar 매핑
  if (legacy.p_tco_advantage != null) out.p_price_competition = legacy.p_tco_advantage;
  if (legacy.p_roi_clarity != null) out.p_cost_value = legacy.p_roi_clarity;
  if (legacy.p_partner_cost != null) out.p_budget_fit = legacy.p_partner_cost;
  // D pillar 매핑
  if (legacy.d_why_us != null) out.d_competitive_strategy = legacy.d_why_us;
  if (legacy.d_tech_edge != null) out.d_tech_reference = legacy.d_tech_edge;
  if (legacy.d_references != null) out.d_partner = legacy.d_references;
  // E pillar 매핑
  if (legacy.e_similar_cases != null) out.e_track_record = legacy.e_similar_cases;
  if (legacy.e_risk_response != null) out.e_risk_management = legacy.e_risk_response;
  if (legacy.e_aidd_productivity != null) out.e_execution_team = legacy.e_aidd_productivity;
  return out;
}

// 7변수 레거시 → 신버전 (마이그레이션용)
export function migrateLegacyVariables(legacy: Record<string, number>): SubScores {
  const out = defaultSubScores();
  if (legacy.decision_maker_access != null) out.v_presentation = legacy.decision_maker_access;
  if (legacy.past_win_history != null) out.e_track_record = legacy.past_win_history;
  if (legacy.price_competitiveness != null) out.p_price_competition = legacy.price_competitiveness;
  if (legacy.tech_differentiation != null) out.d_tech_reference = legacy.tech_differentiation;
  if (legacy.budget_confirmed != null) out.p_budget_fit = legacy.budget_confirmed;
  return out;
}
