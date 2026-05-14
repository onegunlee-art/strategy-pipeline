'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? '오류 발생');
      } else {
        router.push('/admin');
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px',
        padding: '40px', width: '360px', display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '3px' }}>
            ADMIN
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', color: 'var(--text)', marginTop: '6px' }}>
            WIN-RATIO ENGINE
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-mid)', display: 'block', marginBottom: '6px' }}>
            어드민 비밀번호
          </label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoFocus
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '12px 14px', color: 'var(--text)', fontSize: '14px',
              outline: 'none', fontFamily: 'IBM Plex Mono',
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--red)', background: 'rgba(255,68,102,0.08)', padding: '8px 12px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !pw}
          style={{
            padding: '12px', borderRadius: '8px', border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: loading || !pw ? 'var(--surface2)' : 'var(--cyan)',
            color: loading || !pw ? 'var(--text-dim)' : '#000',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 600,
          }}>
          {loading ? 'LOGGING IN...' : '▶  LOGIN'}
        </button>
      </form>
    </div>
  );
}
