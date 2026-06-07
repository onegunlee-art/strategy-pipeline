'use client';

import { useState, useEffect } from 'react';
import { ROLE_WEIGHTS, ROLE_LABEL, VoterRole } from '@/lib/voteWeights';

const ROLE_OPTIONS = (Object.keys(ROLE_WEIGHTS) as VoterRole[]).map(id => ({
  id,
  label: ROLE_LABEL[id],
  weight: `${ROLE_WEIGHTS[id].toFixed(1)}×`,
}));

interface GeoCard {
  id: number;
  label: string;
  description: string;
  direction: string;
}

interface SessionData {
  sessionId: number;
  topic: string;
  geoProb: number;
  cards: GeoCard[];
}

function probColor(p: number) {
  return p >= 65 ? '#16a34a' : p >= 45 ? '#d97706' : '#dc2626';
}

export default function GeoVotePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [phase, setPhase] = useState<'loading' | 'identify' | 'voting' | 'done'>('loading');
  const [session, setSession] = useState<SessionData | null>(null);
  const [resultProb, setResultProb] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<VoterRole | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/geo/session/${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? `HTTP ${res.status}`); return; }
        setSession({
          sessionId: json.sessionId,
          topic: json.topic,
          geoProb: json.geoProb,
          cards: json.cards ?? [],
        });
        setPhase('identify');
      } catch (e) {
        setError(String(e));
      }
    }
    load();
  }, [token]);

  const handleVote = async (cardId: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/geo/vote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, voterName: name, voterRole: role }),
      });
      const json = await res.json();
      if (res.ok) {
        setResultProb(json.geoProb);
        setPhase('done');
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const root: React.CSSProperties = {
    minHeight: '100vh',
    background: '#111',
    color: '#f4f4f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    boxSizing: 'border-box',
  };

  if (error) return (
    <div style={root}>
      <div style={{ marginTop: 80, color: '#dc2626', fontSize: 14 }}>{error}</div>
    </div>
  );

  if (phase === 'loading') return (
    <div style={root}>
      <div style={{ marginTop: 80, color: '#9ca3af', fontSize: 14 }}>불러오는 중...</div>
    </div>
  );

  if (phase === 'done') return (
    <div style={root}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', marginTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>응답 감사합니다</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>
          귀하의 시그널이 분석에 반영되었습니다
        </div>
        {resultProb != null && (
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            padding: '20px',
          }}>
            <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '1px', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
              갱신된 종전 가능성
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: probColor(resultProb) }}>
              {resultProb}%
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (phase === 'identify') return (
    <div style={root}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '1px', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 6 }}>
            지정학 시그널 분석
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
            {session?.topic}
          </div>
        </div>

        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '1px', marginBottom: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
            참여자 이름
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="예: 홍길동"
            style={{
              width: '100%', background: '#111', border: '1px solid #333',
              borderRadius: 8, padding: '12px 14px', color: '#f4f4f5', fontSize: 16,
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '1px', marginBottom: 10, fontFamily: 'IBM Plex Mono, monospace' }}>
              본인 역할
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setRole(opt.id)}
                  style={{
                    padding: '10px 8px', borderRadius: 6,
                    border: '1px solid ' + (role === opt.id ? '#22d3ee' : '#333'),
                    background: role === opt.id ? '#0e3a44' : '#111',
                    color: role === opt.id ? '#22d3ee' : '#f4f4f5',
                    fontSize: 12, cursor: 'pointer', textAlign: 'center',
                  }}>
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 10, color: role === opt.id ? '#22d3ee' : '#6b7280', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                    {opt.weight}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              역할별로 시그널 반영 가중치가 달라집니다
            </div>
          </div>
        </div>

        <button
          onClick={() => { if (name.trim() && role) setPhase('voting'); }}
          disabled={!name.trim() || !role}
          style={{
            width: '100%', marginTop: 20, padding: 14, borderRadius: 10, border: 'none',
            background: name.trim() && role ? '#22d3ee' : '#1a1a1a',
            color: name.trim() && role ? '#06262d' : '#6b7280',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, fontWeight: 700,
            cursor: name.trim() && role ? 'pointer' : 'default',
          }}>
          ▶  시그널 선택 →
        </button>
      </div>
    </div>
  );

  return (
    <div style={root}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#f4f4f5', marginBottom: 10 }}>
            안녕 이하진^^
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '1px', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 6 }}>
            지정학 시그널 분석
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
            {session?.topic}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#9ca3af' }}>
            현재 분석: 종전 가능성{' '}
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: probColor(session?.geoProb ?? 50) }}>
              {session?.geoProb}%
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
          가장 중요하다고 생각하는 시그널 1개를 선택하세요
        </div>

        {/* Cards */}
        {session?.cards.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            시그널 카드를 준비 중입니다
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {session?.cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleVote(card.id)}
              disabled={submitting}
              style={{
                minHeight: 80,
                padding: '16px 20px',
                background: '#1a1a1a',
                border: `2px solid ${card.direction === 'agree' ? '#16a34a' : '#dc2626'}`,
                borderRadius: 8,
                color: '#f4f4f5',
                cursor: submitting ? 'default' : 'pointer',
                textAlign: 'left',
                opacity: submitting ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: card.direction === 'agree' ? '#14532d' : '#7f1d1d',
                  color: card.direction === 'agree' ? '#4ade80' : '#fca5a5',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.5px',
                }}>
                  {card.direction === 'agree' ? '종전↑' : '긴장↑'}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
                {card.description}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 32, fontSize: 10, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
          {name ? `${name} 님` : '참여자'}의 역할 가중치가 분석에 반영됩니다.
        </div>
      </div>
    </div>
  );
}
