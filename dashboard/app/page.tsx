'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import RadarChart from '@/components/charts/RadarChart';
import PositionMatrix from '@/components/charts/PositionMatrix';
import PartnerNetwork from '@/components/charts/PartnerNetwork';
import TimelineChart from '@/components/charts/TimelineChart';
import RiskBubble from '@/components/charts/RiskBubble';
import type { Partner, Risk, Milestone, CompPos, BidTimeline } from '@/lib/types';
import { pillarScoreFromSubs, pillarMultiplication } from '@/lib/pillars';
import type { SubScores } from '@/lib/pillars';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioDeal {
  id: number;
  client_name: string;
  win_probability: number;
  deal_size_eok: number;
  recommendation: string;
}

interface DashboardData {
  deal: {
    id: number; client_name: string; deal_size: string | null; industry: string | null;
    execution_unit: string | null; pm: string | null; duration_months: number | null;
    due_date: string | null; partners: Partner[]; risks: Risk[];
    milestones: Milestone[]; competitive_positioning: CompPos;
    importance_stars: number; bid_timeline: BidTimeline;
    team_size: number | null; team_members: { name: string; dept: string; role: string }[];
    expected_revenue?: number | null;
    margin_rate?: number | null;
  };
  prediction: {
    probability: number;
    method_probs: Record<string, number>;
    pillar_scores: Record<string, number>;
    sub_scores: Record<string, number>;
    weaknesses: Array<{ id: string; label: string; pillar: string; score: number; contribution: number }>;
    next_moves: Array<{
      action_id: string; label: string; pillar: string;
      effort: number; owner: string;
      prob_before: number; prob_after: number;
      delta_pp: number; roi: number;
    }>;
    confidence_interval: { low: number; high: number };
    created_at: string;
  } | null;
  portfolio_rank: number;
  portfolio_size: number;
  model_trust?: {
    level: 'structural' | 'low' | 'medium' | 'high';
    label: string; detail: string;
    labeled_count: number; brier: number | null; color: string;
  };
}

