/**
 * 이란 전쟁 종전 가능성 — 확률 계산 방식 3가지 비교 테스트
 * npx ts-node --project tsconfig.json scripts/test-iran-prob.ts
 */

// ─── Mock: Gist RAG 결과 (이란 관련 실제 기사 유사 데이터) ──────────────
const MOCK_GIST = {
  alignment_points: [
    'FA 2026년 5월호: 카타르·오만 조정 채널 복원, 비공개 회담 3차례 확인됨',
    '이코노미스트: 이란 내 경제 압박이 최고조 — 리알화 가치 48% 폭락',
    'FT: 이스라엘-이란 직접 교전 자제, 양측 외교적 출구 탐색 중',
    '로이터: 미국·EU 동시 제재 완화 카드 검토 — 핵합의 부분 이행 조건',
  ],
  conflict_points: [
    '이코노미스트: IRGC 강경파, 협상 거부 선언 — 최고지도자 승인 불투명',
    'FA: 이스라엘 내각 "선제타격 옵션 유지" — 협상 진행 중에도 군사 압박',
    'FT: 호르무즈 해협 기뢰 부설 징후 — 봉쇄 카드 여전히 유효',
  ],
  synthesis: '협상 채널은 열려 있으나 양측 강경파가 합의를 가로막는 구조적 교착 상태',
  outlook: '3개월 내 부분 합의 가능성 30~40%, 전면 종전은 2027년 이후 전망',
};

// ─── Mock: OpenAI 드라이버 점수 (현재 방식) ──────────────────────────────
const DRIVER_META = [
  { key: 'd1', labelKo: '외교 채널',  invert: false },
  { key: 'd2', labelKo: '군사 강도',  invert: true  },
  { key: 'd3', labelKo: '경제 압박',  invert: true  },
  { key: 'd4', labelKo: '내부 안정',  invert: false },
  { key: 'd5', labelKo: '외부 개입',  invert: true  },
];

// 방식①②③ 별로 점수를 다르게 설정
const SCORES_1 = { d1: 4, d2: 7, d3: 8, d4: 3, d5: 6 }; // 방식①: 현재 방식
const SCORES_3 = { d1: 5, d2: 6, d3: 8, d4: 3, d5: 6 }; // 방식③: alignment 반영 +1 on d1

function contribution(invert: boolean, score: number) {
  return invert ? 10 - score : score;
}

function computeProb(scores: Record<string, number>): number {
  const sum = DRIVER_META.reduce((acc, m) => acc + contribution(m.invert, scores[m.key] ?? 5), 0);
  const mean = sum / DRIVER_META.length;
  return Math.round(Math.max(5, Math.min(95, mean * 10)));
}

// ─── 방식 ① 직접 확률 보정 (evidence blending) ──────────────────────────
function approach1(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식① 직접 확률 보정 (Evidence Blending)');
  console.log('══════════════════════════════════════');

  const driver_prob = computeProb(SCORES_1);
  const align = MOCK_GIST.alignment_points.length;  // 4
  const conflict = MOCK_GIST.conflict_points.length; // 3
  const evidence_score = Math.round((align / (align + conflict)) * 100); // 57%

  const final_prob = Math.round(0.7 * driver_prob + 0.3 * evidence_score);

  console.log(`드라이버 점수: ${JSON.stringify(SCORES_1)}`);
  DRIVER_META.forEach(m => {
    const c = contribution(m.invert, SCORES_1[m.key as keyof typeof SCORES_1]);
    console.log(`  ${m.labelKo} (invert=${m.invert}): raw=${SCORES_1[m.key as keyof typeof SCORES_1]} → contribution=${c}`);
  });
  console.log(`Driver 확률: ${driver_prob}%`);
  console.log(`Alignment ${align}개 / Conflict ${conflict}개 → Evidence Score: ${evidence_score}%`);
  console.log(`최종 확률: 0.7×${driver_prob} + 0.3×${evidence_score} = ${final_prob}%`);
  console.log(`\n평가: 계산은 단순하지만 alignment/conflict 개수에만 의존 — 내용 무시`);
}

