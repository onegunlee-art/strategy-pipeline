'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SUB_FACTORS, PILLAR_META } from '@/lib/pillars';

type AdminTab = 'labels' | 'deals' | 'voters' | 'weights' | 'links' | 'import' | 'competitors';

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
    background: color, color: color === 'var(--cyan)' ? '#000' : '#fff',
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
                  padding: '8px 12px', background: 'rgba(255,183,77,0.10)',
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
                      <option value="member">member</option>
                      <option value="reviewer">reviewer</option>
                      <option value="leader">leader</option>
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

function LinksTab() {
  const [links, setLinks] = useState<VotingLink[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [msg, setMsg] = useState('');

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

  const createLink = async () => {
    if (!selectedDeal) return;
    await apiFetch('/api/admin/voting-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: Number(selectedDeal), closes_at: closesAt || null }),
    });
    setMsg('링크 생성됨');
    setTimeout(() => setMsg(''), 1500);
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} style={{ ...S.input, minWidth: '200px' }}>
            <option value="">딜 선택...</option>
            {dealsWithNoLink.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
            {deals.filter(d => links.find(l => l.deal_id === d.id)).map(d => (
              <option key={d.id} value={d.id}>{d.client_name} (재생성)</option>
            ))}
          </select>
          <input type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} style={S.input} placeholder="마감일 (선택)" />
          <button onClick={createLink} disabled={!selectedDeal} style={S.btn()}>▶  생성</button>
          {msg && <span style={{ fontSize: '12px', color: 'var(--green)' }}>{msg}</span>}
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
              style={{ ...S.btn('var(--green)'), color: '#000' }}>
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
                        <span style={{ fontFamily: 'IBM Plex Mono', color: '#ffd54f' }}>
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
                        <span style={{ fontFamily: 'IBM Plex Mono', color: '#ffd54f' }}>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingText() {
  return (
    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-dim)', padding: '40px', textAlign: 'center' }}>
      LOADING...
    </div>
  );
}
