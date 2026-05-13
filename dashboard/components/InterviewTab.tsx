'use client';

import { useState } from 'react';
import { VARIABLE_META, Variables } from '@/lib/algorithm';

interface Props {
  onResult: (data: { probability: number; deal_id: number; variables: Variables; weights: Record<string, number> }) => void;
}

const EMPTY: Variables = {
  decision_maker_access: 5,
  past_win_history: 5,
  price_competitiveness: 5,
  tech_differentiation: 5,
  lg_cns_threat: 5,
  samsung_sds_threat: 5,
  budget_confirmed: 5,
};

export default function InterviewTab({ onResult }: Props) {
  const [clientName, setClientName] = useState('');
  const [dealSize, setDealSize] = useState('');
  const [vars, setVars] = useState<Variables>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setVar = (key: keyof Variables, val: number) =>
    setVars(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!clientName.trim()) { setError('고객사명을 입력하세요.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: clientName, deal_size: dealSize, variables: vars }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onResult({ ...data, variables: vars });
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 고객사 정보 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          CLIENT INFO
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-mid)', display: 'block', marginBottom: '6px' }}>고객사명 *</label>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="예: KT 엔터프라이즈"
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-mid)', display: 'block', marginBottom: '6px' }}>딜 규모</label>
            <input
              value={dealSize}
              onChange={e => setDealSize(e.target.value)}
              placeholder="예: 50억"
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* 변수 입력 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '20px' }}>
          VARIABLES (1–10)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(Object.keys(vars) as (keyof Variables)[]).map(key => {
            const meta = VARIABLE_META[key];
            const val = vars[key];
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                    {meta.label}
                    {meta.invert && <span style={{ color: 'var(--red)', fontSize: '11px', marginLeft: '6px' }}>↓불리</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[2, 5, 8].map((q, i) => (
                      <button
                        key={q}
                        onClick={() => setVar(key, q)}
                        style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', border: 'none',
                          background: val === q ? 'var(--cyan)' : 'var(--surface2)',
                          color: val === q ? '#000' : 'var(--text-dim)',
                        }}
                      >
                        {['Low', 'Mid', 'High'][i]}
                      </button>
                    ))}
                    <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)', fontSize: '16px', fontWeight: 600, minWidth: '28px', textAlign: 'right' }}>
                      {val}
                    </span>
                  </div>
                </div>
                <input
                  type="range" min={1} max={10} step={1}
                  value={val}
                  onChange={e => setVar(key, Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px', color: 'var(--red)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: '16px', borderRadius: '10px', border: 'none', cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--cyan)', color: loading ? 'var(--text-dim)' : '#000',
          fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600, letterSpacing: '1px', transition: 'all 0.2s',
        }}
      >
        {loading ? 'ANALYZING...' : '▶  수주 확률 계산'}
      </button>
    </div>
  );
}
