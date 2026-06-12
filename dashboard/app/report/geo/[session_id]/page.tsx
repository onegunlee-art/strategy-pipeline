'use client';

import { useState, useEffect } from 'react';
import '../../../brief/print.css';
import { GeoDriver, contribution, normalizeDriverMeta } from '@/lib/geoDrivers';

interface Props {
  params: { session_id: string };
}

interface ReportItem {
  tag: string;
  content: string;
  badge: string;
  driver_key?: string;
  delta?: number;
}

interface GeoReportData {
  topic: string;
  geo_prob: number;
  driver_scores: Record<string, number>;
  driver_meta: GeoDriver[];
  total_votes: number;
  cards: { label: string; direction: string; vote_count: number }[];
  hypothesis: string;
  strategy: string;
  strategy_label: string;
  target_prob: number;
  overview: string;
  analysis_items: ReportItem[];
  resistance_items: ReportItem[];
  strategy_items: ReportItem[];
}

const FONT = "'Malgun Gothic', '맑은 고딕', -apple-system, BlinkMacSystemFont, sans-serif";

function probColor(p: number) { return p >= 65 ? '#16a34a' : p >= 45 ? '#d97706' : '#dc2626'; }

function badgeStyle(badge: string): React.CSSProperties {
  const isRed = badge === '열위' || badge === '리스크' || badge === '추가발굴';
  const isBlue = badge === '우위';
  const bg = isRed ? '#C01B2E' : isBlue ? '#1F4E9C' : 'transparent';
  const color = (isRed || isBlue) ? '#fff' : 'transparent';
  return {
    display: 'inline-block', fontSize: 9, padding: '2px 8px', borderRadius: 2,
    background: bg, color, fontWeight: 700, letterSpacing: 0.3,
    fontFamily: FONT, whiteSpace: 'nowrap' as const,
  };
}

const BADGE_LEGEND = [
  { badge: '우위', desc: '가능성 상승 요인', bg: '#1F4E9C' },
  { badge: '열위', desc: '가능성 저하 요인', bg: '#C01B2E' },
  { badge: '리스크', desc: '위험 요소', bg: '#C01B2E' },
  { badge: '추가발굴', desc: '전략 보강 필요', bg: '#C01B2E' },
];

