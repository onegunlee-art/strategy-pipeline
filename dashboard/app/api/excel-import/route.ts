import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// 우리 시스템의 15개 sub-factor (pillar, label, weight)
const SUB_FACTOR_META = [
  { id: 's_key_man_contact',      pillar: 'S', label: 'Key Man 접촉',      weight: 0.40 },
  { id: 's_evaluator_rfp',        pillar: 'S', label: '평가자·RFP 파악',    weight: 0.40 },
  { id: 's_poc_proposal',         pillar: 'S', label: 'PoC·제안 기회',      weight: 0.20 },
  { id: 'v_needs_painpoint',      pillar: 'V', label: '니즈·Pain Point',    weight: 0.40 },
  { id: 'v_value_proposition',    pillar: 'V', label: '가치 제안',           weight: 0.40 },
  { id: 'v_presentation',         pillar: 'V', label: 'C-Level 발표',       weight: 0.20 },
  { id: 'd_competitive_strategy', pillar: 'D', label: '차별화 전략',        weight: 0.40 },
  { id: 'd_tech_reference',       pillar: 'D', label: '기술·레퍼런스',       weight: 0.40 },
  { id: 'd_partner',              pillar: 'D', label: '파트너·컨소시엄',     weight: 0.20 },
  { id: 'p_budget_fit',           pillar: 'P', label: '예산 적합성',         weight: 0.30 },
  { id: 'p_price_competition',    pillar: 'P', label: '경쟁 가격 우위',      weight: 0.40 },
  { id: 'p_cost_value',           pillar: 'P', label: 'ROI·TCO',            weight: 0.30 },
  { id: 'e_track_record',         pillar: 'E', label: '수주·이행 실적',      weight: 0.40 },
  { id: 'e_risk_management',      pillar: 'E', label: '리스크 관리',          weight: 0.40 },
  { id: 'e_execution_team',       pillar: 'E', label: '전담팀·PM',            weight: 0.20 },
];

const PILLAR_IDS = ['S', 'V', 'D', 'P', 'E'];
const PILLAR_LABELS: Record<string, string> = {
  S: '사전영업', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery',
};

interface ParsedItem {
  pillar: string;
  label: string;
  weight: number;     // 가중치 (%)
  rating: number;     // 평점 (1~3)
  score: number;      // 점수 = weight * rating / 100 * (100/3)  or direct
  rationale: string;  // 현수준 판단 근거
}

interface ParsedSheet {
  items: ParsedItem[];
  pillarScores: Record<string, number>;   // 0~100
  pillarRationale: Record<string, string>; // Pillar별 현수준 요약
  totalScore: number;
  source: 'template' | 'custom';
}

function isNumeric(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

function parseExcelSheet(ws: XLSX.WorkSheet): ParsedSheet {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:Z100');
  const rows: (string | number | boolean | null)[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: (string | number | boolean | null)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      row.push(cell ? (cell.v ?? null) : null);
    }
    rows.push(row);
  }

  const items: ParsedItem[] = [];
  const pillarScores: Record<string, number> = { S: 0, V: 0, D: 0, P: 0, E: 0 };
  const pillarRationale: Record<string, string[]> = { S: [], V: [], D: [], P: [], E: [] };

  // 템플릿 형식: Sub-Factor ID가 2열(index 1)에 있는 경우
  const isTemplateFormat = rows.some(r => {
    const v = r[1];
    return typeof v === 'string' && v.startsWith('s_');
  });

  if (isTemplateFormat) {
    // 우리 템플릿 형식 파싱
    for (const row of rows) {
      const subId = String(row[1] ?? '');
      const meta = SUB_FACTOR_META.find(m => m.id === subId);
      if (!meta) continue;

      const weight = isNumeric(row[4]) ? row[4] : 0;
      const rating = isNumeric(row[5]) ? Math.min(3, Math.max(1, Math.round(row[5]))) : 1;
      const score = isNumeric(row[6]) ? row[6] : (weight * rating / 100);
      const rationale = String(row[7] ?? '');

      items.push({ pillar: meta.pillar, label: meta.label, weight, rating, score, rationale });
      pillarScores[meta.pillar] = (pillarScores[meta.pillar] ?? 0) + score;
      if (rationale) pillarRationale[meta.pillar].push(rationale);
    }
  } else {
    // 커스텀 엑셀 파싱 — 가중치(%)와 평점(숫자) 열을 휴리스틱으로 찾음
    let currentPillar = 'S';
    const pillarKeywords: Record<string, string[]> = {
      S: ['사전영업', '고객관계', 'key man', '접촉', 'rfp', 'poc'],
      V: ['value', '가치', '니즈', 'pain', '요구사항', '제안'],
      D: ['차별화', '경쟁', '기술', '파트너', '레퍼런스'],
      P: ['가격', '예산', '비용', 'roi', 'tco', '원가'],
      E: ['delivery', '실적', '리스크', '팀', 'pm', '수행'],
    };

    for (const row of rows) {
      const text = row.map(v => String(v ?? '')).join(' ').toLowerCase();

      // Pillar 감지
      for (const [pid, kws] of Object.entries(pillarKeywords)) {
        if (kws.some(kw => text.includes(kw))) {
          currentPillar = pid;
          break;
        }
      }

      // 가중치(숫자 1~100)와 평점(정수 1~5) 찾기
      const nums = row.filter(v => isNumeric(v) && (v as number) > 0) as number[];
      if (nums.length < 2) continue;

      // 가중치: 보통 5~30% 범위, 평점: 1~5
      const weightCand = nums.find(n => n >= 1 && n <= 50);
      const ratingCand = nums.find(n => Number.isInteger(n) && n >= 1 && n <= 5 && n !== weightCand);
      if (!weightCand || !ratingCand) continue;

      // 텍스트 열에서 항목명 추출
      const labelCell = row.find(v => typeof v === 'string' && v.length > 2 && v.length < 60);
      const label = String(labelCell ?? '항목');

      // 현수준 근거 (긴 텍스트 열)
      const rationaleCell = row.find(v => typeof v === 'string' && v.length > 20);
      const rationale = String(rationaleCell ?? '');

      const score = weightCand * ratingCand / 100;
      items.push({ pillar: currentPillar, label, weight: weightCand, rating: ratingCand, score, rationale });
      pillarScores[currentPillar] = (pillarScores[currentPillar] ?? 0) + score;
      if (rationale) pillarRationale[currentPillar].push(rationale);
    }
  }

  // Pillar 점수를 0~100 스케일로 정규화 (만점 = 가중치 합계 × 3 / 100)
  for (const pid of PILLAR_IDS) {
    const pillarItems = items.filter(i => i.pillar === pid);
    if (pillarItems.length === 0) continue;
    const maxScore = pillarItems.reduce((s, i) => s + i.weight * 3 / 100, 0);
    if (maxScore > 0 && pillarScores[pid] > 1) {
      // 이미 0~100 스케일 (템플릿)이면 그대로, 아니면 정규화
      pillarScores[pid] = Math.min(100, Math.round(pillarScores[pid] * 10) / 10);
    } else if (maxScore > 0) {
      pillarScores[pid] = Math.min(100, Math.round(pillarScores[pid] / maxScore * 100 * 10) / 10);
    }
  }

  const totalScore = Math.round(
    PILLAR_IDS.reduce((s, p) => s + (pillarScores[p] ?? 0), 0) / 5 * 10
  ) / 10;

  // Pillar별 현수준 합산
  const pillarRationaleStr: Record<string, string> = {};
  for (const pid of PILLAR_IDS) {
    pillarRationaleStr[pid] = pillarRationale[pid].slice(0, 3).join(' / ');
  }

  return {
    items,
    pillarScores,
    pillarRationale: pillarRationaleStr,
    totalScore,
    source: isTemplateFormat ? 'template' : 'custom',
  };
}

