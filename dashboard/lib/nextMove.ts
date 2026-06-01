// 다음 최선의 수 (Next Best Move) — 1-step lookahead ROI 랭킹.
// AlphaGo의 '정책(policy)'에 해당하는 경량판: 각 액션을 가상으로 실행해
// 승률 변화(ΔP)를 측정하고 ΔP/effort(=ROI) 순으로 정렬한다.
// 진단(확률)을 넘어 처방(무엇을 어떤 순서로)을 제시하는 게 목적.

import {
  SubScores, SubFactorId, PillarId,
  pillarScoreFromSubs, pillarMultiplication,
} from './pillars';
import { ACTION_CATALOG, DealAction } from './actionCatalog';

export interface NextMove {
  action: DealAction;
  prob_before: number;     // 0~1 (현재 pillar 기반 승률)
  prob_after: number;      // 0~1 (액션 적용 후)
  delta_pp: number;        // 상승폭 (퍼센트포인트)
  roi: number;             // delta_pp / effort (효율)
  capped: boolean;         // 대상 점수가 이미 높아 상승 여지가 적었는지
}

// 단일 What-if: 액션의 targets를 uplift만큼(상한 10) 올린 sub_scores로 승률 재계산
function applyAction(
  subs: SubScores,
  action: DealAction,
  pillarWeights?: Partial<Record<PillarId, number>>,
  subWeights?: Partial<Record<SubFactorId, number>>
): { prob: number; capped: boolean } {
  const next: SubScores = { ...subs };
  let anyHeadroom = false;
  for (const t of action.targets) {
    const cur = next[t] ?? 5;
    const raised = Math.min(10, cur + action.uplift);
    if (raised > cur) anyHeadroom = true;
    next[t] = raised;
  }
  const prob = pillarMultiplication(pillarScoreFromSubs(next, subWeights), pillarWeights);
  return { prob, capped: !anyHeadroom };
}

// 모든 액션을 1-step 탐색해 ROI 순으로 랭킹.
export function rankNextMoves(
  subs: SubScores,
  opts: {
    pillarWeights?: Partial<Record<PillarId, number>>;
    subWeights?: Partial<Record<SubFactorId, number>>;
    topN?: number;
  } = {}
): NextMove[] {
  const { pillarWeights, subWeights, topN = 5 } = opts;
  const probBefore = pillarMultiplication(pillarScoreFromSubs(subs, subWeights), pillarWeights);

  const moves: NextMove[] = ACTION_CATALOG.map((action) => {
    const { prob: probAfter, capped } = applyAction(subs, action, pillarWeights, subWeights);
    const deltaPp = (probAfter - probBefore) * 100;
    return {
      action,
      prob_before: probBefore,
      prob_after: probAfter,
      delta_pp: deltaPp,
      roi: deltaPp / action.effort,
      capped,
    };
  });

  // 효과가 거의 없는(이미 높은 점수) 액션은 후순위, ROI 내림차순
  return moves
    .filter(m => m.delta_pp > 0.05)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, topN);
}