// ─── 방식 ② OpenAI 드라이버 스코어링에 명시적 연결 ──────────────────────
function approach2(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식② OpenAI 프롬프트에 alignment/conflict 명시적 매핑');
  console.log('══════════════════════════════════════');
  console.log('\n[프롬프트에 추가될 내용 예시]');
  console.log('─────────────────────────────');
  console.log(`alignment_points (각각 관련 드라이버 +0.5~1 근거):
  • "${MOCK_GIST.alignment_points[0]}" → 외교채널(d1) +1
  • "${MOCK_GIST.alignment_points[1]}" → 경제압박(d3) 이미 반영
  • "${MOCK_GIST.alignment_points[2]}" → 군사강도(d2) 완화 신호 +0.5
  • "${MOCK_GIST.alignment_points[3]}" → 외교채널(d1) +0.5

conflict_points (각각 관련 드라이버 -0.5~1 근거):
  • "${MOCK_GIST.conflict_points[0]}" → 내부안정(d4) -1
  • "${MOCK_GIST.conflict_points[1]}" → 군사강도(d2) 유지 -0.5
  • "${MOCK_GIST.conflict_points[2]}" → 외부개입(d5) 악화 -1`);

  // 명시적 매핑 후 예상 점수
  const SCORES_2 = { d1: 5.5, d2: 6.5, d3: 8, d4: 2, d5: 7 };
  const prob2 = computeProb({ d1: 6, d2: 7, d3: 8, d4: 2, d5: 7 });
  console.log(`\n명시적 매핑 후 예상 드라이버 점수: ${JSON.stringify(SCORES_2)}`);
  console.log(`예상 확률: ~${prob2}%`);
  console.log(`\n평가: 가장 정확하나 OpenAI 호출 시 프롬프트 복잡도 증가, 추가 비용 없음`);
}

// ─── 방식 ③ Bayesian PRIOR_STRENGTH에 conflict 반영 ─────────────────────
function approach3(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식③ Bayesian PRIOR_STRENGTH에 conflict 반영');
  console.log('══════════════════════════════════════');

  const BASE_PRIOR = 10;
  const conflict_count = MOCK_GIST.conflict_points.length; // 3
  const PRIOR_STRENGTH = BASE_PRIOR + conflict_count * 2;  // 10 + 6 = 16

  const driver_prob = computeProb(SCORES_3);

  console.log(`conflict_points ${conflict_count}개 → PRIOR_STRENGTH = ${BASE_PRIOR} + ${conflict_count}×2 = ${PRIOR_STRENGTH}`);
  console.log(`Driver 확률: ${driver_prob}%`);
  console.log(`\n투표 영향 시뮬레이션 (모두 "종전↑" 카드 선택 가정):`)
  for (const votes of [1, 5, 10, 20, 50]) {
    const weight = votes / (PRIOR_STRENGTH + votes);
    const delta_per_driver = 0.5; // 평균 delta
    const shift = Math.round(delta_per_driver * weight * 10 * 10) / 10;
    console.log(`  ${String(votes).padStart(2)}표: weight=${(weight * 100).toFixed(1)}%, 최대확률 이동 ~${shift}%`);
  }
  console.log(`\n평가: conflict 많을수록 AI 판단이 더 강하게 고정 → 투표 설득력 필요`);
}

// ─── 종합 비교 ────────────────────────────────────────────────────────────
function summary(): void {
  const d1 = Math.round(0.7 * computeProb(SCORES_1) + 0.3 * 57);
  const d2 = computeProb({ d1: 6, d2: 7, d3: 8, d4: 2, d5: 7 });
  const d3 = computeProb(SCORES_3);

  console.log('\n══════════════════════════════════════');
  console.log('종합 비교 — 이란 전쟁 종전 가능성');
  console.log('══════════════════════════════════════');
  console.log(`방식①  Evidence Blending    : ${d1}%  (alignment/conflict 개수 기반 보정)`);
  console.log(`방식②  OpenAI 명시적 매핑   : ${d2}%  (기사 내용 → 드라이버 직접 반영)`);
  console.log(`방식③  Bayesian Prior 조정  : ${d3}%  (확률은 동일, 투표 영향만 달라짐)`);
  console.log(`현재 방식 (비교 기준)        : ${computeProb(SCORES_1)}%  (alignment/conflict 미반영)`);
  console.log(`\nGist Outlook 전망: "3개월 내 부분합의 30~40%, 종전은 2027년 이후"`);
}

approach1();
approach2();
approach3();
summary();
