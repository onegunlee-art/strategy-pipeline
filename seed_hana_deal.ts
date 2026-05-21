/**
 * 하나은행 비정형데이터 자산화 플랫폼 구축 사업
 * WIN-RATIO ENGINE DB 등록 스크립트
 *
 * 사용법: BASE_URL=http://localhost:3000 ADMIN_PASSWORD=xxx npx ts-node seed_hana_deal.ts
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

const HANA_DEAL = {
  client_name: '하나은행',
  deal_size: '30억',
  industry: '금융',
  duration_months: 8,
  risk: 3,
  competitors: ['Samsung SDS'],
  voting_days: 14,

  rfp_summary: [
    '■ 사업명: 하나은행 비정형데이터 자산화 플랫폼 구축 사업',
    '■ 사업 기간: 8개월',
    '■ 데이터 규모: 초기 1TB/100만건, 일 10GB/4,000건 증분',
    '■ 14개 기능 영역: 데이터수집·저장구조·워크플로우·데이터변환·파싱·청킹·임베딩/벡터검색·',
    '  메타데이터/리니지/버전관리·품질관리·검색/포털·API/SDK·API Gateway·생성형AI연계(MCP Server)·비식별화',
    '■ 핵심 제약: 개발망/운영망 분리, DRM 복호화, 개인정보보호법+신용정보법, 전금법 준수, Oracle CLOB/BLOB 연계',
    '■ 경쟁사: 삼성SDS (자체솔루션 Brightics 기반, 라이선스 절감으로 입찰가 낮출 가능성)',
    '■ 당사 제약: Elasticsearch 라이선스 비용 부담으로 금액 여유 제한적',
  ].join('\n'),

  strategy_memo: [
    '■ 3대 핵심 전략',
    '1. Ready to AI: 플랫폼 구축 즉시 MCP Server 연결 → AI Agent 사업 바로 적용 가능',
    '   - 하나은행 킬러앱: 영업점 상담 AI(내규/상품 Q&A), 여신심사 비정형 자동요약, AML 이상거래 탐지',
    '2. 비용 최적화: Hot/Warm/Cold 티어 전략 → 스토리지 비용 60% 절감',
    '   - Hot(SSD/ES): 최근 6개월만 인덱싱, Warm(HDD): 6개월~2년, Cold(S3): 2년 이상',
    '   - KT Cloud 할인율 + 오토스케일링으로 TCO 5년 비교표 제시',
    '3. 데이터 무결성: 2-Pass 클렌징 (1차: 입수 시점, 2차: AI 처리 후) → 오류율 0.5% 이하',
    '',
    '■ 경쟁 전략 vs 삼성SDS',
    '- 가격 싸움 탈피: ES = 글로벌 금융 표준(JPMorgan·Goldman Sachs) → 안정성 검증 완료',
    '- 락인 리스크 부각: 삼성SDS 자체솔루션 = 유지보수 종속, KT = OSS 기반 멀티벤더 전환 자유',
    '- AI 연계 실용성: 삼성SDS는 플랫폼만, KT는 구축 즉시 AI 비즈니스 청사진 제시',
    '',
    '■ 금융 특화 차별화 (선제 제안)',
    '- 컴플라이언스 자동화: 규제 변경 감지 → 내규 영향도 자동 매핑 → 감사 대응',
    '- DRM 연계 API + 복호화 감사로그, HWP 파서 내장, 망분리 환경 온프레미스 임베딩 모델',
  ].join('\n'),

  sub_scores: {
    // S — 사전영업
    s_key_man_contact: 6,   // RFP 수령했으나 의사결정자 깊은 관계 미확인
    s_evaluator_rfp:   8,   // RFP 21개 카테고리 173요건 엑셀화, 평가 기준 완전 파악
    s_poc_proposal:    4,   // POC 미실시, 제안 초기 단계

    // V — Value Impact
    v_needs_painpoint:    8, // DRM/비식별화/개발망분리/레거시Oracle/전금법 등 상세 파악
    v_value_proposition:  7, // 3대 전략 + 컴플라이언스 자동화 킬러앱 명확
    v_presentation:       6, // 제안서 목차·전략 수립 완료, 실제 PT 준비 중

    // D — 차별화
    d_competitive_strategy: 6, // 삼성SDS 대비 락인·표준 전략 수립, 가격 열세 존재
    d_tech_reference:       7, // ES 글로벌 금융 표준 + KT 금융 레퍼런스
    d_partner:              5, // 특별 파트너/컨소시엄 미정

    // P — 가격경쟁력
    p_budget_fit:        5, // ES 라이선스로 예산 여유 제한적
    p_price_competition: 3, // 삼성SDS 자체솔루션 대비 불리 — 최약점
    p_cost_value:        6, // TCO 절감 전략으로 일부 만회 가능

    // E — Delivery
    e_track_record:    6, // KT 금융 레퍼런스 있으나 비정형데이터 특화 실적 부족
    e_risk_management: 7, // 8개월 WBS, 2-Pass 클렌징 품질 체계, 리스크 관리 계획
    e_execution_team:  7, // KT 전문 인력 + 금융 도메인 인력 확보 가능
  },
};

async function seed() {
  console.log('='.repeat(60));
  console.log('하나은행 딜 등록 — WIN-RATIO ENGINE');
  console.log('='.repeat(60));

  if (!ADMIN_PASSWORD) {
    console.error('❌  ADMIN_PASSWORD 환경변수 미설정. 종료.');
    process.exit(1);
  }

  // Admin 쿠키 획득
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    console.error('❌  Admin 로그인 실패:', body);
    process.exit(1);
  }

  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const cookieMatch = setCookie.match(/wr_admin=[^;]+/);
  const cookie = cookieMatch ? cookieMatch[0] : '';
  console.log('✅  Admin 인증 완료');

  // RFP 등록
  const importRes = await fetch(`${BASE_URL}/api/admin/rfp-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify(HANA_DEAL),
  });

  const data = await importRes.json();

  if (!importRes.ok) {
    console.error('❌  딜 등록 실패:', data.error);
    process.exit(1);
  }

  console.log('\n📊  수주 확률 분석 결과');
  console.log('-'.repeat(40));
  console.log(`딜 ID:         #${data.deal_id}`);
  console.log(`최종 확률:      ${data.probability.toFixed(1)}%`);
  console.log(`신뢰구간:       ${data.confidence_interval.low.toFixed(0)}% – ${data.confidence_interval.high.toFixed(0)}%`);
  console.log(`사전 기저확률:  ${data.prior_base_rate.toFixed(1)}%`);
  console.log(`누적 데이터:    ${data.data_points}건`);

  console.log('\n📐  4-Method Breakdown');
  console.log('-'.repeat(40));
  const mp = data.method_probs;
  console.log(`Pillar Mult:   ${mp.pillar?.toFixed(1) ?? '-'}%`);
  console.log(`Bayesian:      ${mp.bayesian?.toFixed(1) ?? '-'}%`);
  console.log(`Elo Matchup:   ${mp.elo?.toFixed(1) ?? '-'}%`);
  console.log(`Monte Carlo:   ${mp.monteCarlo?.toFixed(1) ?? '-'}%`);

  console.log('\n⚠   Top 3 약점');
  console.log('-'.repeat(40));
  for (const [i, w] of (data.weaknesses ?? []).entries()) {
    console.log(`${i + 1}. [${w.pillar}] ${w.label} — 점수 ${w.score}/10`);
  }

  console.log('\n🗳   팀 투표 링크');
  console.log('-'.repeat(40));
  console.log(`URL:  ${BASE_URL}${data.voting_url}`);
  console.log(`Token: ${data.voting_token}`);

  console.log('\n✅  완료! 대시보드에서 딜 #' + data.deal_id + ' 확인하세요.');
  console.log('='.repeat(60));
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
