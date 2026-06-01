// 액션 카탈로그 — "확률을 올리려면 무엇을 할 수 있나"의 정의.
// AlphaGo의 '수(move)'에 해당. 각 액션은 특정 sub_factor 점수를 끌어올리며
// 그에 드는 노력(effort)을 가진다. nextMove.ts가 이 카탈로그를 1-step 탐색해
// ΔP(win)/effort(=ROI) 순으로 "다음 최선의 수"를 랭킹한다.

import { SubFactorId, PillarId } from './pillars';

export interface DealAction {
  id: string;
  label: string;            // 실행 액션 문구
  targets: SubFactorId[];   // 이 액션이 끌어올리는 sub_factor(들)
  pillar: PillarId;         // 주 소속 Pillar (UI 그룹핑)
  effort: number;           // 상대 노력/비용 (1=가벼움 ~ 5=무거움)
  owner: string;            // 주관 역할
  uplift: number;           // 성공 시 목표 점수 상향폭 (1~10 스케일에서 +N)
}

// 15 sub_factor 각각에 대해 현실적인 실행 액션을 매핑.
// uplift/effort는 실무 기준 초기 추정치 — 추후 outcome 학습으로 보정 가능.
export const ACTION_CATALOG: DealAction[] = [
  // S — 사전영업
  { id: 'a_keyman', label: 'Key Man 발굴·면담 및 관계 구축', targets: ['s_key_man_contact'], pillar: 'S', effort: 3, owner: '영업대표', uplift: 3 },
  { id: 'a_eval_rfp', label: '평가위원 구성 파악 + RFP 사전 입수·분석', targets: ['s_evaluator_rfp'], pillar: 'S', effort: 2, owner: '영업대표', uplift: 3 },
  { id: 'a_poc', label: 'PoC·파일럿 제안으로 사전 검증 기회 확보', targets: ['s_poc_proposal'], pillar: 'S', effort: 4, owner: '제안PM', uplift: 3 },

  // V — Value Impact
  { id: 'a_needs', label: '고객 Pain Point 심층 인터뷰 + 니즈 구조화', targets: ['v_needs_painpoint'], pillar: 'V', effort: 2, owner: '영업대표', uplift: 3 },
  { id: 'a_value_prop', label: '고객 KPI 연계 가치제안서 정교화', targets: ['v_value_proposition'], pillar: 'V', effort: 3, owner: '제안PM', uplift: 3 },
  { id: 'a_pt', label: 'C-Level 대상 임팩트 PT 기회 확보·리허설', targets: ['v_presentation'], pillar: 'V', effort: 3, owner: '영업대표', uplift: 2 },

  // D — 차별화
  { id: 'a_diff', label: 'Why Us 차별화 논리 + 경쟁사 대응 메시지 개발', targets: ['d_competitive_strategy'], pillar: 'D', effort: 2, owner: '제안PM', uplift: 3 },
  { id: 'a_tech_ref', label: '기술 우위 입증(PoC/특허) + 유사 레퍼런스 확보', targets: ['d_tech_reference'], pillar: 'D', effort: 4, owner: '이행PM', uplift: 3 },
  { id: 'a_partner', label: '보완적 파트너·컨소시엄 구성 강화', targets: ['d_partner'], pillar: 'D', effort: 3, owner: '제안PM', uplift: 3 },

  // P — 가격경쟁력
  { id: 'a_budget', label: '고객 예산 규모 확인 + 사업 범위 적합화', targets: ['p_budget_fit'], pillar: 'P', effort: 2, owner: '영업대표', uplift: 2 },
  { id: 'a_price', label: '경쟁 단가 분석 + 가격 전략(PTW) 수립', targets: ['p_price_competition'], pillar: 'P', effort: 3, owner: '영업대표', uplift: 3 },
  { id: 'a_roi', label: 'ROI·TCO 정량 모델 + 가성비 논리 구축', targets: ['p_cost_value'], pillar: 'P', effort: 3, owner: '제안PM', uplift: 2 },

  // E — Delivery
  { id: 'a_track', label: '동종 수주·이행 실적 정리 및 레퍼런스화', targets: ['e_track_record'], pillar: 'E', effort: 2, owner: '이행PM', uplift: 2 },
  { id: 'a_risk', label: '리스크 사전 식별 + 대응방안 구체화', targets: ['e_risk_management'], pillar: 'E', effort: 2, owner: '이행PM', uplift: 3 },
  { id: 'a_team', label: '전담 수행팀·PM 확보 + 생산성 체계 구성', targets: ['e_execution_team'], pillar: 'E', effort: 4, owner: '이행PM', uplift: 3 },
];

export function actionsForSubFactor(id: SubFactorId): DealAction[] {
  return ACTION_CATALOG.filter(a => a.targets.includes(id));
}
