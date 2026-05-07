'use client';

import { useState, useEffect } from 'react';
import { VARIABLE_META, Variables, calculateProbability } from '@/lib/algorithm';

interface Props {
  initialVars: Variables;
  weights: Record<string, number>;
}

export default function SimulatorTab({ initialVars, weights }: Props) {
  const [vars, setVars] = useState<Variables>({ ...initialVars });
  const [probability, setProbability] = useState(0);

  useEffect(() => {
    setProbability(calculateProbability(vars, weights));
  }, [vars, weights]);

  const setVar = (key: keyof Variables, val: number) =>
    setVars(prev => ({ ...prev, [key]: val }));

  const color = probability >= 70 ? 'var(--green)' : probability >= 45 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
      {/* 슬라이더 패널 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '24px' }}>
          SCENARIO SIMULATOR
        </div>
        {(Object.keys(vars) as (keyof Variables)[]).map(key => {
          const meta = VARIABLE_META[key];
          const val = vars[key];
          const w = weights[key] ?? meta.defaultWeight;
          return (
            <div key={key} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>{meta.label}</span>
                  {meta.invert && <span style={{ color: 'var(--red)', fontSize: '11px', marginLeft: '6px' }}>↓불리</span>}
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '8px' }}>가중치 {(w * 100).toFixed(1)}%</span>
                </div>
                <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)', fontSize: '18px', fontWeight: 600 }}>{val}</span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={val}
                onChange={e => setVar(key, Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>1 (최저)</span><span>10 (최고)</span>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setVars({ ...initialVars })}
          style={{
            padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px',
          }}
        >
          ↺ 초기값 복원
        </button>
      </div>

      {/* 실시간 확률 패널 */}
      <div style={{ position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          background: 'var(--surface)', border: `1px solid ${color}44`, borderRadius: '12px',
          padding: '32px 24px', textAlign: 'center',
        }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontFamily: 'IBM Plex Mono', letterSpacing: '2px', marginBottom: '16px' }}>
            LIVE PROBABILITY
          </div>
          <div style={{ fontSize: '64px', fontFamily: 'IBM Plex Mono', fontWeight: 600, color, lineHeight: 1 }}>
            {probability.toFixed(1)}
            <span style={{ fontSize: '24px' }}>%</span>
          </div>
          <div style={{ marginTop: '16px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${probability}%`,
              background: color, borderRadius: '3px',
              boxShadow: `0 0 10px ${color}`,
              transition: 'all 0.3s ease',
            }} />
          </div>
        </div>

        {/* 초기값 대비 델타 */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px' }}>
            DELTA
          </div>
          {(Object.keys(vars) as (keyof Variables)[]).map(key => {
            const delta = vars[key] - initialVars[key];
            if (delta === 0) return null;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-mid)' }}>{VARIABLE_META[key].label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
            );
          })}
          {Object.keys(vars).every(k => vars[k as keyof Variables] === initialVars[k as keyof Variables]) && (
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>슬라이더를 조정하세요</div>
          )}
        </div>
      </div>
    </div>
  );
}
