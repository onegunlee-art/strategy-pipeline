import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const SUB_FACTORS = [
  // S — 사전영업
  { id: 's_key_man_contact',   pillar: 'S', label: 'Key Man 접촉',      weight: 40, desc: '수요처 핵심 담당자/결정권자와 직접 접촉하고 있는가?' },
  { id: 's_evaluator_rfp',     pillar: 'S', label: '평가자·RFP 파악',    weight: 40, desc: '평가자/RFP 요구사항을 사전에 파악했는가?' },
  { id: 's_poc_proposal',      pillar: 'S', label: 'PoC·제안 기회',      weight: 20, desc: 'PoC, 선제안 등을 통해 제안 기회를 선점했는가?' },
  // V — Value Impact
  { id: 'v_needs_painpoint',   pillar: 'V', label: '니즈·Pain Point',    weight: 40, desc: '고객의 핵심 문제를 정확히 파악하고 있는가?' },
  { id: 'v_value_proposition', pillar: 'V', label: '가치 제안',           weight: 40, desc: '고객 니즈를 충족하는 충분한 가치 제안이 있는가?' },
  { id: 'v_presentation',      pillar: 'V', label: 'C-Level 발표',       weight: 20, desc: '고객에게 핵심 승리 메시지를 전달할 수 있는가?' },
  // D — 차별화
  { id: 'd_competitive_strategy', pillar: 'D', label: '차별화 전략',    weight: 40, desc: '경쟁사 대비 명확한 Why Us 논리가 있는가?' },
  { id: 'd_tech_reference',    pillar: 'D', label: '기술·레퍼런스',       weight: 40, desc: '기술 우위 및 유사 레퍼런스가 있는가?' },
  { id: 'd_partner',           pillar: 'D', label: '파트너·컨소시엄',     weight: 20, desc: '파트너사/컨소시엄 구성이 차별화되는가?' },
  // P — 가격경쟁력
  { id: 'p_budget_fit',        pillar: 'P', label: '예산 적합성',         weight: 30, desc: '고객 예산 범위에 맞는 제안이 가능한가?' },
  { id: 'p_price_competition', pillar: 'P', label: '경쟁 가격 우위',      weight: 40, desc: '경쟁사 대비 가격 경쟁력이 있는가?' },
  { id: 'p_cost_value',        pillar: 'P', label: 'ROI·TCO',            weight: 30, desc: '고객 관점의 ROI/TCO 가치를 입증할 수 있는가?' },
  // E — Delivery
  { id: 'e_track_record',      pillar: 'E', label: '수주·이행 실적',      weight: 40, desc: '유사 사업 수주 및 성공 이행 실적이 있는가?' },
  { id: 'e_risk_management',   pillar: 'E', label: '리스크 관리',          weight: 40, desc: '사업 리스크를 사전 식별하고 대응 방안이 있는가?' },
  { id: 'e_execution_team',    pillar: 'E', label: '전담팀·PM',            weight: 20, desc: '전담 수행팀 및 PM 역량이 검증되었는가?' },
];

const PILLAR_NAMES: Record<string, string> = {
  S: '사전영업 (Key Man·RFP·PoC)',
  V: 'Value Impact (니즈·가치·발표)',
  D: '차별화 (전략·기술·파트너)',
  P: '가격경쟁력 (예산·가격·ROI)',
  E: 'Delivery (실적·리스크·팀)',
};

export async function GET() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: 수주가능성 분석 ──────────────────────────────────────────
  const wsData: (string | number)[][] = [];

  // 헤더 행
  wsData.push(['Pillar', 'Sub-Factor ID', '평가 항목', '평가 기준 질문', '가중치(%)', '평점(1~3)', '점수(가중치×평점)', '현수준 기재']);

  let rowIndex = 2; // Excel은 1-based, 헤더가 1행
  const pillarStartRows: Record<string, number> = {};

  const pillars = ['S', 'V', 'D', 'P', 'E'];
  for (const pid of pillars) {
    const items = SUB_FACTORS.filter(f => f.pillar === pid);
    pillarStartRows[pid] = rowIndex;

    for (const item of items) {
      wsData.push([
        PILLAR_NAMES[pid],
        item.id,
        item.label,
        item.desc,
        item.weight,
        3,  // 기본 평점 3 (최고점)
        { f: `E${rowIndex}*F${rowIndex}/100` } as unknown as number,
        '',
      ]);
      rowIndex++;
    }

    // Pillar 합계 행
    const startRow = pillarStartRows[pid];
    const endRow = rowIndex - 1;
    wsData.push([
      `[${pid}] ${PILLAR_NAMES[pid]} 합계`,
      '', '', '',
      { f: `SUM(E${startRow}:E${endRow})` } as unknown as number,
      '',
      { f: `SUM(G${startRow}:G${endRow})` } as unknown as number,
      '',
    ]);
    rowIndex++;

    // 빈 줄
    wsData.push(['', '', '', '', '', '', '', '']);
    rowIndex++;
  }

  // 총점 행
  wsData.push(['총점 (Win Possibility Score)', '', '', '', 100, '', { f: `G2+G${pillarStartRows.V}+G${pillarStartRows.D}+G${pillarStartRows.P}+G${pillarStartRows.E}` } as unknown as number, '']);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 열 너비
  ws['!cols'] = [
    { wch: 36 }, { wch: 24 }, { wch: 18 }, { wch: 44 },
    { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 36 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '수주가능성 분석');

  // ── Sheet 2: 평점 가이드 ──────────────────────────────────────────────
  const guideData = [
    ['평점', '기준', '설명'],
    [1, '미흡', '정보 부족 / 준비 안 됨 / 경쟁열위'],
    [2, '보통', '부분적으로 파악 / 준비 중 / 대등'],
    [3, '우수', '충분히 파악 / 준비 완료 / 경쟁우위'],
    ['', '', ''],
    ['Pillar', '만점', '비고'],
    ['사전영업 (S)', 100, '가중치 합계 100% × 최고평점 3 / 3'],
    ['Value Impact (V)', 100, ''],
    ['차별화 (D)', 100, ''],
    ['가격경쟁력 (P)', 100, ''],
    ['Delivery (E)', 100, ''],
    ['총점', 100, '각 Pillar 점수 산술 평균'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, '평점 가이드');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="win_ratio_assessment.xlsx"',
    },
  });
}
