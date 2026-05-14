'use client';

import { useMemo, useState } from 'react';
import { SubScores, SUB_FACTORS, PillarId, pillarScoreFromSubs, pillarMultiplication, defaultSubScores } from '@/lib/pillars';
import { monteCarloRun } from '@/lib/montecarlo';

interface Props {
  initialSubs: SubScores;
}

interface Scenario {
  name: string;
  subs: SubScores;
  prob: number;
  ci: [number, number];
}

const PILLAR_COLORS: Record<PillarId, string> = {
  V: '#4dd0e1', P: '#81c784', D: '#ffb74d', E: '#ba68c8',
};

function computeScenario(subs: SubScores, name: string): Scenario {
  const pillars = pillarScoreFromSubs(subs);
  const prob = pillarMultiplication(pillars) * 100;
  const mc = monteCarloRun(subs, { iterations: 1000, subFactorStd: 0.8 });
  return { name, subs, prob, ci: [mc.p5 * 100, mc.p95 * 100] };
}

export default function ScenarioCompare({ initialSubs }: Props) {
  const [current] = useState<SubScores>(initialSubs ?? defaultSubScores());
  const [scenarioA, setScenarioA] = useState<SubScores>(() => ({ ...initialSubs }));
  const [scenarioB, setScenarioB] = useState<SubScores>(() => ({ ...initialSubs }));

  const currentResult = useMemo(() => computeScenario(current, 'Current'), [current]);
  const aResult = useMemo(() => computeScenario(scenarioA, 'Scenario A'), [scenarioA]);
  const bResult = useMemo(() => computeScenario(scenarioB, 'Scenario B'), [scenarioB]);

  const delta = (s: Scenario) => s.prob - currentResult.prob;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '2px', marginBottom: '12px' }}>
          ◈ SCENARIO COMPARE — 액션 시나리오 효과 시뮬레이션
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px' }}>
          오른쪽 두 열에서 sub-factor를 조정하여 &quot;이 액션 하면 +몇%?&quot; 확인. 좌측은 현재 상태.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[currentResult, aResult, bResult].map((s, idx) => (
            <ResultCard key={idx} scenario={s} deltaPp={idx === 0 ? 0 : delta(s)} highlight={idx === 0} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div /> {/* Current는 조정 안 됨 */}
        <ScenarioEditor name="Scenario A" subs={scenarioA} onChange={setScenarioA} accent="var(--cyan)" />
        <ScenarioEditor name="Scenario B" subs={scenarioB} onChange={setScenarioB} accent="var(--green)" />
      </div>
    </div>
  );
}

function ResultCard({ scenario, deltaPp, highlight }: { scenario: Scenario; deltaPp: number; highlight: boolean }) {
  const deltaColor = deltaPp > 0 ? 'var(--green)' : deltaPp < 0 ? 'var(--red)' : 'var(--text-dim)';
  return (
    <div style={{
      background: highlight ? 'var(--surface2)' : 'var(--surface)',
      border: '1px solid ' + (highlight ? 'var(--cyan)' : 'var(--border)'),
      borderRadius: '8px', padding: '16px',
    }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
        {scenario.name}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '32px', color: 'var(--cyan)', marginTop: '8px' }}>
        {scenario.prob.toFixed(1)}%
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
        CI: {scenario.ci[0].toFixed(0)}–{scenario.ci[1].toFixed(0)}%
      </div>
      {!highlight && (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '14px', color: deltaColor, marginTop: '8px' }}>
          {deltaPp >= 0 ? '+' : ''}{deltaPp.toFixed(1)} pp
        </div>
      )}
    </div>
  );
}

function ScenarioEditor({ name, subs, onChange, accent }: {
  name: string;
  subs: SubScores;
  onChange: (s: SubScores) => void;
  accent: string;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: accent, letterSpacing: '1px', marginBottom: '12px' }}>
        {name} 조정
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SUB_FACTORS.map(f => (
          <div key={f.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ color: PILLAR_COLORS[f.pillar] }}>[{f.pillar}]</span>
              <span style={{ flex: 1, marginLeft: '6px', color: 'var(--text-dim)' }}>{f.label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', color: accent, minWidth: '22px', textAlign: 'right' }}>
                {(subs[f.id] ?? 5).toFixed(1)}
              </span>
            </div>
            <input type="range" min={1} max={10} step={0.5} value={subs[f.id] ?? 5}
              onChange={e => onChange({ ...subs, [f.id]: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
