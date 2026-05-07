'use client';

import { Variables, VARIABLE_META } from '@/lib/algorithm';

interface Props {
  probability: number;
  variables: Variables;
  weights: Record<string, number>;
  dealId: number;
  onOutcomeRecorded?: () => void;
}

function ProbabilityGauge({ value }: { value: number }) {
  const color = value >= 70 ? 'var(--green)' : value >= 45 ? 'var(--yellow)' : 'var(--red)';
  const label = value >= 70 ? '수주 가능성 높음' : value >= 45 ? '경쟁 필요' : '취약 — 전략 재검토';

  return (
    <div style={{ textAlign: 'center', padding: '32px' }}>
      <div style={{ fontSize: '72px', fontFamily: 'IBM Plex Mono', fontWeight: 600, color, lineHeight: 1 }}>
        {value.toFixed(1)}
        <span style={{ fontSize: '28px' }}>%</span>
      </div>
      <div style={{
        display: 'inline-block', marginTop: '12px', padding: '4px 16px',
        borderRadius: '20px', background: `${color}22`, border: `1px solid ${color}44`,
        color, fontSize: '12px', fontFamily: 'IBM Plex Mono',
      }}>
        {label}
      </div>
      <div style={{ marginTop: '20px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value}%`, background: color,
          borderRadius: '3px', boxShadow: `0 0 12px ${color}`, transition: 'width 1s ease',
        }} />
      </div>
    </div>
  );
}

function VariableBar({ label, score, weight, invert }: { label: string; score: number; weight: number; invert: boolean }) {
  const normalized = invert ? (11 - score) / 10 : score / 10;
  const contribution = normalized * weight * 100;
  const color = contribution > 12 ? 'var(--green)' : contribution > 6 ? 'var(--cyan)' : 'var(--red)';

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text)' }}>{label}{invert && <span style={{ color: 'var(--red)', marginLeft: '4px' }}>↓</span>}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', color }}>
          {score}/10 &nbsp;·&nbsp; {contribution.toFixed(1)}pts
        </span>
      </div>
      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
        <div style={{
          height: '100%', width: `${contribution * 5}%`, maxWidth: '100%',
          background: color, borderRadius: '3px', transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
        가중치 {(weight * 100).toFixed(1)}%
      </div>
    </div>
  );
}

export default function AnalysisTab({ probability, variables, weights, dealId, onOutcomeRecorded }: Props) {
  const weakVars = (Object.keys(variables) as (keyof Variables)[])
    .filter(k => {
      const meta = VARIABLE_META[k];
      const v = variables[k];
      return meta.invert ? v > 7 : v < 4;
    })
    .map(k => VARIABLE_META[k].label);

  const handleOutcome = async (result: 0 | 1) => {
    await fetch('/api/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId, actual_result: result }),
    });
    onOutcomeRecorded?.();
    alert(`결과가 저장되었습니다: ${result === 1 ? '✅ 수주' : '❌ 실패'}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 확률 게이지 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: '20px 24px 0', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px' }}>
          WIN PROBABILITY
        </div>
        <ProbabilityGauge value={probability} />
      </div>

      {/* 변수별 기여도 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '20px' }}>
          VARIABLE CONTRIBUTION
        </div>
        {(Object.keys(variables) as (keyof Variables)[]).map(key => (
          <VariableBar
            key={key}
            label={VARIABLE_META[key].label}
            score={variables[key]}
            weight={weights[key] ?? VARIABLE_META[key].defaultWeight}
            invert={VARIABLE_META[key].invert}
          />
        ))}
      </div>

      {/* AI 리포트 */}
      {weakVars.length > 0 && (
        <div style={{ background: 'rgba(255,68,102,0.05)', border: '1px solid rgba(255,68,102,0.3)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ color: 'var(--red)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px' }}>
            ⚠ RISK FACTORS
          </div>
          {weakVars.map(v => (
            <div key={v} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-mid)' }}>
              <span style={{ color: 'var(--red)' }}>▸</span> {v} 개선 필요
            </div>
          ))}
        </div>
      )}

      {/* 결과 기록 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          RECORD OUTCOME
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => handleOutcome(1)}
            style={{
              padding: '14px', borderRadius: '8px', border: '1px solid var(--green)',
              background: 'rgba(0,255,136,0.08)', color: 'var(--green)', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600,
            }}
          >
            ✅ 수주 성공
          </button>
          <button
            onClick={() => handleOutcome(0)}
            style={{
              padding: '14px', borderRadius: '8px', border: '1px solid var(--red)',
              background: 'rgba(255,68,102,0.08)', color: 'var(--red)', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600,
            }}
          >
            ❌ 수주 실패
          </button>
        </div>
      </div>
    </div>
  );
}
