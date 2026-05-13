'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  SubScores, SubFactorId, PillarId, subFactorsOf,
  pillarScoreFromSubs, pillarMultiplication,
} from '@/lib/pillars';
import { monteCarloRun, MonteCarloResult } from '@/lib/montecarlo';

interface Props {
  initialSubs: SubScores;
  baseProb: number;
}

const PILLAR_COLORS: Record<PillarId, string> = {
  V: '#4dd0e1', P: '#81c784', D: '#ffb74d', E: '#ba68c8',
};

export default function MonteCarloTab({ initialSubs, baseProb }: Props) {
  const [subs, setSubs] = useState<SubScores>(initialSubs);
  const [sigma, setSigma] = useState(1.0);
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  // 결정적 확률 (현재 슬라이더 값 그대로)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 결정 확률 + Δ */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '24px', display: 'flex', gap: '32px', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
            CURRENT (Pillar mult)
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '40px', color: 'var(--cyan)' }}>
            {detProb.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
            Δ FROM BASELINE
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '28px',
            color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-mid)',
          }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%p
          </div>
        </div>
        {mc && (
          <>
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
                MC MEAN (σ={sigma.toFixed(1)})
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '28px', color: 'var(--text)' }}>
                {(mc.mean * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
                90% CI
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '14px', color: 'var(--text-mid)' }}>
                {(mc.p5 * 100).toFixed(1)} — {(mc.p95 * 100).toFixed(1)}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Monte Carlo Histogram */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px' }}>
            MONTE CARLO DISTRIBUTION (5,000 iter)
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>σ (불확실성)</span>
            <input type="range" min={0.3} max={2.5} step={0.1} value={sigma}
              onChange={e => setSigma(Number(e.target.value))}
              style={{ width: '100px' }} />
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--cyan)', minWidth: '30px' }}>
              {sigma.toFixed(1)}
            </span>
            <button onClick={runMC} disabled={running}
              style={{
                padding: '4px 12px', background: 'var(--cyan)', color: '#000',
                border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                fontFamily: 'IBM Plex Mono',
              }}>
              {running ? 'RUNNING' : 'RUN'}
            </button>
          </div>
        </div>

        {mc && (
          <Histogram distribution={mc.distribution} mean={mc.mean} p5={mc.p5} p95={mc.p95} />
        )}
      </div>

      {/* 슬라이더 (시나리오 조정) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          SCENARIO ADJUSTMENT
        </div>
        {(['V', 'P', 'D', 'E'] as PillarId[]).map(p => (
          <div key={p} style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: PILLAR_COLORS[p], marginBottom: '8px' }}>
              {p}
            </div>
            {subFactorsOf(p).map(f => (
              <div key={f.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>{f.label}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: PILLAR_COLORS[p] }}>
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
            width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--cyan)',
            background: 'transparent', color: 'var(--cyan)',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', cursor: 'pointer',
          }}>
          ↻  Monte Carlo 재실행
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
              background: isMean ? 'var(--cyan)' : inCI ? 'rgba(77, 208, 225, 0.4)' : 'var(--border)',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}
