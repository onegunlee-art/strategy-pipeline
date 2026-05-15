'use client';

import { useEffect, useState } from 'react';
import {
  SubScores, SubFactorId, PillarId, PILLAR_META,
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

const PILLAR_COLORS: Record<PillarId, string> = {
  V: '#4dd0e1', P: '#81c784', D: '#ffb74d', E: '#ba68c8',
};

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
    // 진행 중 딜 (voting 있는 딜) 목록 — voting → predict 통합용
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
        setVoteMsg(`✓ ${d.voter_count}명 voting 결과 불러옴 (avg spread ${d.average_spread?.toFixed(2) ?? '0'})`);
      } else {
        setVoteMsg('voting 데이터 없음');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* VOTING → PREDICT */}
      {openDeals.length > 0 && (
        <Card title="VOTING 결과로 자동 입력 (선택사항)">
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>
            voting이 진행 중인 딜을 클릭하면 12개 sub-factor가 역할 가중평균으로 자동 채워집니다.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {openDeals.slice(0, 8).map(d => {
              const active = selectedDealId === d.id;
              return (
                <button key={d.id} onClick={() => loadFromVoting(d.id)} disabled={loadingVote}
                  style={{
                    padding: '8px 12px', borderRadius: '8px',
                    background: active ? 'var(--cyan)' : 'var(--surface2)',
                    color: active ? '#000' : 'var(--text)',
                    border: '1px solid ' + (active ? 'var(--cyan)' : 'var(--border)'),
                    fontSize: '12px', cursor: loadingVote ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                  <span>{d.client_name}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', opacity: 0.7 }}>
                    ({d.voter_count}명)
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

      {/* CLIENT INFO */}
      <Card title="CLIENT INFO">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input label="고객사명 *" value={clientName} onChange={setClientName} placeholder="예: KT 엔터프라이즈" />
          <Input label="딜 규모" value={dealSize} onChange={setDealSize} placeholder="예: 50억" />
          <Input label="산업" value={industry} onChange={setIndustry} placeholder="예: 공공/국방" />
          <Input label="예상 매출 (억)" value={expectedRevenue} onChange={setExpectedRevenue} placeholder="예: 50" />
        </div>
      </Card>

      {/* COMPETITORS */}
      <Card title="COMPETITORS (다중 선택)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {competitors.map(c => {
            const active = selectedCompIds.has(c.id);
            return (
              <button key={c.id} onClick={() => toggleComp(c.id)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  background: active ? 'var(--cyan)' : 'var(--surface2)',
                  color: active ? '#000' : 'var(--text)',
                  border: active ? 'none' : '1px solid var(--border)',
                  fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                <span>{c.name}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', opacity: 0.7 }}>
                  {Math.round(c.current_elo)}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 4-PILLAR SCORES */}
      <Card title="4-PILLAR DIAGNOSIS (Win Ratio = V × P × D × E)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {(['V', 'P', 'D', 'E'] as PillarId[]).map(p => (
            <div key={p} style={{
              padding: '14px', borderRadius: '8px',
              background: 'var(--surface2)', borderLeft: `3px solid ${PILLAR_COLORS[p]}`,
            }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: PILLAR_COLORS[p], letterSpacing: '1px' }}>
                {p}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '2px' }}>
                {PILLAR_META[p].label}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '22px', color: PILLAR_COLORS[p], marginTop: '8px' }}>
                {(pillarScores[p] * 100).toFixed(0)}
              </div>
              <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pillarScores[p] * 100}%`, background: PILLAR_COLORS[p] }} />
              </div>
            </div>
          ))}
        </div>

        {(['V', 'P', 'D', 'E'] as PillarId[]).map(p => (
          <div key={p} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '20px', height: '2px', background: PILLAR_COLORS[p] }} />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: PILLAR_COLORS[p], letterSpacing: '1px' }}>
                {p} — {PILLAR_META[p].label}
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
        <div style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px', color: 'var(--red)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        style={{
          width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'var(--surface2)' : 'var(--cyan)',
          color: loading ? 'var(--text-dim)' : '#000',
          fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
        }}>
        {loading ? 'CALCULATING (4-METHOD ENSEMBLE)...' : '▶  ENSEMBLE 확률 계산'}
      </button>
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

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-mid)', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none',
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
                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', border: 'none',
                background: value === q ? color : 'var(--surface2)',
                color: value === q ? '#000' : 'var(--text-dim)',
              }}>
              {['Low', 'Mid', 'High'][i]}
            </button>
          ))}
          <span style={{ fontFamily: 'IBM Plex Mono', color, fontSize: '15px', fontWeight: 600, minWidth: '24px', textAlign: 'right' }}>
            {value}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>{factor.description}</div>
      <input type="range" min={1} max={10} step={1} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}
