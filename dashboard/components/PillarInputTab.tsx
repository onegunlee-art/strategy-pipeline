'use client';

import { useEffect, useState } from 'react';
import {
  SubScores, SubFactorId, PillarId, PILLAR_META, PILLAR_COLORS, PILLAR_IDS,
  defaultSubScores, pillarScoreFromSubs, subFactorsOf,
} from '@/lib/pillars';

interface Competitor { id: number; name: string; current_elo: number; }
interface PredictResponse {
  deal_id: number;
  probability: number;
  method_probs: { pillar: number; bayesian: number; elo: number; monteCarlo: number };
  pillar_scores: Record<PillarId, number>;
  confidence_interval: { low: number; high: number };
  mc_distribution: number[];
  weaknesses: Array<{ id: SubFactorId; label: string; pillar: PillarId; score: number; contribution: number }>;
  prior_base_rate: number;
  data_points: number;
}

interface Props {
  onResult: (data: PredictResponse & { client_name: string; deal_size: string; competitors: string[]; sub_scores: SubScores }) => void;
}

interface OpenDeal {
  id: number;
  client_name: string;
  industry: string | null;
  voter_count: number;
}

export default function PillarInputTab({ onResult }: Props) {
  const [clientName, setClientName] = useState('');
  const [dealSize, setDealSize] = useState('');
  const [industry, setIndustry] = useState('');
  const [expectedRevenue, setExpectedRevenue] = useState('');
  const [subs, setSubs] = useState<SubScores>(defaultSubScores());
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompIds, setSelectedCompIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openDeals, setOpenDeals] = useState<OpenDeal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [loadingVote, setLoadingVote] = useState(false);
  const [voteMsg, setVoteMsg] = useState('');

  useEffect(() => {
    fetch('/api/weights').then(r => r.json()).then(d => {
      if (d.competitors) setCompetitors(d.competitors);
    });
    fetch('/api/portfolio').then(r => r.json()).then(d => {
      if (d.deals) {
        setOpenDeals(d.deals.filter((x: { voter_count: number }) => x.voter_count > 0));
      }
    });
  }, []);

  const loadFromVoting = async (dealId: number) => {
    setLoadingVote(true);
    setVoteMsg('');
    try {
      const res = await fetch(`/api/vote-tally/${dealId}`);
      const d = await res.json();
      if (d.subs) {
        setSubs(d.subs);
        setSelectedDealId(dealId);
        setClientName(d.client_name ?? '');
        setVoteMsg(`${d.voter_count}명 Voting 결과 반영 (평균 spread ${d.average_spread?.toFixed(2) ?? '0'})`);
      } else {
        setVoteMsg('Voting 데이터 없음');
      }
    } catch {
      setVoteMsg('불러오기 실패');
    } finally {
      setLoadingVote(false);
    }
  };

  const pillarScores = pillarScoreFromSubs(subs);

  const setSub = (id: SubFactorId, val: number) =>
    setSubs(prev => ({ ...prev, [id]: val }));

  const toggleComp = (id: number) => {
    setSelectedCompIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) { setError('고객사명을 입력하세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          deal_size: dealSize || undefined,
          industry: industry || undefined,
          expected_revenue: expectedRevenue ? parseFloat(expectedRevenue) : undefined,
          sub_scores: subs,
          competitor_ids: Array.from(selectedCompIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onResult({
        ...data,
        client_name: clientName,
        deal_size: dealSize,
        competitors: competitors.filter(c => selectedCompIds.has(c.id)).map(c => c.name),
        sub_scores: subs,
      });
    } catch (e: unknown) {
      setError(String(e));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Voting 자동 입력 */}
      {openDeals.length > 0 && (
        <Card title="Voting 결과로 자동 입력 (선택사항)">
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', margin: '0 0 12px' }}>
            진행 중인 딜을 선택하면 팀 Voting 평균으로 Sub-Factor가 자동 채워집니다.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {openDeals.slice(0, 8).map(d => {
              const active = selectedDealId === d.id;
              return (
                <button key={d.id} onClick={() => loadFromVoting(d.id)} disabled={loadingVote}
                  style={{
                    padding: '6px 14px', borderRadius: '2px',
                    background: active ? 'var(--brand)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-mid)',
                    border: '1px solid ' + (active ? 'var(--brand)' : 'var(--border)'),
                    fontSize: '12px', cursor: loadingVote ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}>
                  {d.client_name}
                  <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '6px' }}>
                    {d.voter_count}명
                  </span>
                </button>
              );
            })}
          </div>
          {voteMsg && (
            <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '10px' }}>{voteMsg}</div>
          )}
        </Card>
      )}

      {/* Client Info */}
      <Card title="Client Info">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input label="고객사명 *" value={clientName} onChange={setClientName} placeholder="예: 하나은행" />
          <Input label="딜 규모" value={dealSize} onChange={setDealSize} placeholder="예: 50억" />
          <Input label="산업" value={industry} onChange={setIndustry} placeholder="예: 금융" />
          <Input label="예상 매출 (억)" value={expectedRevenue} onChange={setExpectedRevenue} placeholder="예: 50" />
        </div>
      </Card>

      {/* Competitors */}
      <Card title="경쟁사 (다중 선택)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {competitors.map(c => {
            const active = selectedCompIds.has(c.id);
            return (
              <button key={c.id} onClick={() => toggleComp(c.id)}
                style={{
                  padding: '6px 14px', borderRadius: '2px',
                  background: active ? 'var(--brand)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-mid)',
                  border: '1px solid ' + (active ? 'var(--brand)' : 'var(--border)'),
                  fontSize: '12px', cursor: 'pointer',
                }}>
                {c.name}
                <span style={{ fontSize: '10px', opacity: 0.65, marginLeft: '6px', fontFamily: 'var(--font-num)' }}>
                  {Math.round(c.current_elo)}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 5-Pillar Diagnosis */}
      <Card title="5-Pillar 진단">
        {/* 점수 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '28px' }}>
          {PILLAR_IDS.map(p => (
            <div key={p} style={{
              padding: '14px 12px',
              background: 'var(--surface2)',
              borderTop: `3px solid ${PILLAR_COLORS[p]}`,
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: PILLAR_COLORS[p], letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                {p}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {PILLAR_META[p].label}
              </div>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: '24px', color: PILLAR_COLORS[p], marginTop: '8px', fontWeight: 600 }}>
                {(pillarScores[p] * 100).toFixed(0)}
              </div>
              <div style={{ height: '3px', background: 'var(--border)', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pillarScores[p] * 100}%`, background: PILLAR_COLORS[p] }} />
              </div>
            </div>
          ))}
        </div>

        {/* Sub-factor 슬라이더 */}
        {PILLAR_IDS.map(p => (
          <div key={p} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '14px', paddingBottom: '8px',
              borderBottom: `1.5px solid ${PILLAR_COLORS[p]}`,
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: PILLAR_COLORS[p], letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                {p}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>
                {PILLAR_META[p].label}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {subFactorsOf(p).map(f => (
                <SubFactorRow key={f.id} factor={f} value={subs[f.id]} onChange={v => setSub(f.id, v)} color={PILLAR_COLORS[p]} />
              ))}
            </div>
          </div>
        ))}
      </Card>

      {error && (
        <div style={{
          background: 'rgba(204,34,34,0.06)', border: '1px solid var(--red)',
          borderRadius: '2px', padding: '12px 16px', color: 'var(--red)', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        style={{
          width: '100%', padding: '14px', border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--brand)',
          color: loading ? 'var(--text-dim)' : '#fff',
          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
          letterSpacing: '0.5px', borderRadius: '2px',
        }}>
        {loading ? '분석 중...' : 'Ensemble 확률 계산'}
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '2px', padding: '28px 32px' }}>
      <div style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px',
        textTransform: 'uppercase' as const, color: 'var(--brand)',
        borderBottom: '1.5px solid var(--brand)', paddingBottom: '8px', marginBottom: '20px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-mid)', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: '2px',
          padding: '9px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  );
}

function SubFactorRow({ factor, value, onChange, color }: {
  factor: { id: SubFactorId; label: string; description: string };
  value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text)' }}>{factor.label}</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[2, 5, 8].map((q, i) => (
            <button key={q} onClick={() => onChange(q)}
              style={{
                padding: '2px 8px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', border: 'none',
                background: value === q ? color : 'var(--surface2)',
                color: value === q ? '#fff' : 'var(--text-dim)',
                fontFamily: 'var(--font-sans)',
              }}>
              {['Low', 'Mid', 'High'][i]}
            </button>
          ))}
          <span style={{ fontFamily: 'var(--font-num)', color, fontSize: '15px', fontWeight: 600, minWidth: '22px', textAlign: 'right' as const }}>
            {value}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>{factor.description}</div>
      <input type="range" min={1} max={10} step={1} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}
