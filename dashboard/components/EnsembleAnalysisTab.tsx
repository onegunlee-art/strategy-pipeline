'use client';

import { useState } from 'react';
import { PillarId, SubFactorId, SubScores } from '@/lib/pillars';

interface PredictResult {
  deal_id: number;
  probability: number;
  method_probs: { pillar: number; bayesian: number; elo: number; monteCarlo: number };
  pillar_scores: Record<PillarId, number>;
  confidence_interval: { low: number; high: number };
  weaknesses: Array<{ id: SubFactorId; label: string; pillar: PillarId; score: number; contribution: number }>;
  prior_base_rate: number;
  data_points: number;
  client_name: string;
  deal_size: string;
  competitors: string[];
  sub_scores: SubScores;
}

interface StrategyCard {
  sub_factor_id: SubFactorId;
  cause_hypothesis: string;
  actions: Array<{ step: string; owner: string; duration: string }>;
  expected_score_lift: number;
  expected_probability_lift_pp: number;
  kt_framework_reference: string;
}

const PILLAR_COLORS: Record<PillarId, string> = {
  V: '#4dd0e1', P: '#81c784', D: '#ffb74d', E: '#ba68c8',
};

const METHOD_LABELS: Record<string, { label: string; desc: string }> = {
  pillar: { label: 'A. Pillar Multiplication', desc: 'KT 4축 곱셈 모델' },
  bayesian: { label: 'B. Bayesian Update', desc: '과거 base rate × 현재 evidence' },
  elo: { label: 'C. Competitor Elo', desc: '경쟁사 Elo 매치업' },
  monteCarlo: { label: 'D. Monte Carlo', desc: '불확실성 10,000회 시뮬' },
};

interface Props {
  result: PredictResult;
  onOutcome: (r: 1 | 0) => void;
}

