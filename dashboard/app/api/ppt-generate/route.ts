import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const PILLARS = ['S', 'V', 'D', 'P', 'E'] as const;
const PILLAR_KO: Record<string, string> = {
  S: '사전영업', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery',
};

const BG = '0f172a';
const BRAND = '6366f1';
const TEXT = 'f1f5f9';
const TEXT_DIM = '94a3b8';
const SURFACE = '1e293b';
const GREEN = '22c55e';
const YELLOW = 'f59e0b';
const RED = 'ef4444';

function scoreColor(v: number) { return v >= 70 ? GREEN : v >= 50 ? YELLOW : RED; }

interface RequestBody {
  dealName?: string;
  pillarScores: Record<string, number>;
  pillarRationale: Record<string, string>;
  weaknesses: { label: string; pillar: string; score: number }[];
  nextMoves: { label: string; owner?: string; delta_pp?: number }[];
  deal?: {
    deal_size?: string;
    duration_months?: number;
    customer_eval_criteria?: string;
    competitive_positioning?: { competitors?: { name: string; risk_level?: string; notes?: string }[] };
  };
  totalScore: number;
  items?: { pillar: string; label: string; weight: number; rating: number; rationale: string }[];
}

async function generateNarratives(body: RequestBody): Promise<Record<string, string>> {
  if (PILLARS.every(p => body.pillarRationale?.[p])) return body.pillarRationale;
  if (!process.env.ANTHROPIC_API_KEY) return body.pillarRationale ?? {};

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const pillarContext = PILLARS.map(pid => {
    const score = body.pillarScores?.[pid] ?? 0;
    const weak = body.weaknesses?.filter(w => w.pillar === pid).map(w => w.label).join(', ') || '없음';
    return `${PILLAR_KO[pid]}(${pid}): ${score}점, Weak: ${weak}`;
  }).join('\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `아래 수주 평가 결과를 바탕으로 각 Pillar의 현수준을 1~2문장으로 서술. JSON만 응답:\n${pillarContext}\n\n{"S":"...","V":"...","D":"...","P":"...","E":"..."}`,
    }],
  });
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? { ...body.pillarRationale, ...JSON.parse(m[0]) } : body.pillarRationale ?? {};
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const narratives = await generateNarratives(body);
    const dealName = body.dealName || '사업명';
    const competitors = body.deal?.competitive_positioning?.competitors ?? [];
    const riskLabel = (r?: string) => r === 'high' ? '상' : r === 'low' ? '하' : '중';

    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
    pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

    // ── Slide 1: Cover ─────────────────────────────────────────────────────────
    const s1 = pres.addSlide();
    s1.background = { color: BG };
    s1.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: BRAND } });
    s1.addText('WIN-RATE | 수주전략 장표', { x: 0.3, y: 0.4, w: 12, h: 0.4, fontSize: 11, color: TEXT_DIM, fontFace: 'Arial' });
    s1.addText(dealName, { x: 0.3, y: 1.2, w: 9, h: 1.2, fontSize: 36, bold: true, color: TEXT, fontFace: 'Arial' });
    s1.addText('수주 가능성 분석 보고서', { x: 0.3, y: 2.5, w: 9, h: 0.5, fontSize: 16, color: TEXT_DIM, fontFace: 'Arial' });

    // Win Score circle area
    s1.addShape(pres.ShapeType.ellipse, { x: 10.5, y: 1.5, w: 2.2, h: 2.2, fill: { color: SURFACE }, line: { color: BRAND, width: 3 } });
    s1.addText(`${body.totalScore}`, { x: 10.5, y: 2.0, w: 2.2, h: 0.8, fontSize: 36, bold: true, color: scoreColor(body.totalScore), align: 'center', fontFace: 'Arial' });
    s1.addText('/ 100', { x: 10.5, y: 2.8, w: 2.2, h: 0.4, fontSize: 12, color: TEXT_DIM, align: 'center', fontFace: 'Arial' });
    s1.addText('WIN SCORE', { x: 10.5, y: 3.3, w: 2.2, h: 0.3, fontSize: 9, color: TEXT_DIM, align: 'center', fontFace: 'Arial' });

    const today = new Date().toLocaleDateString('ko-KR');
    s1.addText(today, { x: 0.3, y: 6.9, w: 5, h: 0.3, fontSize: 10, color: TEXT_DIM, fontFace: 'Arial' });

    // ── Slide 2: 사업 개요 ──────────────────────────────────────────────────────
    const s2 = pres.addSlide();
    s2.background = { color: BG };
    s2.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: SURFACE } });
    s2.addText('사업 개요', { x: 0.4, y: 0.15, w: 6, h: 0.4, fontSize: 18, bold: true, color: TEXT, fontFace: 'Arial' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toRow = (cells: string[]): any[] => cells.map(text => ({ text }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overviewRows: any[][] = [
      toRow(['항목', '내용']),
      toRow(['사업 규모', body.deal?.deal_size || '미기재']),
      toRow(['사업 기간', body.deal?.duration_months ? `${body.deal.duration_months}개월` : '미기재']),
      toRow(['평가 기준', body.deal?.customer_eval_criteria || '미기재']),
    ];
    s2.addTable(overviewRows, {
      x: 0.5, y: 1.0, w: 12, h: 4,
      colW: [2.5, 9.5],
      border: { type: 'solid', color: '334155', pt: 1 },
      fill: { color: SURFACE },
      color: TEXT,
      fontFace: 'Arial',
      fontSize: 13,
      rowH: 0.8,
    });

    // ── Slide 3: 경쟁사 현황 ────────────────────────────────────────────────────
    const s3 = pres.addSlide();
    s3.background = { color: BG };
    s3.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: SURFACE } });
    s3.addText('경쟁사 현황', { x: 0.4, y: 0.15, w: 6, h: 0.4, fontSize: 18, bold: true, color: TEXT, fontFace: 'Arial' });

    if (competitors.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compRows: any[][] = [
        toRow(['경쟁사', '경쟁 위험도', '특이사항']),
        ...competitors.map(c => toRow([c.name, riskLabel(c.risk_level), c.notes || '—'])),
      ];
      s3.addTable(compRows, {
        x: 0.5, y: 1.0, w: 12,
        colW: [3, 2, 7],
        border: { type: 'solid', color: '334155', pt: 1 },
        fill: { color: SURFACE },
        color: TEXT,
        fontFace: 'Arial',
        fontSize: 12,
        rowH: 0.6,
      });
    } else {
      s3.addText('경쟁사 정보 없음', { x: 0.5, y: 2.0, w: 12, h: 1, fontSize: 14, color: TEXT_DIM, align: 'center', fontFace: 'Arial' });
    }

    // ── Slide 4: 5-Pillar 현황 ──────────────────────────────────────────────────
    const s4 = pres.addSlide();
    s4.background = { color: BG };
    s4.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: SURFACE } });
    s4.addText('Win Ratio 5-Pillar 현황', { x: 0.4, y: 0.15, w: 8, h: 0.4, fontSize: 18, bold: true, color: TEXT, fontFace: 'Arial' });

    PILLARS.forEach((pid, i) => {
      const score = body.pillarScores?.[pid] ?? 0;
      const narrative = narratives[pid] || '—';
      const yBase = 0.9 + i * 1.2;
      const barW = Math.max(0.1, score / 100 * 7);

      s4.addText(`${pid} — ${PILLAR_KO[pid]}`, { x: 0.4, y: yBase, w: 3, h: 0.35, fontSize: 11, bold: true, color: TEXT_DIM, fontFace: 'Arial' });
      s4.addShape(pres.ShapeType.rect, { x: 3.6, y: yBase + 0.05, w: 7, h: 0.25, fill: { color: '1e293b' } });
      s4.addShape(pres.ShapeType.rect, { x: 3.6, y: yBase + 0.05, w: barW, h: 0.25, fill: { color: scoreColor(score) } });
      s4.addText(`${score}점`, { x: 10.7, y: yBase, w: 1.2, h: 0.35, fontSize: 11, bold: true, color: scoreColor(score), align: 'right', fontFace: 'Arial' });
      s4.addText(narrative, { x: 0.4, y: yBase + 0.38, w: 12, h: 0.6, fontSize: 10, color: TEXT_DIM, fontFace: 'Arial', wrap: true });
    });

    // ── Slide 5: Weak Point & Action ────────────────────────────────────────────
    const s5 = pres.addSlide();
    s5.background = { color: BG };
    s5.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: SURFACE } });
    s5.addText('Weak Point & Action Item', { x: 0.4, y: 0.15, w: 8, h: 0.4, fontSize: 18, bold: true, color: TEXT, fontFace: 'Arial' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionRows: any[][] = [
      toRow(['Pillar', 'Weak Point', 'Action Item', '담당']),
      ...PILLARS.map(pid => {
        const weak = body.weaknesses?.find(w => w.pillar === pid);
        const move = body.nextMoves?.[PILLARS.indexOf(pid)];
        return toRow([
          `${pid} ${PILLAR_KO[pid]}`,
          weak?.label || '—',
          move?.label || '—',
          (move as { owner?: string })?.owner || '—',
        ]);
      }),
    ];
    s5.addTable(actionRows, {
      x: 0.5, y: 0.9, w: 12.3,
      colW: [2.2, 3, 5, 2.1],
      border: { type: 'solid', color: '334155', pt: 1 },
      fill: { color: SURFACE },
      color: TEXT,
      fontFace: 'Arial',
      fontSize: 11,
      rowH: 0.8,
    });

    // ── Slide 6: 전략 방향 ──────────────────────────────────────────────────────
    const s6 = pres.addSlide();
    s6.background = { color: BG };
    s6.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: SURFACE } });
    s6.addText('전략 방향', { x: 0.4, y: 0.15, w: 6, h: 0.4, fontSize: 18, bold: true, color: TEXT, fontFace: 'Arial' });

    // Build strategy summary from top weaknesses
    const topWeaks = PILLARS
      .map(pid => ({ pid, w: body.weaknesses?.find(w => w.pillar === pid) }))
      .filter(x => x.w)
      .map(x => `${PILLAR_KO[x.pid]} — ${x.w!.label}`)
      .join(', ');
    const strategyText = `핵심 개선 영역: ${topWeaks || '없음'}\n\n${Object.values(narratives).slice(0, 2).join('\n\n')}`;

    s6.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.9, w: 12.3, h: 5.8, fill: { color: SURFACE }, line: { color: BRAND, width: 2 } });
    s6.addText(strategyText, { x: 0.8, y: 1.1, w: 11.7, h: 5.2, fontSize: 13, color: TEXT, fontFace: 'Arial', wrap: true, valign: 'top' });

    const buf = await pres.write({ outputType: 'nodebuffer' });
    const filename = `${dealName}_전략장표.pptx`;

    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    console.error('[ppt-generate]', err);
    return NextResponse.json({ error: 'PPT 생성 오류' }, { status: 500 });
  }
}
