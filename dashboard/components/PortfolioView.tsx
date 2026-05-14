'use client';

import { useEffect, useState } from 'react';
import type { PortfolioDeal, Recommendation } from '@/lib/portfolio';

const REC_STYLE: Record<Recommendation, { bg: string; color: string; label: string }> = {
  NO_GO: { bg: 'rgba(255,68,102,0.15)', color: 'var(--red)', label: 'NO-GO' },
  PRIORITY: { bg: 'rgba(129,199,132,0.15)', color: 'var(--green)', label: 'PRIORITY' },
  WATCH: { bg: 'rgba(255,183,77,0.15)', color: 'var(--yellow)', label: 'WATCH' },
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
      .then(d => {
        setDeals(d.deals ?? []);
        setLoading(false);
      })
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

  if (loading) return <div style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>LOADING...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
      }}>
        <StatCard label="ACTIVE DEALS" value={String(stats.total)} />
        <StatCard label="TOTAL EV (억원)" value={stats.totalEv.toFixed(1)} color="var(--cyan)" />
        <StatCard label="PRIORITY EV" value={stats.priorityEv.toFixed(1)} color="var(--green)" />
        <StatCard label="NO-GO 추정" value={`${stats.noGo}건`} color="var(--red)" />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['all', 'PRIORITY', 'WATCH', 'NO_GO'] as const).map(f => {
          const active = filter === f;
          const label = f === 'all' ? `전체 (${stats.total})`
            : f === 'PRIORITY' ? `🟢 PRIORITY (${stats.priority})`
            : f === 'WATCH' ? `🟡 WATCH (${stats.watch})`
            : `🔴 NO-GO (${stats.noGo})`;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '8px 14px', borderRadius: '6px',
                border: '1px solid ' + (active ? 'var(--cyan)' : 'var(--border)'),
                background: active ? 'rgba(77,208,225,0.15)' : 'var(--surface2)',
                color: active ? 'var(--cyan)' : 'var(--text)',
                fontSize: '12px', cursor: 'pointer', fontFamily: 'IBM Plex Mono',
              }}>{label}</button>
          );
        })}
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Deal', '본부', 'Win %', '규모(억)', 'EV(억)', 'Risk', 'Voters', 'Spread', 'Recommendation'].map(h => (
                <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const rec = REC_STYLE[d.recommendation];
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.client_name}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{d.industry ?? '-'}</td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono',
                    color: d.win_probability >= 60 ? 'var(--green)' : d.win_probability < 30 ? 'var(--red)' : 'var(--yellow)' }}>
                    {d.win_probability.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono' }}>{d.deal_size_eok.toFixed(1)}</td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{d.ev_eok.toFixed(2)}</td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>{d.risk ?? '-'}</td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>{d.voter_count}</td>
                  <td style={{ padding: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                    {d.average_spread > 0 ? d.average_spread.toFixed(2) : '-'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px',
                      background: rec.bg, color: rec.color,
                      fontFamily: 'IBM Plex Mono', fontSize: '10px', letterSpacing: '1px',
                    }}>{rec.label}</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                해당 조건의 딜이 없습니다
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '8px' }}>
        Recommendation 규칙: NO-GO (확률 &lt; 30%), PRIORITY (확률 ≥ 60% AND voter spread ≤ 1.5 AND EV 상위 30%), 그 외 WATCH
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color }}>
        {value}
      </div>
    </div>
  );
}