export default function EnsembleAnalysisTab({ result, onOutcome }: Props) {
  const [cards, setCards] = useState<StrategyCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);

  const generateStrategy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: result.client_name,
          deal_size: result.deal_size,
          weaknesses: result.weaknesses,
          current_probability: result.probability,
          competitors: result.competitors,
        }),
      });
      const data = await res.json();
      if (data.cards) setCards(data.cards);
    } catch {
      setCards([]);
    } finally { setLoading(false); }
  };

  const recordOutcome = async (r: 1 | 0) => {
    await fetch('/api/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: result.deal_id, actual_result: r }),
    });
    setOutcomeSaved(true);
    onOutcome(r);
  };

  const probColor = result.probability >= 70 ? 'var(--green)' : result.probability >= 45 ? 'var(--yellow)' : 'var(--red)';
  const gateRecommendation = result.probability >= 60
    ? { color: 'var(--green)', text: 'GO — 적극 추진' }
    : result.probability >= 40
    ? { color: 'var(--yellow)', text: 'PIVOT — 약점 보강 후 재평가' }
    : { color: 'var(--red)', text: 'NO-GO 검토 — 자원 효율 우선' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 메인 확률 + Gate */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '32px', display: 'flex', gap: '24px', alignItems: 'center',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
            ENSEMBLE WIN PROBABILITY
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '8px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '64px', color: probColor, fontWeight: 600, lineHeight: 1 }}>
              {result.probability.toFixed(1)}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: probColor }}>%</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
            95% CI: <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-mid)' }}>
              {result.confidence_interval.low.toFixed(1)} — {result.confidence_interval.high.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Prior(base rate): {result.prior_base_rate.toFixed(1)}% · 학습 데이터 {result.data_points}건
          </div>
        </div>

        <div style={{
          padding: '20px', borderRadius: '12px',
          background: `${gateRecommendation.color}15`, border: `2px solid ${gateRecommendation.color}`,
          minWidth: '220px',
        }}>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: gateRecommendation.color, letterSpacing: '1px' }}>
            GATE REVIEW
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: gateRecommendation.color, marginTop: '6px' }}>
            {gateRecommendation.text}
          </div>
        </div>
      </div>

      {/* 4 Method 분해 */}
      <Card title="4-METHOD ENSEMBLE BREAKDOWN">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {(['pillar', 'bayesian', 'elo', 'monteCarlo'] as const).map(m => {
            const v = result.method_probs[m];
            return (
              <div key={m} style={{ padding: '14px', background: 'var(--surface2)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '1px' }}>
                  {METHOD_LABELS[m].label}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '28px', color: 'var(--text)', marginTop: '6px' }}>
                  {v.toFixed(1)}%
                </div>
                <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${v}%`, background: 'var(--cyan)' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                  {METHOD_LABELS[m].desc}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pillar Scores */}
      <Card title="4-PILLAR SCORES">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {(['V', 'P', 'D', 'E'] as PillarId[]).map(p => (
            <div key={p}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', color: PILLAR_COLORS[p], fontSize: '12px' }}>{p}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', color: PILLAR_COLORS[p], fontSize: '20px' }}>
                  {(result.pillar_scores[p] * 100).toFixed(0)}
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${result.pillar_scores[p] * 100}%`, background: PILLAR_COLORS[p] }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top 3 약점 */}
      <Card title="TOP 3 WEAKNESSES — 확률을 끌어내리는 sub-factor">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {result.weaknesses.map((w, i) => (
            <div key={w.id} style={{
              padding: '14px', background: 'var(--surface2)', borderRadius: '8px',
              borderLeft: `3px solid ${PILLAR_COLORS[w.pillar]}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>
                  #{i + 1} · {w.pillar}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text)', marginTop: '4px' }}>
                  {w.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: PILLAR_COLORS[w.pillar] }}>
                  {w.score}/10
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--red)' }}>
                  {(w.contribution * 100).toFixed(1)}%p
                </div>
              </div>
            </div>
          ))}
        </div>

        {!cards && (
          <button onClick={generateStrategy} disabled={loading}
            style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--cyan)',
              background: 'transparent', color: 'var(--cyan)',
              fontFamily: 'IBM Plex Mono', fontSize: '12px', cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? 'GENERATING ACTIONS...' : '▶  AI 전략 카드 생성'}
          </button>
        )}
      </Card>

      {/* 전략 카드 */}
      {cards && cards.length > 0 && (
        <Card title="STRATEGY CARDS (3주 내 실행)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cards.map(card => (
              <div key={card.sub_factor_id} style={{
                padding: '16px', background: 'var(--surface2)', borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)' }}>
                    {card.sub_factor_id}
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--green)' }}>
                    예상 +{card.expected_probability_lift_pp}%p
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px', fontStyle: 'italic' }}>
                  {card.cause_hypothesis}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {card.actions.map((a, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-mid)', display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono' }}>›</span>
                      <span style={{ flex: 1 }}>
                        {a.step}
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>
                          [{a.owner} · {a.duration}]
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '10px', fontFamily: 'IBM Plex Mono' }}>
                  KT 프레임워크: {card.kt_framework_reference}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 결과 기록 */}
      {!outcomeSaved ? (
        <Card title="OUTCOME (수주 결과 기록)">
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => recordOutcome(1)}
              style={{
                flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid var(--green)',
                background: 'transparent', color: 'var(--green)',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', cursor: 'pointer',
              }}>
              ✓  수주 (WIN)
            </button>
            <button onClick={() => recordOutcome(0)}
              style={{
                flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid var(--red)',
                background: 'transparent', color: 'var(--red)',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', cursor: 'pointer',
              }}>
              ✗  실패 (LOSS)
            </button>
          </div>
        </Card>
      ) : (
        <div style={{
          padding: '14px', background: 'rgba(102, 187, 106, 0.1)',
          border: '1px solid var(--green)', borderRadius: '8px',
          color: 'var(--green)', fontSize: '13px', textAlign: 'center',
        }}>
          ✓ 결과 기록 완료 · 경쟁사 Elo 자동 업데이트됨
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
