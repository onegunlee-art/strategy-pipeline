import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 일회용 SG제주위성데이터센터 시드 엔드포인트
// GET /api/seed-sg?key=sg2026 — 호출 후 제거 예정
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'sg2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const db = await getDb();

  // SG 딜 찾기
  const { rows } = await db.query(
    `SELECT id, client_name FROM deals WHERE LOWER(client_name) LIKE '%sg%' OR LOWER(client_name) LIKE '%제주%' OR LOWER(client_name) LIKE '%위성%' ORDER BY id LIMIT 5`
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: '딜을 찾지 못했습니다', hint: 'client_name에 sg/제주/위성 포함된 딜 없음' }, { status: 404 });
  }

  const deal = rows[0];

  const winningPoints = [
    { customer_cfs: 'NGA를 뛰어넘는 위성영상처리/관리/배포 전용시스템 및 위성데이터센터 구축', winning_point: '국자원 대국센터·국방DIDC 설계/구축·운영 경험으로 체득한 SDN/SDC/SDS 구축 방법론 제시 → SG 국자원을 능가하는 DC구축 역량 보유' },
    { customer_cfs: '위성영상 데이터 표준화 방안 및 현 영상데이터(15PB)의 안전한 제주 이관', winning_point: 'KT단독 100G NW(168억원/2년) 제공을 통한 15PB 영상데이터 최단기(17일) 이관 및 정합성 확보' },
    { customer_cfs: 'SDDC 인프라 환경 구축 및 데이터센터 운영 자동화', winning_point: '100G NW 활용 서울-제주간 끊김없는 VDI 영상판독서비스 및 긴급 재해복구/업무연속성(BCP) 체계 구성' },
    { customer_cfs: '대용량 위성영상 장기 관리·보존 및 업무연속성(BCP) 보장', winning_point: '30년 이상 kt-sat 위성사업 경험·역량 기반 위성영상처리/관리시스템 개발의 안정적 적기 납기 제공' },
    { customer_cfs: '서울-제주 간 VDI를 통한 원활한 영상판독 기능 제공', winning_point: 'KT 기 운용중인 DC 운용자동화(AIOps) 맞춤형 제공으로 운용비 절감 및 운용효율성 강화 방안 제시' },
  ];

  const partners = [
    { name: 'KT', role: '주관', category: '프로젝트 관리', task_scope: '사업관리(PM, PMO) / 전사 품질관리(QA), 아키텍처(AA, SA)', ratio_pct: null },
    { name: '컨텍, 제타존, KT-SAT', role: '협력', category: '소프트웨어 개발', task_scope: '통합 수신·처리시스템 개발 / 통합 촬영계획시스템 개발', ratio_pct: null },
    { name: '한컴인스페이스, KT-SAT', role: '협력', category: '소프트웨어 개발', task_scope: '영상관리 시스템 개발 / 대외배포 시스템 개발 / UI 설계, 데이터 이관 및 관련 도구 개발', ratio_pct: null },
    { name: 'IBM, VAST', role: '협력', category: 'IT 인프라 구축/인프라도입', task_scope: '영상저장 인프라 구축 / 기반 아키텍처 구축', ratio_pct: null },
    { name: '진인프라, KT-DS', role: '협력', category: 'IT 인프라 구축/인프라도입', task_scope: '네트워크·보안 아키텍처 구축 / VDI 시스템 구축 / IT 운영 관제시스템 구축', ratio_pct: null },
    { name: '코넥(1순위), 용창', role: '협력', category: '기반환경구축', task_scope: '운영실 인테리어 / 전산실 컨테인먼트 / 공조·배관 / UPS·전원공사 / Tray·부스덕트 / CCTV·DCIM 구축', ratio_pct: null },
  ];

  const qnaItems = [
    { question: 'VDI 협력사 구도', answer: 'VDI는 KT-DS가 총괄 사업자이며 VMware vs Citrix 솔루션 견적 및 요구사항 기능 충족 여부 확인 중. 고객사 VMware 종속 요건 해소 요청 중.' },
    { question: '100G 구성 문의', answer: '서울→제주 이관 핵심. 고객 현황: 10G×2회선, 약 15PT. 10G×2 기준 10PT 이관 7개월 소요(동일 환경 11개월 예상). 100G 구성 시 이관 시간 획기적 단축, 이관 후 VDI 실시간 판독 처리 보장, 10G 비용 수준으로 100G 사용 가능.' },
    { question: 'PoC 문의', answer: '수주 이후 인프라·VDI 환경 구축 전까지 진행. ISP 때 1User 10G 환경 테스트. PoC는 동접자 최소 150User 이상. PoC 결과에 따라 VDI 외 방안도 제안 예정.' },
  ];

  const teamMembers = [
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '3담당', team: 'Cloud/IT제안이행TF', role: '제안이행', count: null },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '3담당', team: 'AX이행1팀', role: '이행', count: null },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '3담당', team: 'AX이행2팀', role: '이행', count: null },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '3담당', team: 'Cloud이행2팀', role: '이행', count: 19 },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '1담당', team: '수주/이행전략팀', role: '전략', count: 2 },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '아키텍처/품질담당', team: '플랫폼아키텍처팀', role: '아키텍처', count: null },
    { division: 'AX사업부문', hq: 'AX제안/이행본부', dept: '아키텍처/품질담당', team: '품질관리팀', role: '품질관리', count: 4 },
    { division: 'AX사업부문', hq: 'AX사업본부', dept: 'Cloud/IT사업담당', team: 'Cloud/IT GTM1팀', role: 'GTM', count: null },
    { division: 'AX사업부문', hq: 'AX사업본부', dept: 'Cloud/IT사업담당', team: 'Cloud/IT GTM2팀', role: 'GTM', count: 3 },
    { division: 'AX사업부문', hq: 'AX전략본부', dept: 'AX전략컨설팅담당', team: 'AX사업개발팀', role: '전략컨설팅', count: 1 },
    { division: 'Enterprise부문', hq: '공공/금융사업본부', dept: '공공사업개발1담당', team: '공공사업개발2팀', role: '사업개발', count: 5 },
    { division: 'Enterprise부문', hq: 'Enterprise제안/이행본부', dept: '사업제안담당', team: '수주전략팀', role: '수주전략', count: 2 },
    { division: 'Enterprise부문', hq: 'Enterprise사업본부', dept: 'Account 담당', team: '전략사업개발팀', role: 'Account', count: null },
    { division: 'IT부문', hq: 'IT전략본부', dept: 'IT인프라기술담당', team: 'IT인프라컨설팅팀', role: '인프라컨설팅', count: 4 },
    { division: 'KT-DS', hq: 'Cloud사업본부', dept: 'Cloud사업담당', team: 'Cloud사업팀', role: 'Cloud사업', count: 2 },
    { division: 'KT-SAT', hq: '신사업추진본부', dept: '', team: 'Spacedata팀', role: '위성데이터', count: 1 },
  ];

  const risks = [
    { name: '사업구도/재무상태 — 핵심 파트너사(한컴인스페이스) 재무구조 취약', probability: 55, impact: 70, difficulty: 50, level: '중' },
    { name: '인력/경험 — 대규모 구축 협력사 관리 및 장기 제주 지역 파견 부담', probability: 50, impact: 65, difficulty: 55, level: '중' },
  ];

  await db.query(
    `UPDATE deals SET
      expected_revenue     = $2,
      risk_grade           = $3,
      pt_format            = $4,
      customer_eval_criteria = $5,
      winning_points       = $6::jsonb,
      partners             = $7::jsonb,
      vdc_b_result         = $8::jsonb,
      qna_items            = $9::jsonb,
      team_members         = $10::jsonb,
      risks                = $11::jsonb
    WHERE id = $1`,
    [
      deal.id,
      1345,
      '전략중요도★★★★★',
      '6.10(수) 오후 2시 / (20분) PT 발표, (20분) 질의응답 진행',
      '위성수 증가에 따른 수집 데이터 표준화 정립 및 개별 위성 통합촬영계획 시스템 구축 / 서울-제주간 VDI 기반 판독환경 구축 및 운영자동화를 통한 안정적/효율적 DC운용관리 / 선진사례 NGA 수준의 위성데이터센터 구축 및 영상관리/저장/배포 운영기술 접목',
      JSON.stringify(winningPoints),
      JSON.stringify(partners),
      JSON.stringify([]),
      JSON.stringify(qnaItems),
      JSON.stringify(teamMembers),
      JSON.stringify(risks),
    ]
  );

  return NextResponse.json({
    ok: true,
    deal_id: deal.id,
    client_name: deal.client_name,
    message: `딜 [${deal.id}] ${deal.client_name} 업데이트 완료`,
  });
}
