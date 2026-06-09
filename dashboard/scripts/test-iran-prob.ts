/**
 * 이란 전쟁 종전 가능성 — 확률 계산 방식 3가지 비교 테스트
 * (실제 Gist RAG 기사 데이터 기반)
 * npx ts-node --project tsconfig.json scripts/test-iran-prob.ts
 */

// ─── 실제 Gist RAG 결과 (2026-06 기준 실제 기사 분석) ────────────────────
const ACTUAL_GIST = {
  synthesis:
    '최소 합의로 즉각 교전을 멈추고, 이후 단계적으로 비공격 보장·핵·제재를 재협상하는 방식일 때만 ' +
    '현실성이 높음. 정권 교체 수사와 결합된 강경 조건 휴전안은 성사 가능성을 낮추고 장기 소모전 위험을 키움.',

  // 종전 가능성을 높이는 방향 (일치하는 점)
  alignment_points: [
    '[FA 2026-04] 양측 모두 휴전 필요성 공유 — 전쟁 비용·위험이 커졌고 출구전략 필요',
    '[FA 2026-04] 과도한 조건 붙인 휴전은 작동 불가 — 사실상 항복 요구는 버티기·확전 유인',
    '[이코노미스트 2026-05] 호르무즈 해협 리스크가 협상을 급박하게 만듦 — 에너지·물류 압박으로 국제 중재 강화',
    '[FA 2026-05] 단계론 부상 — 먼저 최소 합의로 교전 중단, 이후 비공격 보장·핵 의제 단계 협상',
  ],

  // 종전 가능성을 낮추는 방향 (충돌하는 점)
  conflict_points: [
    '[FA 2026-04] 미국 15개항 휴전안 = 사실상 이란 무조건 굴복 수준 — 이란 수용 불가 구조',
    '[FA 2026-04] 미·이스라엘 정권 교체 시사 수사 지속 — 이란은 휴전을 잠깐 숨 고르기로 의심',
    '[FA 2026-04] 요구 간극 극대화: 미(호르무즈·핵·미사일·대리세력) vs 이란(전면 제재해제·동결자산·비공격 보장)',
    '[이코노미스트 2026-03] 이란 체제 붕괴 예상과 달리 혁명수비대 지휘체계 유지 — 버티기 장기화',
    '[FA 2026-03] 이란, 이번 전쟁을 체제 생존 위기이자 억지력 복원 기회로 해석 — 타협 유인 낮음',
    '[이코노미스트 2026-06] 기술 의존 공습(AI 타격)으로 상대 굴복 실패 — 영원한 전쟁 함정 진입',
  ],

  outlook:
    '단기: 최소 합의형 제한 휴전 가능성 상대적으로 높음 (베트남전식 불안정 타협). ' +
    '중기: 지속 보장·제재 보상 신뢰성이 핵심 변수. ' +
    '구조: 호르무즈 리스크가 협상 테이블 상수로 고착 — 이후 어떤 합의든 해협 통행 문제 중심.',
};

// ─── 드라이버 메타 & 실제 기사 반영 점수 ─────────────────────────────────
const DRIVER_META = [
  { key: 'd1', labelKo: '외교 채널',  invert: false },
  { key: 'd2', labelKo: '군사 강도',  invert: true  },
  { key: 'd3', labelKo: '경제 압박',  invert: true  },
  { key: 'd4', labelKo: '내부 안정',  invert: false },
  { key: 'd5', labelKo: '외부 개입',  invert: true  },
];

// 현재 방식 (alignment/conflict 미반영): 기사 내용 기반 베이스
const SCORES_BASE = { d1: 3, d2: 8, d3: 7, d4: 2, d5: 7 };
// 방식②: alignment → 드라이버 +, conflict → 드라이버 - 명시 반영
const SCORES_2    = { d1: 4, d2: 7, d3: 7, d4: 2, d5: 7 };
// 방식③: conflict 6개 → PRIOR_STRENGTH 강화, 점수는 alignment 4개 소폭 반영
const SCORES_3    = { d1: 4, d2: 7, d3: 7, d4: 2, d5: 7 };

