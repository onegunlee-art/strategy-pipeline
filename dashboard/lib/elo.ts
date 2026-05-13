// Competitor Elo Rating — 체스/축구 베팅의 핵심 기법
// 각 경쟁사를 1500 출발, 매 딜 결과로 K=32 업데이트
// 다자 경쟁: softmax 방식으로 우리 vs 모든 경쟁사 평균 승률

export const INITIAL_ELO = 1500;
export const K_FACTOR = 32;

// 1:1 매치업 기대 승률
export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// 1:1 Elo 업데이트 (scoreA: 1=A 승, 0=A 패)
export function updateElo(
  eloA: number,
  eloB: number,
  scoreA: 0 | 1,
  k: number = K_FACTOR
): [number, number] {
  const expA = expectedScore(eloA, eloB);
  const newA = eloA + k * (scoreA - expA);
  const newB = eloB + k * ((1 - scoreA) - (1 - expA));
  return [newA, newB];
}

// 다자 경쟁 매치업 (우리 vs 다수 경쟁사)
// 방법 1 (softmax 추정): 우리 Elo / (우리 + Σ 경쟁사 Elo) — 직관적이지만 부정확
// 방법 2 (pairwise 평균): 각 경쟁사 1:1 expectedScore의 곱 (모두 이겨야 수주)
//   다만 다자에서는 항상 매우 낮아지는 문제 → 평균으로 완화
export function multiCompetitorWinProb(
  ourElo: number,
  competitorElos: number[]
): number {
  if (competitorElos.length === 0) return 0.5;
  if (competitorElos.length === 1) return expectedScore(ourElo, competitorElos[0]);

  // 1) 평균 경쟁사 Elo와 매치업
  const avgCompetitor = competitorElos.reduce((a, b) => a + b, 0) / competitorElos.length;
  const vsAverage = expectedScore(ourElo, avgCompetitor);

  // 2) 경쟁사 수가 많을수록 우리 승률은 조금씩 감소 (1/N 보정은 너무 강하므로 sqrt)
  const fieldPenalty = 1 / Math.sqrt(competitorElos.length);
  // 최종: 평균 매치업 × field penalty + (1-fieldPenalty) × 0.5 (혼란 보정)
  return vsAverage * fieldPenalty + 0.5 * (1 - fieldPenalty);
}

// 딜 결과로 모든 참여 경쟁사의 Elo 업데이트 (우리 승/패)
export function updateAllCompetitorElos(
  ourElo: number,
  competitors: { id: number; elo: number }[],
  ourScore: 0 | 1,
  k: number = K_FACTOR
): { ourNewElo: number; updated: { id: number; eloBefore: number; eloAfter: number }[] } {
  // 각 경쟁사 1:1 매치업으로 처리 → 평균 변화 적용
  let ourEloDelta = 0;
  const updated = competitors.map(c => {
    const expUs = expectedScore(ourElo, c.elo);
    ourEloDelta += k * (ourScore - expUs);
    const cExp = 1 - expUs;
    const cScore = 1 - ourScore;
    const cNew = c.elo + k * (cScore - cExp);
    return { id: c.id, eloBefore: c.elo, eloAfter: cNew };
  });
  // 우리 변화는 평균값 적용 (모든 매치업에서 누적되면 과도)
  const ourAvgDelta = ourEloDelta / competitors.length;
  return { ourNewElo: ourElo + ourAvgDelta, updated };
}

// 과거 데이터 시퀀스로 Elo 재시뮬레이션 (CSV 임포트 시 시드)
// records: 시간순 정렬된 딜 결과
export function simulateEloFromHistory(
  records: { competitorIds: number[]; ourScore: 0 | 1 }[],
  competitorIds: number[],
  ourInitialElo: number = INITIAL_ELO
): { ourElo: number; competitorElos: Map<number, number> } {
  const elos = new Map<number, number>(competitorIds.map(id => [id, INITIAL_ELO]));
  let ourElo = ourInitialElo;

  for (const rec of records) {
    const comps = rec.competitorIds.map(id => ({ id, elo: elos.get(id) ?? INITIAL_ELO }));
    if (comps.length === 0) continue;
    const result = updateAllCompetitorElos(ourElo, comps, rec.ourScore);
    ourElo = result.ourNewElo;
    for (const u of result.updated) {
      elos.set(u.id, u.eloAfter);
    }
  }
  return { ourElo, competitorElos: elos };
}
