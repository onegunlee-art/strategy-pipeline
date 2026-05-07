'use client';

import { useState, useEffect } from 'react';
import { VARIABLE_META } from '@/lib/algorithm';

interface Deal {
  id: number;
  client_name: string;
  deal_size: string;
  created_at: string;
  predicted_probability: number;
  actual_result: number | null;
}

interface Weight {
  variable_id: string;
  weight_value: number;
  version: number;
  updated_at: string;
}

interface RetrainResult {
  ok: boolean;
  version?: number;
  cases_analyzed?: number;
  avg_brier?: number;
  new_weights?: Record<string, number>;
  reasoning?: string;
  message?: string;
  current?: number;
}

export default function LearningTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState<RetrainResult | null>(null);

  const load = async () => {
    const [d, w] = await Promise.all([
      fetch('/api/deals').then(r => r.json()),
      fetch('/api/weights').then(r => r.json()),
    ]);
    setDeals(d);
    setWeights(w);
  };

  useEffect(() => { load(); }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    try {
      const res = await fetch('/api/retrain', { method: 'POST' });
      const data = await res.json() as RetrainResult;
      setRetrainResult(data);
      if (data.ok) await load();
    } finally {
      setRetraining(false);
    }
  };

  const dealsWithOutcome = deals.filter(d => d.actual_result !== null);
  const accuracy = dealsWithOutcome.length > 0
    ? dealsWithOutcome.filter(d => {
        const pred = d.predicted_probability >= 50;
        return pred === (d.actual_result === 1);
      }).length / dealsWithOutcome.length * 100
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 요약 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: '전체 딜', value: deals.length, unit: '건' },
          { label: '결과 입력', value: dealsWithOutcome.length, unit: '건' },
          { label: '예측 정확도', value: accuracy !== null ? accuracy.toFixed(0) : '-', unit: accuracy !== null ? '%' : '' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', letterSpacing: '1px', marginBottom: '8px' }}>
              {s.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '36px', fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--cyan)' }}>
              {s.value}<span style={{ fontSize: '16px' }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 현재 가중치 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px' }}>
            CURRENT WEIGHTS {weights[0] && `— v${weights[0].version}`}
          </div>
          <button
            onClick={handleRetrain}
            disabled={retraining}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: retraining ? 'wait' : 'pointer',
              background: retraining ? 'var(--surface2)' : 'var(--cyan)', color: retraining ? 'var(--text-dim)' : '#000',
              fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
            }}
          >
            {retraining ? '학습 중...' : '▶ AI 재학습'}
          </button>
        </div>

        {weights.map(w => {
          const meta = VARIABLE_META[w.variable_id as keyof typeof VARIABLE_META];
          const pct = w.weight_value * 100;
          return (
            <div key={w.variable_id} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text)' }}>{meta?.label ?? w.variable_id}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
                <div style={{
                  height: '100%', width: `${pct * 3}%`, maxWidth: '100%',
                  background: 'var(--cyan)', borderRadius: '3px',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 재학습 결과 */}
      {retrainResult && (
        <div style={{
          background: retrainResult.ok ? 'rgba(0,212,255,0.05)' : 'rgba(255,68,102,0.05)',
          border: `1px solid ${retrainResult.ok ? 'var(--cyan)' : 'var(--red)'}44`,
          borderRadius: '12px', padding: '24px',
        }}>
          <div style={{ color: retrainResult.ok ? 'var(--cyan)' : 'var(--red)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px' }}>
            {retrainResult.ok ? '✓ RETRAIN COMPLETE' : '⚠ RETRAIN SKIPPED'}
          </div>
          {retrainResult.ok ? (
            <>
              <div style={{ fontSize: '13px', color: 'var(--text-mid)', marginBottom: '8px' }}>
                분석 {retrainResult.cases_analyzed}건 &nbsp;·&nbsp; 평균 Brier {retrainResult.avg_brier?.toFixed(3)} &nbsp;·&nbsp; v{retrainResult.version}으로 업데이트
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                {retrainResult.reasoning}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
              {retrainResult.message} (현재 {retrainResult.current ?? 0}건)
            </div>
          )}
        </div>
      )}

      {/* 예측 vs 실제 테이블 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
          PREDICTION HISTORY
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                {['고객사', '딜 규모', '예측 확률', '실제 결과', '정확도', '날짜'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const correct = deal.actual_result !== null
                  ? (deal.predicted_probability >= 50) === (deal.actual_result === 1)
                  : null;
                return (
                  <tr key={deal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{deal.client_name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-mid)' }}>{deal.deal_size ?? '-'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>
                      {deal.predicted_probability?.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {deal.actual_result === null ? (
                        <span style={{ color: 'var(--text-dim)' }}>대기중</span>
                      ) : deal.actual_result === 1 ? (
                        <span style={{ color: 'var(--green)' }}>✅ 수주</span>
                      ) : (
                        <span style={{ color: 'var(--red)' }}>❌ 실패</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {correct === null ? '-' : correct ? (
                        <span style={{ color: 'var(--green)' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--red)' }}>✗</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>
                      {deal.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    아직 데이터가 없습니다. 인터뷰 탭에서 첫 번째 딜을 입력해보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