function StrategyText({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const numbered = lines.filter(l => /^\d+\./.test(l));
  if (numbered.length > 0) {
    return (
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {numbered.map((line, i) => {
          const body = line.replace(/^\d+\.\s*/, '');
          return (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: '#1f2937', fontFamily: FONT, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
              {body}
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <p style={{ margin: 0, lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap', color: '#1f2937', fontFamily: FONT, wordBreak: 'keep-all' }}>
      {text}
    </p>
  );
}

function SectionTable({ items }: { items: ReportItem[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
      <thead>
        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
          <th style={{ width: 120, textAlign: 'left', padding: '10px 14px', color: '#475569', fontWeight: 700, fontSize: 11, fontFamily: FONT, whiteSpace: 'nowrap' }}>항목</th>
          <th style={{ textAlign: 'left', padding: '10px 14px', color: '#475569', fontWeight: 700, fontSize: 11, fontFamily: FONT }}>내용</th>
          <th style={{ width: 76, textAlign: 'center', padding: '10px 14px', color: '#475569', fontWeight: 700, fontSize: 11, fontFamily: FONT, whiteSpace: 'nowrap' }}>평가</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #e9eef4', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1F4E9C', fontSize: 12, verticalAlign: 'top', whiteSpace: 'nowrap', fontFamily: FONT }}>
              [{item.tag}]
            </td>
            <td style={{ padding: '12px 14px', lineHeight: 1.8, color: '#1f2937', verticalAlign: 'top', fontFamily: FONT, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
              {item.content}
            </td>
            <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top' }}>
              {item.badge && <span style={badgeStyle(item.badge)}>{item.badge}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── 전략 적용 시뮬레이터 — 파워 카드 + 아크 게이지 + 워터폴 ──────────────────
function clampNum(min: number, max: number, v: number) { return Math.max(min, Math.min(max, v)); }

// 반원 아크 게이지
function ArcGauge({ base, applied, target }: { base: number; applied: number; target: number }) {
  const W = 340; const H = 160;
  const cx = W / 2; const cy = H - 10;
  const R = 120;
  const circumference = Math.PI * R; // 반원 둘레

  // 각도: 0% = 왼쪽(-180°), 100% = 오른쪽(0°)
  const toOffset = (val: number) => circumference * (1 - val / 100);
  const toCartesian = (val: number) => {
    const angle = Math.PI * (1 - val / 100); // 0%=π(왼쪽), 100%=0(오른쪽)
    return { x: cx + R * Math.cos(angle), y: cy - R * Math.sin(angle) };
  };

  const delta = applied - base;
  const appliedColor = applied >= 65 ? '#22c55e' : applied >= 45 ? '#f59e0b' : '#ef4444';
  const basePos = toCartesian(base);
  const targetPos = toCartesian(target);

  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>

      {/* 배경 반원 호 */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke="#1e293b" strokeWidth={14} strokeLinecap="round"
      />

      {/* 적용 확률 호 (base → applied) */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke="url(#arcGrad)" strokeWidth={14} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={toOffset(applied)}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />

      {/* base 마커 */}
      <circle cx={basePos.x} cy={basePos.y} r={5} fill="#94a3b8" stroke="#0f172a" strokeWidth={2} />

      {/* target 마커 */}
      <circle cx={targetPos.x} cy={targetPos.y} r={4} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 2" />

      {/* base % 라벨 */}
      <text x={cx - R - 14} y={cy + 20} textAnchor="middle" fontSize={11} fontFamily="IBM Plex Mono, monospace" fill="#64748b">
        0%
      </text>
      <text x={cx + R + 14} y={cy + 20} textAnchor="middle" fontSize={11} fontFamily="IBM Plex Mono, monospace" fill="#64748b">
        100%
      </text>

      {/* 중앙 적용 확률 */}
      <text x={cx} y={cy - 34} textAnchor="middle" fontSize={46} fontWeight={800} fontFamily="IBM Plex Mono, monospace" fill={appliedColor}
        style={{ transition: 'all 0.4s ease' }}>
        {applied}%
      </text>
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={11} fontFamily="IBM Plex Mono, monospace" fill="#64748b">
        적용 시
      </text>

      {/* 현재 / delta / 목표 */}
      <text x={cx - 90} y={cy + 22} textAnchor="middle" fontSize={12} fontFamily="IBM Plex Mono, monospace" fill="#94a3b8">
        현재 {base}%
      </text>
      {delta !== 0 && (
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily="IBM Plex Mono, monospace" fill="#22c55e">
          +{delta}pp
        </text>
      )}
      <text x={cx + 90} y={cy + 22} textAnchor="middle" fontSize={11} fontFamily="IBM Plex Mono, monospace" fill="#f59e0b">
        목표 {target}%
      </text>
    </svg>
  );
}

function StrategySimulator({ items, driverMeta, driverScores, baseProb, targetProb }: {
  items: ReportItem[];
  driverMeta: GeoDriver[];
  driverScores: Record<string, number>;
  baseProb: number;
  targetProb: number;
}) {
  const meta = normalizeDriverMeta(driverMeta);
  const validKeys = new Set(meta.map(m => m.key));
  const levers = items.filter(it => it.driver_key && validKeys.has(it.driver_key) && (it.delta ?? 0) > 0);
  const [enabled, setEnabled] = useState<boolean[]>(() => levers.map(() => false));

  if (levers.length === 0) return null;

  const labelOf = (key: string) => meta.find(m => m.key === key)?.labelKo ?? key;
  const baseContrib: Record<string, number> = {};
  for (const m of meta) baseContrib[m.key] = contribution(m, driverScores[m.key] ?? 0);

  const probWith = (mask: boolean[]) => {
    const c = { ...baseContrib };
    levers.forEach((l, i) => {
      if (mask[i]) c[l.driver_key!] = clampNum(0, 10, c[l.driver_key!] + (l.delta ?? 0));
    });
    const mean = meta.reduce((acc, m) => acc + c[m.key], 0) / Math.max(1, meta.length);
    return clampNum(5, 95, Math.round(mean * 10));
  };

  const appliedProb = probWith(enabled);

  // 워터폴 스텝
  const steps: { label: string; from: number; to: number }[] = [];
  {
    const mask = levers.map(() => false);
    let prev = baseProb;
    levers.forEach((l, i) => {
      if (!enabled[i]) return;
      mask[i] = true;
      const p = probWith(mask);
      steps.push({ label: labelOf(l.driver_key!), from: prev, to: p });
      prev = p;
    });
  }

  // 워터폴 SVG
  const cols = steps.length + 2;
  const colW = 84, gap = 18, padL = 46, padT = 18, padB = 34;
  const W = padL + cols * (colW + gap) + 10;
  const H = 230;
  const allVals = [baseProb, appliedProb, targetProb, ...steps.flatMap(s => [s.from, s.to])];
  const lo = Math.max(0, Math.min(...allVals) - 8);
  const hi = Math.min(100, Math.max(...allVals) + 6);
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - lo) / Math.max(1, hi - lo));
  const xOf = (i: number) => padL + i * (colW + gap);

  return (
    <div className="no-print" style={{
      background: 'rgba(2,6,23,0.96)', border: '1px solid #22d3ee', borderRadius: 10,
      padding: '22px 26px', marginBottom: 16, fontFamily: FONT,
      boxShadow: '0 0 32px rgba(34,211,238,0.08)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', letterSpacing: 1.6, textTransform: 'uppercase' as const }}>
          전략 적용 시뮬레이터
        </div>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(34,211,238,0.12)', color: '#22d3ee', fontWeight: 700, border: '1px solid rgba(34,211,238,0.3)' }}>
          INTERACTIVE
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
        전략을 켜고 끄면 확률 엔진(P = mean(contribution) × 10)이 즉시 재계산합니다
      </div>

      {/* 아크 게이지 */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 20 }}>
        <ArcGauge base={baseProb} applied={appliedProb} target={targetProb} />
        <div style={{ textAlign: 'center', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#334155', marginTop: 4 }}>
          잔여 갭 {Math.max(0, targetProb - appliedProb)}pp
        </div>
      </div>

      {/* 파워 카드 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {levers.map((l, i) => {
          const solo = levers.map((_, j) => j === i);
          const soloDpp = probWith(solo) - baseProb;
          const on = enabled[i];
          return (
            <div
              key={i}
              onClick={() => setEnabled(prev => prev.map((v, j) => j === i ? !v : v))}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                borderRadius: 8, cursor: 'pointer', userSelect: 'none' as const,
                background: on ? 'rgba(8,47,73,0.8)' : 'rgba(15,23,42,0.7)',
                border: on ? '1px solid #22d3ee' : '1px solid #1e293b',
                boxShadow: on ? '0 0 16px rgba(34,211,238,0.18), inset 0 0 24px rgba(34,211,238,0.04)' : 'none',
                transition: 'all 0.22s ease',
              }}
            >
              {/* 드라이버 칩 */}
              <span style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 4, flexShrink: 0,
                background: on ? '#1d4ed8' : '#1e293b',
                color: on ? '#bfdbfe' : '#64748b',
                fontWeight: 700, whiteSpace: 'nowrap' as const,
                border: on ? '1px solid rgba(59,130,246,0.4)' : '1px solid #334155',
                transition: 'all 0.22s ease',
              }}>
                {labelOf(l.driver_key!)}
              </span>

              {/* 전략 텍스트 */}
              <span style={{
                flex: 1, fontSize: 12.5, lineHeight: 1.65, wordBreak: 'keep-all' as const,
                color: on ? '#e2e8f0' : '#475569',
                transition: 'color 0.22s ease',
              }}>
                {l.content}
              </span>

              {/* +pp 배지 */}
              <span style={{
                fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, flexShrink: 0,
                color: on ? '#22d3ee' : '#334155',
                opacity: on ? 1 : 0.5,
                transition: 'all 0.22s ease',
                minWidth: 44, textAlign: 'right' as const,
              }}>
                +{soloDpp}pp
              </span>

              {/* 전원 버튼 */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: on ? '1.5px solid #22d3ee' : '1.5px solid #334155',
                boxShadow: on ? '0 0 10px rgba(34,211,238,0.6)' : 'none',
                transition: 'all 0.22s ease',
              }}>
                <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5v4" stroke={on ? '#22d3ee' : '#475569'} strokeWidth={1.8} strokeLinecap="round" />
                  <path d="M4 3.2A5 5 0 1 0 10 3.2" stroke={on ? '#22d3ee' : '#475569'} strokeWidth={1.8} strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* 워터폴 차트 */}
      {steps.length > 0 && (
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 10, color: '#334155', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: 1, marginBottom: 8 }}>PROBABILITY WATERFALL</div>
          <svg width={W} height={H} style={{ display: 'block', minWidth: '100%' }}>
            <line x1={padL - 8} y1={y(targetProb)} x2={W - 4} y2={y(targetProb)} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.2} />
            <text x={W - 6} y={y(targetProb) - 5} textAnchor="end" fontSize={10} fill="#f59e0b" fontFamily="IBM Plex Mono, monospace">목표 {targetProb}%</text>
            <rect x={xOf(0)} y={y(baseProb)} width={colW} height={Math.max(2, y(lo) - y(baseProb))} fill="#334155" rx={3} />
            <text x={xOf(0) + colW / 2} y={y(baseProb) - 7} textAnchor="middle" fontSize={12} fontWeight={700} fill="#94a3b8" fontFamily="IBM Plex Mono, monospace">{baseProb}%</text>
            <text x={xOf(0) + colW / 2} y={H - 12} textAnchor="middle" fontSize={11} fill="#475569" fontFamily={FONT}>현재</text>
            {steps.map((s, i) => {
              const x = xOf(i + 1);
              return (
                <g key={i}>
                  <line x1={x - gap} y1={y(s.from)} x2={x} y2={y(s.from)} stroke="#334155" strokeWidth={1} strokeDasharray="3 3" />
                  <rect x={x} y={y(s.to)} width={colW} height={Math.max(2, y(s.from) - y(s.to))} fill="#0ea5e9" rx={3} opacity={0.9} />
                  <text x={x + colW / 2} y={y(s.to) - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill="#38bdf8" fontFamily="IBM Plex Mono, monospace">+{s.to - s.from}</text>
                  <text x={x + colW / 2} y={H - 12} textAnchor="middle" fontSize={10} fill="#475569" fontFamily={FONT}>{s.label}</text>
                </g>
              );
            })}
            <rect x={xOf(steps.length + 1)} y={y(appliedProb)} width={colW} height={Math.max(2, y(lo) - y(appliedProb))} fill="#22c55e" rx={3} />
            <text x={xOf(steps.length + 1) + colW / 2} y={y(appliedProb) - 7} textAnchor="middle" fontSize={12} fontWeight={800} fill="#4ade80" fontFamily="IBM Plex Mono, monospace">{appliedProb}%</text>
            <text x={xOf(steps.length + 1) + colW / 2} y={H - 12} textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight={600} fontFamily={FONT}>적용 후</text>
          </svg>
        </div>
      )}
    </div>
  );
}

function BadgeLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 14, fontFamily: FONT }}>
      {BADGE_LEGEND.map(({ badge, desc, bg }) => (
        <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280', fontFamily: FONT }}>
          <span style={{ display: 'inline-block', fontSize: 9, padding: '2px 7px', borderRadius: 2, background: bg, color: '#fff', fontWeight: 700, fontFamily: FONT }}>{badge}</span>
          {desc}
        </span>
      ))}
    </div>
  );
}

export default function GeoReportPage({ params }: Props) {
  const { session_id } = params;
  const [data, setData] = useState<GeoReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/geo-report/${session_id}`, { method: 'POST' });
        const rawText = await res.text();
        if (cancelled) return;
        let json: Partial<GeoReportData> & { error?: string };
        try {
          json = JSON.parse(rawText);
        } catch {
          setError(res.ok ? '보고서 응답을 해석할 수 없습니다.' : `HTTP ${res.status} — 서버 응답 시간 초과로 추정됩니다. 잠시 후 다시 시도하세요.`);
          return;
        }
        if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); return; }
        setData({
          ...(json as GeoReportData),
          cards: Array.isArray(json.cards) ? json.cards : [],
          driver_scores: json.driver_scores ?? {},
          analysis_items: Array.isArray(json.analysis_items) ? json.analysis_items : [],
          resistance_items: Array.isArray(json.resistance_items) ? json.resistance_items : [],
          strategy_items: Array.isArray(json.strategy_items) ? json.strategy_items : [],
        });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session_id]);

  if (error) return <div style={{ padding: 40, color: '#dc2626', fontFamily: FONT }}>{`오류: ${error}`}</div>;
  if (!data) return (
    <div style={{ padding: 40, color: '#666', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, fontFamily: FONT }}>전략 보고서 생성 중 (10~40초)...</div>
      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FONT }}>글로벌 뉴스 RAG 기사를 분석하여 전략 보고서를 작성합니다</div>
    </div>
  );

  const S: React.CSSProperties = {
    background: '#fff', color: '#111', border: '1px solid #e5e7eb',
    borderRadius: 8, padding: '20px 24px', marginBottom: 16,
    fontFamily: FONT, wordBreak: 'keep-all', overflowWrap: 'break-word',
  };
  const H: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 14,
    letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: FONT,
  };
  const stratBg = data.geo_prob < 40 ? '#fef2f2' : data.geo_prob < 65 ? '#fffbeb' : '#f0fdf4';
  const stratBorder = data.geo_prob < 40 ? '#fecaca' : data.geo_prob < 65 ? '#fde68a' : '#bbf7d0';
  const stratColor = data.geo_prob < 40 ? '#b91c1c' : data.geo_prob < 65 ? '#92400e' : '#15803d';

  return (
    <div className="brief-root" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', fontFamily: FONT, background: '#f9fafb', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.4, fontFamily: FONT, wordBreak: 'keep-all' }}>
          {data.topic}
        </h1>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
          <button onClick={() => window.print()}
            style={{ padding: '6px 14px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }}>
            인쇄 / PDF
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 22, fontFamily: FONT, lineHeight: 1.6 }}>
        전략 분석 보고서 · 발간일 {new Date().toLocaleDateString('ko-KR')} · 시그널 응답 {data.total_votes}건
      </div>

      {/* 사업 개요 */}
      {data.overview && (
        <div style={{ ...S, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ ...H, color: '#374151' }}>사업 개요</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#374151', fontFamily: FONT, wordBreak: 'keep-all' }}>{data.overview}</p>
        </div>
      )}

      {/* 확률 배지 + Win Factors */}
      <div style={{ ...S, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: 1, marginBottom: 4, fontFamily: FONT }}>달성 가능성</div>
          <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace', color: probColor(data.geo_prob), lineHeight: 1 }}>
            {data.geo_prob}%
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontFamily: FONT }}>→ 목표 {data.target_prob}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 10, fontFamily: FONT }}>Win Factors (0~10)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 28px' }}>
            {normalizeDriverMeta(data.driver_meta).map(m => {
              const val = contribution(m, data.driver_scores[m.key] ?? 0);
              return (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, fontFamily: FONT }}>
                    <span style={{ color: '#374151', wordBreak: 'keep-all' }}>{m.labelKo}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#374151', flexShrink: 0, marginLeft: 6 }}>{val.toFixed(1)}</span>
                  </div>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 2 }}>
                    <div style={{ width: `${Math.max(4, val * 10)}%`, height: '100%', background: '#E6001C', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 전략 가설 */}
      {data.hypothesis && (
        <div style={{ ...S, border: '1px solid #E6001C', background: '#fff5f5' }}>
          <div style={{ ...H, color: '#E6001C' }}>전략 가설</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, fontWeight: 500, fontStyle: 'italic', fontFamily: FONT, wordBreak: 'keep-all' }}>❝ {data.hypothesis} ❞</p>
        </div>
      )}

      {/* 핵심 전략 요약 */}
      {data.strategy && (
        <div style={{ ...S, background: stratBg, border: `1px solid ${stratBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ ...H, color: '#1d4ed8', margin: 0 }}>핵심 전략 요약</div>
            <span style={{
              fontSize: 10, padding: '2px 10px', borderRadius: 3,
              background: stratColor, color: '#fff',
              fontFamily: FONT, fontWeight: 700, whiteSpace: 'nowrap' as const,
            }}>
              {data.strategy_label}
            </span>
            <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FONT, whiteSpace: 'nowrap' as const }}>
              현재 {data.geo_prob}% → 목표 {data.target_prob}%
            </span>
          </div>
          <StrategyText text={data.strategy} />
        </div>
      )}

      {/* 1. 현황 분석 */}
      {data.analysis_items.length > 0 && (
        <div style={S}>
          <div style={H}>1. 현황 분석</div>
          <BadgeLegend />
          <SectionTable items={data.analysis_items} />
        </div>
      )}

      {/* 2. 저항/리스크 분석 */}
      {data.resistance_items.length > 0 && (
        <div style={S}>
          <div style={H}>2. 저항 · 리스크 분석</div>
          <SectionTable items={data.resistance_items} />
        </div>
      )}

      {/* 3. 액션 플랜 */}
      {data.strategy_items.length > 0 && (
        <div style={{ ...S, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <div style={{ ...H, color: '#0369a1' }}>3. 액션 플랜 ({data.target_prob}% 달성)</div>
          <SectionTable items={data.strategy_items} />
        </div>
      )}

      {/* 4. 전략 적용 시뮬레이터 — 토글 + 워터폴 (화면 전용, 인쇄 제외) */}
      <StrategySimulator
        items={data.strategy_items}
        driverMeta={data.driver_meta}
        driverScores={data.driver_scores}
        baseProb={data.geo_prob}
        targetProb={data.target_prob}
      />

      {/* 시그널 투표 결과 */}
      {data.cards.length > 0 && (
        <div style={S}>
          <div style={H}>시그널 투표 결과 ({data.total_votes}건)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, fontFamily: FONT }}>시그널</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: '#6b7280', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap' }}>방향</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap' }}>득표</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 10px', fontWeight: 500, fontFamily: FONT, wordBreak: 'keep-all', lineHeight: 1.6 }}>{c.label}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 3,
                      background: c.direction === 'agree' ? '#dcfce7' : '#fee2e2',
                      color: c.direction === 'agree' ? '#15803d' : '#b91c1c',
                      fontFamily: FONT,
                    }}>
                      {c.direction === 'agree' ? '가능성↑' : '가능성↓'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>
                    {c.vote_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: '#9ca3af', textAlign: 'center', fontFamily: FONT, lineHeight: 1.6 }}>
        본 보고서는 글로벌 뉴스 RAG 기사 AI 분석 기반 내부 참고용 자료입니다.
      </div>
    </div>
  );
}
