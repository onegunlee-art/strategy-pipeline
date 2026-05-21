'use client';

import { useEffect, useState } from 'react';
import type { PortfolioDeal, Recommendation } from '@/lib/portfolio';

const REC_STYLE: Record<Recommendation, { bg: string; color: string; border: string; label: string }> = {
  NO_GO:    { bg: 'rgba(204,34,34,0.06)',   color: 'var(--red)',    border: 'var(--red)',    label: 'NO-GO' },
  PRIORITY: { bg: 'rgba(26,127,60,0.08)',   color: 'var(--green)',  border: 'var(--green)',  label: 'PRIORITY' },
  WATCH:    { bg: 'rgba(192,122,0,0.08)',   color: 'var(--yellow)', border: 'var(--yellow)', label: 'WATCH' },
};

interface Props { refreshKey?: number; }

export default function PortfolioView({ refreshKey }: Props) {
  const [deals, setDeals] = useState<PortfolioDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Recommendation>('all');

  useEffect(() => {
    setLoading(true);
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(d => { setDeals(d.deals ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  const filtered = filter === 'all' ? deals : deals.filter(d => d.recommendation === filter);

  const stats = {
    total: deals.length,
    noGo: deals.filter(d => d.recommendation === 'NO_GO').length,
    priority: deals.filter(d => d.recommendation === 'PRIORITY').length,
    watch: deals.filter(d => d.recommendation === 'WATCH').length,
    totalEv: deals.reduce((s, d) => s + d.ev_eok, 0),
    priorityEv: deals.filter(d => d.recommendation === 'PRIORITY').reduce((s, d) => s + d.ev_eok, 0),
  };

  if (loading) return (
    <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '40px' }}>데이터 로딩 중...</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Active Deals" value={String(stats.total)} />
        <StatCard label="Total EV (억원)" value={stats.totalEv.toFixed(1)} color="var(--brand)" />
        <StatCard label="Priority EV" value={stats.priorityEv.toFixed(1)} color="var(--green)" />
        <StatCard label="NO-GO 추정" value={`${stats.noGo}건`} color="var(--red)" />
      </div>

      {/* 필터 버튼 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
        {(['all', 'PRIORITY', 'WATCH', 'NO_GO'] as const).map(f => {
          const active = filter === f;
          const label = f === 'all' ? `전체 (${stats.total})`
            : f === 'PRIORITY' ? `PRIORITY (${stats.priority})`
            : f === 'WATCH'    ? `WATCH (${stats.watch})`
            : `NO-GO (${stats.noGo})`;
          const accentColor = f === 'PRIORITY' ? 'var(--green)' : f === 'WATCH' ? 'var(--yellow)' : f === 'NO_GO' ? 'var(--red)' : 'var(--brand)';
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: '2px',
                border: '1px solid ' + (active ? accentColor : 'var(--border)'),
                background: 'transparent',
                color: active ? accentColor : 'var(--text-mid)',
                fontSize: '12px', fontWeight: active ? 600 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                letterSpacing: '0.3px',
              }}>{label}</button>
          );
        })}
      </div>

      {/* 딜 테이블 */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
              {['Deal', '본부', 'Win %', '규모(억)', 'EV(억)', 'Risk', 'Voters', 'Spread', 'Recommendation'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left' as const,
                  fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)',
                  letterSpacing: '0.8px', textTransform: 'uppercase' as const,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, idx) => {
              const rec = REC_STYLE[d.recommendation];
              return (
                <tr key={d.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                }}>
                  <td style={{ padding: '10px 12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>
                    {d.client_name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{d.industry ?? '-'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)', fontWeight: 600,
                    color: d.win_probability >= 60 ? 'var(--green)' : d.win_probability < 30 ? 'var(--red)' : 'var(--yellow)' }}>
                    {d.win_probability.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)' }}>{d.deal_size_eok.toFixed(1)}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)', color: 'var(--brand)', fontWeight: 600 }}>{d.ev_eok.toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)', color: 'var(--text-dim)' }}>{d.risk ?? '-'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)', color: 'var(--text-dim)' }}>{d.voter_count}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-num)', color: 'var(--text-dim)' }}>
                    {d.average_spread > 0 ? d.average_spread.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px',
                      border: `1px solid ${rec.border}`,
                      color: rec.color, background: rec.bg,
                      fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px',
                    }}>{rec.label}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center' as const, color: 'var(--text-dim)' }}>
                해당 조건의 딜이 없습니다
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
        Recommendation 기준: NO-GO (확률 &lt; 30%) · PRIORITY (확률 ≥ 60% AND spread ≤ 1.5 AND EV 상위 30%) · WATCH (그 외)
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderTop: `3px solid ${color}`,
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.8px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-num)', fontSize: '22px', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}
