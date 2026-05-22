'use client';

import { useEffect, useState, useCallback } from 'react';

type DocType = 'rfp' | 'loss_report' | 'win_strategy' | 'catalog' | 'partner' | 'other';

interface DocumentRow {
  id: number;
  doc_type: string;
  title: string;
  source_path: string | null;
  customer: string | null;
  industry: string | null;
  word_count: number;
  status: string;
  chunk_count?: number;
  created_at: string;
}

interface SearchHit {
  chunk_id: number;
  document_id: number;
  document_title: string;
  doc_type: string;
  content: string;
  similarity: number;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  rfp: 'RFP',
  loss_report: '실주 보고서',
  win_strategy: '수주전략 보고서',
  catalog: '상품 카탈로그',
  partner: '협력사 리스트',
  other: '기타',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--text-dim)',
  embedded: 'var(--green)',
  partial: 'var(--yellow)',
  failed: 'var(--red)',
};

const ui = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 } as const,
  label: { fontSize: 11, color: 'var(--text-mid)', fontFamily: 'IBM Plex Mono', letterSpacing: 1, marginBottom: 6 } as const,
  input: { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 6, background: 'var(--brand)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 } as const,
  btnGhost: { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' } as const,
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocType>('rfp');
  const [customer, setCustomer] = useState('');
  const [industry, setIndustry] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // search
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const qs = filterType ? `?doc_type=${filterType}` : '';
    const res = await fetch(`/api/admin/documents${qs}`);
    if (res.ok) {
      const d = await res.json();
      setDocs(d.documents ?? []);
    }
    setLoading(false);
  }, [filterType]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) { setUploadMsg('파일과 제목 필수'); return; }
    setUploading(true);
    setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('doc_type', docType);
    if (customer) fd.append('customer', customer);
    if (industry) fd.append('industry', industry);
    try {
      const res = await fetch('/api/admin/documents/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg(`오류: ${data.error ?? '실패'}${data.detail ? ' — ' + data.detail : ''}`);
      } else {
        setUploadMsg(`완료: ${data.chunks_stored}/${data.chunks_total} 청크 저장`);
        setFile(null); setTitle(''); setCustomer(''); setIndustry('');
        const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
        await fetchDocs();
      }
    } catch (err) {
      setUploadMsg(`네트워크 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까? 연결된 청크도 함께 삭제됩니다.')) return;
    await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
    await fetchDocs();
  };

  const handleReindex = async (id: number) => {
    const res = await fetch(`/api/admin/documents/${id}/reindex`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert(`재인덱싱 완료: ${data.chunks_stored}/${data.chunks_total}`);
      await fetchDocs();
    } else {
      alert(`오류: ${data.error ?? '실패'}${data.detail ? ' — ' + data.detail : ''}`);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim().length < 2) return;
    setSearching(true);
    setSearchHits([]);
    try {
      const res = await fetch('/api/admin/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQ, match_count: 8 }),
      });
      const data = await res.json();
      if (res.ok) setSearchHits(data.hits ?? []);
      else alert(`검색 실패: ${data.error}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--brand)', letterSpacing: 3 }}>
          ADMIN · DOCUMENTS
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>사내 문서 RAG</div>
        <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 4 }}>
          RFP · 실주/수주전략 보고서 · 카탈로그 · 협력사 리스트 임베딩
        </div>
      </div>

      {/* Upload */}
      <div style={{ ...ui.card, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>업로드</div>
        <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={ui.label}>파일 (PDF / TXT / MD)</div>
            <input id="file-input" type="file" accept=".pdf,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ ...ui.input, padding: 6 }} />
          </div>
          <div>
            <div style={ui.label}>제목</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={ui.input} placeholder="예: 하나은행 AI 통제 RFP" />
          </div>
          <div>
            <div style={ui.label}>문서 유형</div>
            <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)} style={ui.input}>
              {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((k) => (
                <option key={k} value={k}>{DOC_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={ui.label}>고객사 (선택)</div>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} style={ui.input} placeholder="예: 하나은행" />
          </div>
          <div>
            <div style={ui.label}>산업 (선택)</div>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} style={ui.input} placeholder="예: 금융" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" disabled={uploading} style={{ ...ui.btn, opacity: uploading ? 0.5 : 1 }}>
              {uploading ? '처리 중…' : '업로드 + 임베딩'}
            </button>
            {uploadMsg && <span style={{ fontSize: 12, color: uploadMsg.startsWith('오류') ? 'var(--red)' : 'var(--green)' }}>{uploadMsg}</span>}
          </div>
        </form>
      </div>

      {/* Search */}
      <div style={{ ...ui.card, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>의미 검색</div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            style={{ ...ui.input, flex: 1 }} placeholder="예: 가격 경쟁력 약점 극복 전략" />
          <button type="submit" disabled={searching} style={{ ...ui.btn, opacity: searching ? 0.5 : 1 }}>
            {searching ? '검색 중…' : '검색'}
          </button>
        </form>
        {searchHits.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {searchHits.map((h) => (
              <div key={h.chunk_id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--brand)' }}>
                    {(h.similarity * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{h.document_title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {DOC_TYPE_LABELS[h.doc_type as DocType] ?? h.doc_type}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {h.content.length > 280 ? h.content.slice(0, 280) + '…' : h.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div style={ui.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>문서 목록 ({docs.length})</div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...ui.input, width: 180 }}>
            <option value="">전체 유형</option>
            {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((k) => (
              <option key={k} value={k}>{DOC_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>불러오는 중…</div>
        ) : docs.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>문서가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-mid)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>제목</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>유형</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>고객사</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>단어</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>청크</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>상태</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 6px' }}>{d.title}</td>
                  <td style={{ padding: '10px 6px', fontSize: 12 }}>{DOC_TYPE_LABELS[d.doc_type as DocType] ?? d.doc_type}</td>
                  <td style={{ padding: '10px 6px', fontSize: 12, color: 'var(--text-mid)' }}>{d.customer ?? '—'}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{d.word_count.toLocaleString()}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{d.chunk_count ?? 0}</td>
                  <td style={{ padding: '10px 6px', fontSize: 11, color: STATUS_COLORS[d.status] ?? 'var(--text-mid)', fontWeight: 600 }}>{d.status}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                    <button onClick={() => handleReindex(d.id)} style={{ ...ui.btnGhost, marginRight: 6 }}>재인덱싱</button>
                    <button onClick={() => handleDelete(d.id)} style={{ ...ui.btnGhost, color: 'var(--red)' }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
