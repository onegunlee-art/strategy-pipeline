'use client';

import { useState, useEffect } from 'react';
import '../../../brief/print.css';

interface Props {
  params: { session_id: string };
}

interface GeoReportData {
  topic: string;
  geo_prob: number;
  driver_scores: Record<string, number>;
  total_votes: number;
  cards: { label: string; direction: string; vote_count: number }[];
  hypothesis: string;
  strategy: string;
  strategy_label: string;
  executive_summary: string;
  driver_analysis: string;
  signal_summary: string;
  risk_scenarios: string;
  recommendation: string;
}

function probColor(p: number) { return p >= 65 ? '#16a34a' : p >= 45 ? '#d97706' : '#dc2626'; }

const DRIVER_META_REPORT = [
  { key: '외교채널', label: 'Diplomacy',              invert: false },
  { key: '군사강도', label: 'Military De-escalation', invert: true  },
  { key: '경제압박', label: 'Economic Off-ramp',      invert: true  },
  { key: '이란내부', label: 'Iran Stability',         invert: false },
  { key: '호르무즈', label: 'Hormuz Flow',            invert: true  },
];

export default function GeoReportPage({ params }: Props) {
  const { session_id } = params;
  const [data, setData] = useState<GeoReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = '보고서 생성 중 (10~30초)...';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/geo-report/${session_id}`, { method: 'POST' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); return; }
        setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session_id]);

  if (error) return <div style={{ padding: 40, color: '#dc2626', fontFamily: 'system-ui' }}>{`오류: ${error}`}</div>;
  if (!data) return <div style={{ padding: 40, color: '#666', fontFamily: 'system-ui' }}>{status}</div>;

  const S: React.CSSProperties = { background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 };
  const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 12, letterSpacing: 1 };

  return (
    <div className="brief-root" style={{ maxWidth: 880, margin: '0 auto', padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>
          {data.topic} — 지정학 분석 보고서
        </h1>
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()}
            style={{ padding: '6px 14px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            인쇄 / PDF
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
        발간일 {new Date().toLocaleDateString('ko-KR')} · 시그널 응답 {data.total_votes}건
      </div>

      {/* 확률 배지 */}
      <div style={{ ...S, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1, marginBottom: 4 }}>종전 가능성</div>
          <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace', color: probColor(data.geo_prob), lineHeight: 1 }}>
            {data.geo_prob}%
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>종전 기여도 (높을수록 종전↑)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {DRIVER_META_REPORT.map(m => {
              const raw = (data.driver_scores[m.key] as number) ?? 0;
              const val = m.invert ? 10 - raw : raw;
              return (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: '#374151' }}>{m.label}</span>
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

      {/* Hypothesis */}
      {data.hypothesis && (
        <div style={{ ...S, border: '1px solid #E6001C', background: '#fff5f5' }}>
          <div style={{ ...H, color: '#E6001C' }}>전략 가설</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, fontWeight: 500 }}>{data.hypothesis}</p>
        </div>
      )}

      {/* Conditional Strategy */}
      {data.strategy && (
        <div style={{ ...S, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ ...H, color: '#1d4ed8', margin: 0 }}>{data.strategy_label || '전략 제언'}</div>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: data.geo_prob < 40 ? '#fee2e2' : data.geo_prob < 65 ? '#fef9c3' : '#dcfce7',
              color: data.geo_prob < 40 ? '#b91c1c' : data.geo_prob < 65 ? '#92400e' : '#15803d',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              {data.geo_prob < 40 ? 'RISK — LOW PROB' : data.geo_prob < 65 ? 'HOLD — MID PROB' : 'SECURE — HIGH PROB'}
            </span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-wrap' }}>{data.strategy}</p>
        </div>
      )}

      {/* Executive Summary */}
      {data.executive_summary && (
        <div style={S}>
          <div style={H}>종합 판단</div>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14 }}>{data.executive_summary}</p>
        </div>
      )}

      {/* Driver Analysis */}
      {data.driver_analysis && (
        <div style={S}>
          <div style={H}>드라이버 분석</div>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-wrap' }}>{data.driver_analysis}</p>
        </div>
      )}

      {/* Signal votes */}
      {data.cards.length > 0 && (
        <div style={S}>
          <div style={H}>시그널 투표 결과 ({data.total_votes}건)</div>
          {data.signal_summary && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{data.signal_summary}</p>
          )}
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
                      {c.direction === 'agree' ? '종전↑' : '긴장↑'}
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

      {/* Risk scenarios */}
      {data.risk_scenarios && (
        <div style={S}>
          <div style={H}>시나리오 분석</div>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, whiteSpace: 'pre-wrap' }}>{data.risk_scenarios}</p>
        </div>
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div style={{ ...S, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ ...H, color: '#1d4ed8' }}>권고사항</div>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, fontWeight: 500 }}>{data.recommendation}</p>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        본 보고서는 AI 분석 기반으로 작성된 내부 참고용 자료입니다.
      </div>
    </div>
  );
}
