'use client';

import { useEffect, useState } from 'react';

interface QuestionItem {
  id: number;
  question_no: number;
  sub_factor_id: string;
  lv1_category: string;
  lv2_group: string;
  lv3_label: string;
  question_text: string;
  importance: string;
  display_order: number;
}

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
  questions: QuestionItem[];
  my_voter: { id: number; display_name: string; role: string; weight: number } | null;
  my_votes: Record<string, number>;
  voter_count: number;
}

type AnswerLevel = 'low' | 'mid' | 'high';

const PILLAR_COLORS: Record<string, string> = {
  S: '#7c3aed', V: '#0ea5e9', D: '#10b981', P: '#f59e0b', E: '#ef4444',
};

const PILLAR_LABELS: Record<string, string> = {
  S: '사전영업', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery',
};

const LEVEL_LABELS: Record<AnswerLevel, string> = { low: '하', mid: '중', high: '상' };
const LEVEL_SCORES: Record<AnswerLevel, string> = { low: '(2점)', mid: '(6점)', high: '(9점)' };

export default function VotePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<VoteData | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'name' | 'vote' | 'done'>('name');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('reviewer');
  const [answers, setAnswers] = useState<Record<number, AnswerLevel>>({});
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

        if (d.my_voter) {
          setName(d.my_voter.display_name);
          if (d.my_voter.role) setRole(d.my_voter.role);
          setStep(d.is_closed ? 'done' : 'vote');
        } else if (d.is_closed) {
          setStep('done');
        }
      })
      .catch(() => setError('링크 정보를 불러올 수 없습니다.'));
  }, [token]);

  const handleSubmit = async () => {
    if (!data) return;
    const totalQuestions = data.questions.length;
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < totalQuestions) {
      setSubmitMsg(`${totalQuestions - answeredCount}개 질문이 아직 선택되지 않았습니다.`);
      return;
    }
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch(`/api/vote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, role, question_answers: answers }),
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

  // 질문 목록을 pillar(lv1_category) 단위로 그룹화
  const pillarGroups = ['S', 'V', 'D', 'P', 'E'];
  const questionsByPillar: Record<string, QuestionItem[]> = {};
  for (const pid of pillarGroups) {
    questionsByPillar[pid] = data.questions.filter(q => q.lv1_category === pid);
  }

  const totalQ = data.questions.length;
  const answeredQ = Object.keys(answers).length;
  const progress = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

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

      <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>

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
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                같은 이름으로 재접속하면 이전 표를 수정할 수 있습니다
              </div>

              <div style={{ marginTop: '20px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '2px', marginBottom: '10px' }}>
                  본인 역할
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {([
                    ['executive', '임원', '2.5×'],
                    ['sales_rep', '영업대표', '2.3×'],
                    ['proposal_pm', '제안 PM', '2.0×'],
                    ['bm', 'BM', '1.8×'],
                    ['pmo', 'PMO', '1.6×'],
                    ['reviewer', '검토자', '1.0×'],
                  ] as const).map(([id, label, wt]) => (
                    <button
                      key={id}
                      onClick={() => setRole(id)}
                      style={{
                        padding: '10px 8px', borderRadius: '6px',
                        border: '1px solid ' + (role === id ? 'var(--cyan)' : 'var(--border)'),
                        background: role === id ? 'var(--cyan-dim)' : 'var(--surface2)',
                        color: role === id ? 'var(--cyan)' : 'var(--text)',
                        fontSize: '12px', cursor: 'pointer', textAlign: 'center',
                      }}>
                      <div>{label}</div>
                      <div style={{ fontSize: '10px', color: role === id ? 'var(--cyan)' : 'var(--text-dim)', marginTop: '2px' }}>{wt}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                  역할별로 평가 가중치가 달라집니다
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep('vote')}
              disabled={!name.trim()}
              style={{
                padding: '14px', borderRadius: '10px', border: 'none',
                background: name.trim() ? 'var(--cyan)' : 'var(--surface2)',
                color: name.trim() ? '#fff' : 'var(--text-dim)',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600,
                cursor: name.trim() ? 'pointer' : 'default',
              }}>
              ▶  다음 — 평가 입력 ({totalQ}개 질문)
            </button>
          </div>
        )}

        {/* Step: vote */}
        {step === 'vote' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '8px' }}>으로 참여 중</span>
                </div>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>
                  {answeredQ}/{totalQ} 완료 · {voterCount}명 참여
                </span>
              </div>
              <div style={{ height: '4px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--cyan)', borderRadius: '2px', transition: 'width 0.2s' }} />
              </div>
            </div>

            {/* Pillar 그룹별 질문 카드 */}
            {pillarGroups.map(pid => {
              const qs = questionsByPillar[pid] ?? [];
              if (qs.length === 0) return null;
              const pillarColor = PILLAR_COLORS[pid] ?? '#888';
              const pillarLabel = data.pillar_labels[pid]?.label ?? PILLAR_LABELS[pid] ?? pid;
              const pillarAnswered = qs.filter(q => answers[q.question_no] != null).length;
              return (
                <div key={pid} style={{ background: 'var(--surface)', border: `1px solid ${pillarColor}33`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ background: `${pillarColor}18`, padding: '14px 20px', borderBottom: `1px solid ${pillarColor}33` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: pillarColor, letterSpacing: '1px', fontWeight: 700 }}>
                        {pid} — {pillarLabel}
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-dim)' }}>
                        {pillarAnswered}/{qs.length}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {qs.map((q, qi) => {
                      const ans = answers[q.question_no];
                      return (
                        <div key={q.question_no} style={{
                          padding: '16px 20px',
                          borderBottom: qi < qs.length - 1 ? '1px solid var(--border)' : 'none',
                          background: ans ? `${pillarColor}08` : 'transparent',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                                Q{q.question_no} · {q.lv2_group}
                                {q.importance === 'high' && (
                                  <span style={{ marginLeft: '6px', fontSize: '10px', color: pillarColor, background: `${pillarColor}20`, padding: '1px 5px', borderRadius: '3px' }}>중요</span>
                                )}
                              </div>
                              <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text)' }}>
                                {q.question_text}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {(['low', 'mid', 'high'] as AnswerLevel[]).map(level => (
                              <button
                                key={level}
                                onClick={() => setAnswers(prev => ({ ...prev, [q.question_no]: level }))}
                                style={{
                                  flex: 1, padding: '10px 6px', borderRadius: '8px', cursor: 'pointer',
                                  border: `1px solid ${ans === level ? pillarColor : 'var(--border)'}`,
                                  background: ans === level ? `${pillarColor}25` : 'var(--surface2)',
                                  color: ans === level ? pillarColor : 'var(--text-dim)',
                                  fontFamily: 'IBM Plex Mono', fontSize: '14px', fontWeight: ans === level ? 700 : 400,
                                  transition: 'all 0.1s',
                                  textAlign: 'center',
                                }}>
                                <div>{LEVEL_LABELS[level]}</div>
                                <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>{LEVEL_SCORES[level]}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {submitMsg && (
              <div style={{ fontSize: '12px', color: 'var(--red)', background: 'rgba(255,68,102,0.08)', padding: '10px', borderRadius: '6px' }}>
                {submitMsg}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '16px', borderRadius: '10px',
                border: answeredQ < totalQ ? '1px solid var(--border)' : 'none',
                background: submitting ? 'var(--surface2)' : answeredQ === totalQ ? 'var(--cyan)' : 'var(--surface)',
                color: submitting ? 'var(--text-dim)' : answeredQ === totalQ ? '#fff' : 'var(--text-dim)',
                fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 600,
                cursor: submitting ? 'wait' : 'pointer',
              }}>
              {submitting
                ? 'SUBMITTING...'
                : answeredQ < totalQ
                  ? `▶  투표 제출 (${totalQ - answeredQ}개 미선택)`
                  : '▶  투표 제출'}
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
                    평가를 수정하려면 아래 버튼을 눌러 다시 답변하세요
                  </div>
                </>
              )}
            </div>

            {!data.is_closed && (
              <button
                onClick={() => setStep('vote')}
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