// Pillar 점수(0-100) → sub_scores(1-10) 역산
function pillarScoreToSubScores(pillarScores: Record<string, number>): Record<string, number> {
  const subScores: Record<string, number> = {};
  for (const meta of SUB_FACTOR_META) {
    const ps = (pillarScores[meta.pillar] ?? 50) / 100;
    // ps = 0~1 → sub score 1~10 (선형 변환)
    subScores[meta.id] = Math.max(1, Math.min(10, Math.round(ps * 9 + 1)));
  }
  return subScores;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: false, cellDates: true });

    // "수주가능성 분석" 시트 우선, 없으면 첫 번째 시트
    const sheetName = wb.SheetNames.find(n => n.includes('수주') || n.includes('분석') || n.includes('가능')) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    if (!ws) return NextResponse.json({ error: '시트를 찾을 수 없습니다' }, { status: 400 });

    const parsed = parseExcelSheet(ws);
    const subScores = pillarScoreToSubScores(parsed.pillarScores);

    // Claude로 현수준 분석 요약 (선택적)
    let aiSummary: Record<string, string> = {};
    if (process.env.ANTHROPIC_API_KEY && parsed.items.length > 0) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const itemSummary = PILLAR_IDS.map(pid => {
          const pItems = parsed.items.filter(i => i.pillar === pid);
          const avg = pItems.length > 0 ? pItems.reduce((s, i) => s + i.rating, 0) / pItems.length : 0;
          const rationale = parsed.pillarRationale[pid] ?? '';
          return `${PILLAR_LABELS[pid]}(${pid}): 평균평점 ${avg.toFixed(1)}/3, 점수 ${parsed.pillarScores[pid]}점\n  근거: ${rationale || '없음'}`;
        }).join('\n');

        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `아래는 수주 가능성 평가 엑셀 분석 결과입니다. 각 Pillar의 현수준을 1~2문장으로 요약해주세요. 반드시 JSON 형식으로만 응답:\n\n${itemSummary}\n\n{"S":"...","V":"...","D":"...","P":"...","E":"..."}`,
          }],
        });
        const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) aiSummary = JSON.parse(m[0]);
      } catch { /* AI 실패 시 엑셀 원문 사용 */ }
    }

    // 현수준: AI 요약 > 엑셀 원문 > 빈 문자열
    const finalRationale: Record<string, string> = {};
    for (const pid of PILLAR_IDS) {
      finalRationale[pid] = aiSummary[pid] || parsed.pillarRationale[pid] || '';
    }

    return NextResponse.json({
      sheetName,
      source: parsed.source,
      pillarScores: parsed.pillarScores,
      pillarRationale: finalRationale,
      subScores,
      totalScore: parsed.totalScore,
      itemCount: parsed.items.length,
      items: parsed.items.slice(0, 40), // 상위 40개만
    });
  } catch (err) {
    console.error('[excel-import]', err);
    return NextResponse.json({ error: '파일 파싱 오류' }, { status: 500 });
  }
}
