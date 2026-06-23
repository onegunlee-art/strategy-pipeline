import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

export const maxDuration = 60;

const BG = '0f172a';
const BRAND = '1e40af';     // 진한 파란색 (레퍼런스 슬라이드 스타일)
const BRAND_LIGHT = '3b82f6';
const TEXT = '1e293b';       // 다크 텍스트 (라이트 배경용)
const TEXT_LIGHT = 'f1f5f9';
const SURFACE = 'f8fafc';
const BORDER = 'cbd5e1';
const GREEN = '16a34a';
const RED = 'dc2626';
const GRAY = '64748b';

const PILLAR_KO: Record<string, string> = {
  S: '사전영업 수준', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery 경쟁력',
};

interface LossReportBody {
  dealName: string;
  dealSize: string;
  duration: string;
  evalCriteria: string;
  winner: string;
  winnerNotes: string;
  ourScore: string;
  competitorScore?: string;
  ourTechScore: string;
  ourPriceScore: string;
  pillarBefore: Record<string, number>;
  pillarAfter: Record<string, number>;
  totalBefore: number;
  totalAfter: number;
  actions: Record<string, string>;
  lossReason: string;
  lessons: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (cells: string[]): any[] => cells.map(text => ({ text }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toStyledRow = (cells: { text: string; bold?: boolean; color?: string; fill?: string }[]): any[] =>
  cells.map(c => ({ text: c.text, options: { bold: c.bold, color: c.color, fill: c.fill } }));

export async function POST(req: NextRequest) {
  try {
    const body: LossReportBody = await req.json();
    const PILLARS = ['S', 'V', 'D', 'P', 'E'] as const;

    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE';

    // ── Slide 1: Cover ─────────────────────────────────────────────────────────
    const s0 = pres.addSlide();
    s0.background = { color: BG };
    s0.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: BRAND } });
    s0.addText('04 Must-Win 사업 Win Ratio 관리 현황', {
      x: 0.4, y: 0.15, w: 12, h: 0.4, fontSize: 14, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s0.addText(`> ${body.dealName}`, {
      x: 0.4, y: 0.55, w: 12, h: 0.35, fontSize: 12, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s0.addShape(pres.ShapeType.rect, { x: 0, y: 1.0, w: 13.33, h: 6.5, fill: { color: SURFACE } });
    s0.addText('실주 보고', {
      x: 4.5, y: 2.5, w: 4.5, h: 0.8, fontSize: 32, bold: true, color: RED, align: 'center', fontFace: 'Arial',
    });
    s0.addText(body.dealName, {
      x: 1, y: 3.5, w: 11.33, h: 0.6, fontSize: 18, bold: true, color: TEXT, align: 'center', fontFace: 'Arial',
    });
    s0.addText(new Date().toLocaleDateString('ko-KR'), {
      x: 1, y: 4.3, w: 11.33, h: 0.4, fontSize: 12, color: GRAY, align: 'center', fontFace: 'Arial',
    });

    // ── Slide 2: 사업 개요 + 경쟁사 현황 + 평가 결과 + Win Ratio 제고 활동 ──
    // (레퍼런스 이미지 1번 슬라이드 재현)
    const s1 = pres.addSlide();
    s1.background = { color: SURFACE };
    // 상단 헤더
    s1.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: BRAND } });
    s1.addText('04 Must-Win 사업 Win Ratio 관리 현황', {
      x: 0.3, y: 0.1, w: 10, h: 0.35, fontSize: 13, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s1.addText(`> ${body.dealName}`, {
      x: 0.3, y: 0.5, w: 12, h: 0.3, fontSize: 11, color: TEXT_LIGHT, fontFace: 'Arial',
    });

    // 왼쪽 컬럼: 사업 개요 + 경쟁사 + 평가 결과
    const leftW = 5.8;
    s1.addShape(pres.ShapeType.rect, { x: 0.2, y: 1.0, w: leftW, h: 0.4, fill: { color: BRAND } });
    s1.addText('사업 개요 및 평가 결과', {
      x: 0.3, y: 1.05, w: leftW - 0.2, h: 0.3, fontSize: 12, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });

    // 사업 개요 박스
    s1.addShape(pres.ShapeType.rect, { x: 0.2, y: 1.45, w: leftW, h: 1.3, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    s1.addText('□ 사업 개요', { x: 0.3, y: 1.5, w: 5, h: 0.3, fontSize: 10, bold: true, color: TEXT, fontFace: 'Arial' });
    s1.addText(
      `• 매출금액 : ${body.dealSize}\n• 사업기간 : ${body.duration}\n• 평가방법 : ${body.evalCriteria}`,
      { x: 0.4, y: 1.8, w: leftW - 0.3, h: 0.9, fontSize: 10, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.3 }
    );

    // 경쟁사 박스
    const compLines = body.winnerNotes.split('\n').map(l => `• ${l}`).join('\n');
    const compH = Math.min(2.0, 0.3 + body.winnerNotes.split('\n').length * 0.28);
    s1.addShape(pres.ShapeType.rect, { x: 0.2, y: 2.8, w: leftW, h: compH + 0.3, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    s1.addText(`□ 경쟁사 현황 (${body.winner})`, { x: 0.3, y: 2.85, w: 5, h: 0.28, fontSize: 10, bold: true, color: TEXT, fontFace: 'Arial' });
    s1.addText(compLines, { x: 0.4, y: 3.15, w: leftW - 0.3, h: compH, fontSize: 9.5, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.3 });

    const evalY = 2.8 + compH + 0.5;
    s1.addShape(pres.ShapeType.rect, { x: 0.2, y: evalY, w: leftW, h: 0.28, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 0 } });
    s1.addText('□ 평가 결과', { x: 0.3, y: evalY + 0.02, w: 5, h: 0.25, fontSize: 10, bold: true, color: TEXT, fontFace: 'Arial' });
    s1.addText(`• 당사가 총점 ${(Number(body.ourScore) - (Number(body.competitorScore) || 94.89)).toFixed(2)}점 우위로 우선협상대상자 선정`, {
      x: 0.4, y: evalY + 0.28, w: leftW - 0.3, h: 0.28, fontSize: 9.5, color: TEXT, fontFace: 'Arial',
    });

    // 평가 점수 테이블
    const tableY = evalY + 0.65;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalRows: any[][] = [
      toStyledRow([
        { text: '구분', bold: true, fill: BRAND, color: 'ffffff' },
        { text: '당사(A)', bold: true, fill: BRAND, color: 'ffffff' },
        { text: `경쟁사(${body.winner})`, bold: true, fill: BRAND, color: 'ffffff' },
        { text: '차이(A-B)', bold: true, fill: BRAND, color: 'ffffff' },
      ]),
      toRow(['기술', body.ourTechScore, '85.7143', '0.5714']),
      toRow(['가격', body.ourPriceScore, '9.18', '0.82']),
      toStyledRow([
        { text: '계', bold: true },
        { text: body.ourScore, bold: true, color: BRAND_LIGHT },
        { text: body.competitorScore || '94.8943', bold: true },
        { text: `+${(Number(body.ourScore) - (Number(body.competitorScore) || 94.89)).toFixed(4)}`, bold: true, color: GREEN },
      ]),
    ];
    s1.addTable(evalRows, {
      x: 0.3, y: tableY, w: leftW - 0.2,
      colW: [1.0, 1.5, 1.8, 1.2],
      border: { type: 'solid', color: BORDER, pt: 1 },
      fontSize: 10, fontFace: 'Arial', rowH: 0.3,
    });

    // 오른쪽 컬럼: Win Ratio 제고 활동 결과
    const rightX = 6.4;
    const rightW = 6.7;
    s1.addShape(pres.ShapeType.rect, { x: rightX, y: 1.0, w: rightW, h: 0.4, fill: { color: BRAND } });
    s1.addText('Win Ratio 제고 활동 결과', {
      x: rightX + 0.1, y: 1.05, w: rightW - 0.2, h: 0.3, fontSize: 12, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });

    s1.addShape(pres.ShapeType.rect, { x: rightX, y: 1.45, w: rightW, h: 0.8, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    s1.addText('□ 수주가능성 분석 Framework을 적용하여 Win Ratio 제고 활동 수행', {
      x: rightX + 0.1, y: 1.5, w: rightW - 0.2, h: 0.25, fontSize: 10, bold: true, color: TEXT, fontFace: 'Arial',
    });
    s1.addText(
      '• 수주전략 보고 단계에 적용하여 Win Ratio 개선활동 수행 → 이후 결과 발표 단계에서의 점수와 비교 분석하여 개선도 측정',
      { x: rightX + 0.2, y: 1.78, w: rightW - 0.3, h: 0.4, fontSize: 9.5, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.3 }
    );

    // Win Ratio 점수 테이블
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winRows: any[][] = [
      toStyledRow([
        { text: '영역', bold: true, fill: BRAND, color: 'ffffff' },
        { text: '수주전략 보고', bold: true, fill: BRAND, color: 'ffffff' },
        { text: '결과 발표', bold: true, fill: '1d4ed8', color: 'ffffff' },
        { text: '증감', bold: true, fill: BRAND, color: 'ffffff' },
      ]),
      ...PILLARS.map(pid => {
        const before = body.pillarBefore[pid] ?? 0;
        const after = body.pillarAfter[pid] ?? 0;
        const delta = after - before;
        return toStyledRow([
          { text: PILLAR_KO[pid] },
          { text: String(before) },
          { text: String(after), bold: true, color: BRAND_LIGHT },
          { text: `+ ${delta.toFixed(1)}`, color: GREEN },
        ]);
      }),
      toStyledRow([
        { text: '총점', bold: true },
        { text: String(body.totalBefore), bold: true },
        { text: String(body.totalAfter), bold: true, color: BRAND_LIGHT },
        { text: `+ ${(body.totalAfter - body.totalBefore).toFixed(1)}`, bold: true, color: GREEN },
      ]),
    ];
    s1.addTable(winRows, {
      x: rightX + 0.1, y: 2.35, w: rightW - 0.2,
      colW: [2.2, 1.6, 1.6, 1.1],
      border: { type: 'solid', color: BORDER, pt: 1 },
      fontSize: 10, fontFace: 'Arial', rowH: 0.38,
    });

    // 슬라이드 번호
    s1.addText('04', { x: 12.8, y: 7.1, w: 0.4, h: 0.25, fontSize: 9, color: GRAY, fontFace: 'Arial', align: 'right' });

    // ── Slide 3: 영역별 개선방안 Action Item (레퍼런스 이미지 2번 슬라이드) ──
    const s2 = pres.addSlide();
    s2.background = { color: SURFACE };
    s2.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: BRAND } });
    s2.addText('04 Must-Win 사업 Win Ratio 관리 현황', {
      x: 0.3, y: 0.1, w: 10, h: 0.35, fontSize: 13, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s2.addText(`> ${body.dealName}`, {
      x: 0.3, y: 0.5, w: 12, h: 0.3, fontSize: 11, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s2.addText('각 영역별 개선방안/Action Item 수행을 통해 기존 대비 수주가능성 제고', {
      x: 0.3, y: 0.95, w: 12, h: 0.3, fontSize: 11, color: TEXT, bold: true, fontFace: 'Arial',
    });

    // 5개 Pillar 박스 (2열 배치: S/V 상단, D/P/E 하단 조정)
    const pillarColors = ['1d4ed8', '2563eb', '3b82f6', '1e40af', '1d4ed8'];
    const pillarLayout = [
      { x: 0.2, y: 1.35, w: 6.0, h: 2.5 },   // S
      { x: 7.1, y: 1.35, w: 6.0, h: 2.5 },   // V
      { x: 0.2, y: 4.05, w: 6.0, h: 2.5 },   // D (아래 왼쪽)
      { x: 7.1, y: 4.05, w: 6.0, h: 2.5 },   // P (아래 오른쪽)
      { x: 0.2, y: 4.05, w: 13.0, h: 0 },    // E (별도 처리)
    ];

    const pillarList = ['S', 'V', 'D', 'P'] as const;
    pillarList.forEach((pid, i) => {
      const { x, y, w, h } = pillarLayout[i];
      const before = body.pillarBefore[pid] ?? 0;
      const after = body.pillarAfter[pid] ?? 0;
      const delta = after - before;
      const dept = i < 2 ? '영업/사업개발' : '제안/이행';

      s2.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
      // 헤더
      s2.addShape(pres.ShapeType.rect, { x, y, w, h: 0.38, fill: { color: pillarColors[i] } });
      s2.addText(`${i + 1}) ${PILLAR_KO[pid]} (${before} → ${after})`, {
        x: x + 0.1, y: y + 0.05, w: w - 1.5, h: 0.28, fontSize: 10, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
      });
      s2.addText(dept, {
        x: x + w - 1.5, y: y + 0.05, w: 1.4, h: 0.28, fontSize: 9, color: TEXT_LIGHT, fontFace: 'Arial',
        align: 'right', bold: true,
      });
      // delta 뱃지
      s2.addShape(pres.ShapeType.rect, { x: x + w - 0.9, y: y + 0.42, w: 0.8, h: 0.22, fill: { color: GREEN } });
      s2.addText(`+${delta.toFixed(1)}`, { x: x + w - 0.9, y: y + 0.42, w: 0.8, h: 0.22, fontSize: 9, bold: true, color: 'ffffff', align: 'center', fontFace: 'Arial' });

      // Action 내용
      const lines = body.actions[pid]?.split('\n').map(l => `• ${l.replace(/^•\s*/, '')}`).join('\n') || '';
      s2.addText(lines, {
        x: x + 0.1, y: y + 0.4, w: w - 1.0, h: h - 0.5, fontSize: 9.5, color: TEXT, fontFace: 'Arial',
        lineSpacingMultiple: 1.35, valign: 'top',
      });
    });

    // Delivery (E) — 하단 전체 폭
    const eY = 4.05;
    const before_E = body.pillarBefore['E'] ?? 0;
    const after_E = body.pillarAfter['E'] ?? 0;
    const delta_E = after_E - before_E;
    s2.addShape(pres.ShapeType.rect, { x: 0.2, y: eY, w: 13.0, h: 2.5, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    s2.addShape(pres.ShapeType.rect, { x: 0.2, y: eY, w: 13.0, h: 0.38, fill: { color: pillarColors[4] } });
    s2.addText(`5) ${PILLAR_KO['E']} (${before_E} → ${after_E})`, {
      x: 0.3, y: eY + 0.05, w: 10, h: 0.28, fontSize: 10, bold: true, color: TEXT_LIGHT, fontFace: 'Arial',
    });
    s2.addText('제안/이행', { x: 11.8, y: eY + 0.05, w: 1.2, h: 0.28, fontSize: 9, color: TEXT_LIGHT, align: 'right', bold: true, fontFace: 'Arial' });
    s2.addShape(pres.ShapeType.rect, { x: 12.1, y: eY + 0.42, w: 0.8, h: 0.22, fill: { color: GREEN } });
    s2.addText(`+${delta_E.toFixed(1)}`, { x: 12.1, y: eY + 0.42, w: 0.8, h: 0.22, fontSize: 9, bold: true, color: 'ffffff', align: 'center', fontFace: 'Arial' });
    s2.addText(
      body.actions['E']?.split('\n').map(l => `• ${l.replace(/^•\s*/, '')}`).join('\n') || '',
      { x: 0.3, y: eY + 0.4, w: 11.7, h: 2.0, fontSize: 9.5, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.35, valign: 'top' }
    );

    s2.addText('05', { x: 12.8, y: 7.1, w: 0.4, h: 0.25, fontSize: 9, color: GRAY, fontFace: 'Arial', align: 'right' });

    // ── Slide 4: 실주 원인 분석 ─────────────────────────────────────────────────
    const s3 = pres.addSlide();
    s3.background = { color: SURFACE };
    s3.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: '7f1d1d' } });
    s3.addText('실주 원인 분석 및 교훈', { x: 0.3, y: 0.1, w: 10, h: 0.35, fontSize: 13, bold: true, color: TEXT_LIGHT, fontFace: 'Arial' });
    s3.addText(`> ${body.dealName}`, { x: 0.3, y: 0.5, w: 12, h: 0.3, fontSize: 11, color: TEXT_LIGHT, fontFace: 'Arial' });

    s3.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.0, w: 12.7, h: 0.38, fill: { color: '7f1d1d' } });
    s3.addText('실주 원인', { x: 0.4, y: 1.05, w: 6, h: 0.28, fontSize: 11, bold: true, color: TEXT_LIGHT, fontFace: 'Arial' });
    s3.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.38, w: 12.7, h: 1.8, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    s3.addText(body.lossReason, { x: 0.5, y: 1.45, w: 12.3, h: 1.6, fontSize: 11, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.5, valign: 'top' });

    s3.addShape(pres.ShapeType.rect, { x: 0.3, y: 3.3, w: 12.7, h: 0.38, fill: { color: BRAND } });
    s3.addText('교훈 및 시사점', { x: 0.4, y: 3.35, w: 6, h: 0.28, fontSize: 11, bold: true, color: TEXT_LIGHT, fontFace: 'Arial' });
    s3.addShape(pres.ShapeType.rect, { x: 0.3, y: 3.68, w: 12.7, h: 2.8, fill: { color: 'ffffff' }, line: { color: BORDER, pt: 1 } });
    body.lessons.filter(Boolean).forEach((lesson, i) => {
      s3.addShape(pres.ShapeType.ellipse, { x: 0.5, y: 3.78 + i * 0.8, w: 0.3, h: 0.3, fill: { color: BRAND } });
      s3.addText(String(i + 1), { x: 0.5, y: 3.78 + i * 0.8, w: 0.3, h: 0.3, fontSize: 9, bold: true, color: 'ffffff', align: 'center', fontFace: 'Arial' });
      s3.addText(lesson, { x: 0.9, y: 3.82 + i * 0.8, w: 12.0, h: 0.65, fontSize: 11, color: TEXT, fontFace: 'Arial', lineSpacingMultiple: 1.4 });
    });

    s3.addText('06', { x: 12.8, y: 7.1, w: 0.4, h: 0.25, fontSize: 9, color: GRAY, fontFace: 'Arial', align: 'right' });

    const buf = await pres.write({ outputType: 'nodebuffer' });
    const filename = `${body.dealName}_실주보고.pptx`;

    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    console.error('[ppt-loss-report]', err);
    return NextResponse.json({ error: 'PPT 생성 오류' }, { status: 500 });
  }
}
