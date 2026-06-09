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

function probColor(p: number) { return p >= 65 ? '#16a34a' : p >= 45 ? '#d97706' : '#dc2626'; }

function badgeStyle(badge: string): React.CSSProperties {
  const isRed = badge === '열위' || badge === '리스크' || badge === '추가발굴';
  const isBlue = badge === '우위';
  const bg = isRed ? '#C01B2E' : isBlue ? '#1F4E9C' : 'transparent';
  const color = (isRed || isBlue) ? '#fff' : 'transparent';
  return {
    display: 'inline-block', fontSize: 9, padding: '2px 7px', borderRadius: 2,
    background: bg, color, fontWeight: 700, letterSpacing: 0.5,
    fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' as const,
  };
}

const BADGE_LEGEND = [
  { badge: '우위', desc: '가능성 상승 요인', bg: '#1F4E9C' },
  { badge: '열위', desc: '가능성 저하 요인', bg: '#C01B2E' },
  { badge: '리스크', desc: '위험 요소', bg: '#C01B2E' },
  { badge: '추가발굴', desc: '전략 보강 필요', bg: '#C01B2E' },
];

function SectionTable({ items }: { items: ReportItem[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
          <th style={{ width: 130, textAlign: 'left', padding: '8px 12px', color: '#475569', fontWeight: 700, fontSize: 11 }}>항목</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#475569', fontWeight: 700, fontSize: 11 }}>내용</th>
          <th style={{ width: 72, textAlign: 'center', padding: '8px 12px', color: '#475569', fontWeight: 700, fontSize: 11 }}>평가</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1F4E9C', fontSize: 12, verticalAlign: 'top' }}>
              [{item.tag}]
            </td>
            <td style={{ padding: '10px 12px', lineHeight: 1.7, color: '#1f2937', verticalAlign: 'top' }}>{item.content}</td>
            <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>
              {item.badge && <span style={badgeStyle(item.badge)}>{item.badge}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BadgeLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 12 }}>
      {BADGE_LEGEND.map(({ badge, desc, bg }) => (
        <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
          <span style={{ display: 'inline-block', fontSize: 9, padding: '2px 6px', borderRadius: 2, background: bg, color: '#fff', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>{badge}</span>
          {desc}
        </span>
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: ReportItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 12, color: '#1F4E9C', fontWeight: 700, whiteSpace: 'nowrap' as const, marginRight: 8, marginTop: 1 }}>
        [{item.tag}]
      </span>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: '#1f2937' }}>{item.content}</span>
      {item.badge && <span style={{ ...badgeStyle(item.badge), marginLeft: 8 }}>{item.badge}</span>}
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

  if (error) return <div style={{ padding: 40, color: '#dc2626', fontFamily: 'system-ui' }}>{`오류: ${error}`}</div>;
  if (!data) return (
    <div style={{ padding: 40, color: '#666', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ fontSize: 14 }}>전략 보고서 생성 중 (10~40초)...</div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>FA·이코노미스트 기사를 분석하여 KT 수주전략 형식으로 작성합니다</div>
    </div>
  );

  const S: React.CSSProperties = { background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 };
  const H: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 12, letterSpacing: 1.5, textTransform: 'uppercase' as const };
  const stratBg = data.geo_prob < 40 ? '#fef2f2' : data.geo_prob < 65 ? '#fffbeb' : '#f0fdf4';
  const stratBorder = data.geo_prob < 40 ? '#fecaca' : data.geo_prob < 65 ? '#fde68a' : '#bbf7d0';
  const stratColor = data.geo_prob < 40 ? '#b91c1c' : data.geo_prob < 65 ? '#92400e' : '#15803d';

  return (
    <div className="brief-root" style={{ maxWidth: 900, margin: '0 auto', padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.3 }}>
          {data.topic}
        </h1>
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()}
            style={{ padding: '6px 14px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            인쇄 / PDF
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 20 }}>
        전략 분석 보고서 · 발간일 {new Date().toLocaleDateString('ko-KR')} · 시그널 응답 {data.total_votes}건
      </div>

      {/* 사업 개요 */}
      {data.overview && (
        <div style={{ ...S, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ ...H, color: '#374151' }}>사업 개요</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{data.overview}</p>
        </div>
      )}

      {/* 확률 배지 + 드라이버 */}
      <div style={{ ...S, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: 1, marginBottom: 4 }}>달성 가능성</div>
          <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace', color: probColor(data.geo_prob), lineHeight: 1 }}>
            {data.geo_prob}%
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>→ 목표 {data.target_prob}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>드라이버 기여도 (0~10)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {normalizeDriverMeta(data.driver_meta).map(m => {
              const val = contribution(m, data.driver_scores[m.key] ?? 0);
              return (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: '#374151' }}>{m.labelKo}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#374151' }}>{val.toFixed(1)}</span>
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
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, fontWeight: 500, fontStyle: 'italic' }}>❝ {data.hypothesis} ❞</p>
        </div>
      )}

      {/* 확률 제고 전략 */}
      {data.strategy && (
        <div style={{ ...S, background: stratBg, border: `1px solid ${stratBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ ...H, color: '#1d4ed8', margin: 0 }}>확률 제고 전략</div>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: stratColor, color: '#fff',
              fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
            }}>
              {data.strategy_label}
            </span>
            <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
              현재 {data.geo_prob}% → 목표 {data.target_prob}%
            </span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.9, fontSize: 14, whiteSpace: 'pre-wrap', color: '#1f2937' }}>{data.strategy}</p>
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

      {/* 3. 확률 제고 전략 상세 */}
      {data.strategy_items.length > 0 && (
        <div style={{ ...S, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <div style={{ ...H, color: '#0369a1' }}>3. 확률 제고 전략 ({data.target_prob}% 달성)</div>
          <SectionTable items={data.strategy_items} />
        </div>
      )}

      {/* 시그널 투표 결과 */}
      {data.cards.length > 0 && (
        <div style={S}>
          <div style={H}>시그널 투표 결과 ({data.total_votes}건)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>시그널</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>방향</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>득표</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 8px', fontWeight: 500 }}>{c.label}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 3,
                      background: c.direction === 'agree' ? '#dcfce7' : '#fee2e2',
                      color: c.direction === 'agree' ? '#15803d' : '#b91c1c',
                    }}>
                      {c.direction === 'agree' ? '가능성↑' : '가능성↓'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>
                    {c.vote_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        본 보고서는 FA·이코노미스트 등 글로벌 기사 AI 분석 기반 내부 참고용 자료입니다.
      </div>
    </div>
  );
}
