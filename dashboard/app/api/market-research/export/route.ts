import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

const BG = '0f172a';
const BRAND = 'E6001C';
const TEXT = 'f1f5f9';
const TEXT_DIM = '94a3b8';
const SURFACE = '1e293b';
const SURFACE2 = '162032';
const GREEN = '22c55e';
const YELLOW = 'f59e0b';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface Analysis3C {
  company: { strengths: string[]; positioning: string };
  customer: { needs: string[]; eval_criteria: string[] };
  competitors: { name: string; strategy: string; strengths: string[]; weaknesses: string[] }[];
}

interface SWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface Opportunity {
  key_opportunities: string[];
  differentiation: string[];
  strategy: string;
}

interface ExportBody {
  type: 'ppt' | 'excel';
  projectName: string;
  customerName: string;
  businessDesc: string;
  competitors: string[];
  newsMap: Record<string, NaverNewsItem[]>;
  analysis_3c: Analysis3C;
  swot: SWOT;
  opportunity: Opportunity;
}

function buildPPT(body: ExportBody): PptxGenJS {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  // ── Slide 1: Cover ────────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: BRAND } });
    s.addShape(pres.ShapeType.rect, { x: 0.25, y: 3.2, w: 13.08, h: 0.04, fill: { color: '334155' } });

    s.addText('수주전략', { x: 0.5, y: 1.5, w: 12, h: 0.6, fontSize: 16, color: TEXT_DIM, fontFace: 'Arial', bold: false });
    s.addText('AI Market Research', { x: 0.5, y: 2.1, w: 12, h: 1.1, fontSize: 48, color: TEXT, fontFace: 'Arial', bold: true });
    s.addText(body.projectName || '프로젝트명 미입력', { x: 0.5, y: 3.5, w: 12, h: 0.6, fontSize: 22, color: BRAND, fontFace: 'Arial', bold: true });
    s.addText(`고객사: ${body.customerName}   |   ${today}`, { x: 0.5, y: 4.3, w: 12, h: 0.5, fontSize: 14, color: TEXT_DIM, fontFace: 'Arial' });
    s.addText(`경쟁사: ${body.competitors.join(' · ')}`, { x: 0.5, y: 5.0, w: 12, h: 0.4, fontSize: 13, color: TEXT_DIM, fontFace: 'Arial' });
  }

  // ── Slide 2: 경쟁사 뉴스 요약 ─────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: SURFACE } });
    s.addText('경쟁사 뉴스 요약', { x: 0.4, y: 0.18, w: 12, h: 0.5, fontSize: 22, color: TEXT, fontFace: 'Arial', bold: true });
    s.addText('Naver News 최신 수집', { x: 0.4, y: 0.62, w: 12, h: 0.3, fontSize: 12, color: TEXT_DIM, fontFace: 'Arial' });

    const rows: any[][] = [[
      { text: '경쟁사', options: { bold: true, color: TEXT, fill: { color: BRAND } } },
      { text: '날짜', options: { bold: true, color: TEXT, fill: { color: BRAND } } },
      { text: '제목', options: { bold: true, color: TEXT, fill: { color: BRAND } } },
    ]];

    for (const comp of body.competitors) {
      const items = (body.newsMap[comp] ?? []).slice(0, 4);
      if (items.length === 0) {
        rows.push([
          { text: comp, options: { color: TEXT_DIM } },
          { text: '-', options: { color: TEXT_DIM } },
          { text: '(뉴스 없음)', options: { color: TEXT_DIM } },
        ]);
      } else {
        items.forEach((item, idx) => {
          const dateStr = item.pubDate ? item.pubDate.slice(0, 16) : '-';
          rows.push([
            { text: idx === 0 ? comp : '', options: { color: TEXT } },
            { text: dateStr, options: { color: TEXT_DIM, fontSize: 10 } },
            { text: item.title.slice(0, 80), options: { color: TEXT } },
          ]);
        });
      }
    }

    s.addTable(rows, {
      x: 0.4, y: 1.15, w: 12.5, colW: [2.0, 2.0, 8.5],
      border: { type: 'solid', color: '334155', pt: 0.5 },
      fill: { color: SURFACE2 },
      color: TEXT,
      fontSize: 11,
      fontFace: 'Arial',
      rowH: 0.36,
    });
  }

  // ── Slide 3: 3C — Customer & Competitor ──────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: SURFACE } });
    s.addText('3C 분석 — Customer & Competitor', { x: 0.4, y: 0.25, w: 12, h: 0.5, fontSize: 22, color: TEXT, fontFace: 'Arial', bold: true });

    // Customer box
    s.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.1, w: 4.0, h: 5.8, fill: { color: SURFACE }, line: { color: '334155', width: 1 } });
    s.addText('Customer', { x: 0.3, y: 1.1, w: 4.0, h: 0.5, fontSize: 14, color: BRAND, fontFace: 'Arial', bold: true, align: 'center' });
    s.addText(`고객사: ${body.customerName}`, { x: 0.4, y: 1.7, w: 3.8, h: 0.4, fontSize: 12, color: TEXT_DIM, fontFace: 'Arial' });

    const { customer } = body.analysis_3c;
    s.addText('핵심 니즈', { x: 0.4, y: 2.2, w: 3.8, h: 0.35, fontSize: 12, color: GREEN, fontFace: 'Arial', bold: true });
    s.addText(customer.needs.map(n => `• ${n}`).join('\n'), { x: 0.4, y: 2.55, w: 3.8, h: 2.0, fontSize: 11, color: TEXT, fontFace: 'Arial', wrap: true });
    s.addText('평가기준', { x: 0.4, y: 4.6, w: 3.8, h: 0.35, fontSize: 12, color: YELLOW, fontFace: 'Arial', bold: true });
    s.addText(customer.eval_criteria.map(e => `• ${e}`).join('\n'), { x: 0.4, y: 4.95, w: 3.8, h: 1.7, fontSize: 11, color: TEXT, fontFace: 'Arial', wrap: true });

    // Competitor boxes
    const { competitors: comps } = body.analysis_3c;
    comps.forEach((comp, i) => {
      const xOff = 4.7 + i * (8.3 / comps.length);
      const bw = 8.0 / comps.length - 0.2;
      s.addShape(pres.ShapeType.rect, { x: xOff, y: 1.1, w: bw, h: 5.8, fill: { color: SURFACE }, line: { color: '334155', width: 1 } });
      s.addText(comp.name, { x: xOff, y: 1.1, w: bw, h: 0.5, fontSize: 13, color: TEXT, fontFace: 'Arial', bold: true, align: 'center' });
      s.addText('전략', { x: xOff + 0.1, y: 1.7, w: bw - 0.2, h: 0.3, fontSize: 11, color: TEXT_DIM, fontFace: 'Arial', bold: true });
      s.addText(comp.strategy, { x: xOff + 0.1, y: 2.0, w: bw - 0.2, h: 1.2, fontSize: 10, color: TEXT, fontFace: 'Arial', wrap: true });
      s.addText('강점', { x: xOff + 0.1, y: 3.3, w: bw - 0.2, h: 0.3, fontSize: 11, color: GREEN, fontFace: 'Arial', bold: true });
      s.addText(comp.strengths.map(x => `• ${x}`).join('\n'), { x: xOff + 0.1, y: 3.6, w: bw - 0.2, h: 1.5, fontSize: 10, color: TEXT, fontFace: 'Arial', wrap: true });
      s.addText('약점', { x: xOff + 0.1, y: 5.1, w: bw - 0.2, h: 0.3, fontSize: 11, color: BRAND, fontFace: 'Arial', bold: true });
      s.addText(comp.weaknesses.map(x => `• ${x}`).join('\n'), { x: xOff + 0.1, y: 5.4, w: bw - 0.2, h: 1.3, fontSize: 10, color: TEXT, fontFace: 'Arial', wrap: true });
    });
  }

  // ── Slide 4: 3C — Company (KT) ───────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: SURFACE } });
    s.addText('3C 분석 — Company (KT)', { x: 0.4, y: 0.25, w: 12, h: 0.5, fontSize: 22, color: TEXT, fontFace: 'Arial', bold: true });

    const { company } = body.analysis_3c;
    s.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.1, w: 12.7, h: 1.6, fill: { color: SURFACE }, line: { color: BRAND, width: 2 } });
    s.addText('포지셔닝', { x: 0.5, y: 1.2, w: 3.0, h: 0.4, fontSize: 13, color: BRAND, fontFace: 'Arial', bold: true });
    s.addText(company.positioning, { x: 0.5, y: 1.6, w: 12.3, h: 0.9, fontSize: 14, color: TEXT, fontFace: 'Arial', wrap: true });

    s.addText('KT 핵심 강점', { x: 0.4, y: 3.0, w: 5.0, h: 0.5, fontSize: 16, color: GREEN, fontFace: 'Arial', bold: true });
    company.strengths.forEach((st, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      s.addShape(pres.ShapeType.rect, {
        x: 0.4 + col * 6.2, y: 3.6 + row * 1.5, w: 5.8, h: 1.3,
        fill: { color: SURFACE2 }, line: { color: GREEN, width: 1 },
      });
      s.addText(`${i + 1}. ${st}`, {
        x: 0.5 + col * 6.2, y: 3.7 + row * 1.5, w: 5.6, h: 1.1,
        fontSize: 13, color: TEXT, fontFace: 'Arial', wrap: true,
      });
    });
  }

  // ── Slide 5: SWOT ─────────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: SURFACE } });
    s.addText('SWOT 분석', { x: 0.4, y: 0.25, w: 12, h: 0.5, fontSize: 22, color: TEXT, fontFace: 'Arial', bold: true });

    const quadrants = [
      { label: 'Strengths (강점)', items: body.swot.strengths, x: 0.25, y: 1.05, color: GREEN },
      { label: 'Weaknesses (약점)', items: body.swot.weaknesses, x: 6.9, y: 1.05, color: BRAND },
      { label: 'Opportunities (기회)', items: body.swot.opportunities, x: 0.25, y: 4.35, color: '3b82f6' },
      { label: 'Threats (위협)', items: body.swot.threats, x: 6.9, y: 4.35, color: YELLOW },
    ];

    quadrants.forEach(q => {
      s.addShape(pres.ShapeType.rect, { x: q.x, y: q.y, w: 6.4, h: 3.0, fill: { color: SURFACE }, line: { color: q.color, width: 2 } });
      s.addText(q.label, { x: q.x + 0.15, y: q.y + 0.1, w: 6.1, h: 0.45, fontSize: 14, color: q.color, fontFace: 'Arial', bold: true });
      s.addText(q.items.map(i => `• ${i}`).join('\n'), {
        x: q.x + 0.15, y: q.y + 0.55, w: 6.1, h: 2.3,
        fontSize: 12, color: TEXT, fontFace: 'Arial', wrap: true,
      });
    });

    s.addShape(pres.ShapeType.rect, { x: 6.6, y: 1.05, w: 0.3, h: 6.3, fill: { color: '1e2a3a' } });
    s.addShape(pres.ShapeType.rect, { x: 0.25, y: 4.1, w: 13.0, h: 0.25, fill: { color: '1e2a3a' } });
    s.addText('내부 요인', { x: 0.25, y: 4.15, w: 6.3, h: 0.2, fontSize: 9, color: TEXT_DIM, fontFace: 'Arial', align: 'center' });
    s.addText('외부 요인', { x: 6.9, y: 4.15, w: 6.3, h: 0.2, fontSize: 9, color: TEXT_DIM, fontFace: 'Arial', align: 'center' });
  }

  // ── Slide 6: Opportunity & 전략 방향 ─────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: SURFACE } });
    s.addText('기회 분석 & 수주전략 방향', { x: 0.4, y: 0.25, w: 12, h: 0.5, fontSize: 22, color: TEXT, fontFace: 'Arial', bold: true });

    const { opportunity } = body;

    // Key Opportunities
    s.addShape(pres.ShapeType.rect, { x: 0.3, y: 1.1, w: 6.0, h: 5.8, fill: { color: SURFACE }, line: { color: '334155', width: 1 } });
    s.addText('핵심 기회 요소', { x: 0.4, y: 1.2, w: 5.8, h: 0.45, fontSize: 14, color: '3b82f6', fontFace: 'Arial', bold: true });
    s.addText(opportunity.key_opportunities.map(o => `• ${o}`).join('\n'), {
      x: 0.4, y: 1.7, w: 5.8, h: 2.3, fontSize: 12, color: TEXT, fontFace: 'Arial', wrap: true,
    });
    s.addText('KT 차별화 포인트', { x: 0.4, y: 4.1, w: 5.8, h: 0.45, fontSize: 14, color: BRAND, fontFace: 'Arial', bold: true });
    s.addText(opportunity.differentiation.map(d => `• ${d}`).join('\n'), {
      x: 0.4, y: 4.55, w: 5.8, h: 2.1, fontSize: 12, color: TEXT, fontFace: 'Arial', wrap: true,
    });

    // Strategy
    s.addShape(pres.ShapeType.rect, { x: 6.6, y: 1.1, w: 6.5, h: 5.8, fill: { color: SURFACE2 }, line: { color: BRAND, width: 2 } });
    s.addText('종합 수주전략', { x: 6.7, y: 1.2, w: 6.3, h: 0.45, fontSize: 14, color: BRAND, fontFace: 'Arial', bold: true });
    s.addText(opportunity.strategy, {
      x: 6.7, y: 1.75, w: 6.3, h: 4.5, fontSize: 14, color: TEXT, fontFace: 'Arial', wrap: true, lineSpacingMultiple: 1.5,
    });
  }

  return pres;
}

