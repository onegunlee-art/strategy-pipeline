// strategyPath.ts — Reason Chain Layer
// 시뮬레이션 엔진 출력(next_moves)을 "전략 경로" 숫자로 변환.
// LLM이 건드리지 못하는 권위값 레이어. 보고서/브리프는 이 값을 설명만 한다.

import { SubScores, pillarScoreFromSubs, pillarMultiplication, SubFactorId } from './pillars';
import { rankNextMoves } from './nextMove';

export interface StrategyStep {
  order: number;
  action_id: string;
  label: string;
  pillar: string;
  effort: number;
  owner: string;
  prob_before: number;   // %
  prob_after: number;    // %
  delta_pp: number;      // 상승폭 %p
  roi: number;
  revenue_before: number; // 억원 (expected_revenue × prob)
  revenue_after: number;
  revenue_delta: number;
}

export interface StrategyPath {
  baseline_prob: number;          // 초기 확률 %
  target_prob: number;            // 전 액션 실행 후 최종 확률 %
  total_delta_pp: number;         // 총 상승 %p
  baseline_ev: number;            // 초기 기대매출 (억)
  target_ev: number;              // 최종 기대매출 (억)
  ev_delta: number;               // 기대매출 증가 (억)
  steps: StrategyStep[];
  go_nogo: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  go_nogo_rationale: string;
}

export interface VoteDisagreement {
  sub_factor_id: string;
  label: string;
  min_score: number;
  max_score: number;
  spread: number;
  flag: 'HIGH' | 'MEDIUM';  // spread >= 4 → HIGH, >= 2 → MEDIUM
  roles: { role: string; score: number }[];
}

// 기계적 GO/NO_GO — LLM에 맡기지 않음
export function computeGoNogo(prob: number): { decision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO'; rationale: string } {
  if (prob >= 65) {
    return { decision: 'GO', rationale: `수주 확률 ${prob.toFixed(1)}%로 기준선(65%) 초과. 적극 추진 권고.` };
  }
  if (prob >= 45) {
    return { decision: 'CONDITIONAL_GO', rationale: `수주 확률 ${prob.toFixed(1)}%. 주요 약점 보완 조건부 추진. 목표 확률 65% 이상.` };
  }
  return { decision: 'NO_GO', rationale: `수주 확률 ${prob.toFixed(1)}%로 기준선(45%) 미달. 자원 투입 재검토 필요.` };
}

// Next Moves → 단계별 확률 + 재무 임팩트 경로
export function buildStrategyPath(
  subs: SubScores,
  expectedRevenue: number | null,   // 억원, null이면 0
  topN = 5,
): StrategyPath {
  const rev = expectedRevenue ?? 0;
  const moves = rankNextMoves(subs, { topN });
  const baselineProb = pillarMultiplication(pillarScoreFromSubs(subs)) * 100;

  // 단계별 누적 적용 (앞 액션 효과 반영 후 다음 계산)
  let currentSubs = { ...subs };
  const steps: StrategyStep[] = [];

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const probBefore = pillarMultiplication(pillarScoreFromSubs(currentSubs)) * 100;

    // 해당 액션 targets uplift 적용
    const nextSubs = { ...currentSubs };
    for (const t of m.action.targets) {
      const cur = nextSubs[t as SubFactorId] ?? 5;
      nextSubs[t as SubFactorId] = Math.min(10, cur + m.action.uplift);
    }
    const probAfter = pillarMultiplication(pillarScoreFromSubs(nextSubs)) * 100;
    const deltaPp = probAfter - probBefore;

    steps.push({
      order: i + 1,
      action_id: m.action.id,
      label: m.action.label,
      pillar: m.action.pillar,
      effort: m.action.effort,
      owner: m.action.owner,
      prob_before: Math.round(probBefore * 10) / 10,
      prob_after: Math.round(probAfter * 10) / 10,
      delta_pp: Math.round(deltaPp * 10) / 10,
      roi: Math.round((deltaPp / m.action.effort) * 100) / 100,
      revenue_before: Math.round(rev * probBefore) / 100,
      revenue_after: Math.round(rev * probAfter) / 100,
      revenue_delta: Math.round(rev * deltaPp) / 100,
    });

    currentSubs = nextSubs;
  }

  const targetProb = steps.length > 0
    ? steps[steps.length - 1].prob_after
    : baselineProb;

  const baselineEv = Math.round(rev * baselineProb) / 100;
  const targetEv = Math.round(rev * targetProb) / 100;
  const { decision, rationale } = computeGoNogo(baselineProb);

  return {
    baseline_prob: Math.round(baselineProb * 10) / 10,
    target_prob: Math.round(targetProb * 10) / 10,
    total_delta_pp: Math.round((targetProb - baselineProb) * 10) / 10,
    baseline_ev: baselineEv,
    target_ev: targetEv,
    ev_delta: Math.round((targetEv - baselineEv) * 10) / 10,
    steps,
    go_nogo: decision,
    go_nogo_rationale: rationale,
  };
}

// 투표 불일치 신호 — 내부 의견 분열 리스크 감지
export function findVoteDisagreements(
  votes: Array<{ role: string; sub_factor_id: string; score: number; label?: string }>,
  threshold = 2,
): VoteDisagreement[] {
  const byFactor: Record<string, { role: string; score: number; label?: string }[]> = {};
  for (const v of votes) {
    if (!byFactor[v.sub_factor_id]) byFactor[v.sub_factor_id] = [];
    byFactor[v.sub_factor_id].push({ role: v.role, score: v.score, label: v.label });
  }

  const disagreements: VoteDisagreement[] = [];
  for (const [fid, entries] of Object.entries(byFactor)) {
    if (entries.length < 2) continue;
    const scores = entries.map(e => e.score);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread >= threshold) {
      disagreements.push({
        sub_factor_id: fid,
        label: entries[0].label ?? fid,
        min_score: Math.min(...scores),
        max_score: Math.max(...scores),
        spread,
        flag: spread >= 4 ? 'HIGH' : 'MEDIUM',
        roles: entries.map(e => ({ role: e.role, score: e.score })),
      });
    }
  }
  return disagreements.sort((a, b) => b.spread - a.spread);
}
