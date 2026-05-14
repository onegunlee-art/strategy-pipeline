'use client';

import { useEffect, useState } from 'react';

interface SubFactorLabel {
  id: string; pillar: string; label: string; description: string;
}
interface PillarMeta { label: string; description: string; }

interface VoteData {
  deal_id: number;
  client_name: string;
  deal_size: string;
  closes_at: string | null;
  is_closed: boolean;
  labels: SubFactorLabel[];
  pillar_labels: Record<string, PillarMeta>;
  my_voter: { id: number; display_name: string; role: string; weight: number } | null;
  my_votes: Record<string, number>;
  voter_count: number;
}

const PILLAR_COLORS: Record<string, string> = {
  V: '#4dd0e1', P: '#81c784', D: '#ffb74d', E: '#ba68c8',
};

export default function VotePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<VoteData | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'name' | 'vote' | 'done'>('name');
  const [name, setName] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [voterCount, setVoterCount] = useState(0);

  useEffect(() => {
    fetch(`/api/vote/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setVoterCount(d.voter_count);

        // 기본값: 이전 표 or 5
        const init: Record<string, number> = {};
        for (const f of d.labels) {
          init[f.id] = d.my_votes[f.id] ?? 5;
        }
        setScores(init);

        // 이미 본인 표 있으면 name 스텝 건너뜀
        if (d.my_voter) {
          setName(d.my_voter.display_name);
          setStep(d.is_closed ? 'done' : 'vote');
        } else if (d.is_closed) {
          setStep('done');
        }
      })
      .catch(() => setError('링크 정보를 불러올 수 없습니다.'));
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, scores }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSubmitMsg(d.error ?? '오류 발생');
      } else {
        setVoterCount(d.voter_count);
        setStep('done');
        setSubmitMsg(`투표 반영됨. 현재 ${d.voter_count}명 참여.`);
      }
    } catch {
      setSubmitMsg('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <FullCenter><ErrorCard msg={error} /></FullCenter>;
  if (!data) return <FullCenter><Spinner /></FullCenter>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '2px' }}>
          WIN-RATIO ENGINE — TEAM VOTE
        </div>
        <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>{data.client_name}</div>
        {data.deal_size && <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{data.deal_size}</div>}
        {data.closes_at && (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            링크 마감: {new Date(data.closes_at).toLocaleDateString('ko-KR')}
          </div>
        )}
      </div>

      <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>

        {/* Step: name */}
        {step === 'name' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '2px', marginBottom: '16px' }}>
                참여자 이름
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep('vote'); }}
                autoFocus
                placeholder="예: 홍길동"
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '12px 14px', color: 'var(--text)', fontSize: '16px',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                같은 이름으로 재접속하면 이전 표를 수정할 수 있습니다
              </div>
            </div>
            <button
              onClick={() => setStep('vote')}
              disabled={!name.trim()}
              style={{
                padding: '14px', borderRadius: '10px', border: 'none',
                background: name.trim() ? 'var(--cyan)' : 'var(--surface2)',
                color: name.trim() ? '#000' : 'var(--text-dim)',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600, cursor: name.trim() ? 'pointer' : 'default',
              }}>
              ▶  다음 — 평가 입력
            </button>
          </div>
        )}

        {/* Step: vote */}
        {step === 'vote' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '8px' }}>으로 참여 중</span>
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>
                현재 {voterCount}명 참여
              </span>
            </div>

            {(['V', 'P', 'D', 'E'] as const).map(pid => (
              <div key={pid} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <div style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px',
                  color: PILLAR_COLORS[pid], marginBottom: '16px',
                }}>
                  {pid} — {data.pillar_labels[pid]?.label ?? pid}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {data.labels.filter(f => f.pillar === pid).map(f => (
                    <div key={f.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px' }}>{f.label}</span>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: PILLAR_COLORS[pid], fontWeight: 600, fontSize: '15px', minWidth: '24px', textAlign: 'right' }}>
                          {scores[f.id] ?? 5}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>{f.description}</div>
                      <input type="range" min={1} max={10} step={1} value={scores[f.id] ?? 5}
                        onChange={e => setScores(prev => ({ ...prev, [f.id]: Number(e.target.value) }))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {submitMsg && (
              <div style={{ fontSize: '12px', color: 'var(--red)', background: 'rgba(255,68,102,0.08)', padding: '10px', borderRadius: '6px' }}>
                {submitMsg}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              style={{
                padding: '16px', borderRadius: '10px', border: 'none',
                background: submitting ? 'var(--surface2)' : 'var(--cyan)',
                color: submitting ? 'var(--text-dim)' : '#000',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
              }}>
              {submitting ? 'SUBMITTING...' : '▶  투표 제출'}
            </button>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
              padding: '32px', textAlign: 'center',
            }}>
              {data.is_closed ? (
                <>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '14px', color: 'var(--text-dim)' }}>마감된 투표입니다</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '36px', color: 'var(--cyan)', marginTop: '12px' }}>
                    {voterCount}명 참여
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '24px', color: 'var(--green)' }}>✓ 투표 완료</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '36px', color: 'var(--cyan)', marginTop: '12px' }}>
                    {voterCount}명 참여
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
                    평가를 수정하려면 다시 슬라이더를 조정하고 제출하세요
                  </div>
                </>
              )}
            </div>

            {!data.is_closed && step === 'done' && (
              <button onClick={() => setStep('vote')}
                style={{
                  padding: '12px', borderRadius: '8px', border: '1px solid var(--cyan)',
                  background: 'transparent', color: 'var(--cyan)',
                  fontFamily: 'IBM Plex Mono', fontSize: '12px', cursor: 'pointer',
                }}>
                ↩  평가 수정
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-dim)' }}>LOADING...</div>;
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '360px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--red)', letterSpacing: '2px', marginBottom: '12px' }}>ERROR</div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{msg}</div>
    </div>
  );
}