function buildExcel(body: ExportBody): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 경쟁사 뉴스
  const newsData: (string | number)[][] = [['경쟁사', '날짜', '제목', '출처 링크']];
  for (const comp of body.competitors) {
    const items = body.newsMap[comp] ?? [];
    if (items.length === 0) {
      newsData.push([comp, '-', '(뉴스 없음)', '']);
    } else {
      items.forEach(item => {
        newsData.push([comp, item.pubDate ?? '', item.title, item.originallink || item.link || '']);
      });
    }
  }
  const ws1 = XLSX.utils.aoa_to_sheet(newsData);
  ws1['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 60 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws1, '경쟁사 뉴스');

  // Sheet 2: 3C 분석
  const { analysis_3c } = body;
  const threeC: (string)[][] = [
    ['분류', '항목', '내용'],
    ['Company (KT)', '포지셔닝', analysis_3c.company.positioning],
    ...analysis_3c.company.strengths.map((s, i) => ['Company (KT)', `강점 ${i + 1}`, s]),
    ['Customer', '핵심 니즈', analysis_3c.customer.needs.join('\n')],
    ['Customer', '평가기준', analysis_3c.customer.eval_criteria.join('\n')],
    ...analysis_3c.competitors.flatMap(c => [
      ['Competitor', `${c.name} — 전략`, c.strategy],
      ['Competitor', `${c.name} — 강점`, c.strengths.join('\n')],
      ['Competitor', `${c.name} — 약점`, c.weaknesses.join('\n')],
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(threeC);
  ws2['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws2, '3C 분석');

  // Sheet 3: SWOT
  const { swot } = body;
  const swotData: string[][] = [
    ['구분', '내용'],
    ['Strengths (강점)', swot.strengths.join('\n')],
    ['Weaknesses (약점)', swot.weaknesses.join('\n')],
    ['Opportunities (기회)', swot.opportunities.join('\n')],
    ['Threats (위협)', swot.threats.join('\n')],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(swotData);
  ws3['!cols'] = [{ wch: 24 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'SWOT 분석');

  // Sheet 4: Opportunity
  const { opportunity } = body;
  const oppData: string[][] = [
    ['구분', '내용'],
    ['핵심 기회 요소', opportunity.key_opportunities.join('\n')],
    ['KT 차별화 포인트', opportunity.differentiation.join('\n')],
    ['종합 수주전략', opportunity.strategy],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(oppData);
  ws4['!cols'] = [{ wch: 24 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Opportunity 분석');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExportBody;
    const { type, projectName } = body;

    if (type === 'ppt') {
      const pres = buildPPT(body);
      const buf = await pres.write({ outputType: 'nodebuffer' });
      const filename = encodeURIComponent(`${projectName || 'AI_Market_Research'}_수주전략.pptx`);
      return new Response(buf as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (type === 'excel') {
      const buf = buildExcel(body);
      const filename = encodeURIComponent(`${projectName || 'AI_Market_Research'}_수주전략.xlsx`);
      return new NextResponse(buf as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ ok: false, error: 'type must be ppt or excel' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
