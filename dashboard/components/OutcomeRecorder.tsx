'use client';

import { useEffect, useState } from 'react';

interface OpenDeal {
  id: number;
  client_name: string;
  industry: string | null;
  deal_size_eok: number;
  win_probability: number;
  voter_count: number;
}

interface Props { refreshKey?: number; onRecorded?: () => void; }

export default function OutcomeRecorder({ refreshKey, onRecorded }: Props) {
  const [deals, setDeals] = useState<OpenDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const d = await res.json();
      setDeals((d.deals ?? []) as OpenDeal[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const record = async (dealId: number, result: 1 | 0) => {
    setBusy(dealId);
    setMsg('');
    try {
      const res = await fetch('/api/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, actual_result: result }),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg(result === 1 ? '수주 기록 완료 — Bayesian/Elo 자동 갱신' : '실주 기록 완료 — Bayesian/Elo 자동 갱신');
      await load();
      onRecorded?.();
    } catch {
      setMsg('저장 실패');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return (
    <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '8px 0' }}>로딩 중...</div>
  );

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px 28px' }}>
      <div style={{
        fontSize: '10px', fontWeight: 600, color: 'var(--brand)',
        letterSpacing: '1.5px', textTransform: 'uppercase',
        borderBottom: '1.5px solid var(--brand)', paddingBottom: '8px', marginBottom: '16px',
        fontFamily: 'var(--font-sans)',
      }}>
        Outcome Recorder — 미종결 딜 결과 기록
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' }}>
        딜이 종결됐을 때 Win/Loss를 기록하면 Bayesian prior + Competitor Elo가 자동 갱신됩니다.
      </div>
      {msg && (
        <div style={{
          fontSize: '12px', color: 'var(--green)', marginBottom: '12px',
          padding: '8px 12px', background: 'rgba(26,127,60,0.06)',
          borderLeft: '3px solid var(--green)',
        }}>
          {msg}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {deals.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-dim)', padding: '24px', textAlign: 'center' }}>
            미종결 딜이 없습니다
          </div>
        )}
        {deals.map(d => (
          <div key={d.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--surface2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.client_name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-sans)' }}>
                {d.industry ?? '-'} · {d.deal_size_eok > 0 ? `${d.deal_size_eok.toFixed(1)}억 · ` : ''}
                예측 <span style={{ fontFamily: 'var(--font-num)', fontWeight: 600 }}>{d.win_probability.toFixed(1)}%</span>
                {d.voter_count > 0 && ` · ${d.voter_count}명 voting`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => record(d.id, 1)} disabled={busy === d.id}
                style={{
                  padding: '6px 14px',
                  borderRadius: '2px',
                  background: 'rgba(26,127,60,0.08)', color: 'var(--green)',
                  border: '1px solid var(--green)', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.5px',
                  cursor: busy === d.id ? 'wait' : 'pointer',
                }}>
                {busy === d.id ? '...' : 'WIN'}
              </button>
              <button onClick={() => record(d.id, 0)} disabled={busy === d.id}
                style={{
                  padding: '6px 14px',
                  borderRadius: '2px',
                  background: 'rgba(204,34,34,0.08)', color: 'var(--red)',
                  border: '1px solid var(--red)', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.5px',
                  cursor: busy === d.id ? 'wait' : 'pointer',
                }}>
                LOSS
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
