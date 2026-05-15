'use client';

import { useState, useEffect, use } from 'react';
import BriefSection from '@/components/BriefSection';
import '../print.css';

interface Props {
  params: Promise<{ deal_id: string }>;
}

export default function BriefPage({ params }: Props) {
  const { deal_id } = use(params);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('캐시 확인 중...');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1) 캐시 GET 시도 (즉시 반환)
      try {
        const res = await fetch(`/api/brief/${deal_id}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && !json.error) {
            setData(json);
            return;
          }
        }
      } catch { /* no cache, fall through */ }

      // 2) SSE POST — meta 이벤트를 즉시 받으므로 Vercel timeout 없음
      setStatusMsg('브리프 생성 중 (30~60초 소요)...');
      try {
        const res = await fetch(`/api/brief/${deal_id}`, { method: 'POST' });
        if (!res.body) throw new Error('no stream body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let metaData: Record<string, unknown> = {};
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            try {
              const ev = JSON.parse(payload);
              if (ev.type === 'meta') {
                metaData = ev;
                if (!cancelled) setStatusMsg('AI 분석 중...');
              } else if (ev.type === 'done') {
                // 캐시에서 완성본 읽기 (캐시 저장 완료 타이밍)
                try {
                  const cached = await fetch(`/api/brief/${deal_id}`);
                  if (cached.ok) {
                    const json = await cached.json();
                    if (!cancelled && !json.error) { setData(json); return; }
                  }
                } catch { /* fallback to metaData */ }
                if (!cancelled) setData({ ...metaData, cached: false });
              } else if (ev.type === 'error') {
                if (!cancelled) setError(ev.message ?? 'brief 생성 실패');
              }
            } catch { /* partial line */ }
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [deal_id]);

  if (error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d0d', minHeight: '100vh' }}>
        <h1 style={{ color: '#ef5350' }}>Executive Brief 생성 실패</h1>
        <p>deal_id: {deal_id}</p>
        <pre style={{ background: '#1a1a1a', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap', color: '#ef5350' }}>
          {error}
        </pre>
        <button
          onClick={() => { setError(null); setData(null); setStatusMsg('재시도 중...'); }}
          style={{ marginTop: '16px', padding: '10px 20px', background: 'transparent', border: '1px solid #4dd0e1', color: '#4dd0e1', borderRadius: '6px', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d0d', minHeight: '100vh' }}>
        <div style={{ color: '#4dd0e1', fontSize: '11px', letterSpacing: '2px' }}>GENERATING EXECUTIVE BRIEF</div>
        <div style={{ marginTop: '16px', fontSize: '13px', color: '#666' }}>{statusMsg}</div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#4dd0e1',
              opacity: 0.3 + i * 0.35,
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0d0d0d)', color: 'var(--text, #e0e0e0)' }}>
      <BriefSection data={data as unknown as Parameters<typeof BriefSection>[0]['data']} />
    </div>
  );
}