function contribution(invert: boolean, score: number) {
  return invert ? 10 - score : score;
}

function computeProb(scores: Record<string, number>): number {
  const sum = DRIVER_META.reduce((acc, m) => acc + contribution(m.invert, scores[m.key] ?? 5), 0);
  const mean = sum / DRIVER_META.length;
  return Math.round(Math.max(5, Math.min(95, mean * 10)));
}

// ─── 방식 ① 직접 확률 보정 (Evidence Blending) ───────────────────────────
function approach1(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식① 직접 확률 보정 (Evidence Blending)');
  console.log('══════════════════════════════════════');

  const driver_prob = computeProb(SCORES_BASE);
  const align = ACTUAL_GIST.alignment_points.length;    // 4
  const conflict = ACTUAL_GIST.conflict_points.length;  // 6
  const evidence_score = Math.round((align / (align + conflict)) * 100); // 40%

  const final_prob = Math.round(0.7 * driver_prob + 0.3 * evidence_score);

  console.log(`드라이버 점수: ${JSON.stringify(SCORES_BASE)}`);
  DRIVER_META.forEach(m => {
    const c = contribution(m.invert, SCORES_BASE[m.key as keyof typeof SCORES_BASE]);
    console.log(`  ${m.labelKo} (invert=${m.invert}): raw=${SCORES_BASE[m.key as keyof typeof SCORES_BASE]} → contribution=${c}`);
  });
  console.log(`Driver 확률: ${driver_prob}%`);
  console.log(`Alignment ${align}개 / Conflict ${conflict}개 → Evidence Score: ${evidence_score}%`);
  console.log(`최종 확률: 0.7×${driver_prob} + 0.3×${evidence_score} = ${final_prob}%`);
  console.log(`\n핵심 alignment: "${ACTUAL_GIST.alignment_points[3]}"`);
  console.log(`핵심 conflict:  "${ACTUAL_GIST.conflict_points[0]}"`);
  console.log(`\n평가: 개수 기반이라 conflict 6 > alignment 4 → evidence_score 40%로 하락. 내용 무시.`);
}

// ─── 방식 ② OpenAI 프롬프트에 alignment/conflict 명시적 드라이버 매핑 ─────
function approach2(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식② OpenAI 프롬프트에 alignment/conflict 명시적 매핑');
  console.log('══════════════════════════════════════');
  console.log('\n[프롬프트에 추가될 실제 내용]');
  console.log('─────────────────────────────');
  console.log(`alignment_points → 드라이버 조정:
  • "${ACTUAL_GIST.alignment_points[0]}" → 외교채널(d1) +0.5
  • "${ACTUAL_GIST.alignment_points[1]}" → (양면: 외교채널 긍정 +0.5, 군사강도 하락 가능 +0.5)
  • "${ACTUAL_GIST.alignment_points[2]}" → 외부개입(d5) 완화 압력 +0.5
  • "${ACTUAL_GIST.alignment_points[3]}" → 외교채널(d1) +0.5

conflict_points → 드라이버 조정:
  • "${ACTUAL_GIST.conflict_points[0]}" → 외교채널(d1) -1
  • "${ACTUAL_GIST.conflict_points[1]}" → 군사강도(d2) 유지 -0.5
  • "${ACTUAL_GIST.conflict_points[2]}" → 외교채널(d1) -0.5, 외부개입(d5) -0.5
  • "${ACTUAL_GIST.conflict_points[3]}" → 내부안정(d4) -1 (체제 유지, 타협 유인 낮음)
  • "${ACTUAL_GIST.conflict_points[4]}" → 내부안정(d4) -1 (체제 생존 논리)
  • "${ACTUAL_GIST.conflict_points[5]}" → 군사강도(d2) 유지 -0.5`);

  const prob2 = computeProb(SCORES_2);
  console.log(`\n명시적 매핑 후 예상 드라이버 점수: ${JSON.stringify(SCORES_2)}`);
  DRIVER_META.forEach(m => {
    const c = contribution(m.invert, SCORES_2[m.key as keyof typeof SCORES_2]);
    console.log(`  ${m.labelKo}: raw=${SCORES_2[m.key as keyof typeof SCORES_2]} → contribution=${c}`);
  });
  console.log(`예상 확률: ~${prob2}%`);
  console.log(`\n평가: conflict 6개가 강하게 작용 → alignment 4개의 긍정 효과 상쇄. 가장 정확한 실상 반영.`);
}

