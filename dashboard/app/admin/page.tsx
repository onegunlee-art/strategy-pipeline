'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SUB_FACTORS, PILLAR_META, defaultSubScores, SubScores } from '@/lib/pillars';
import { ROLE_LABEL } from '@/lib/voteWeights';
import PillarInputTab from '@/components/PillarInputTab';
import EnsembleAnalysisTab from '@/components/EnsembleAnalysisTab';
import PortfolioTab from '@/components/PortfolioTab';
import ScenarioCompare from '@/components/ScenarioCompare';

type AdminTab = 'labels' | 'deals' | 'voters' | 'weights' | 'links' | 'import' | 'competitors' | 'rfp' | 'vote_analysis' | 'manual_edit' | 'analyze' | 'signal' | 'loss_report';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deal {
  id: number;
  client_name: string;
  deal_size: string | null;
  created_at: string;
  predicted_probability: number | null;
  actual_result: number | null;
  source: string | null;
}

interface Voter {
  id: number;
  deal_id: number;
  display_name: string;
  role: string;
  weight: number;
  vote_count: number;
  created_at: string;
}

interface VotingLink {
  deal_id: number;
  token: string;
  closes_at: string | null;
  created_at: string;
  client_name: string;
  deal_size: string | null;
  voter_count: number;
}

interface WeightInfo {
  ensemble: { pillar: number; bayesian: number; elo: number; monteCarlo: number; version: number };
  pillar: Record<string, number>;
  sub: Record<string, number>;
}

interface ImportRow {
  client_name: string;
  industry: string;
  risk: number;
  result: string;
  announced_at: string | null;
  profit_rate: number | null;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties,
  header: { borderBottom: '1px solid var(--border)', padding: '0 32px', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' } as React.CSSProperties,
  nav: { borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto' as const },
  content: { maxWidth: '1200px', margin: '0 auto', padding: '32px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', letterSpacing: '1px' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)' },
  btn: (color = 'var(--cyan)') => ({
    padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    background: color, color: '#fff',
    fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 600,
  } as React.CSSProperties),
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit' } as React.CSSProperties,
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' } as React.CSSProperties,
  mono: { fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '2px' } as React.CSSProperties,
};

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  return { ok: res.ok, data };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('labels');

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
  };

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'labels', label: 'Labels' },
    { id: 'deals', label: 'Deals' },
    { id: 'voters', label: 'Voters' },
    { id: 'weights', label: 'Weights' },
    { id: 'links', label: 'Links' },
    { id: 'import', label: 'Import' },
    { id: 'competitors', label: 'Competitors' },
    { id: 'rfp', label: 'RFP 등록' },
    { id: 'vote_analysis', label: '투표 분석' },
    { id: 'manual_edit', label: '수동 편집' },
    { id: 'analyze', label: '분석' },
    { id: 'signal', label: '시그널 입력' },
    { id: 'loss_report', label: '실주 보고' },
  ];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.mono}>ADMIN — WIN-RATIO ENGINE</div>
        <button onClick={handleLogout} style={{ ...S.btn('var(--surface2)'), color: 'var(--text-dim)' }}>
          LOGOUT
        </button>
      </header>

      <nav style={S.nav}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: tab === t.id ? '2px solid var(--cyan)' : '2px solid transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text-dim)',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', whiteSpace: 'nowrap',
          }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </nav>

      <main style={S.content}>
        {tab === 'labels' && <LabelsTab />}
        {tab === 'deals' && <DealsTab />}
        {tab === 'voters' && <VotersTab />}
        {tab === 'weights' && <WeightsTab />}
        {tab === 'links' && <LinksTab />}
        {tab === 'import' && <ImportTab />}
        {tab === 'competitors' && <CompetitorsTab />}
        {tab === 'rfp' && <RfpImportTab />}
        {tab === 'vote_analysis' && <VoteAnalysisTab />}
        {tab === 'manual_edit' && <ManualEditTab />}
        {tab === 'analyze' && <AnalyzeTab />}
        {tab === 'signal' && <SignalInputTab />}
        {tab === 'loss_report' && <LossReportTab />}
      </main>
    </div>
  );
}

// ─── Labels Tab ───────────────────────────────────────────────────────────────

