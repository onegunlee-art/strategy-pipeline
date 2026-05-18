'use client';

import { useState, useEffect } from 'react';
import BriefSection from '@/components/BriefSection';
import '../print.css';

interface Props {
  params: { deal_id: string };
}

export default function BriefPage({ params }: Props) {
  const { deal_id } = params;
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
        let done = false;

        while (!done) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
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
                // done 이벤트에 전체 결과가 포함됨 (race condition 없음)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { type: _t, ...output } = ev;
                if (!cancelled) setData(Object.keys(output).length > 0 ? output : { ...metaData, cached: false });
                done = true;
              } else if (ev.type === 'error') {
                if (!cancelled) setError(ev.message ?? 'brief 생성 실패');
                done = true;
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
      <div style={{ padding: '40px', fontFamily: 'monospace', color: 'var(--text)', background: 'var(--bg)', minHeight: '100vh' }}>
        <h1 style={{ color: 'var(--red)' }}>Executive Brief 생성 실패</h1>
        <p>deal_id: {deal_id}</p>
        <pre style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap', color: 'var(--red)' }}>
          {error}
        </pre>
        <button
          onClick={() => { setError(null); setData(null); setStatusMsg('재시도 중...'); }}
          style={{ marginTop: '16px', padding: '10px 20px', background: 'transparent', border: '1px solid var(--cyan)', color: 'var(--cyan)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', color: 'var(--text)', background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ color: 'var(--cyan)', fontSize: '11px', letterSpacing: '2px' }}>GENERATING EXECUTIVE BRIEF</div>
        <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-dim)' }}>{statusMsg}</div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cyan)',
              opacity: 0.3 + i * 0.35,
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <BriefSection data={data as unknown as Parameters<typeof BriefSection>[0]['data']} />
    </div>
  );
}