// ─── 방식 ③ Bayesian PRIOR_STRENGTH에 conflict 수 반영 ──────────────────
function approach3(): void {
  console.log('\n══════════════════════════════════════');
  console.log('방식③ Bayesian PRIOR_STRENGTH에 conflict 반영');
  console.log('══════════════════════════════════════');

  const BASE_PRIOR = 10;
  const conflict_count = ACTUAL_GIST.conflict_points.length;  // 6
  const PRIOR_STRENGTH = BASE_PRIOR + conflict_count * 2;     // 10 + 12 = 22

  const driver_prob = computeProb(SCORES_3);

  console.log(`conflict_points ${conflict_count}개 → PRIOR_STRENGTH = ${BASE_PRIOR} + ${conflict_count}×2 = ${PRIOR_STRENGTH}`);
  console.log(`Driver 확률: ${driver_prob}%`);
  console.log(`\n투표 영향 시뮬레이션 (모두 "종전↑" 카드 선택 가정):`)
  for (const votes of [1, 5, 10, 20, 50]) {
    const weight = votes / (PRIOR_STRENGTH + votes);
    const delta_per_driver = 0.5;
    const shift = Math.round(delta_per_driver * weight * 10 * 10) / 10;
    console.log(`  ${String(votes).padStart(2)}표: weight=${(weight * 100).toFixed(1)}%, 최대확률 이동 ~${shift}%`);
  }
  console.log(`\n평가: conflict 6개 → AI 판단이 더 강하게 고정. 1표 이동폭 ${
    Math.round(0.5 * (1/(PRIOR_STRENGTH+1)) * 10 * 10) / 10
  }% (기본 PRIOR=10일 때보다 작음)`);
}

// ─── 종합 비교 ────────────────────────────────────────────────────────────
function summary(): void {
  const align = ACTUAL_GIST.alignment_points.length;
  const conflict = ACTUAL_GIST.conflict_points.length;
  const evidence_score = Math.round((align / (align + conflict)) * 100);
  const d1 = Math.round(0.7 * computeProb(SCORES_BASE) + 0.3 * evidence_score);
  const d2 = computeProb(SCORES_2);
  const d3 = computeProb(SCORES_3);
  const base = computeProb(SCORES_BASE);

  console.log('\n══════════════════════════════════════');
  console.log('종합 비교 — 이란 전쟼 종전 가능성 (실제 Gist 기사 기반)');
  console.log('══════════════════════════════════════');
  console.log(`현재 방식 (비교 기준)        : ${base}%  (alignment/conflict 미반영)`);
  console.log(`방식①  Evidence Blending    : ${d1}%  (alignment ${align}개/conflict ${conflict}개 → evidence ${evidence_score}%)`);
  console.log(`방식②  OpenAI 명시적 매핑   : ${d2}%  (기사 내용 → 드라이버 직접 반영)`);
  console.log(`방식③  Bayesian Prior 조정  : ${d3}%  (확률 동일, PRIOR_STRENGTH=${10+conflict*2}로 투표 영향 약화)`);
  console.log(`\nGist 종합 판단: "${ACTUAL_GIST.synthesis.slice(0,60)}..."`);
  console.log(`Gist Outlook:   "${ACTUAL_GIST.outlook.slice(0,60)}..."`);
  console.log(`\n★ 권장: 방식② — 실제 기사 내용이 드라이버에 반영됨. conflict 우세 → 낮은 확률이 현실과 일치.`);
}

approach1();
approach2();
approach3();
summary();