function LabelsTab() {
  const [pillars, setPillars] = useState<Record<string, { label: string; description: string }>>(() =>
    Object.fromEntries(Object.entries(PILLAR_META).map(([k, v]) => [k, { label: v.label, description: v.description }]))
  );
  const [subs, setSubs] = useState<Record<string, { label: string; description: string }>>(() =>
    Object.fromEntries(SUB_FACTORS.map(f => [f.id, { label: f.label, description: f.description }]))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/labels').then(r => r.json()).then(d => {
      if (d.pillars) {
        setPillars(prev => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(d.pillars as Record<string, { label: string; description: string }>)) {
            if (next[k]) next[k] = { label: v.label, description: v.description };
          }
          return next;
        });
      }
      if (d.subFactors) {
        setSubs(prev => {
          const next = { ...prev };
          for (const f of d.subFactors as Array<{ id: string; label: string; description: string }>) {
            if (next[f.id]) next[f.id] = { label: f.label, description: f.description };
          }
          return next;
        });
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const updates = [
      ...Object.entries(pillars).flatMap(([k, v]) => [
        { scope: 'pillar', key: k, field: 'label', value: v.label },
        { scope: 'pillar', key: k, field: 'description', value: v.description },
      ]),
      ...Object.entries(subs).flatMap(([k, v]) => [
        { scope: 'sub_factor', key: k, field: 'label', value: v.label },
        { scope: 'sub_factor', key: k, field: 'description', value: v.description },
      ]),
    ];
    const { ok } = await apiFetch('/api/admin/labels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    setMsg(ok ? '저장 완료' : '저장 실패');
    setTimeout(() => setMsg(''), 2000);
  };

  const resetAll = async () => {
    for (const pid of Object.keys(PILLAR_META)) {
      await apiFetch('/api/admin/labels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'pillar', key: pid }),
      });
    }
    for (const f of SUB_FACTORS) {
      await apiFetch('/api/admin/labels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'sub_factor', key: f.id }),
      });
    }
    setPillars(Object.fromEntries(Object.entries(PILLAR_META).map(([k, v]) => [k, { label: v.label, description: v.description }])));
    setSubs(Object.fromEntries(SUB_FACTORS.map(f => [f.id, { label: f.label, description: f.description }])));
    setMsg('기본값으로 초기화됨');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.mono}>LABEL EDITOR</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {msg && <span style={{ fontSize: '12px', color: msg.includes('완료') || msg.includes('초기화') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
          <button onClick={resetAll} style={{ ...S.btn('var(--surface2)'), color: 'var(--text-dim)' }}>Reset to Default</button>
          <button onClick={save} disabled={saving} style={S.btn()}>
            {saving ? 'SAVING...' : '▶  SAVE ALL'}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>PILLARS (4)</div>
        {Object.entries(PILLAR_META).map(([pid]) => (
          <div key={pid} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 2fr', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--cyan)' }}>{pid}</span>
            <input style={{ ...S.input, width: '100%' }} value={pillars[pid]?.label ?? ''} onChange={e => setPillars(p => ({ ...p, [pid]: { ...p[pid], label: e.target.value } }))} />
            <input style={{ ...S.input, width: '100%' }} value={pillars[pid]?.description ?? ''} onChange={e => setPillars(p => ({ ...p, [pid]: { ...p[pid], description: e.target.value } }))} />
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>SUB-FACTORS (12)</div>
        {SUB_FACTORS.map(f => (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 2fr', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>{f.id}</span>
            <input style={{ ...S.input, width: '100%' }} value={subs[f.id]?.label ?? ''} onChange={e => setSubs(p => ({ ...p, [f.id]: { ...p[f.id], label: e.target.value } }))} />
            <input style={{ ...S.input, width: '100%' }} value={subs[f.id]?.description ?? ''} onChange={e => setSubs(p => ({ ...p, [f.id]: { ...p[f.id], description: e.target.value } }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Deals Tab ────────────────────────────────────────────────────────────────

function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/deals').then(r => r.json()).then(d => {
      setDeals(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingText />;

  return (
    <div style={S.card}>
      <div style={{ ...S.mono, marginBottom: '16px' }}>DEALS ({deals.length})</div>
      <table style={S.table}>
        <thead>
          <tr>
            {['ID', '고객사', '예측확률', '실제결과', '출처', '날짜'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map(d => (
            <tr key={d.id}>
              <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>{d.id}</td>
              <td style={S.td}>{d.client_name}</td>
              <td style={{ ...S.td, fontFamily: 'IBM Plex Mono' }}>
                {d.predicted_probability != null
                  ? <span style={{ color: d.predicted_probability >= 70 ? 'var(--green)' : d.predicted_probability >= 45 ? 'var(--yellow)' : 'var(--red)' }}>
                      {d.predicted_probability.toFixed(1)}%
                    </span>
                  : <span style={{ color: 'var(--text-dim)' }}>—</span>}
              </td>
              <td style={S.td}>
                {d.actual_result != null
                  ? <span style={{ color: d.actual_result === 1 ? 'var(--green)' : 'var(--red)', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>
                      {d.actual_result === 1 ? '수주' : '실주'}
                    </span>
                  : <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>미기록</span>}
              </td>
              <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>
                {d.source ?? 'manual'}
              </td>
              <td style={{ ...S.td, fontSize: '11px', color: 'var(--text-dim)' }}>
                {new Date(d.created_at).toLocaleDateString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deals.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>딜 데이터가 없습니다</div>}
    </div>
  );
}

// ─── Voters Tab ───────────────────────────────────────────────────────────────

interface Conflict {
  subFactorId: string;
  highRole: string; highVoter: string; highScore: number;
  lowRole: string; lowVoter: string; lowScore: number;
  gap: number; message: string;
}
interface HeatmapRow {
  voter_id: number; voter_name: string; role: string;
  scores: Record<string, number>;
}
interface TallyData {
  voter_count: number;
  vote_count: number;
  probability: number;
  average_spread: number;
  conflicts: Conflict[];
  heatmap: HeatmapRow[];
  spread: Record<string, number>;
}

function VotersTab() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [msg, setMsg] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
  const [tally, setTally] = useState<TallyData | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/voters').then(r => r.json()).then(d => {
      setVoters(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  const loadTally = useCallback((dealId: number) => {
    fetch(`/api/vote-tally/${dealId}`).then(r => r.json()).then(d => setTally(d));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (selectedDeal) loadTally(selectedDeal);
  }, [selectedDeal, loadTally]);

  const startEdit = (v: Voter) => {
    setEditId(v.id);
    setEditRole(v.role);
    setEditWeight(String(v.weight));
  };

  const saveEdit = async (id: number) => {
    await apiFetch('/api/admin/voters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: id, role: editRole, weight: Number(editWeight) }),
    });
    setEditId(null);
    setMsg('저장됨');
    setTimeout(() => setMsg(''), 1500);
    load();
  };

  const deleteVoter = async (id: number, name: string) => {
    if (!confirm(`"${name}" 투표자를 삭제하시겠습니까?`)) return;
    await apiFetch('/api/admin/voters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: id }),
    });
    load();
  };

  if (loading) return <LoadingText />;

  // 딜 ID별 voter 그룹화
  const dealIds = Array.from(new Set(voters.map(v => v.deal_id)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 딜 선택 — Heatmap / Conflict 조회용 */}
      {dealIds.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.mono, marginBottom: '12px' }}>VOTING DEAL — HEATMAP / CONFLICT 조회</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {dealIds.map(id => {
              const active = selectedDeal === id;
              const count = voters.filter(v => v.deal_id === id).length;
              return (
                <button key={id} onClick={() => setSelectedDeal(id)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px',
                    background: active ? 'var(--cyan)' : 'var(--surface2)',
                    color: active ? '#000' : 'var(--text)',
                    border: '1px solid ' + (active ? 'var(--cyan)' : 'var(--border)'),
                    fontFamily: 'IBM Plex Mono', fontSize: '11px', cursor: 'pointer',
                  }}>
                  Deal #{id} ({count}명)
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap + Conflict */}
      {tally && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={S.mono}>HEATMAP — Voter × Sub-factor</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>
              avg spread: {tally.average_spread?.toFixed(2) ?? '0'} · 확률 {(tally.probability * 100)?.toFixed(1)}%
            </div>
          </div>
          {tally.conflicts && tally.conflicts.length > 0 && (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tally.conflicts.map((c, i) => (
                <div key={i} style={{
                  padding: '8px 12px', background: 'rgba(217,119,6,0.08)',
                  borderRadius: '6px', borderLeft: '3px solid var(--yellow)',
                  fontSize: '12px',
                }}>
                  <strong style={{ color: 'var(--yellow)' }}>⚠ {c.subFactorId}</strong> — {c.message}
                </div>
              ))}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, position: 'sticky', left: 0, background: 'var(--surface)' }}>Voter</th>
                  <th style={S.th}>Role</th>
                  {Object.keys(tally.spread ?? {}).map(sub => (
                    <th key={sub} style={{ ...S.th, fontSize: '9px' }}>
                      {sub.replace(/^[vpde]_/, '')}
                      {tally.spread[sub] >= 2.0 && <span style={{ color: 'var(--yellow)' }}> ⚠</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tally.heatmap.map(row => (
                  <tr key={row.voter_id}>
                    <td style={{ ...S.td, position: 'sticky', left: 0, background: 'var(--surface)' }}>{row.voter_name}</td>
                    <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>{row.role}</td>
                    {Object.keys(tally.spread ?? {}).map(sub => {
                      const v = row.scores[sub];
                      const color = v == null ? 'var(--text-dim)'
                        : v >= 8 ? 'var(--green)' : v <= 3 ? 'var(--red)' : 'var(--text)';
                      return (
                        <td key={sub} style={{ ...S.td, textAlign: 'center', fontFamily: 'IBM Plex Mono', color }}>
                          {v ?? '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-dim)' }}>
            ⚠ = spread ≥ 2.0 (의견 분산 큼). 갈색 점 = 갈등 감지 (역할 간 갭 ≥ 4점)
          </div>
        </div>
      )}

      <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={S.mono}>VOTERS ({voters.length})</div>
        {msg && <span style={{ fontSize: '12px', color: 'var(--green)' }}>{msg}</span>}
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            {['Deal ID', '이름', '역할', 'Weight', '투표수', '작업'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {voters.map(v => (
            <tr key={v.id}>
              <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>{v.deal_id}</td>
              <td style={S.td}>{v.display_name}</td>
              <td style={S.td}>
                {editId === v.id
                  ? <select value={editRole} onChange={e => setEditRole(e.target.value)} style={S.input}>
                      {Object.entries(ROLE_LABEL).map(([id, label]) =>
                        <option key={id} value={id}>{label} ({id})</option>)}
                    </select>
                  : <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>{v.role}</span>}
              </td>
              <td style={S.td}>
                {editId === v.id
                  ? <input type="number" step="0.5" min="0.5" max="3" value={editWeight}
                      onChange={e => setEditWeight(e.target.value)}
                      style={{ ...S.input, width: '70px' }} />
                  : <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>{v.weight}</span>}
              </td>
              <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>{v.vote_count}/12</td>
              <td style={{ ...S.td, display: 'flex', gap: '6px' }}>
                {editId === v.id
                  ? <>
                      <button onClick={() => saveEdit(v.id)} style={S.btn()}>저장</button>
                      <button onClick={() => setEditId(null)} style={{ ...S.btn('var(--surface2)'), color: 'var(--text-dim)' }}>취소</button>
                    </>
                  : <>
                      <button onClick={() => startEdit(v)} style={{ ...S.btn('var(--surface2)'), color: 'var(--text)' }}>편집</button>
                      <button onClick={() => deleteVoter(v.id, v.display_name)} style={{ ...S.btn('var(--red)') }}>삭제</button>
                    </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {voters.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>투표자 없음</div>}
      </div>
    </div>
  );
}

// ─── Weights Tab ──────────────────────────────────────────────────────────────

function WeightsTab() {
  const [weights, setWeights] = useState<WeightInfo | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/weights').then(r => r.json()).then(d => setWeights(d));
  }, []);

  const retrain = async () => {
    setRetraining(true);
    setMsg('');
    const { ok, data } = await apiFetch('/api/retrain', { method: 'POST' });
    setRetraining(false);
    if (ok && data.ok) {
      setMsg(`재학습 완료 — v${data.version}, Brier: ${data.avg_brier?.toFixed(3)}`);
      fetch('/api/weights').then(r => r.json()).then(d => setWeights(d));
    } else {
      setMsg(data.message ?? data.error ?? '실패');
    }
  };

  if (!weights) return <LoadingText />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.mono}>MODEL WEIGHTS</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {msg && <span style={{ fontSize: '12px', color: msg.includes('완료') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
          <button onClick={retrain} disabled={retraining} style={S.btn()}>
            {retraining ? '재학습 중...' : '▶  AI 재학습'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={S.card}>
          <div style={{ ...S.mono, marginBottom: '16px' }}>ENSEMBLE (v{weights.ensemble.version})</div>
          {[
            ['Pillar ×', weights.ensemble.pillar],
            ['Bayesian', weights.ensemble.bayesian],
            ['Elo', weights.ensemble.elo],
            ['Monte Carlo', weights.ensemble.monteCarlo],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px' }}>{k}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{(Number(v) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={{ ...S.mono, marginBottom: '16px' }}>PILLAR WEIGHTS</div>
          {Object.entries(weights.pillar).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px' }}>{k}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{(Number(v) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>SUB-FACTOR WEIGHTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {SUB_FACTORS.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface2)', borderRadius: '6px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>{f.id}</span>
              <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>
                {((weights.sub[f.id] ?? f.defaultWeight) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Links Tab ────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function LinksTab() {
  const [links, setLinks] = useState<VotingLink[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [msg, setMsg] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/admin/voting-links').then(r => r.json()),
      fetch('/api/deals').then(r => r.json()),
    ]).then(([l, d]) => {
      setLinks(Array.isArray(l) ? l : []);
      setDeals(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePhone = (idx: number, val: string) => {
    setPhones(prev => prev.map((p, i) => i === idx ? formatPhone(val) : p));
  };
  const addPhone = () => setPhones(prev => prev.length < 10 ? [...prev, ''] : prev);
  const removePhone = (idx: number) => setPhones(prev => prev.filter((_, i) => i !== idx));

  const createLink = async () => {
    if (!selectedDeal) return;
    const filledPhones = phones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 10);
    const { data } = await apiFetch('/api/admin/voting-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: Number(selectedDeal),
        closes_at: closesAt || null,
        phones: filledPhones,
      }),
    });
    const smsPart = data?.sms_sent ? ` + 문자 ${data.sms_sent}건 발송` : '';
    setMsg(`링크 생성됨${smsPart}`);
    setTimeout(() => setMsg(''), 3000);
    setPhones(['']);
    load();
  };

  const deleteLink = async (dealId: number) => {
    await apiFetch('/api/admin/voting-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId }),
    });
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/vote/${token}`;
    navigator.clipboard.writeText(url);
    setMsg('링크 복사됨!');
    setTimeout(() => setMsg(''), 1500);
  };

  if (loading) return <LoadingText />;

  const dealsWithNoLink = deals.filter(d => !links.find(l => l.deal_id === d.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>새 투표 링크 생성</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} style={{ ...S.input, minWidth: '200px' }}>
              <option value="">딜 선택...</option>
              {dealsWithNoLink.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
              {deals.filter(d => links.find(l => l.deal_id === d.id)).map(d => (
                <option key={d.id} value={d.id}>{d.client_name} (재생성)</option>
              ))}
            </select>
            <input type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} style={S.input} placeholder="마감일 (선택)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>문자 수신 번호 (선택, 최대 10개)</div>
            {phones.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="tel"
                  value={p}
                  onChange={e => updatePhone(i, e.target.value)}
                  placeholder="010-0000-0000"
                  style={{ ...S.input, width: '160px' }}
                />
                {phones.length > 1 && (
                  <button onClick={() => removePhone(i)} style={{ ...S.btn('var(--red)'), padding: '4px 8px', fontSize: '11px' }}>✕</button>
                )}
              </div>
            ))}
            {phones.length < 10 && (
              <button onClick={addPhone} style={{ ...S.btn(), alignSelf: 'flex-start', fontSize: '11px', padding: '4px 10px' }}>+ 번호 추가</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={createLink} disabled={!selectedDeal} style={S.btn()}>▶  생성</button>
            {msg && <span style={{ fontSize: '12px', color: 'var(--green)' }}>{msg}</span>}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>활성 링크 ({links.length})</div>
        <table style={S.table}>
          <thead>
            <tr>{['딜', '참여자', '마감일', '생성일', '작업'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {links.map(l => (
              <tr key={l.deal_id}>
                <td style={S.td}>{l.client_name}</td>
                <td style={{ ...S.td, fontFamily: 'IBM Plex Mono' }}>{l.voter_count}명</td>
                <td style={{ ...S.td, fontSize: '11px', color: l.closes_at && new Date(l.closes_at) < new Date() ? 'var(--red)' : 'var(--text-dim)' }}>
                  {l.closes_at ? new Date(l.closes_at).toLocaleDateString('ko-KR') : '무기한'}
                </td>
                <td style={{ ...S.td, fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(l.created_at).toLocaleDateString('ko-KR')}</td>
                <td style={{ ...S.td, display: 'flex', gap: '6px' }}>
                  <button onClick={() => copyLink(l.token)} style={S.btn()}>링크 복사</button>
                  <button onClick={() => deleteLink(l.deal_id)} style={{ ...S.btn('var(--red)') }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {links.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>링크 없음</div>}
      </div>
    </div>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('var(--green)');

  const notify = (text: string, color = 'var(--green)') => {
    setMsg(text);
    setMsgColor(color);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleOcr = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    const { ok, data } = await apiFetch('/api/admin/import/ocr', { method: 'POST', body: fd });
    setLoading(false);
    if (ok && data.rows) {
      setRows(data.rows);
      notify(`OCR 완료 — ${data.count}행 추출됨. 검수 후 확정하세요.`);
    } else {
      notify(data.error ?? 'OCR 실패', 'var(--red)');
    }
  };

  const handleConfirm = async () => {
    if (!confirm(`${rows.length}건을 DB에 저장하시겠습니까? Drop/미종결건은 자동 제외됩니다.`)) return;
    setConfirming(true);
    const { ok, data } = await apiFetch('/api/admin/import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    setConfirming(false);
    if (ok) {
      notify(`${data.message}${data.retrained ? ' · 재학습 완료' : ''}`);
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } else {
      notify(data.error ?? '저장 실패', 'var(--red)');
    }
  };

  const updateRow = (i: number, field: keyof ImportRow, value: string | number | null) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const resultColor = (r: string) =>
    r === 'win' || r === '수의' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--text-dim)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>PDF / 이미지 OCR 임포트</div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' }}>
          수주/실주 현황 표가 포함된 PDF 또는 이미지를 업로드하면 Claude가 자동으로 데이터를 추출합니다.
          추출 후 테이블에서 셀을 직접 편집한 뒤 확정하세요.
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ ...S.btn('var(--cyan)'), color: '#000' }}
          >
            📁  파일 선택
          </button>
          <span style={{ fontSize: '13px', color: fileName ? 'var(--text)' : 'var(--text-dim)', minWidth: '200px' }}>
            {fileName || '선택된 파일 없음'}
          </span>
          <button onClick={handleOcr} disabled={loading || !fileName} style={S.btn()}>
            {loading ? 'OCR 분석 중...' : '▶  OCR 실행'}
          </button>
          {rows.length > 0 && (
            <button onClick={handleConfirm} disabled={confirming}
              style={S.btn('var(--green)')}>
              {confirming ? '저장 중...' : `▶  ${rows.length}건 확정 Import`}
            </button>
          )}
          {msg && <span style={{ fontSize: '12px', color: msgColor }}>{msg}</span>}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '12px' }}>RISK → SCORE 변환</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {([1,2,3,4,5] as const).map(r => {
            const score = Math.max(3, Math.round(10 - (r-1)*1.75));
            return (
              <div key={r} style={{ background: 'var(--surface2)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>Risk {r}</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: 'var(--cyan)' }}>{score}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>/ 10</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
          이 점수가 12개 sub-factor 모두에 동일하게 적용됩니다. drop·미종결(발표일 없음)은 자동 제외.
        </div>
      </div>

      {rows.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.mono, marginBottom: '16px' }}>검수 테이블 ({rows.length}행) — 셀을 클릭해 수정하세요</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['#', '사업명', '본부', 'Risk', '결과', '발표일', '이익율', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ opacity: (row.result === 'drop' || !row.announced_at) ? 0.4 : 1 }}>
                    <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>{i+1}</td>
                    <td style={S.td}>
                      <input value={row.client_name} onChange={e => updateRow(i, 'client_name', e.target.value)}
                        style={{ ...S.input, width: '180px' }} />
                    </td>
                    <td style={S.td}>
                      <input value={row.industry ?? ''} onChange={e => updateRow(i, 'industry', e.target.value)}
                        style={{ ...S.input, width: '120px' }} />
                    </td>
                    <td style={S.td}>
                      <input type="number" min={1} max={5} value={row.risk ?? 3}
                        onChange={e => updateRow(i, 'risk', Number(e.target.value))}
                        style={{ ...S.input, width: '50px' }} />
                    </td>
                    <td style={S.td}>
                      <select value={row.result} onChange={e => updateRow(i, 'result', e.target.value)}
                        style={{ ...S.input, color: resultColor(row.result) }}>
                        <option value="win">win</option>
                        <option value="수의">수의</option>
                        <option value="loss">loss</option>
                        <option value="drop">drop</option>
                        <option value="unknown">unknown</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <input type="date" value={row.announced_at ?? ''}
                        onChange={e => updateRow(i, 'announced_at', e.target.value || null)}
                        style={S.input} />
                    </td>
                    <td style={S.td}>
                      <input type="number" min={0} max={1} step={0.01}
                        value={row.profit_rate ?? ''}
                        onChange={e => updateRow(i, 'profit_rate', e.target.value ? Number(e.target.value) : null)}
                        style={{ ...S.input, width: '70px' }} placeholder="0.15" />
                    </td>
                    <td style={S.td}>
                      <button onClick={() => removeRow(i)} style={{ ...S.btn('var(--red)'), padding: '4px 8px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-dim)' }}>
            흐릿한 행(drop/발표일 없음)은 자동 제외됩니다.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Competitors Tab ──────────────────────────────────────────────────────────

interface Competitor { id: number; name: string; current_elo: number; match_count: number; }
interface AiEloEstimate { name: string; estimated_elo_range: [number, number]; summary: string; recent_wins: string[]; strength_areas: string[]; }
interface IndustryPrior { industry: string; win_rate: number; deal_count: number; }
interface AiPriorEstimate { industry: string; estimated_win_rate_range: [number, number]; summary: string; }

function CompetitorsTab() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiElo, setAiElo] = useState<Record<string, AiEloEstimate | null>>({});
  const [aiEloLoading, setAiEloLoading] = useState<Record<string, boolean>>({});
  const [industryPriors, setIndustryPriors] = useState<IndustryPrior[]>([]);
  const [aiPrior, setAiPrior] = useState<Record<string, AiPriorEstimate | null>>({});
  const [aiPriorLoading, setAiPriorLoading] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, priorRes] = await Promise.all([
        fetch('/api/admin/competitors'),
        fetch('/api/admin/industry-priors'),
      ]);
      if (compRes.ok) setCompetitors(await compRes.json());
      if (priorRes.ok) setIndustryPriors(await priorRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchAiElo = async (comp: Competitor) => {
    setAiEloLoading(p => ({ ...p, [comp.name]: true }));
    try {
      const res = await fetch(`/api/admin/ai-estimate?type=elo&name=${encodeURIComponent(comp.name)}`);
      const d = await res.json();
      setAiElo(p => ({ ...p, [comp.name]: d.estimate ?? null }));
    } catch { /* ignore */ }
    setAiEloLoading(p => ({ ...p, [comp.name]: false }));
  };

  const applyAiElo = async (comp: Competitor, estimate: AiEloEstimate) => {
    const midElo = Math.round((estimate.estimated_elo_range[0] + estimate.estimated_elo_range[1]) / 2);
    const res = await fetch('/api/admin/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: comp.id, current_elo: midElo }),
    });
    if (res.ok) {
      setMsg(`✓ ${comp.name} Elo → ${midElo} 적용됨 (AI 추정 중간값)`);
      load();
    }
  };

  const fetchAiPrior = async (industry: string) => {
    setAiPriorLoading(p => ({ ...p, [industry]: true }));
    try {
      const res = await fetch(`/api/admin/ai-estimate?type=prior&industry=${encodeURIComponent(industry)}`);
      const d = await res.json();
      setAiPrior(p => ({ ...p, [industry]: d.estimate ?? null }));
    } catch { /* ignore */ }
    setAiPriorLoading(p => ({ ...p, [industry]: false }));
  };

  const applyAiPrior = async (industry: string, estimate: AiPriorEstimate) => {
    const midRate = (estimate.estimated_win_rate_range[0] + estimate.estimated_win_rate_range[1]) / 2;
    const res = await fetch('/api/admin/labels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'prior', key: industry, field: 'win_rate', value: midRate.toFixed(3) }),
    });
    if (res.ok) {
      setMsg(`✓ ${industry} prior → ${(midRate * 100).toFixed(1)}% 적용됨 (AI 추정 중간값)`);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {msg && (
        <div style={{ padding: '10px 14px', background: 'rgba(129,199,132,0.12)', border: '1px solid var(--green)', borderRadius: '8px', fontSize: '12px', color: 'var(--green)' }}>
          {msg}
        </div>
      )}

      {/* 경쟁사 Elo 섹션 */}
      <div style={S.card}>
        <div style={{ ...S.mono, color: 'var(--cyan)', marginBottom: '16px' }}>
          COMPETITOR ELO 관리
          <span style={{ marginLeft: '12px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 400 }}>
            🟢 자체 DB 값 / 🟡 AI 추정 (Gemini, 참고용)
          </span>
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>경쟁사</th>
              <th style={S.th}>현재 Elo 🟢</th>
              <th style={S.th}>매치 수</th>
              <th style={S.th}>AI 추정 Elo 🟡</th>
              <th style={S.th}>액션</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(comp => {
              const est = aiElo[comp.name];
              const fetching = aiEloLoading[comp.name];
              return (
                <tr key={comp.id}>
                  <td style={S.td}>{comp.name}</td>
                  <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{comp.current_elo.toFixed(0)}</td>
                  <td style={{ ...S.td, color: 'var(--text-dim)' }}>{comp.match_count}</td>
                  <td style={S.td}>
                    {est ? (
                      <div>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--yellow)' }}>
                          {est.estimated_elo_range[0]}~{est.estimated_elo_range[1]}
                        </span>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{est.summary}</div>
                      </div>
                    ) : (
                      <button onClick={() => fetchAiElo(comp)} disabled={fetching}
                        style={{ ...S.btn('var(--surface2)'), fontSize: '10px', padding: '4px 8px' }}>
                        {fetching ? '조회 중...' : '🟡 AI 추정 보기'}
                      </button>
                    )}
                  </td>
                  <td style={S.td}>
                    {est && (
                      <button onClick={() => applyAiElo(comp, est)}
                        style={{ ...S.btn('var(--cyan)'), fontSize: '10px', padding: '4px 10px', color: '#000' }}>
                        적용
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-dim)' }}>
          ⚠️ &ldquo;적용&rdquo; 버튼을 눌러야만 AI 추정값이 실제 모델에 반영됩니다. 자동 주입되지 않습니다.
        </div>
      </div>

      {/* 산업별 Prior 섹션 */}
      <div style={S.card}>
        <div style={{ ...S.mono, color: 'var(--cyan)', marginBottom: '16px' }}>
          INDUSTRY PRIOR 관리
          <span style={{ marginLeft: '12px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 400 }}>
            🟢 자체 이력 기반 / 🟡 AI 시장 추정 (참고용)
          </span>
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>산업</th>
              <th style={S.th}>자체 Win율 🟢</th>
              <th style={S.th}>학습 딜 수</th>
              <th style={S.th}>AI 추정 Win율 🟡</th>
              <th style={S.th}>액션</th>
            </tr>
          </thead>
          <tbody>
            {industryPriors.map(ip => {
              const est = aiPrior[ip.industry];
              const fetching = aiPriorLoading[ip.industry];
              return (
                <tr key={ip.industry}>
                  <td style={S.td}>{ip.industry}</td>
                  <td style={{ ...S.td, fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>
                    {(ip.win_rate * 100).toFixed(1)}%
                  </td>
                  <td style={{ ...S.td, color: 'var(--text-dim)' }}>{ip.deal_count}</td>
                  <td style={S.td}>
                    {est ? (
                      <div>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--yellow)' }}>
                          {(est.estimated_win_rate_range[0] * 100).toFixed(0)}~{(est.estimated_win_rate_range[1] * 100).toFixed(0)}%
                        </span>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{est.summary}</div>
                      </div>
                    ) : (
                      <button onClick={() => fetchAiPrior(ip.industry)} disabled={fetching}
                        style={{ ...S.btn('var(--surface2)'), fontSize: '10px', padding: '4px 8px' }}>
                        {fetching ? '조회 중...' : '🟡 AI 추정 보기'}
                      </button>
                    )}
                  </td>
                  <td style={S.td}>
                    {est && (
                      <button onClick={() => applyAiPrior(ip.industry, est)}
                        style={{ ...S.btn('var(--cyan)'), fontSize: '10px', padding: '4px 10px', color: '#000' }}>
                        적용
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-dim)' }}>
          ⚠️ &ldquo;적용&rdquo; 버튼을 눌러야만 AI 추정값이 Bayesian prior에 반영됩니다. 자동 주입되지 않습니다.
        </div>
      </div>
    </div>
  );
}

// ─── RFP Import Tab ───────────────────────────────────────────────────────────

function RfpImportTab() {
  const [form, setForm] = useState({
    client_name: '',
    deal_size: '',
    industry: '',
    duration_months: '',
    risk: '',
    competitors: '',
    rfp_summary: '',
    strategy_memo: '',
    voting_days: '7',
  });
  const [rfpImportanceStars, setRfpImportanceStars] = useState(3);
  const [rfpBidTimeline, setRfpBidTimeline] = useState({ rfp_published: '', bid_deadline: '', pt_date: '', announcement_date: '' });
  const [rfpTeamSize, setRfpTeamSize] = useState('');
  const [rfpPartners, setRfpPartners] = useState<{ name: string; role: string; task_scope: string }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>(defaultSubScores());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean; deal_id: number; probability: number;
    method_probs: Record<string, number>;
    confidence_interval: { low: number; high: number };
    weaknesses: Array<{ id: string; label: string; pillar: string; score: number }>;
    voting_url: string; voting_token: string;
    pillar_scores: Record<string, number>;
  }>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const bidTl = {
        ...(rfpBidTimeline.rfp_published ? { rfp_published: rfpBidTimeline.rfp_published } : {}),
        ...(rfpBidTimeline.bid_deadline ? { bid_deadline: rfpBidTimeline.bid_deadline } : {}),
        ...(rfpBidTimeline.pt_date ? { pt_date: rfpBidTimeline.pt_date } : {}),
        ...(rfpBidTimeline.announcement_date ? { announcement_date: rfpBidTimeline.announcement_date } : {}),
      };
      const body = {
        client_name: form.client_name,
        deal_size: form.deal_size || undefined,
        industry: form.industry || undefined,
        duration_months: form.duration_months ? Number(form.duration_months) : undefined,
        risk: Number(form.risk),
        competitors: form.competitors.split(',').map(s => s.trim()).filter(Boolean),
        rfp_summary: form.rfp_summary || undefined,
        strategy_memo: form.strategy_memo || undefined,
        voting_days: Number(form.voting_days),
        sub_scores: scores,
        importance_stars: rfpImportanceStars,
        ...(Object.keys(bidTl).length > 0 ? { bid_timeline: bidTl } : {}),
        ...(rfpTeamSize ? { team_size: Number(rfpTeamSize) } : {}),
        ...(rfpPartners.filter(p => p.name).length > 0 ? { partners_list: rfpPartners.filter(p => p.name) } : {}),
      };
      const res = await fetch('/api/admin/rfp-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setResult(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const input = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{
          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--text)', padding: '8px 10px', borderRadius: '4px', fontSize: '13px',
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  );

  const probColor = (p: number) => p >= 60 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', color: 'var(--cyan)', marginBottom: '4px' }}>
          RFP 분석 → 딜 등록 & 수주 확률 산정
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          RFP 분석 결과를 15개 Sub-Factor 점수로 입력하면 4-Method Ensemble로 수주 확률을 계산하고 팀 투표 링크를 생성합니다.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* 기본 정보 */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '12px', letterSpacing: '1px' }}>
            DEAL INFO
          </div>
          {input('고객사명', 'client_name')}
          {input('사업 규모', 'deal_size')}
          {input('산업', 'industry')}
          {input('사업 기간 (개월)', 'duration_months', 'number')}
          {input('리스크 레벨 (1-5)', 'risk', 'number')}
          {input('경쟁사 (쉼표 구분, Elo 조회용)', 'competitors')}
          {input('투표 기간 (일)', 'voting_days', 'number')}

          {/* 중요도 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '6px' }}>중요도</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRfpImportanceStars(n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: n <= rfpImportanceStars ? 'var(--yellow)' : 'var(--border)', padding: '0 2px' }}>★</button>
              ))}
            </div>
          </div>

          {/* 입찰 일정 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '6px' }}>입찰 일정</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { label: '공고일', key: 'rfp_published' },
                { label: '마감일', key: 'bid_deadline' },
                { label: 'PT일', key: 'pt_date' },
                { label: '발표일', key: 'announcement_date' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</div>
                  <input type="date" value={rfpBidTimeline[key as keyof typeof rfpBidTimeline]}
                    onChange={e => setRfpBidTimeline(b => ({ ...b, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>
          </div>

          {/* 팀 규모 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>팀 규모 (명)</label>
            <input type="number" value={rfpTeamSize} onChange={e => setRfpTeamSize(e.target.value)} placeholder="예: 42"
              style={{ width: '120px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>

          {/* 파트너 + 과업범위 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '6px' }}>협력 파트너 구조</label>
            {rfpPartners.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={p.name} onChange={e => setRfpPartners(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="파트너명"
                  style={{ ...S.input, width: '110px', padding: '5px 8px', fontSize: '12px' }} />
                <input value={p.role} onChange={e => setRfpPartners(ps => ps.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="역할"
                  style={{ ...S.input, width: '90px', padding: '5px 8px', fontSize: '12px' }} />
                <input value={p.task_scope} onChange={e => setRfpPartners(ps => ps.map((x, j) => j === i ? { ...x, task_scope: e.target.value } : x))} placeholder="과업범위 (PM/QA/인프라...)"
                  style={{ ...S.input, width: '200px', padding: '5px 8px', fontSize: '12px' }} />
                <button onClick={() => setRfpPartners(ps => ps.filter((_, j) => j !== i))}
                  style={{ ...S.btn('var(--red)'), padding: '4px 8px', fontSize: '11px' }}>✕</button>
              </div>
            ))}
            <button onClick={() => setRfpPartners(ps => [...ps, { name: '', role: '', task_scope: '' }])}
              style={{ ...S.btn(), padding: '4px 12px', fontSize: '11px', marginTop: '4px' }}>+ 파트너</button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
              RFP 배경 요약
            </label>
            <textarea
              value={form.rfp_summary}
              onChange={e => setForm(f => ({ ...f, rfp_summary: e.target.value }))}
              rows={4}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '8px 10px', borderRadius: '4px', fontSize: '12px',
                fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
              전략 메모
            </label>
            <textarea
              value={form.strategy_memo}
              onChange={e => setForm(f => ({ ...f, strategy_memo: e.target.value }))}
              rows={4}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '8px 10px', borderRadius: '4px', fontSize: '12px',
                fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Sub-Factor 점수 */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '12px', letterSpacing: '1px' }}>
            15-FACTOR SCORES (1–10)
          </div>
          {SUB_FACTORS.map(f => {
            const pillarColors: Record<string, string> = {
              S: '#7c3aed', V: '#0ea5e9', D: '#10b981', P: '#f59e0b', E: '#ef4444',
            };
            const col = pillarColors[f.pillar] ?? 'var(--cyan)';
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '10px', color: col,
                  width: '16px', textAlign: 'center',
                }}>{f.pillar}</span>
                <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1, minWidth: 0 }}>{f.label}</span>
                <input
                  type="range" min={1} max={10} step={1}
                  value={scores[f.id] ?? 5}
                  onChange={e => setScores(s => ({ ...s, [f.id]: Number(e.target.value) }))}
                  style={{ width: '100px', accentColor: col }}
                />
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '13px',
                  color: (scores[f.id] ?? 5) >= 7 ? 'var(--green)' : (scores[f.id] ?? 5) >= 4 ? 'var(--yellow)' : 'var(--red)',
                  width: '20px', textAlign: 'right',
                }}>{scores[f.id] ?? 5}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 등록 버튼 */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={handleSubmit} disabled={loading}
          style={{
            padding: '12px 32px', background: loading ? 'var(--surface2)' : 'var(--cyan)',
            color: loading ? 'var(--text-dim)' : '#000', border: 'none', borderRadius: '4px',
            fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px',
          }}>
          {loading ? 'CALCULATING...' : '딜 등록 & 확률 산출'}
        </button>
        {error && <span style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</span>}
      </div>

      {/* 결과 */}
      {result && (
        <div style={{ marginTop: '32px', padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '24px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '48px', fontWeight: 700, color: probColor(result.probability) }}>
              {result.probability.toFixed(1)}%
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>수주 확률 (4-Method Ensemble)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                CI {result.confidence_interval.low.toFixed(0)}% – {result.confidence_interval.high.toFixed(0)}% &nbsp;|&nbsp; Deal #{result.deal_id}
              </div>
            </div>
          </div>

          {/* 4-Method Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {Object.entries(result.method_probs).map(([k, v]) => (
              <div key={k} style={{ padding: '12px', background: 'var(--surface2)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  {k.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: probColor(v as number) }}>
                  {(v as number).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* 약점 Top 3 */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--red)', fontFamily: 'IBM Plex Mono', marginBottom: '10px', letterSpacing: '1px' }}>
              ⚠ TOP 3 WEAKNESSES
            </div>
            {result.weaknesses.map((w, i) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--red)', width: '20px' }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{w.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--yellow)' }}>
                  [{w.pillar}] {w.score}/10
                </span>
              </div>
            ))}
          </div>

          {/* 투표 링크 */}
          <div style={{ padding: '16px', background: 'rgba(0,212,255,0.08)', border: '1px solid var(--cyan)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '8px', letterSpacing: '1px' }}>
              TEAM VOTING LINK
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <code style={{ fontSize: '13px', color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}{result.voting_url}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(
                  (typeof window !== 'undefined' ? window.location.origin : '') + result.voting_url
                )}
                style={{
                  padding: '6px 14px', background: 'var(--cyan)', color: '#000',
                  border: 'none', borderRadius: '4px', fontFamily: 'IBM Plex Mono',
                  fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                COPY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vote Analysis Tab ────────────────────────────────────────────────────────

interface VoteTally {
  deal_id: number;
  client_name: string;
  voter_count: number;
  vote_count: number;
  subs: Record<string, number>;
  spread: Record<string, number>;
  average_spread: number;
  pillar_scores: Record<string, number>;
  probability: number;
  confidence_interval: { p5: number; p95: number };
  conflicts: Array<{ subFactorId: string; highRole: string; highVoter: string; highScore: number; lowRole: string; lowVoter: string; lowScore: number; gap: number; message: string }>;
  heatmap: Array<{ voter_id: number; voter_name: string; role: string; scores: Record<string, number> }>;
}

const PILLAR_COLORS: Record<string, string> = { S: '#7c3aed', V: '#0ea5e9', D: '#10b981', P: '#f59e0b', E: '#ef4444' };

function scoreColor(score: number): string {
  if (score >= 8) return 'rgba(16,185,129,0.25)';
  if (score >= 6) return 'rgba(0,212,255,0.15)';
  if (score >= 4) return 'rgba(245,158,11,0.20)';
  return 'rgba(239,68,68,0.25)';
}

function VoteAnalysisTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

  useEffect(() => {
    fetch('/api/deals', { credentials: 'include' }).then(r => r.json()).then(setDeals).catch(() => {});
  }, []);

  const loadTally = async (dealId: number) => {
    setLoading(true); setTally(null); setApplyMsg('');
    const r = await fetch(`/api/vote-tally/${dealId}`, { credentials: 'include' });
    if (r.ok) setTally(await r.json());
    setLoading(false);
  };

  const handleDealChange = (id: number) => { setSelectedDeal(id); loadTally(id); };

  const applyToOfficial = async () => {
    if (!tally || !selectedDeal) return;
    setApplyMsg('처리 중...');
    const res = await fetch('/api/admin/rescore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: selectedDeal, sub_scores: tally.subs, memo: '투표 가중 평균 점수를 공식 예측에 반영' }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) setApplyMsg(`✅ 반영 완료 — 새 확률 ${data.probability.toFixed(1)}%`);
    else setApplyMsg(`❌ ${data.error}`);
  };

  const probColor = (p: number) => p >= 60 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', color: 'var(--cyan)' }}>VOTE ANALYSIS</div>
        <select
          value={selectedDeal ?? ''}
          onChange={e => handleDealChange(Number(e.target.value))}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: '4px', fontSize: '13px' }}
        >
          <option value="">딜 선택...</option>
          {deals.map(d => <option key={d.id} value={d.id}>#{d.id} {d.client_name}</option>)}
        </select>
        {loading && <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>LOADING...</span>}
      </div>

      {tally && (
        <>
          {/* 헤더 KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: '참여자', value: `${tally.voter_count}명` },
              { label: '총 투표', value: `${tally.vote_count}건` },
              { label: '평균 분산', value: tally.average_spread.toFixed(2), warn: tally.average_spread >= 2.0 },
              { label: '분쟁 항목', value: `${tally.conflicts.length}건`, warn: tally.conflicts.length > 0 },
              { label: '투표 기반 확률', value: `${(tally.probability * 100).toFixed(1)}%`, color: probColor(tally.probability * 100) },
            ].map(({ label, value, warn, color }) => (
              <div key={label} style={{ padding: '14px', background: warn ? 'rgba(239,68,68,0.08)' : 'var(--surface)', border: `1px solid ${warn ? 'var(--red)' : 'var(--border)'}`, borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '18px', color: color ?? (warn ? 'var(--red)' : 'var(--text)') }}>{value}</div>
              </div>
            ))}
          </div>

          {/* 분쟁 경고 */}
          {tally.conflicts.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--yellow)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--yellow)', fontFamily: 'IBM Plex Mono', marginBottom: '10px', letterSpacing: '1px' }}>⚠ 의견 분쟁 ({tally.conflicts.length}건)</div>
              {tally.conflicts.map((c, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '4px', display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--yellow)', fontFamily: 'IBM Plex Mono', minWidth: '160px' }}>{c.subFactorId}</span>
                  <span>{c.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* 필라 점수 바 */}
          <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {Object.entries(tally.pillar_scores).map(([p, score]) => {
              const pct = Math.round((score as number) * 100);
              return (
                <div key={p} style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: PILLAR_COLORS[p] ?? 'var(--cyan)', marginBottom: '8px' }}>{p} — {(PILLAR_META as Record<string, { label: string }>)[p]?.label ?? p}</div>
                  <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', marginBottom: '6px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: PILLAR_COLORS[p] ?? 'var(--cyan)', borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '16px', color: 'var(--text)' }}>{pct}%</div>
                </div>
              );
            })}
          </div>

          {/* 히트맵: 투표자 × Sub-Factor */}
          {tally.heatmap.length > 0 && (
            <div style={{ marginBottom: '24px', overflowX: 'auto' }}>
              <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '10px', letterSpacing: '1px' }}>VOTER HEATMAP</div>
              <table style={{ borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', background: 'var(--surface)', position: 'sticky', left: 0 }}>역할</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', background: 'var(--surface)', position: 'sticky', left: 60 }}>이름</th>
                    {SUB_FACTORS.map(f => (
                      <th key={f.id} style={{ padding: '4px 6px', color: PILLAR_COLORS[f.pillar] ?? 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '9px', background: 'var(--surface)', textAlign: 'center' }}>
                        {f.label.substring(0, 5)}
                      </th>
                    ))}
                    <th style={{ padding: '4px 8px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: 'var(--surface)', textAlign: 'center' }}>평균</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.heatmap.map(voter => {
                    const scores = SUB_FACTORS.map(f => voter.scores[f.id] ?? 0);
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    return (
                      <tr key={voter.voter_id}>
                        <td style={{ padding: '5px 10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: 'var(--surface)', position: 'sticky', left: 0, borderBottom: '1px solid var(--border)' }}>{voter.role}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text)', fontSize: '12px', background: 'var(--surface)', position: 'sticky', left: 60, borderBottom: '1px solid var(--border)' }}>{voter.voter_name}</td>
                        {SUB_FACTORS.map(f => {
                          const s = voter.scores[f.id];
                          return (
                            <td key={f.id} style={{ padding: '5px 6px', textAlign: 'center', background: s != null ? scoreColor(s) : 'transparent', color: s != null ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
                              {s ?? '—'}
                            </td>
                          );
                        })}
                        <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--cyan)', borderBottom: '1px solid var(--border)' }}>
                          {avg.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* 가중 평균 행 */}
                  <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
                    <td colSpan={2} style={{ padding: '6px 10px', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--cyan)' }}>가중 평균</td>
                    {SUB_FACTORS.map(f => {
                      const s = tally.subs[f.id];
                      return (
                        <td key={f.id} style={{ padding: '5px 6px', textAlign: 'center', background: s != null ? scoreColor(s) : 'transparent', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--cyan)', fontWeight: 700 }}>
                          {s?.toFixed(1) ?? '—'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--cyan)', fontWeight: 700 }}>
                      {(Object.values(tally.subs).reduce((a, b) => a + b, 0) / Object.values(tally.subs).length).toFixed(1)}
                    </td>
                  </tr>
                  {/* 분산 행 */}
                  <tr>
                    <td colSpan={2} style={{ padding: '6px 10px', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)' }}>분산 (σ)</td>
                    {SUB_FACTORS.map(f => {
                      const sp = tally.spread[f.id] ?? 0;
                      return (
                        <td key={f.id} style={{ padding: '5px 6px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '11px', color: sp >= 2 ? 'var(--red)' : 'var(--text-dim)' }}>
                          {sp.toFixed(1)}{sp >= 2 ? '⚠' : ''}
                        </td>
                      );
                    })}
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '11px', color: tally.average_spread >= 2 ? 'var(--red)' : 'var(--text-dim)' }}>
                      {tally.average_spread.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 공식 예측 반영 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={applyToOfficial} style={{ padding: '10px 24px', background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: '4px', fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
              투표 결과 → 공식 예측 반영
            </button>
            {applyMsg && <span style={{ fontSize: '13px', color: applyMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{applyMsg}</span>}
          </div>
        </>
      )}

      {!tally && !loading && selectedDeal && (
        <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '40px', textAlign: 'center' }}>투표 데이터가 없습니다.</div>
      )}
    </div>
  );
}

// ─── Manual Edit Tab ──────────────────────────────────────────────────────────

interface PredictionRow {
  id: number;
  sub_scores: Record<string, number> | null;
  predicted_probability: number;
  created_at: string;
}

function ManualEditTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
  const [latestPred, setLatestPred] = useState<PredictionRow | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [memo, setMemo] = useState('');
  const [traces, setTraces] = useState<Array<{ id: number; stage: string; decision: string; rationale: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ probability: number; method_probs: Record<string, number>; confidence_interval: { low: number; high: number }; weaknesses: Array<{ id: string; label: string; pillar: string; score: number }> } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/deals', { credentials: 'include' }).then(r => r.json()).then(setDeals).catch(() => {});
  }, []);

  const loadDeal = async (dealId: number) => {
    setLoading(true); setResult(null); setError(''); setLatestPred(null);
    try {
      const [predRes, traceRes] = await Promise.all([
        fetch(`/api/admin/deals/${dealId}/latest-prediction`, { credentials: 'include' }),
        fetch(`/api/admin/deals/${dealId}/traces`, { credentials: 'include' }),
      ]);
      if (predRes.ok) {
        const pred = await predRes.json();
        setLatestPred(pred);
        setScores(pred.sub_scores ?? Object.fromEntries(SUB_FACTORS.map(f => [f.id, 5])));
      } else {
        setScores(Object.fromEntries(SUB_FACTORS.map(f => [f.id, 5])));
      }
      if (traceRes.ok) setTraces(await traceRes.json());
    } finally {
      setLoading(false);
    }
  };

  const handleDealChange = (id: number) => { setSelectedDeal(id); loadDeal(id); };

  const handleSave = async () => {
    if (!selectedDeal) return;
    setSaving(true); setError(''); setResult(null);
    const res = await fetch('/api/admin/rescore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: selectedDeal, sub_scores: scores, memo: memo || undefined }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      setMemo('');
      loadDeal(selectedDeal);
    } else {
      setError(data.error ?? 'Unknown error');
    }
    setSaving(false);
  };

  const probColor = (p: number) => p >= 60 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', color: 'var(--cyan)' }}>MANUAL EDIT</div>
        <select
          value={selectedDeal ?? ''}
          onChange={e => handleDealChange(Number(e.target.value))}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: '4px', fontSize: '13px' }}
        >
          <option value="">딜 선택...</option>
          {deals.map(d => (
            <option key={d.id} value={d.id}>#{d.id} {d.client_name} {d.predicted_probability != null ? `(${d.predicted_probability.toFixed(1)}%)` : ''}</option>
          ))}
        </select>
        {loading && <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>LOADING...</span>}
      </div>

      {selectedDeal && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* 왼쪽: Sub-Factor 슬라이더 */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '12px', letterSpacing: '1px' }}>
              15-FACTOR SCORES
              {latestPred && (
                <span style={{ marginLeft: '12px', color: 'var(--text-dim)', fontSize: '10px' }}>
                  현재 예측: {latestPred.predicted_probability.toFixed(1)}% (예측 #{latestPred.id})
                </span>
              )}
            </div>
            {SUB_FACTORS.map(f => {
              const col = PILLAR_COLORS[f.pillar] ?? 'var(--cyan)';
              const val = scores[f.id] ?? 5;
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: col, width: '16px', textAlign: 'center' }}>{f.pillar}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
                  <input
                    type="range" min={1} max={10} step={1} value={val}
                    onChange={e => setScores(s => ({ ...s, [f.id]: Number(e.target.value) }))}
                    style={{ width: '100px', accentColor: col }}
                  />
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: '13px', width: '20px', textAlign: 'right',
                    color: val >= 7 ? 'var(--green)' : val >= 4 ? 'var(--yellow)' : 'var(--red)',
                  }}>{val}</span>
                </div>
              );
            })}
          </div>

          {/* 오른쪽: 메모 + 이력 + 결과 */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginBottom: '12px', letterSpacing: '1px' }}>편집 메모 (전략 레포트)</div>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="이번 점수 수정 이유, 전략 변경 사항, 추가 인사이트..."
              rows={5}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '10px', borderRadius: '4px', fontSize: '12px',
                fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: '16px',
              }}
            />

            <button
              onClick={handleSave} disabled={saving}
              style={{
                width: '100%', padding: '12px', background: saving ? 'var(--surface2)' : 'var(--cyan)',
                color: saving ? 'var(--text-dim)' : '#000', border: 'none', borderRadius: '4px',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                marginBottom: '16px',
              }}
            >
              {saving ? 'RECALCULATING...' : '저장 & 재계산'}
            </button>

            {error && <div style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

            {result && (
              <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '20px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '32px', color: probColor(result.probability), marginBottom: '8px' }}>
                  {result.probability.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px' }}>
                  CI {result.confidence_interval.low.toFixed(0)}–{result.confidence_interval.high.toFixed(0)}%
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '12px' }}>
                  {Object.entries(result.method_probs).map(([k, v]) => (
                    <div key={k} style={{ padding: '6px 10px', background: 'var(--surface2)', borderRadius: '4px' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: 'var(--text-dim)' }}>{k.toUpperCase()}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', color: probColor(v as number), marginLeft: '8px' }}>{(v as number).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--red)', fontFamily: 'IBM Plex Mono', marginBottom: '6px' }}>⚠ TOP WEAKNESSES</div>
                {result.weaknesses.map((w, i) => (
                  <div key={w.id} style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '3px' }}>
                    {i + 1}. [{w.pillar}] {w.label} — {w.score}/10
                  </div>
                ))}
              </div>
            )}

            {/* 편집 이력 */}
            {traces.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '10px', letterSpacing: '1px' }}>편집 이력</div>
                {traces.slice(0, 5).map(t => (
                  <div key={t.id} style={{ padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--cyan)' }}>{t.stage} / {t.decision}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{new Date(t.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    {t.rationale && <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>{t.rationale}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard metadata (partners / risks / milestones / positioning) */}
      {selectedDeal && !loading && (
        <DashboardMetaSection dealId={selectedDeal} />
      )}
    </div>
  );
}

// ─── Dashboard Metadata Edit Tab ─────────────────────────────────────────────

interface PartnerRow { name: string; role: string; description: string; task_scope: string; category: string; ratio_pct: string }
interface RiskRow { name: string; probability: string; impact: string; difficulty: string; level: string }
interface MilestoneRow { date: string; label: string; type: string }
interface CompPos { selfX: string; selfY: string; competitors: { name: string; x: string; y: string; size: string; notes: string; risk_level: string }[] }
interface BidTimelineRow { rfp_published: string; bid_deadline: string; pt_date: string; announcement_date: string }
interface WinningRow { customer_cfs: string; winning_point: string }
interface OrgRow { division: string; hq: string; dept: string; team: string; role: string; count: string }
interface VdcBRow { decision: string; detail: string }
interface QnaRow { question: string; answer: string }

function DashboardMetaSection({ dealId }: { dealId: number }) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [pos, setPos] = useState<CompPos>({ selfX: '', selfY: '', competitors: [] });
  const [importanceStars, setImportanceStars] = useState(3);
  const [bidTimeline, setBidTimeline] = useState<BidTimelineRow>({ rfp_published: '', bid_deadline: '', pt_date: '', announcement_date: '' });
  const [teamSize, setTeamSize] = useState('');
  // v1.1: SG 양식 완성 필드
  const [expectedRevenue, setExpectedRevenue] = useState('');
  const [marginRate, setMarginRate] = useState('');
  const [contributionMargin, setContributionMargin] = useState('');
  const [subcontractRate, setSubcontractRate] = useState('');
  const [riskGrade, setRiskGrade] = useState('');
  const [ptFormat, setPtFormat] = useState('');
  const [evalCriteria, setEvalCriteria] = useState('');
  const [winningPoints, setWinningPoints] = useState<WinningRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [vdcB, setVdcB] = useState<VdcBRow[]>([]);
  const [qna, setQna] = useState<QnaRow[]>([]);
  // v1.2: Pillar 사유·대응 수동 편집
  const [pillarRationale, setPillarRationale] = useState<Record<string, { reason: string; action: string }>>({
    S: { reason: '', action: '' }, V: { reason: '', action: '' },
    D: { reason: '', action: '' }, P: { reason: '', action: '' }, E: { reason: '', action: '' },
  });
  const [loadingLlm, setLoadingLlm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard/${dealId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.deal) return;
        setPartners((d.deal.partners ?? []).map((p: { name: string; role: string; description?: string; task_scope?: string; category?: string; ratio_pct?: number }) => ({ name: p.name || '', role: p.role || '', description: p.description || '', task_scope: p.task_scope || '', category: p.category || '', ratio_pct: p.ratio_pct != null ? String(p.ratio_pct) : '' })));
        setRisks((d.deal.risks ?? []).map((r: { name: string; probability: number; impact: number; difficulty: number; level: string }) => ({ name: r.name || '', probability: String(r.probability ?? ''), impact: String(r.impact ?? ''), difficulty: String(r.difficulty ?? ''), level: r.level || 'medium' })));
        setMilestones((d.deal.milestones ?? []).map((m: { date: string; label: string; type: string }) => ({ date: m.date || '', label: m.label || '', type: m.type || 'event' })));
        const cp = d.deal.competitive_positioning ?? {};
        setPos({
          selfX: String(cp.self?.x ?? ''),
          selfY: String(cp.self?.y ?? ''),
          competitors: (cp.competitors ?? []).map((c: { name: string; x: number; y: number; size?: string; notes?: string; risk_level?: string }) => ({ name: c.name || '', x: String(c.x ?? ''), y: String(c.y ?? ''), size: c.size || 'medium', notes: c.notes || '', risk_level: c.risk_level || 'medium' })),
        });
        setImportanceStars(d.deal.importance_stars ?? 3);
        const bt = d.deal.bid_timeline ?? {};
        setBidTimeline({
          rfp_published: bt.rfp_published ? bt.rfp_published.slice(0, 10) : '',
          bid_deadline: bt.bid_deadline ? bt.bid_deadline.slice(0, 10) : '',
          pt_date: bt.pt_date ? bt.pt_date.slice(0, 10) : '',
          announcement_date: bt.announcement_date ? bt.announcement_date.slice(0, 10) : '',
        });
        setTeamSize(d.deal.team_size ? String(d.deal.team_size) : '');
        // v1.1 필드 로드
        setExpectedRevenue(d.deal.expected_revenue != null ? String(d.deal.expected_revenue) : '');
        setMarginRate(d.deal.margin_rate != null ? String(d.deal.margin_rate) : '');
        setContributionMargin(d.deal.contribution_margin != null ? String(d.deal.contribution_margin) : '');
        setSubcontractRate(d.deal.subcontract_rate != null ? String(d.deal.subcontract_rate) : '');
        setRiskGrade(d.deal.risk_grade || '');
        setPtFormat(d.deal.pt_format || '');
        setEvalCriteria(d.deal.customer_eval_criteria || '');
        setWinningPoints((d.deal.winning_points ?? []).map((w: { customer_cfs?: string; winning_point?: string }) => ({ customer_cfs: w.customer_cfs || '', winning_point: w.winning_point || '' })));
        setOrgRows((d.deal.team_members ?? []).map((m: { division?: string; hq?: string; dept?: string; team?: string; role?: string; count?: number; name?: string }) => ({ division: m.division || '', hq: m.hq || '', dept: m.dept || m.name || '', team: m.team || '', role: m.role || '', count: m.count != null ? String(m.count) : '' })));
        setVdcB((d.deal.vdc_b_result ?? []).map((v: { decision?: string; detail?: string }) => ({ decision: v.decision || '', detail: v.detail || '' })));
        setQna((d.deal.qna_items ?? []).map((q: { question?: string; answer?: string }) => ({ question: q.question || '', answer: q.answer || '' })));
        const pr = d.deal.pillar_rationale ?? {};
        setPillarRationale({
          S: { reason: pr.S?.reason || '', action: pr.S?.action || '' },
          V: { reason: pr.V?.reason || '', action: pr.V?.action || '' },
          D: { reason: pr.D?.reason || '', action: pr.D?.action || '' },
          P: { reason: pr.P?.reason || '', action: pr.P?.action || '' },
          E: { reason: pr.E?.reason || '', action: pr.E?.action || '' },
        });
        setLoaded(true);
      }).catch(() => setLoaded(true));
  }, [dealId]);

  const save = async () => {
    setSaving(true);
    const payload = {
      partners: partners.filter(p => p.name).map(p => ({ name: p.name, role: p.role, description: p.description, task_scope: p.task_scope || undefined, ...(p.category ? { category: p.category } : {}), ...(p.ratio_pct ? { ratio_pct: parseFloat(p.ratio_pct) || 0 } : {}) })),
      risks: risks.filter(r => r.name).map(r => ({
        name: r.name, level: r.level,
        probability: parseFloat(r.probability) || 0,
        impact: parseFloat(r.impact) || 0,
        difficulty: parseFloat(r.difficulty) || 0,
      })),
      milestones: milestones.filter(m => m.date && m.label).map(m => ({ date: m.date, label: m.label, type: m.type })),
      competitive_positioning: {
        ...(pos.selfX || pos.selfY ? { self: { x: parseFloat(pos.selfX) || 0, y: parseFloat(pos.selfY) || 0 } } : {}),
        competitors: pos.competitors.filter(c => c.name).map(c => ({
          name: c.name, size: c.size,
          x: parseFloat(c.x) || 0, y: parseFloat(c.y) || 0,
          ...(c.notes ? { notes: c.notes } : {}),
          ...(c.risk_level ? { risk_level: c.risk_level } : {}),
        })),
      },
      importance_stars: importanceStars,
      bid_timeline: {
        ...(bidTimeline.rfp_published ? { rfp_published: bidTimeline.rfp_published } : {}),
        ...(bidTimeline.bid_deadline ? { bid_deadline: bidTimeline.bid_deadline } : {}),
        ...(bidTimeline.pt_date ? { pt_date: bidTimeline.pt_date } : {}),
        ...(bidTimeline.announcement_date ? { announcement_date: bidTimeline.announcement_date } : {}),
      },
      ...(teamSize ? { team_size: parseInt(teamSize) || null } : {}),
      // v1.1: SG 양식 완성 필드
      ...(expectedRevenue ? { expected_revenue: parseFloat(expectedRevenue) || null } : {}),
      ...(marginRate ? { margin_rate: parseFloat(marginRate) || null } : {}),
      ...(contributionMargin ? { contribution_margin: parseFloat(contributionMargin) || null } : {}),
      ...(subcontractRate ? { subcontract_rate: parseFloat(subcontractRate) || null } : {}),
      risk_grade: riskGrade || null,
      pt_format: ptFormat || null,
      customer_eval_criteria: evalCriteria || null,
      winning_points: winningPoints.filter(w => w.winning_point).map(w => ({ customer_cfs: w.customer_cfs, winning_point: w.winning_point })),
      team_members: orgRows.filter(m => m.dept || m.team || m.role).map(m => ({ division: m.division, hq: m.hq, dept: m.dept, team: m.team, role: m.role, ...(m.count ? { count: parseInt(m.count) || 0 } : {}) })),
      vdc_b_result: vdcB.filter(v => v.decision || v.detail).map(v => ({ decision: v.decision, detail: v.detail })),
      qna_items: qna.filter(q => q.question || q.answer).map(q => ({ question: q.question, answer: q.answer })),
      pillar_rationale: pillarRationale,
    };
    const res = await fetch(`/api/admin/deals/${dealId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setMsg(res.ok ? '✅ 저장됨' : '❌ 실패');
    setTimeout(() => setMsg(''), 3000);
  };

  if (!loaded) return <div style={{ padding: '20px', fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>로딩...</div>;

  const sectionLabel: React.CSSProperties = { fontSize: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--cyan)', letterSpacing: '1px', marginTop: '20px', marginBottom: '8px' };
  const addBtn: React.CSSProperties = { ...S.btn(), padding: '4px 10px', fontSize: '11px', marginTop: '6px' };
  const delBtn: React.CSSProperties = { ...S.btn('var(--red)'), padding: '4px 8px', fontSize: '11px' };
  const inp = (val: string, onChange: (v: string) => void, ph = '', width = '140px') => (
    <input value={val} onChange={e => onChange(e.target.value)} placeholder={ph}
      style={{ ...S.input, width, fontSize: '12px', padding: '4px 8px' }} />
  );

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '1px', marginBottom: '4px' }}>DASHBOARD METADATA</div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '16px' }}>보고서 전 섹션 — 저장 후 대시보드에 반영됩니다.</div>

      {/* 프로젝트 기본정보 */}
      <div style={sectionLabel}>프로젝트 중요도 & 입찰 일정</div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>중요도</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setImportanceStars(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: n <= importanceStars ? 'var(--yellow)' : 'var(--border)', padding: '0 1px' }}>
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>공고일</div>
          <input type="date" value={bidTimeline.rfp_published} onChange={e => setBidTimeline(b => ({ ...b, rfp_published: e.target.value }))} style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>입찰 마감</div>
          <input type="date" value={bidTimeline.bid_deadline} onChange={e => setBidTimeline(b => ({ ...b, bid_deadline: e.target.value }))} style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>PT일</div>
          <input type="date" value={bidTimeline.pt_date} onChange={e => setBidTimeline(b => ({ ...b, pt_date: e.target.value }))} style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>발표일</div>
          <input type="date" value={bidTimeline.announcement_date} onChange={e => setBidTimeline(b => ({ ...b, announcement_date: e.target.value }))} style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>팀 규모(명)</div>
          <input type="number" value={teamSize} onChange={e => setTeamSize(e.target.value)} placeholder="예: 42" style={{ ...S.input, padding: '4px 8px', fontSize: '12px', width: '80px' }} />
        </div>
      </div>

      {/* Partners */}
      <div style={sectionLabel}>파트너 구조</div>
      {partners.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(p.name, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, name: v } : x)), '파트너명', '110px')}
          {inp(p.role, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, role: v } : x)), '역할', '90px')}
          {inp(p.description, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, description: v } : x)), '설명', '140px')}
          {inp(p.task_scope, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, task_scope: v } : x)), '과업 범위 (예: PM/QA/인프라)', '180px')}
          {inp(p.category, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, category: v } : x)), '구분 (예: 주관/협력)', '110px')}
          {inp(p.ratio_pct, v => setPartners(ps => ps.map((x, j) => j === i ? { ...x, ratio_pct: v } : x)), '비율%', '60px')}
          <button onClick={() => setPartners(ps => ps.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setPartners(ps => [...ps, { name: '', role: '', description: '', task_scope: '', category: '', ratio_pct: '' }])} style={addBtn}>+ 파트너</button>

      {/* Risks */}
      <div style={sectionLabel}>리스크 항목</div>
      {risks.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(r.name, v => setRisks(rs => rs.map((x, j) => j === i ? { ...x, name: v } : x)), '리스크명', '140px')}
          {inp(r.probability, v => setRisks(rs => rs.map((x, j) => j === i ? { ...x, probability: v } : x)), '발생가능성(0-1)', '100px')}
          {inp(r.impact, v => setRisks(rs => rs.map((x, j) => j === i ? { ...x, impact: v } : x)), '사업영향도(0-1)', '100px')}
          {inp(r.difficulty, v => setRisks(rs => rs.map((x, j) => j === i ? { ...x, difficulty: v } : x)), '대응난이도(0-1)', '100px')}
          <select value={r.level} onChange={e => setRisks(rs => rs.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}
            style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <button onClick={() => setRisks(rs => rs.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setRisks(rs => [...rs, { name: '', probability: '0.5', impact: '0.5', difficulty: '0.5', level: 'medium' }])} style={addBtn}>+ 리스크</button>

      {/* Milestones */}
      <div style={sectionLabel}>입찰 타임라인 마일스톤</div>
      {milestones.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center' }}>
          <input type="date" value={m.date} onChange={e => setMilestones(ms => ms.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
            style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }} />
          {inp(m.label, v => setMilestones(ms => ms.map((x, j) => j === i ? { ...x, label: v } : x)), '마일스톤명', '140px')}
          <select value={m.type} onChange={e => setMilestones(ms => ms.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
            style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }}>
            <option value="event">event</option>
            <option value="deadline">deadline</option>
            <option value="today">today</option>
          </select>
          <button onClick={() => setMilestones(ms => ms.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setMilestones(ms => [...ms, { date: '', label: '', type: 'event' }])} style={addBtn}>+ 마일스톤</button>

      {/* Positioning */}
      <div style={sectionLabel}>경쟁 포지셔닝 (x=기술차별화 0-10, y=고객관계 0-10)</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '36px' }}>자사</span>
        {inp(pos.selfX, v => setPos(p => ({ ...p, selfX: v })), 'X 기술', '80px')}
        {inp(pos.selfY, v => setPos(p => ({ ...p, selfY: v })), 'Y 고객', '80px')}
      </div>
      {pos.competitors.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '36px' }}>경쟁사</span>
          {inp(c.name, v => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, name: v } : x) })), '경쟁사명', '110px')}
          {inp(c.x, v => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, x: v } : x) })), 'X', '50px')}
          {inp(c.y, v => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, y: v } : x) })), 'Y', '50px')}
          <select value={c.size} onChange={e => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, size: e.target.value } : x) }))}
            style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }}>
            <option value="large">large</option>
            <option value="medium">medium</option>
            <option value="small">small</option>
          </select>
          <select value={c.risk_level} onChange={e => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, risk_level: e.target.value } : x) }))}
            style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }}>
            <option value="high">위협높음</option>
            <option value="medium">보통</option>
            <option value="low">위협낮음</option>
          </select>
          {inp(c.notes, v => setPos(p => ({ ...p, competitors: p.competitors.map((x, j) => j === i ? { ...x, notes: v } : x) })), '전략 메모 (ISP 수행, 락인 우려 등)', '220px')}
          <button onClick={() => setPos(p => ({ ...p, competitors: p.competitors.filter((_, j) => j !== i) }))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setPos(p => ({ ...p, competitors: [...p.competitors, { name: '', x: '5', y: '5', size: 'medium', notes: '', risk_level: 'medium' }] }))} style={addBtn}>+ 경쟁사</button>

      {/* KT 매출 지표 */}
      <div style={sectionLabel}>KT 매출 지표</div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
        <div><div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>매출액(억)</div>{inp(expectedRevenue, setExpectedRevenue, '예: 120', '90px')}</div>
        <div><div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>영업이익률(%)</div>{inp(marginRate, setMarginRate, '예: 8', '90px')}</div>
        <div><div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>공헌이익률(%)</div>{inp(contributionMargin, setContributionMargin, '예: 15', '90px')}</div>
        <div><div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>하도율(%)</div>{inp(subcontractRate, setSubcontractRate, '예: 40', '90px')}</div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>리스크등급</div>
          <select value={riskGrade} onChange={e => setRiskGrade(e.target.value)} style={{ ...S.input, padding: '4px 8px', fontSize: '12px' }}>
            <option value="">-</option>
            {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* 제안발표회 · 고객 평가기준 */}
      <div style={sectionLabel}>제안발표회 · 고객 평가기준</div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>제안발표회 형식</div>
        {inp(ptFormat, setPtFormat, '예: 20분 PT + 20분 Q&A', '320px')}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>고객 평가기준</div>
        <textarea value={evalCriteria} onChange={e => setEvalCriteria(e.target.value)} placeholder="평가위원 구성, RFP 배점 기준 등"
          style={{ ...S.input, width: '100%', minHeight: '60px', fontSize: '12px', padding: '6px 8px', resize: 'vertical' }} />
      </div>

      {/* Winning 포인트 (CFS ↔ 포인트) */}
      <div style={sectionLabel}>Winning 포인트 (고객 핵심성공요소 ↔ Winning 포인트)</div>
      {winningPoints.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(w.customer_cfs, v => setWinningPoints(ws => ws.map((x, j) => j === i ? { ...x, customer_cfs: v } : x)), '고객 핵심성공요소', '240px')}
          <span style={{ color: 'var(--text-dim)' }}>→</span>
          {inp(w.winning_point, v => setWinningPoints(ws => ws.map((x, j) => j === i ? { ...x, winning_point: v } : x)), 'Winning 포인트', '280px')}
          <button onClick={() => setWinningPoints(ws => ws.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setWinningPoints(ws => [...ws, { customer_cfs: '', winning_point: '' }])} style={addBtn}>+ Winning 포인트</button>

      {/* 조직 구성 (제안/이행 담당) */}
      <div style={sectionLabel}>제안/이행 담당 조직 (부문/본부/담당/팀/역할/명수)</div>
      {orgRows.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(m.division, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, division: v } : x)), '부문', '90px')}
          {inp(m.hq, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, hq: v } : x)), '본부', '90px')}
          {inp(m.dept, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, dept: v } : x)), '담당', '90px')}
          {inp(m.team, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, team: v } : x)), '팀', '90px')}
          {inp(m.role, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, role: v } : x)), '역할', '110px')}
          {inp(m.count, v => setOrgRows(rs => rs.map((x, j) => j === i ? { ...x, count: v } : x)), '명수', '60px')}
          <button onClick={() => setOrgRows(rs => rs.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setOrgRows(rs => [...rs, { division: '', hq: '', dept: '', team: '', role: '', count: '' }])} style={addBtn}>+ 조직</button>

      {/* Pillar 사유·개선 액션 */}
      <div style={sectionLabel}>Pillar 사유·개선 액션 (LLM 초안 또는 수동)</div>
      <button
        onClick={async () => {
          setLoadingLlm(true);
          try {
            const res = await fetch(`/api/report/${dealId}`, { method: 'POST', credentials: 'include' });
            const json = await res.json();
            if (json.pillar_rationale && typeof json.pillar_rationale === 'object') {
              const pr = json.pillar_rationale;
              setPillarRationale({
                S: { reason: pr.S?.reason || '', action: pr.S?.action || '' },
                V: { reason: pr.V?.reason || '', action: pr.V?.action || '' },
                D: { reason: pr.D?.reason || '', action: pr.D?.action || '' },
                P: { reason: pr.P?.reason || '', action: pr.P?.action || '' },
                E: { reason: pr.E?.reason || '', action: pr.E?.action || '' },
              });
            }
          } catch { /* ignore */ }
          setLoadingLlm(false);
        }}
        disabled={loadingLlm}
        style={{ ...S.btn(), padding: '4px 12px', fontSize: '11px', marginBottom: '10px' }}
      >
        {loadingLlm ? '불러오는 중...' : 'LLM 초안 채우기'}
      </button>
      {(['S', 'V', 'D', 'P', 'E'] as const).map(pillar => {
        const labels: Record<string, string> = { S: 'S 사전영업', V: 'V Value', D: 'D 차별화', P: 'P 가격', E: 'E Delivery' };
        return (
          <div key={pillar} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--cyan)', minWidth: '70px', fontFamily: 'IBM Plex Mono' }}>{labels[pillar]}</span>
            <input value={pillarRationale[pillar]?.reason ?? ''} onChange={e => setPillarRationale(pr => ({ ...pr, [pillar]: { ...pr[pillar], reason: e.target.value } }))}
              placeholder="현황 사유" style={{ ...S.input, width: '260px', fontSize: '12px', padding: '4px 8px' }} />
            <input value={pillarRationale[pillar]?.action ?? ''} onChange={e => setPillarRationale(pr => ({ ...pr, [pillar]: { ...pr[pillar], action: e.target.value } }))}
              placeholder="개선 액션" style={{ ...S.input, width: '260px', fontSize: '12px', padding: '4px 8px' }} />
          </div>
        );
      })}

      {/* VDC-B 의결 */}
      <div style={sectionLabel}>VDC-B 의결 결과</div>
      {vdcB.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(v.decision, val => setVdcB(rs => rs.map((x, j) => j === i ? { ...x, decision: val } : x)), '의결 (예: 조건부 승인)', '160px')}
          {inp(v.detail, val => setVdcB(rs => rs.map((x, j) => j === i ? { ...x, detail: val } : x)), '의결 내용', '320px')}
          <button onClick={() => setVdcB(rs => rs.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setVdcB(rs => [...rs, { decision: '', detail: '' }])} style={addBtn}>+ 의결</button>

      {/* 주요질의 Q&A */}
      <div style={sectionLabel}>주요질의 (별첨)</div>
      {qna.map((q, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inp(q.question, val => setQna(rs => rs.map((x, j) => j === i ? { ...x, question: val } : x)), '질의사항', '280px')}
          {inp(q.answer, val => setQna(rs => rs.map((x, j) => j === i ? { ...x, answer: val } : x)), '답변', '280px')}
          <button onClick={() => setQna(rs => rs.filter((_, j) => j !== i))} style={delBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => setQna(rs => [...rs, { question: '', answer: '' }])} style={addBtn}>+ 질의</button>

      {/* Save */}
      <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={save} disabled={saving} style={{ ...S.btn('var(--cyan)'), padding: '8px 20px' }}>
          {saving ? '저장 중...' : '대시보드 데이터 저장'}
        </button>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── Analyze Tab (current landing page 4-tab UI) ──────────────────────────────

type AnalyzeSubTab = 'pillar' | 'analysis' | 'compare' | 'portfolio';

interface AnalyzeResult {
  deal_id: number; probability: number;
  method_probs: { pillar: number; bayesian: number; elo: number; monteCarlo: number };
  pillar_scores: Record<string, number>;
  confidence_interval: { low: number; high: number };
  mc_distribution: number[];
  weaknesses: Array<{ id: string; label: string; pillar: string; score: number; contribution: number }>;
  prior_base_rate: number; data_points: number;
  client_name: string; deal_size: string; competitors: string[]; sub_scores: SubScores;
}

const ANALYZE_TABS: { id: AnalyzeSubTab; label: string }[] = [
  { id: 'pillar', label: 'Pillar 진단' },
  { id: 'analysis', label: '확률 & 전략' },
  { id: 'compare', label: '시나리오 비교' },
  { id: 'portfolio', label: '데이터' },
];

function AnalyzeTab() {
  const [subTab, setSubTab] = useState<AnalyzeSubTab>('pillar');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleResult = (data: AnalyzeResult) => {
    setResult(data);
    setSubTab('analysis');
  };

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px', gap: 0 }}>
        {ANALYZE_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: subTab === t.id ? '2px solid var(--cyan)' : '2px solid transparent',
            color: subTab === t.id ? 'var(--text)' : 'var(--text-dim)',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', whiteSpace: 'nowrap',
          }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {subTab === 'pillar' && <PillarInputTab onResult={handleResult as Parameters<typeof PillarInputTab>[0]['onResult']} />}
      {subTab === 'analysis' && (result ? (
        <EnsembleAnalysisTab result={result as Parameters<typeof EnsembleAnalysisTab>[0]['result']} onOutcome={() => setRefreshKey(k => k + 1)} />
      ) : (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
          Pillar 진단 탭에서 먼저 분석을 실행하세요
        </div>
      ))}
      {subTab === 'compare' && (
        <ScenarioCompare initialSubs={result?.sub_scores ?? defaultSubScores()} />
      )}
      {subTab === 'portfolio' && <PortfolioTab refreshKey={refreshKey} />}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingText() {
  return (
    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-dim)', padding: '40px', textAlign: 'center' }}>
      LOADING...
    </div>
  );
}

// ─── Signal Input Tab ─────────────────────────────────────────────────────────

const SIGNAL_SUB_FACTORS = [
  { id: 's_key_man_contact',      pillar: 'S', label: 'Key Man 접촉',      weight: 40 },
  { id: 's_evaluator_rfp',        pillar: 'S', label: '평가자·RFP 파악',    weight: 40 },
  { id: 's_poc_proposal',         pillar: 'S', label: 'PoC·제안 기회',      weight: 20 },
  { id: 'v_needs_painpoint',      pillar: 'V', label: '니즈·Pain Point',    weight: 40 },
  { id: 'v_value_proposition',    pillar: 'V', label: '가치 제안',           weight: 40 },
  { id: 'v_presentation',         pillar: 'V', label: 'C-Level 발표',       weight: 20 },
  { id: 'd_competitive_strategy', pillar: 'D', label: '차별화 전략',        weight: 40 },
  { id: 'd_tech_reference',       pillar: 'D', label: '기술·레퍼런스',       weight: 40 },
  { id: 'd_partner',              pillar: 'D', label: '파트너·컨소시엄',     weight: 20 },
  { id: 'p_budget_fit',           pillar: 'P', label: '예산 적합성',         weight: 30 },
  { id: 'p_price_competition',    pillar: 'P', label: '경쟁 가격 우위',      weight: 40 },
  { id: 'p_cost_value',           pillar: 'P', label: 'ROI·TCO',            weight: 30 },
  { id: 'e_track_record',         pillar: 'E', label: '수주·이행 실적',      weight: 40 },
  { id: 'e_risk_management',      pillar: 'E', label: '리스크 관리',          weight: 40 },
  { id: 'e_execution_team',       pillar: 'E', label: '전담팀·PM',            weight: 20 },
];

const SIGNAL_PILLAR_KO: Record<string, string> = {
  S: '사전영업', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery',
};

interface SignalEntry { rating: number; rationale: string; }

function SignalInputTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [entries, setEntries] = useState<Record<string, SignalEntry>>(() =>
    Object.fromEntries(SIGNAL_SUB_FACTORS.map(f => [f.id, { rating: 2, rationale: '' }]))
  );
  const [saving, setSaving] = useState(false);
  const [signalLink, setSignalLink] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/deals').then(r => r.json()).then(d => setDeals(Array.isArray(d) ? d : []));
  }, []);

  const setEntry = (id: string, field: keyof SignalEntry, value: string | number) => {
    setEntries(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // Pillar 점수 계산 (0~100)
  const calcPillarScores = () => {
    const scores: Record<string, number> = {};
    for (const pid of ['S', 'V', 'D', 'P', 'E']) {
      const items = SIGNAL_SUB_FACTORS.filter(f => f.pillar === pid);
      const raw = items.reduce((s, f) => s + (entries[f.id]?.rating ?? 2) * f.weight / 100, 0);
      scores[pid] = Math.round(raw / 3 * 100 * 10) / 10;
    }
    return scores;
  };

  const buildExcelData = () => {
    const pillarScores = calcPillarScores();
    const pillarRationale: Record<string, string> = {};
    for (const pid of ['S', 'V', 'D', 'P', 'E']) {
      const texts = SIGNAL_SUB_FACTORS.filter(f => f.pillar === pid)
        .map(f => entries[f.id]?.rationale).filter(Boolean);
      pillarRationale[pid] = texts.slice(0, 2).join(' / ');
    }
    const items = SIGNAL_SUB_FACTORS.map(f => ({
      pillar: f.pillar,
      label: f.label,
      weight: f.weight,
      rating: entries[f.id]?.rating ?? 2,
      score: Math.round((entries[f.id]?.rating ?? 2) * f.weight / 100 * 10) / 10,
      rationale: entries[f.id]?.rationale ?? '',
    }));
    const totalScore = Math.round(Object.values(pillarScores).reduce((s, v) => s + v, 0) / 5 * 10) / 10;
    return { pillarScores, pillarRationale, items, totalScore, itemCount: items.length, source: 'manual' as const };
  };

  const handleDownloadExcel = async () => {
    const data = buildExcelData();
    const res = await fetch('/api/excel-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, dealName: deals.find(d => String(d.id) === selectedDeal)?.client_name }),
    });
    if (!res.ok) { setMsg('엑셀 생성 실패'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'signal_assessment.xlsx'; a.click();
    URL.revokeObjectURL(url);
    void data;
  };

  const handleDownloadPPT = async () => {
    const deal = deals.find(d => String(d.id) === selectedDeal);
    const data = buildExcelData();
    setSaving(true);
    const res = await fetch('/api/ppt-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealName: deal?.client_name,
        pillarScores: data.pillarScores,
        pillarRationale: data.pillarRationale,
        weaknesses: data.items.map(i => ({ label: i.label, pillar: i.pillar, score: i.rating })),
        nextMoves: [],
        deal: null,
        totalScore: data.totalScore,
        items: data.items,
      }),
    });
    setSaving(false);
    if (!res.ok) { setMsg('PPT 생성 실패'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = deal ? `${deal.client_name}_전략장표.pptx` : '전략장표.pptx';
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateLink = async () => {
    setSaving(true);
    const deal = deals.find(d => String(d.id) === selectedDeal);
    const data = buildExcelData();
    const res = await fetch('/api/signal-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: selectedDeal ? Number(selectedDeal) : null, dealName: deal?.client_name, data }),
    });
    const json = await res.json();
    if (json.url) {
      const full = `${window.location.origin}${json.url}`;
      setSignalLink(full);
      navigator.clipboard.writeText(full);
      setMsg('링크 복사됨!');
      setTimeout(() => setMsg(''), 2000);
    }
    setSaving(false);
  };

  const ratingColor = (r: number) => r === 3 ? '#22c55e' : r === 2 ? '#f59e0b' : '#ef4444';
  const pillarScores = calcPillarScores();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '16px' }}>시그널 입력 → 공유 링크 / 엑셀 생성</div>

        {/* 딜 선택 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>딜 선택 (선택사항)</label>
          <select value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} style={{ ...S.input, maxWidth: '320px' }}>
            <option value="">딜 없이 생성</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
          </select>
        </div>

        {/* Pillar별 총점 미리보기 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {(['S', 'V', 'D', 'P', 'E'] as const).map(pid => (
            <div key={pid} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '70px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{pid}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: pillarScores[pid] >= 70 ? '#22c55e' : pillarScores[pid] >= 50 ? '#f59e0b' : '#ef4444', fontFamily: 'IBM Plex Mono' }}>
                {pillarScores[pid]}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{SIGNAL_PILLAR_KO[pid]}</div>
            </div>
          ))}
          <div style={{ background: 'var(--brand-dim)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '70px', border: '1px solid var(--brand)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>총점</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand)', fontFamily: 'IBM Plex Mono' }}>
              {Math.round(Object.values(pillarScores).reduce((s, v) => s + v, 0) / 5 * 10) / 10}
            </div>
          </div>
        </div>

        {/* Sub-Factor 입력 */}
        {(['S', 'V', 'D', 'P', 'E'] as const).map(pid => (
          <div key={pid} style={{ marginBottom: '20px' }}>
            <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              {pid} — {SIGNAL_PILLAR_KO[pid]}
            </div>
            {SIGNAL_SUB_FACTORS.filter(f => f.pillar === pid).map(f => (
              <div key={f.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                {/* 평점 버튼 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>{f.label} ({f.weight}%)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3].map(r => (
                      <button key={r} onClick={() => setEntry(f.id, 'rating', r)} style={{
                        width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                        background: entries[f.id]?.rating === r ? ratingColor(r) : 'var(--surface2)',
                        color: entries[f.id]?.rating === r ? '#fff' : 'var(--text-dim)',
                      }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 현수준 근거 */}
                <textarea
                  value={entries[f.id]?.rationale ?? ''}
                  onChange={e => setEntry(f.id, 'rationale', e.target.value)}
                  placeholder="현수준 판단 근거..."
                  rows={2}
                  style={{ ...S.input, flex: 1, resize: 'vertical', fontSize: '12px', lineHeight: 1.5 }}
                />
              </div>
            ))}
          </div>
        ))}

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleGenerateLink} disabled={saving} style={{ ...S.btn('var(--brand)'), color: '#fff', opacity: saving ? 0.6 : 1 }}>
            {saving ? '생성 중...' : '🔗 공유 링크 생성'}
          </button>
          <button onClick={handleDownloadExcel} style={{ ...S.btn('var(--surface2)') }}>
            📥 엑셀 다운로드
          </button>
          <button onClick={handleDownloadPPT} disabled={saving} style={{ ...S.btn('var(--surface2)'), opacity: saving ? 0.6 : 1 }}>
            📊 전략 장표 생성
          </button>
          {msg && <span style={{ fontSize: '12px', color: 'var(--green)', fontFamily: 'IBM Plex Mono' }}>{msg}</span>}
        </div>

        {signalLink && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-mid)', wordBreak: 'break-all', fontFamily: 'IBM Plex Mono' }}>
            {signalLink}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loss Report Tab ──────────────────────────────────────────────────────────

const HANA_PREFILL = {
  dealName: '하나은행 비정형 데이터 플랫폼 구축사업',
  dealSize: '1,233억원',
  duration: '38개월 (계약체결일~2029.8.31)',
  evalCriteria: '기술 90% + 가격 10% (기술 중요도 高)',
  winner: 'LG CNS',
  winnerNotes: 'ISP 컨설팅 수행사로 사업 이해도 高 / 기존 영상관리시스템(가이아) 구축 경험 / 발주처 사업 6건 모두 수주로 고객 우호도 高 / 그룹 차원의 AI 경쟁력(엑사원) 우수 → 제안 Kick-Off 당시 당사 전반적으로 경쟁 열위 판단',
  ourScore: '96.2857',
  competitorScore: '94.8943',
  ourTechScore: '86.2857',
  ourPriceScore: '10',
  // Pillar Before(수주전략 보고) → After(결과 발표)
  pillarBefore: { S: 53.3, V: 57.6, D: 68.5, P: 52.8, E: 80.7 },
  pillarAfter:  { S: 73.3, V: 93.9, D: 88.0, P: 75.0, E: 86.0 },
  totalBefore: 62.6,
  totalAfter: 83.2,
  // Action Items per pillar
  actions: {
    S: '발주처 특성상 사전영업이 어려운 상황이므로 초기 점수는 낮았으나, 다양한 채널을 활용한 지속적인 고객 접촉을 통해 주요 니즈 및 관심사항을 파악하고 제안팀 전달 및 제안서에 반영\n(ex. AI Agent 활용 방안, 데이터센터 자율운영을 위한 로봇 적용, NGA/AWS 등 글로벌 벤치마킹, 서울 센터에 대한 리모델링 니즈 등)',
    V: '100G 적용 환경에 대해 구체적으로 시뮬레이션하고, 고객 Value 관점에서 강조 (VDI 업무환경, 데이터이관 등)\nAIOps 적용 시 기대효과를 당사 실 적용 사례 기반 제시\n이외 총 14개의 추가/상향 제안 및 고객 Value Proposition 제시',
    D: '경쟁사 예상 전략 분석 및 당사 차별화 전략 구체화\n경쟁사 전략(ISP 경험, 기존 구축 파트너사 활용, 기존과 동일한 제품 사용)과 동등 수준 이상의 전략 제시\nISP 경험 부족에 대응하여 KT sat의 위성사업 역량 강조 및 제안서 전반에 역량 활용 방안 제시\n당사 핵심 보유역량(100G, AIOps, DC구축/운영, 양자보안 등)에 대해 발주처가 충분히 인지할 수 있도록 강조',
    P: '전사 전략사업으로, 전략적 가격정책 수립 및 유관부서와의 컨센서스 형성을 통한 의사결정\n최종 평가결과, 경쟁사 대비 가격경쟁력 우위 확인\n사업 수행 기간 동안 100G에 대한 무상 제공 정책 유효',
    E: '당초 대비 큰 변동은 없으나, KT sat의 위성사업 역량/방법론 및 보유 Asset 활용 강조\n(WTA Tier 4 등급 강조)',
  },
  lossReason: '최종 수주 실패. 우선협상대상자 선정 후 계약 협상 단계에서 이슈 발생. 경쟁사(LG CNS)의 기존 고객 관계 및 사업 이해도가 의사결정에 영향을 미친 것으로 추정.',
  lessons: [
    '사전영업 단계(VDC-A 이전)부터 핵심 의사결정권자와의 관계 구축 필요',
    'ISP 경험 부재에 대한 선제적 극복 전략 수립 및 차별화 논리 강화',
    '경쟁사 대비 고객 우호도 확보를 위한 장기적 관계 관리 체계 필요',
  ],
};

const LOSS_PILLAR_KO: Record<string, string> = {
  S: '사전영업 수준', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery 경쟁력',
};

function LossReportTab() {
  const [form, setForm] = useState(HANA_PREFILL);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));
  const setAction = (pid: string, val: string) =>
    setForm(prev => ({ ...prev, actions: { ...prev.actions, [pid]: val } }));
  const setLesson = (i: number, val: string) =>
    setForm(prev => { const l = [...prev.lessons]; l[i] = val; return { ...prev, lessons: l }; });

  const handleGenerate = async () => {
    setSaving(true);
    const res = await fetch('/api/ppt-loss-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setMsg('생성 실패'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.dealName}_실주보고.pptx`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('다운로드 완료');
    setTimeout(() => setMsg(''), 2000);
  };

  const inp = (label: string, key: string, rows?: number) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ ...S.mono, fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>{label}</label>
      {rows ? (
        <textarea value={(form as Record<string, unknown>)[key] as string} onChange={e => set(key, e.target.value)}
          rows={rows} style={{ ...S.input, width: '100%', resize: 'vertical', fontSize: '12px', lineHeight: 1.6 }} />
      ) : (
        <input value={(form as Record<string, unknown>)[key] as string} onChange={e => set(key, e.target.value)}
          style={{ ...S.input, width: '100%', fontSize: '13px' }} />
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
      <div style={S.card}>
        <div style={{ ...S.mono, marginBottom: '4px' }}>실주 보고서 생성</div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '20px' }}>하나은행 프로젝트 데이터가 프리필됩니다. 수정 후 PPTX 생성.</div>

        {/* 사업 기본 정보 */}
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>A. 사업 기본 정보</div>
        {inp('사업명', 'dealName')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {inp('매출 금액', 'dealSize')}
          {inp('사업 기간', 'duration')}
        </div>
        {inp('평가 방법', 'evalCriteria')}

        {/* 경쟁 결과 */}
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', marginTop: '8px' }}>B. 경쟁 결과</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          {inp('낙찰 경쟁사', 'winner')}
          {inp('당사 기술점수', 'ourTechScore')}
          {inp('당사 가격점수', 'ourPriceScore')}
          {inp('당사 총점', 'ourScore')}
        </div>
        {inp('경쟁사 강점 (한 줄 이내)', 'winnerNotes', 3)}

        {/* Pillar 점수 */}
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', marginTop: '8px' }}>C. Win Ratio 점수 (수주전략 보고 → 결과 발표)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['영역', '수주전략 보고', '결과 발표', '증감'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['S', 'V', 'D', 'P', 'E'] as const).map(pid => {
                const before = form.pillarBefore[pid];
                const after = form.pillarAfter[pid];
                return (
                  <tr key={pid}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{LOSS_PILLAR_KO[pid]}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      <input type="number" value={before} onChange={e => setForm(p => ({ ...p, pillarBefore: { ...p.pillarBefore, [pid]: Number(e.target.value) } }))}
                        style={{ ...S.input, width: '70px', textAlign: 'center', fontSize: '13px' }} />
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      <input type="number" value={after} onChange={e => setForm(p => ({ ...p, pillarAfter: { ...p.pillarAfter, [pid]: Number(e.target.value) } }))}
                        style={{ ...S.input, width: '70px', textAlign: 'center', fontSize: '13px' }} />
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'center', color: (after - before) >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 700 }}>
                      {(after - before) >= 0 ? '+' : ''}{(after - before).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>총점</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>
                  <input type="number" value={form.totalBefore} onChange={e => setForm(p => ({ ...p, totalBefore: Number(e.target.value) }))}
                    style={{ ...S.input, width: '70px', textAlign: 'center', fontSize: '13px' }} />
                </td>
                <td style={{ padding: '6px', textAlign: 'center' }}>
                  <input type="number" value={form.totalAfter} onChange={e => setForm(p => ({ ...p, totalAfter: Number(e.target.value) }))}
                    style={{ ...S.input, width: '70px', textAlign: 'center', fontSize: '13px' }} />
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>
                  +{(form.totalAfter - form.totalBefore).toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 영역별 Action Item */}
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', marginTop: '16px' }}>D. 영역별 개선방안 / Action Item</div>
        {(['S', 'V', 'D', 'P', 'E'] as const).map(pid => (
          <div key={pid} style={{ marginBottom: '10px' }}>
            <label style={{ ...S.mono, fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              {pid} — {LOSS_PILLAR_KO[pid]} ({form.pillarBefore[pid]} → {form.pillarAfter[pid]})
            </label>
            <textarea value={form.actions[pid]} onChange={e => setAction(pid, e.target.value)}
              rows={3} style={{ ...S.input, width: '100%', resize: 'vertical', fontSize: '12px', lineHeight: 1.6 }} />
          </div>
        ))}

        {/* 실주 원인 & 교훈 */}
        <div style={{ ...S.mono, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', marginTop: '8px' }}>E. 실주 원인 & 교훈</div>
        {inp('실주 원인 (핵심 서사)', 'lossReason', 3)}
        {[0, 1, 2].map(i => (
          <div key={i} style={{ marginBottom: '8px' }}>
            <label style={{ ...S.mono, fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>교훈 {i + 1}</label>
            <input value={form.lessons[i] ?? ''} onChange={e => setLesson(i, e.target.value)}
              style={{ ...S.input, width: '100%', fontSize: '13px' }} />
          </div>
        ))}

        {/* 생성 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleGenerate} disabled={saving}
            style={{ ...S.btn('var(--brand)'), color: '#fff', opacity: saving ? 0.6 : 1, fontSize: '13px', padding: '10px 24px' }}>
            {saving ? '생성 중...' : '📊 실주 보고서 PPTX 생성'}
          </button>
          {msg && <span style={{ fontSize: '12px', color: 'var(--green)', fontFamily: 'IBM Plex Mono' }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