interface StrategyCard {
  sub_factor_id: string; label: string; current_score: number;
  reasoning_trace: { situation: string; complication: string; question: string; answer_summary: string };
  cause_hypothesis: string; external_evidence: string;
  actions: { step: string; owner: string; duration: string }[];
  expected_score_lift: number; expected_probability_lift_pp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function probColor(p: number) {
  return p >= 65 ? 'var(--green)' : p >= 45 ? 'var(--yellow)' : 'var(--red)';
}

function todayKST() {
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '2px', padding: '16px', ...style,
    }}>
      <div style={{ fontSize: '10px', letterSpacing: '1.5px', color: 'var(--text-dim)', marginBottom: '10px', fontFamily: 'IBM Plex Mono' }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
      {label}
      <div style={{ marginTop: '6px', fontSize: '11px' }}>
        <a href="/admin" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Admin에서 입력 →</a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const [deals, setDeals] = useState<PortfolioDeal[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [loadingDash, setLoadingDash] = useState(false);
  const [cards, setCards] = useState<StrategyCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [scqaError, setScqaError] = useState('');
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // What-if 시뮬레이터 상태 (클라이언트 사이드 즉시 계산)
  const [simSubs, setSimSubs] = useState<Record<string, number> | null>(null);
  const [simMode, setSimMode] = useState(false);

  const simProb = simSubs
    ? Math.round(pillarMultiplication(pillarScoreFromSubs(simSubs as SubScores)) * 1000) / 10
    : null;
  const baseProb = dashData?.prediction?.probability ?? null;
  const simDelta = simProb !== null && baseProb !== null ? Math.round((simProb - baseProb) * 10) / 10 : null;
  const rev = dashData?.deal?.expected_revenue ?? null;
  const simEvDelta = simDelta !== null && rev !== null ? Math.round(rev * simDelta) / 100 : null;

  const handleSimSlider = useCallback((factorId: string, value: number) => {
    setSimSubs(prev => prev ? { ...prev, [factorId]: value } : null);
  }, []);

  const resetSim = useCallback(() => {
    if (dashData?.prediction?.sub_scores) {
      setSimSubs({ ...dashData.prediction.sub_scores });
    }
  }, [dashData]);

  // Load portfolio
  useEffect(() => {
    setLoadingDeals(true);
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(d => {
        if (d.deals?.length > 0) {
          setDeals(d.deals);
          setSelectedId(d.deals[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDeals(false));
  }, []);

  // Load dashboard when deal changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDash(true);
    setCards([]);
    setStreamText('');
    setScqaError('');
    setSimMode(false);
    setSimSubs(null);
    fetch(`/api/dashboard/${selectedId}`)
      .then(r => r.json())
      .then(d => {
        setDashData(d);
        if (d?.prediction?.sub_scores) {
          setSimSubs({ ...d.prediction.sub_scores });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDash(false));
  }, [selectedId]);

  const generateScqa = async () => {
    if (!selectedId || !dashData?.prediction) return;
    setGenerating(true);
    setCards([]);
    setStreamText('');
    setScqaError('');

    try {
      const res = await fetch(`/api/strategy/${selectedId}`, { method: 'POST' });
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'delta') setStreamText(t => t + ev.text);
            if (ev.type === 'cards' && Array.isArray(ev.cards)) setCards(ev.cards);
          } catch {}
        }
      }
    } catch (e) {
      setScqaError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const deal = dashData?.deal;
  const pred = dashData?.prediction;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100, padding: '0 32px',
      }}>
        <div style={{
          maxWidth: '1440px', margin: '0 auto', height: '56px',
          display: 'flex', alignItems: 'center', gap: '20px',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kt-logo.jpg" alt="KT" style={{ height: '24px' }} />
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0' }}>
              Winning Ratio
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>수주 전략 플랫폼</span>
          </div>

          {/* Deal selector */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {loadingDeals ? (
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>LOADING...</span>
            ) : deals.length > 0 ? (
              <select
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value))}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '6px 12px', borderRadius: '2px',
                  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', minWidth: '220px',
                }}
              >
                {deals.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.client_name}
                    {d.win_probability > 0 ? ` (${d.win_probability.toFixed(0)}%)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                딜 없음 — <a href="/admin" style={{ color: 'var(--brand)' }}>Admin에서 추가</a>
              </span>
            )}
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
              {todayKST()} KST
            </span>
            <a href="/admin" style={{
              fontSize: '11px', color: 'var(--text-dim)', textDecoration: 'none',
              letterSpacing: '1px', padding: '4px 10px', border: '1px solid var(--border)',
              borderRadius: '2px', fontWeight: 500,
            }}>ADMIN</a>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {loadingDash && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
            LOADING DEAL DATA...
          </div>
        )}

        {!loadingDash && !dashData && !loadingDeals && deals.length > 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
            딜을 선택하세요
          </div>
        )}

        {!loadingDash && !dashData && !loadingDeals && deals.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text)', fontSize: '15px', marginBottom: '8px' }}>등록된 딜이 없습니다</div>
            <a href="/admin" style={{ color: 'var(--brand)', fontSize: '13px' }}>Admin에서 딜 추가 →</a>
          </div>
        )}

        {!loadingDash && dashData && deal && (
          <>
            {/* ── ZONE 1: Deal Banner ───────────────────────────── */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '2px', padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
                    {deal.client_name}
                  </div>
                  {deal.importance_stars > 0 && (
                    <span style={{ fontSize: '14px', color: 'var(--yellow)', letterSpacing: '1px' }}>
                      {'★'.repeat(deal.importance_stars)}{'☆'.repeat(5 - deal.importance_stars)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {deal.execution_unit && (
                    <span style={badgeStyle}>{deal.execution_unit}</span>
                  )}
                  {deal.pm && (
                    <span style={{ ...badgeStyle, color: 'var(--text-mid)' }}>PM: {deal.pm}</span>
                  )}
                  {deal.duration_months && (
                    <span style={badgeStyle}>{deal.duration_months}개월</span>
                  )}
                  {deal.team_size && (
                    <span style={{ ...badgeStyle, color: 'var(--text-mid)' }}>{deal.team_size}명</span>
                  )}
                  {/* 입찰 일정 4종 */}
                  {deal.bid_timeline?.rfp_published && (
                    <span style={badgeStyle}>공고 {new Date(deal.bid_timeline.rfp_published).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')}</span>
                  )}
                  {deal.bid_timeline?.bid_deadline && (
                    <span style={{ ...badgeStyle, color: 'var(--yellow)' }}>
                      마감 D-{Math.max(0, Math.ceil((new Date(deal.bid_timeline.bid_deadline).getTime() - Date.now()) / 86400000))}
                    </span>
                  )}
                  {deal.bid_timeline?.pt_date && (
                    <span style={{ ...badgeStyle, color: 'var(--cyan)' }}>
                      PT {new Date(deal.bid_timeline.pt_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')}
                    </span>
                  )}
                  {deal.bid_timeline?.announcement_date && (
                    <span style={badgeStyle}>
                      발표 {new Date(deal.bid_timeline.announcement_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')}
                    </span>
                  )}
                  {deal.due_date && (
                    <span style={{ ...badgeStyle, color: 'var(--red)' }}>
                      D-{Math.max(0, Math.ceil((new Date(deal.due_date).getTime() - Date.now()) / 86400000))}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {pred ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '36px', fontWeight: 700, lineHeight: 1, color: probColor(pred.probability), fontFamily: 'IBM Plex Mono' }}>
                      {pred.probability.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                      CI {pred.confidence_interval.low.toFixed(0)}–{pred.confidence_interval.high.toFixed(0)}
                    </div>
                    {dashData?.model_trust && (
                      <div
                        title={dashData.model_trust.detail}
                        style={{
                          marginTop: '4px', fontSize: '10px', fontWeight: 600,
                          color: dashData.model_trust.color, cursor: 'help',
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dashData.model_trust.color, display: 'inline-block' }} />
                        신뢰 {dashData.model_trust.label}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '12px' }}>
                    예측 없음
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={generateScqa}
                    disabled={!pred || generating}
                    style={{
                      ...actionBtn,
                      opacity: !pred ? 0.4 : 1,
                      cursor: !pred ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generating ? '생성 중...' : 'SCQA 생성'}
                  </button>
                  <button
                    onClick={() => pred && window.open(`/brief/${deal.id}`, '_blank')}
                    disabled={!pred}
                    style={{
                      ...actionBtn,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      opacity: !pred ? 0.4 : 1,
                      cursor: !pred ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Executive Brief
                  </button>
                  <button
                    onClick={() => window.open(`/report/${deal.id}`, '_blank')}
                    style={{
                      ...actionBtn,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    보고서
                  </button>
                </div>
              </div>
            </div>

            {/* ── ZONE 2: 3-col charts ──────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Panel title="수주 가능성 레이더">
                {pred ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RadarChart scores={pred.pillar_scores} size={240} />
                  </div>
                ) : (
                  <EmptyPanel label="Pillar 진단 필요" />
                )}
              </Panel>

              <Panel title="경쟁 포지셔닝 매트릭스">
                {deal.competitive_positioning?.self || (deal.competitive_positioning?.competitors?.length ?? 0) > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <PositionMatrix
                        self={deal.competitive_positioning.self}
                        competitors={deal.competitive_positioning.competitors ?? []}
                      />
                    </div>
                    {(deal.competitive_positioning.competitors?.filter(c => c.notes).length ?? 0) > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {deal.competitive_positioning.competitors?.filter(c => c.notes).map((c, i) => (
                          <div key={i} style={{ fontSize: '11px', background: 'var(--surface2)', borderRadius: '4px', padding: '7px 10px' }}>
                            <span style={{
                              display: 'inline-block', marginRight: '6px', fontSize: '9px', fontFamily: 'IBM Plex Mono',
                              padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.5px',
                              background: c.risk_level === 'high' ? 'rgba(255,68,102,0.15)' : c.risk_level === 'low' ? 'rgba(0,212,160,0.12)' : 'rgba(255,200,60,0.12)',
                              color: c.risk_level === 'high' ? 'var(--red)' : c.risk_level === 'low' ? 'var(--green)' : 'var(--yellow)',
                            }}>{c.name}</span>
                            <span style={{ color: 'var(--text-dim)' }}>{c.notes}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyPanel label="포지셔닝 데이터 없음" />
                )}
              </Panel>

              <Panel title="협력 파트너 구조">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PartnerNetwork partners={deal.partners} />
                </div>
                {deal.partners.filter(p => p.task_scope).length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {['파트너', '역할', '과업 범위'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deal.partners.filter(p => p.name).map((p, i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}>{p.name}</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{p.role}</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{p.task_scope ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            {/* ── ZONE 3: Strategy Cards / SCQA ────────────────── */}
            <Panel title="전략 3레이어 (SCQA)">
              {generating && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '10px' }}>
                    AI 분석 중...
                  </div>
                  {streamText && (
                    <pre style={{
                      fontSize: '11px', color: 'var(--text-mid)', background: 'var(--surface2)',
                      padding: '12px', borderRadius: '2px', maxHeight: '120px',
                      overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {streamText.slice(-400)}
                    </pre>
                  )}
                </div>
              )}

              {scqaError && (
                <div style={{ color: 'var(--red)', fontSize: '12px', padding: '12px 0' }}>{scqaError}</div>
              )}

              {cards.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {cards.map((card, i) => (
                    <ScqaCard key={i} card={card} />
                  ))}
                </div>
              )}

              {!generating && cards.length === 0 && !scqaError && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                  {pred
                    ? 'SCQA 생성 버튼을 눌러 AI 전략 카드를 생성하세요'
                    : '예측 데이터가 없습니다 — Admin에서 Pillar 진단을 실행하세요'
                  }
                </div>
              )}
            </Panel>

            {/* ── ZONE 4: Timeline + Risk ───────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '16px' }}>
              <Panel title="입찰 타임라인">
                {deal.milestones.length > 0 || deal.due_date ? (
                  <TimelineChart milestones={deal.milestones} dueDate={deal.due_date} />
                ) : (
                  <EmptyPanel label="마일스톤 없음" />
                )}
              </Panel>

              <Panel title="리스크 매트릭스">
                {deal.risks.length > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RiskBubble risks={deal.risks} />
                  </div>
                ) : (
                  <EmptyPanel label="리스크 데이터 없음" />
                )}
              </Panel>
            </div>

            {/* ── ZONE 5: What-if 시뮬레이터 ─────────────────────── */}
            {pred && simSubs && (
              <Panel title="What-if 시뮬레이터 — 슬라이더로 즉시 확률 변화 확인">
                {/* 헤더: 현재 확률 → 시뮬레이션 확률 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>기준</span>
                    <span style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: probColor(baseProb ?? 0) }}>
                      {(baseProb ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <span style={{ fontSize: '18px', color: 'var(--text-dim)' }}>→</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>시뮬레이션</span>
                    <span style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: probColor(simProb ?? 0) }}>
                      {(simProb ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  {simDelta !== null && simDelta !== 0 && (
                    <span style={{
                      fontSize: '14px', fontWeight: 700, fontFamily: 'IBM Plex Mono',
                      color: simDelta > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {simDelta > 0 ? '+' : ''}{simDelta.toFixed(1)}%p
                    </span>
                  )}
                  {simEvDelta !== null && simEvDelta !== 0 && (
                    <span style={{
                      fontSize: '13px', fontFamily: 'IBM Plex Mono',
                      color: simEvDelta > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      기대매출 {simEvDelta > 0 ? '+' : ''}{simEvDelta.toFixed(1)}억
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setSimMode(m => !m)}
                      style={{
                        fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                        background: simMode ? 'var(--brand)' : 'var(--surface2)',
                        color: simMode ? '#000' : 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: '2px', fontFamily: 'IBM Plex Mono',
                      }}
                    >
                      {simMode ? '슬라이더 닫기' : '슬라이더 열기'}
                    </button>
                    <button
                      onClick={resetSim}
                      style={{
                        fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                        background: 'var(--surface2)', color: 'var(--text-dim)',
                        border: '1px solid var(--border)', borderRadius: '2px', fontFamily: 'IBM Plex Mono',
                      }}
                    >
                      리셋
                    </button>
                  </div>
                </div>

                {/* 슬라이더 그리드 */}
                {simMode && (() => {
                  const SUB_LABELS: Record<string, { label: string; pillar: string }> = {
                    s_key_man_contact: { label: 'Key Man 접촉', pillar: 'S' },
                    s_evaluator_rfp: { label: '평가위원/RFP 파악', pillar: 'S' },
                    s_poc_proposal: { label: 'PoC/파일럿 제안', pillar: 'S' },
                    v_needs_painpoint: { label: '니즈/Pain Point', pillar: 'V' },
                    v_value_proposition: { label: '가치제안', pillar: 'V' },
                    v_presentation: { label: '임팩트 PT', pillar: 'V' },
                    d_competitive_strategy: { label: '경쟁 전략', pillar: 'D' },
                    d_tech_reference: { label: '기술/레퍼런스', pillar: 'D' },
                    d_partner: { label: '파트너/컨소시엄', pillar: 'D' },
                    p_budget_fit: { label: '예산 적합성', pillar: 'P' },
                    p_price_competition: { label: '가격 경쟁력', pillar: 'P' },
                    p_cost_value: { label: 'ROI/TCO 가성비', pillar: 'P' },
                    e_track_record: { label: '수행 실적', pillar: 'E' },
                    e_risk_management: { label: '리스크 관리', pillar: 'E' },
                    e_execution_team: { label: '수행팀 역량', pillar: 'E' },
                  };
                  const pillarColor: Record<string, string> = {
                    S: 'var(--cyan)', V: 'var(--brand)', D: 'var(--yellow)', P: 'var(--green)', E: 'var(--red)',
                  };
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                      {Object.entries(SUB_LABELS).map(([id, { label, pillar }]) => {
                        const val = simSubs[id] ?? 5;
                        const base = pred.sub_scores?.[id] ?? val;
                        const changed = Math.abs(val - base) > 0.01;
                        return (
                          <div key={id} style={{
                            background: 'var(--surface2)', borderRadius: '2px', padding: '10px 12px',
                            borderLeft: `3px solid ${changed ? pillarColor[pillar] : 'var(--border)'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: changed ? 'var(--text)' : 'var(--text-dim)' }}>{label}</span>
                              <span style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono', fontWeight: 700, color: pillarColor[pillar] }}>
                                {val.toFixed(1)}
                                {changed && (
                                  <span style={{ fontSize: '10px', color: val > base ? 'var(--green)' : 'var(--red)', marginLeft: '4px' }}>
                                    {val > base ? '+' : ''}{(val - base).toFixed(1)}
                                  </span>
                                )}
                              </span>
                            </div>
                            <input
                              type="range" min={1} max={10} step={0.5}
                              value={val}
                              onChange={e => handleSimSlider(id, Number(e.target.value))}
                              style={{ width: '100%', accentColor: pillarColor[pillar] }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Panel>
            )}

            {/* ── ZONE 6: Next Best Move + 앙상블 분해 ───────────── */}
            {pred && pred.next_moves?.length > 0 && (
              <Panel title="다음 최선의 수 (Next Best Move)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {pred.next_moves.map((m, i) => {
                    const pillarColor: Record<string, string> = {
                      S: 'var(--cyan)', V: 'var(--brand)', D: 'var(--yellow)', P: 'var(--green)', E: 'var(--red)',
                    };
                    const color = pillarColor[m.pillar] ?? 'var(--text-dim)';
                    const effortDots = '●'.repeat(m.effort) + '○'.repeat(5 - m.effort);
                    return (
                      <div key={m.action_id} style={{
                        background: 'var(--surface2)', borderRadius: '2px',
                        padding: '12px 14px', borderLeft: `3px solid ${color}`,
                        display: 'flex', flexDirection: 'column', gap: '6px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color, fontWeight: 700 }}>
                            #{i + 1} · {m.pillar} PILLAR
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--green)', fontWeight: 700 }}>
                            +{m.delta_pp.toFixed(1)}pp
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4, fontWeight: 500 }}>
                          {m.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            {m.prob_before.toFixed(1)}% → {m.prob_after.toFixed(1)}%
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', letterSpacing: '1px' }}>
                              {effortDots}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{m.owner}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                  ● effort 1-5 · ROI = ΔP / effort · 1-step lookahead
                </div>
              </Panel>
            )}

            {pred && (
              <Panel title="앙상블 분해 (Pillar · Bayesian · Elo)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  {[
                    { key: 'pillar', label: 'Pillar' },
                    { key: 'bayesian', label: 'Bayesian' },
                    { key: 'elo', label: 'Elo' },
                    { key: 'monteCarlo', label: 'Monte Carlo' },
                  ].map(({ key, label }) => {
                    const v = Number(pred.method_probs[key] ?? 0);
                    return (
                      <div key={key} style={{ padding: '12px', background: 'var(--surface2)', borderRadius: '2px', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '4px' }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: probColor(v) }}>
                          {v.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pred.weaknesses.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', letterSpacing: '1px', marginBottom: '8px' }}>
                      TOP WEAKNESSES
                    </div>
                    {pred.weaknesses.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', minWidth: '16px' }}>#{i + 1}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{w.label}</span>
                        <div style={{ width: '100px', height: '5px', background: 'var(--surface2)', borderRadius: '2px' }}>
                          <div style={{
                            width: `${(w.score / 10) * 100}%`, height: '100%',
                            background: w.score < 4 ? 'var(--red)' : w.score < 7 ? 'var(--yellow)' : 'var(--green)',
                            borderRadius: '2px',
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', minWidth: '28px', textAlign: 'right' }}>
                          {w.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </>
        )}

        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', padding: '4px 0 16px' }}>
          본 시스템은 의사결정 보조 지표이며 실제 수주를 보장하지 않습니다.
        </div>
      </main>
    </div>
  );
}

// ─── SCQA Card ────────────────────────────────────────────────────────────────

function ScqaCard({ card }: { card: StrategyCard }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: '2px', padding: '14px',
      borderTop: '3px solid var(--brand)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '4px' }}>
        [{card.sub_factor_id}]
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
        {card.label}
        <span style={{ marginLeft: '8px', fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
          {card.current_score.toFixed(1)}/10
        </span>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: '8px' }}>
        {card.reasoning_trace.answer_summary}
      </div>

      {expanded && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {[
              { label: 'S', text: card.reasoning_trace.situation },
              { label: 'C', text: card.reasoning_trace.complication },
              { label: 'Q', text: card.reasoning_trace.question },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--brand)', minWidth: '14px', fontWeight: 700 }}>{r.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text)', lineHeight: 1.5 }}>{r.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '4px' }}>ACTIONS</div>
            {card.actions.map((a, i) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text)', marginBottom: '3px', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
                <span style={{ color: 'var(--text-dim)' }}>{a.duration} / {a.owner}</span> — {a.step}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--green)' }}>
          +{card.expected_probability_lift_pp}pp 예상
        </span>
        <button onClick={() => setExpanded(x => !x)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '11px', color: 'var(--text-dim)', padding: '2px 4px',
        }}>
          {expanded ? '접기' : '상세 보기'}
        </button>
      </div>
    </div>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const badgeStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-mid)',
  background: 'var(--surface2)', padding: '2px 8px',
  borderRadius: '2px', border: '1px solid var(--border)',
};

const actionBtn: React.CSSProperties = {
  padding: '7px 16px', background: 'var(--brand)', color: '#fff',
  border: 'none', borderRadius: '2px', fontSize: '12px',
  fontFamily: 'IBM Plex Mono', fontWeight: 600, letterSpacing: '0.5px',
  cursor: 'pointer',
};
