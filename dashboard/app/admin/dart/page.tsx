'use client';

import { useEffect, useState, useCallback } from 'react';

interface CorpRow {
  id: number;
  corp_code: string;
  corp_name: string;
  aliases: string[];
  is_listed: boolean;
  industry: string | null;
}
interface FilingRow {
  id: number;
  corp_code: string;
  corp_name: string;
  rcept_no: string;
  report_nm: string;
  rcept_dt: string;
  summary: string | null;
  tags: string[];
  relevance_score: number;
}
interface SyncResult {
  corp_code: string;
  corp_name: string;
  fetched: number;
  new_filings: number;
  skipped_duplicates: number;
  summarized: number;
  errors: string[];
}

const ui = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 } as const,
  label: { fontSize: 11, color: 'var(--text-mid)', fontFamily: 'IBM Plex Mono', letterSpacing: 1, marginBottom: 6 } as const,
  input: { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 6, background: 'var(--brand)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 } as const,
  btnGhost: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' } as const,
};

export default function DartAdminPage() {
  const [corps, setCorps] = useState<CorpRow[]>([]);
  const [filings, setFilings] = useState<FilingRow[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncing, setSyncing] = useState(false);

  // form
  const [corpCode, setCorpCode] = useState('');
  const [corpName, setCorpName] = useState('');
  const [aliases, setAliases] = useState('');
  const [isListed, setIsListed] = useState(true);
  const [industry, setIndustry] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // filings filter
  const [filterCorp, setFilterCorp] = useState('');

  const fetchCorps = useCallback(async () => {
    const res = await fetch('/api/admin/dart/corp-map');
    if (res.ok) {
      const d = await res.json();
      setCorps(d.corps ?? []);
    }
  }, []);

  const fetchFilings = useCallback(async () => {
    const qs = filterCorp ? `?corp_code=${filterCorp}&days=180&min_relevance=0` : '?days=180&min_relevance=0';
    const res = await fetch(`/api/admin/dart/filings${qs}`);
    if (res.ok) {
      const d = await res.json();
      setFilings(d.filings ?? []);
    }
  }, [filterCorp]);

  useEffect(() => { fetchCorps(); fetchFilings(); }, [fetchCorps, fetchFilings]);

  const handleSaveCorp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg('');
    if (!corpCode || !corpName) { setSaveMsg('필수 입력'); return; }
    const res = await fetch('/api/admin/dart/corp-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corp_code: corpCode,
        corp_name: corpName,
        aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
        is_listed: isListed,
        industry: industry || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaveMsg('저장 완료');
      setCorpCode(''); setCorpName(''); setAliases(''); setIndustry('');
      await fetchCorps();
    } else {
      setSaveMsg(`오류: ${data.error}`);
    }
  };

  const handleDelete = async (cc: string) => {
    if (!confirm(`${cc} 매핑 삭제?`)) return;
    await fetch(`/api/admin/dart/corp-map/${cc}`, { method: 'DELETE' });
    await fetchCorps();
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const res = await fetch('/api/admin/dart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      });
      const data = await res.json();
      if (res.ok) setSyncResults(data.results ?? []);
      else alert(`Sync 실패: ${data.error} ${data.detail ?? ''}`);
      await fetchFilings();
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncOne = async (corp_code: string) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/dart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corp_code, days: 90 }),
      });
      const data = await res.json();
      if (res.ok) setSyncResults(data.results ?? []);
      await fetchFilings();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--brand)', letterSpacing: 3 }}>
          ADMIN · DART
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>DART 공시 인텔리전스</div>
        <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 4 }}>
          상장 고객사 corp_code 매핑 + 최근 90일 공시 자동 수집/요약/태깅
        </div>
      </div>

      {/* Corp 매핑 등록 */}
      <div style={{ ...ui.card, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>고객사 corp_code 매핑</div>
        <form onSubmit={handleSaveCorp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={ui.label}>corp_code (8자리, opendart.fss.or.kr 검색)</div>
            <input value={corpCode} onChange={(e) => setCorpCode(e.target.value)} style={ui.input} placeholder="예: 00126380" />
          </div>
          <div>
            <div style={ui.label}>회사명 (정확)</div>
            <input value={corpName} onChange={(e) => setCorpName(e.target.value)} style={ui.input} placeholder="예: 삼성전자" />
          </div>
          <div>
            <div style={ui.label}>aliases (콤마 구분)</div>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} style={ui.input} placeholder="삼성전자(주), Samsung Electronics" />
          </div>
          <div>
            <div style={ui.label}>산업</div>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} style={ui.input} placeholder="예: 반도체" />
          </div>
          <div>
            <div style={ui.label}>상장 여부</div>
            <select value={isListed ? '1' : '0'} onChange={(e) => setIsListed(e.target.value === '1')} style={ui.input}>
              <option value="1">상장</option>
              <option value="0">비상장 (DART 데이터 없음)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" style={ui.btn}>등록/업데이트</button>
            {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith('오류') ? 'var(--red)' : 'var(--green)' }}>{saveMsg}</span>}
          </div>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-mid)' }}>등록된 회사 ({corps.length})</div>
          <button onClick={handleSyncAll} disabled={syncing} style={{ ...ui.btn, opacity: syncing ? 0.5 : 1 }}>
            {syncing ? '동기화 중…' : '전체 동기화 (최근 90일)'}
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-mid)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>corp_code</th>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>회사명</th>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>aliases</th>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>산업</th>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>상장</th>
              <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {corps.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 6px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{c.corp_code}</td>
                <td style={{ padding: '10px 6px', fontWeight: 600 }}>{c.corp_name}</td>
                <td style={{ padding: '10px 6px', fontSize: 12, color: 'var(--text-mid)' }}>{(c.aliases ?? []).join(', ') || '—'}</td>
                <td style={{ padding: '10px 6px', fontSize: 12 }}>{c.industry ?? '—'}</td>
                <td style={{ padding: '10px 6px', fontSize: 12, color: c.is_listed ? 'var(--green)' : 'var(--text-dim)' }}>
                  {c.is_listed ? '상장' : '비상장'}
                </td>
                <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                  <button onClick={() => handleSyncOne(c.corp_code)} disabled={syncing || !c.is_listed}
                    style={{ ...ui.btnGhost, marginRight: 6, opacity: c.is_listed ? 1 : 0.4 }}>동기화</button>
                  <button onClick={() => handleDelete(c.corp_code)} style={{ ...ui.btnGhost, color: 'var(--red)' }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sync 결과 */}
      {syncResults.length > 0 && (
        <div style={{ ...ui.card, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>동기화 결과</div>
          {syncResults.map((r) => (
            <div key={r.corp_code} style={{ padding: '6px 0', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
              <span style={{ color: 'var(--text)' }}>{r.corp_name}</span>
              {' — '}
              <span>fetched {r.fetched}, new {r.new_filings}, dup {r.skipped_duplicates}, summarized {r.summarized}</span>
              {r.errors.length > 0 && (
                <div style={{ color: 'var(--red)', marginTop: 2 }}>오류: {r.errors.join(' / ')}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filings */}
      <div style={ui.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>최근 공시 ({filings.length})</div>
          <select value={filterCorp} onChange={(e) => setFilterCorp(e.target.value)} style={{ ...ui.input, width: 220 }}>
            <option value="">전체 회사</option>
            {corps.map((c) => <option key={c.corp_code} value={c.corp_code}>{c.corp_name}</option>)}
          </select>
        </div>
        {filings.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>공시 없음 — 동기화 버튼을 눌러주세요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filings.map((f) => (
              <div key={f.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--brand)' }}>
                    {f.relevance_score}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.corp_name}</span>
                  <span style={{ fontSize: 12 }}>{f.report_nm}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{f.rcept_dt}</span>
                  {(f.tags ?? []).map((t) => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>{t}</span>
                  ))}
                </div>
                {f.summary && (
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5 }}>{f.summary}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
