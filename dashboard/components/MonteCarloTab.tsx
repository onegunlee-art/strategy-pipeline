'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  SubScores, SubFactorId, PILLAR_COLORS, PILLAR_IDS,
  subFactorsOf, pillarScoreFromSubs, pillarMultiplication,
} from '@/lib/pillars';
import { monteCarloRun, MonteCarloResult } from '@/lib/montecarlo';

interface Props {
  initialSubs: SubScores;
  baseProb: number;
}

export default function MonteCarloTab({ initialSubs, baseProb }: Props) {
  const [subs, setSubs] = useState<SubScores>(initialSubs);
  const [sigma, setSigma] = useState(1.0);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  const detProb = useMemo(() => {
    const pillars = pillarScoreFromSubs(subs);
    return pillarMultiplication(pillars) * 100;
  }, [subs]);

  const runMC = () => {
    setRunning(true);
    setTimeout(() => {
      const result = monteCarloRun(subs, { iterations: 5000, subFactorStd: sigma });
      setMc(result);
      setRunning(false);
    }, 50);
  };

  useEffect(() => {
    runMC();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSub = (id: SubFactorId, val: number) =>
    setSubs(prev => ({ ...prev, [id]: val }));

  const delta = detProb - baseProb;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 결정 확률 + Δ */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        padding: '24px 28px', display: 'flex', gap: '40px', alignItems: 'center',
        flexWrap: 'wrap' as const,
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)' }}>
            Current (Pillar Mult)
          </div>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: '40px', fontWeight: 700, color: 'var(--brand)', marginTop: '4px' }}>
            {detProb.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)' }}>
            Δ from Baseline
          </div>
          <div style={{
            fontFamily: 'var(--font-num)', fontSize: '28px', fontWeight: 700, marginTop: '4px',
            color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-mid)',
          }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%p
          </div>
        </div>
        {mc && (
          <>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)' }}>
                MC Mean (σ={sigma.toFixed(1)})
              </div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', marginTop: '4px' }}>
                {(mc.mean * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'var(--font-sans)' }}>
                90% CI
              </div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: '16px', fontWeight: 600, color: 'var(--text-mid)', marginTop: '4px' }}>
                {(mc.p5 * 100).toFixed(1)} — {(mc.p95 * 100).toFixed(1)}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Histogram */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 600, color: 'var(--brand)',
            letterSpacing: '1.5px', textTransform: 'uppercase' as const,
            fontFamily: 'var(--font-sans)',
          }}>
            Monte Carlo Distribution (5,000 iter)
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>σ (불확실성)</span>
            <input type="range" min={0.3} max={2.5} step={0.1} value={sigma}
              onChange={e => setSigma(Number(e.target.value))}
              style={{ width: '100px' }} />
            <span style={{ fontFamily: 'var(--font-num)', fontSize: '12px', fontWeight: 700, color: 'var(--brand)', minWidth: '30px' }}>
              {sigma.toFixed(1)}
            </span>
            <button onClick={runMC} disabled={running}
              style={{
                padding: '5px 14px', background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 600,
                cursor: running ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
                letterSpacing: '0.5px',
              }}>
              {running ? 'RUNNING' : 'RUN'}
            </button>
          </div>
        </div>

        {mc && <Histogram distribution={mc.distribution} mean={mc.mean} p5={mc.p5} p95={mc.p95} />}
      </div>

      {/* 슬라이더 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px 28px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 600, color: 'var(--brand)',
          letterSpacing: '1.5px', textTransform: 'uppercase' as const,
          borderBottom: '1.5px solid var(--brand)', paddingBottom: '8px', marginBottom: '20px',
          fontFamily: 'var(--font-sans)',
        }}>
          Scenario Adjustment
        </div>
        {PILLAR_IDS.map(p => (
          <div key={p} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: PILLAR_COLORS[p],
              letterSpacing: '1px', textTransform: 'uppercase' as const,
              marginBottom: '10px', fontFamily: 'var(--font-sans)',
            }}>
              {p}
            </div>
            {subFactorsOf(p).map(f => (
              <div key={f.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>{f.label}</span>
                  <span style={{ fontFamily: 'var(--font-num)', fontSize: '12px', fontWeight: 700, color: PILLAR_COLORS[p] }}>
                    {subs[f.id]}
                  </span>
                </div>
                <input type="range" min={1} max={10} step={1} value={subs[f.id]}
                  onChange={e => setSub(f.id, Number(e.target.value))} />
              </div>
            ))}
          </div>
        ))}
        <button onClick={runMC}
          style={{
            width: '100%', padding: '10px', border: '1px solid var(--brand)',
            borderRadius: '2px',
            background: 'transparent', color: 'var(--brand)',
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.5px', cursor: 'pointer',
          }}>
          Monte Carlo 재실행
        </button>
      </div>
    </div>
  );
}

function Histogram({ distribution, mean, p5, p95 }: {
  distribution: number[]; mean: number; p5: number; p95: number;
}) {
  const max = Math.max(...distribution);
  const bins = distribution.length;
  const meanBin = Math.floor(mean * bins);
  const p5Bin = Math.floor(p5 * bins);
  const p95Bin = Math.floor(p95 * bins);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '180px' }}>
        {distribution.map((count, i) => {
          const h = (count / max) * 100;
          const isMean = i === meanBin;
          const inCI = i >= p5Bin && i <= p95Bin;
          return (
            <div key={i} style={{
              flex: 1, height: `${h}%`,
              background: isMean ? 'var(--brand)' : inCI ? 'rgba(230,0,28,0.25)' : 'var(--border)',
            }} />
          );
        })}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-num)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px',
      }}>
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}
