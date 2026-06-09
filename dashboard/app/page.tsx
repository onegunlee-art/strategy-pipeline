'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import RadarChart from '@/components/charts/RadarChart';
import ProbabilityDistribution from '@/components/charts/ProbabilityDistribution';
import { QRCodeSVG } from 'qrcode.react';
import PositionMatrix from '@/components/charts/PositionMatrix';
import PartnerNetwork from '@/components/charts/PartnerNetwork';
import TimelineChart from '@/components/charts/TimelineChart';
import RiskBubble from '@/components/charts/RiskBubble';
import type { Partner, Risk, Milestone, CompPos, BidTimeline } from '@/lib/types';
import { pillarScoreFromSubs, pillarMultiplication } from '@/lib/pillars';
import type { SubScores } from '@/lib/pillars';
import { ACTION_CATALOG } from '@/lib/actionCatalog';
import { ROLE_LABEL, ROLE_WEIGHTS, VoterRole } from '@/lib/voteWeights';
import { GeoDriver, contribution, computeGeoProb, normalizeDriverMeta, FALLBACK_DRIVER_META, FALLBACK_DRIVER_SCORES, DRIVER_COLORS } from '@/lib/geoDrivers';
import type { GistArticle, GistCluster } from '@/lib/gistRag';
import { gistArticleUrl } from '@/lib/gistRag';

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
    team_size: number | null; team_members: { name?: string; division?: string; hq?: string; dept?: string; team?: string; role?: string; count?: number }[];
    expected_revenue?: number | null;
    margin_rate?: number | null;
    contribution_margin?: number | null;
    subcontract_rate?: number | null;
    risk_grade?: string | null;
    pt_format?: string | null;
    customer_eval_criteria?: string | null;
    vdc_b_result?: { decision: string; detail: string }[];
    qna_items?: { question: string; answer: string }[];
    winning_points?: { customer_cfs?: string; winning_point: string }[];
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

interface SavedScenario {
  id: number;
  name: string;
  actions: Record<string, number>;
  prob_path: number[];
  revenue_path: number[];
  created_at: string;
}

interface ActionLogEntry {
  id: number;
  action_id: string;
  taken_at: string;
  taken_by: string | null;
  notes: string | null;
  sub_scores_before: Record<string, number> | null;
  sub_scores_after: Record<string, number> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function probColor(p: number) {
  return p >= 65 ? 'var(--green)' : p >= 45 ? 'var(--yellow)' : 'var(--red)';
}

// 수주전략 DB가 준비되면 true로 바꿔 모드 토글을 노출한다.
const SHOW_MODE_TOGGLE = false;

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

const ALGO_STEPS = [
  { label: '글로벌 뉴스 RAG 인덱스 연결',     done: 'FA · Economist · FT 외 7개 소스 연결' },
  { label: '기사 수집 및 유사도 필터링',         done: '관련도 ≥ 0.35 검증 완료' },
  { label: 'Alignment / Conflict 신호 추출',  done: '구조적 대립 신호 분류 완료' },
  { label: 'OpenAI o4-mini 드라이버 최적화',   done: '5축 점수 벡터 계산 완료' },
  { label: 'Bayesian 사후확률 수렴',           done: 'P(θ|D) ∝ P(D|θ) × P(θ) 수렴' },
];

function AlgorithmLoader() {
  const [phase, setPhase] = useState(0); // 0=idle, 1..n=step in progress, n+1=done
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    ALGO_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setPhase(i + 1), i * 1100 + 300));
    });
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div style={{ padding:'16px 0', display:'flex', flexDirection:'column', gap:'0px' }}>
      <div style={{ fontSize:'9px', letterSpacing:'1.5px', fontFamily:'IBM Plex Mono', color:'var(--brand)', marginBottom:'14px' }}>
        ENSEMBLE ALGORITHM — RUNNING
      </div>
      {ALGO_STEPS.map((s, i) => {
        const done = phase > i + 1;
        const active = phase === i + 1;
        return (
          <div key={i} style={{
            display:'flex', alignItems:'flex-start', gap:'10px',
            padding:'9px 12px',
            background: active ? 'rgba(34,211,238,0.06)' : done ? 'rgba(34,211,238,0.02)' : 'transparent',
            borderLeft: active ? '2px solid var(--brand)' : done ? '2px solid rgba(34,211,238,0.3)' : '2px solid var(--border)',
            marginBottom:'2px', borderRadius:'0 3px 3px 0',
            transition:'all 0.4s ease',
            opacity: phase < i + 1 ? 0.35 : 1,
          }}>
            <div style={{ width:'14px', marginTop:'1px', flexShrink:0 }}>
              {done && <span style={{ color:'var(--brand)', fontSize:'11px' }}>✓</span>}
              {active && (
                <div style={{
                  width:'10px', height:'10px', border:'2px solid var(--brand)',
                  borderTopColor:'transparent', borderRadius:'50%',
                  animation:'spin 0.7s linear infinite', marginTop:'1px',
                }} />
              )}
              {phase < i + 1 && <span style={{ color:'var(--border)', fontSize:'11px' }}>○</span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'11px', fontFamily:'IBM Plex Mono',
                color: active ? 'var(--text)' : done ? 'var(--text-mid)' : 'var(--text-dim)',
                fontWeight: active ? 600 : 400 }}>
                {s.label}{active ? <span style={{ animation:'blink 0.8s step-end infinite' }}>...</span> : ''}
              </div>
              {done && (
                <div style={{ fontSize:'10px', color:'var(--brand)', marginTop:'2px', fontFamily:'IBM Plex Mono' }}>
                  {s.done}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
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

  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  // 데모: 수주전략 DB가 아직 없어 지정학 분석을 기본 화면으로. 토글은 숨김.
  const [mode, setMode] = useState<'bid' | 'geo'>('geo');
  const [geoStep, setGeoStep] = useState(1);

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
    setScenarios([]);
    setActionLog([]);
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
    fetch(`/api/deals/${selectedId}/scenarios`)
      .then(r => r.json())
      .then(d => { if (d.scenarios) setScenarios(d.scenarios); })
      .catch(() => {});
    fetch(`/api/deals/${selectedId}/action-log`)
      .then(r => r.json())
      .then(d => { if (d.action_log) setActionLog(d.action_log); })
      .catch(() => {});
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

          {/* Mode toggle (수주전략 DB 준비 시 SHOW_MODE_TOGGLE=true) */}
          {SHOW_MODE_TOGGLE && (
            <div style={{ display:'flex', gap:'4px', fontFamily:'IBM Plex Mono', fontSize:'11px', flexShrink:0 }}>
              {(['bid','geo'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding:'5px 12px', borderRadius:'2px', border:'none', cursor:'pointer',
                  background: mode===m ? 'var(--brand)' : 'var(--surface2)',
                  color: mode===m ? '#fff' : 'var(--text-mid)', letterSpacing:'0.3px',
                }}>
                  {m === 'bid' ? '수주전략' : '지정학 분석'}
                </button>
              ))}
            </div>
          )}

          {/* Deal selector — 지정학 모드에선 숨김(목적과 무관) */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {mode === 'geo' ? null : loadingDeals ? (
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
      <div style={{ maxWidth:'1440px', margin:'0 auto', display:'flex', alignItems:'flex-start' }}>
        {mode === 'geo' && <GeoProcessSidebar step={geoStep} onStepClick={setGeoStep} />}
        <main style={{ flex:1, padding:'20px 32px', display:'flex', flexDirection:'column', gap:'16px', minWidth:0 }}>
          {mode === 'geo' ? (
            <GeoContent step={geoStep} setStep={setGeoStep} />
          ) : (
            <>

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
                          {['파트너', '구분', '과업 범위', '비율'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deal.partners.filter(p => p.name).map((p, i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}>{p.name}</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>{p.category ?? p.role ?? '-'}</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{p.task_scope ?? '-'}</td>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}>{p.ratio_pct != null ? `${p.ratio_pct}%` : '-'}</td>
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

            {/* ── ZONE 4.5: SG 보고서 양식 데이터 ────────────────── */}
            {(() => {
              const winning = deal.winning_points ?? [];
              const org = (deal.team_members ?? []).filter(m => m.dept || m.team || m.role || m.name);
              const vdcB = deal.vdc_b_result ?? [];
              const qna = deal.qna_items ?? [];
              const hasRevenue = deal.contribution_margin != null || deal.subcontract_rate != null || deal.risk_grade != null;
              const hasAny = hasRevenue || winning.length > 0 || org.length > 0 || vdcB.length > 0 || qna.length > 0 || deal.pt_format || deal.customer_eval_criteria;
              if (!hasAny) return null;

              const th: React.CSSProperties = { textAlign: 'left', padding: '4px 6px', fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px' };
              const td: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '11px' };
              const metric = (label: string, value: string) => (
                <div style={{ background: 'var(--surface2)', borderRadius: '4px', padding: '8px 10px', minWidth: '78px' }}>
                  <div style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: '15px', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginTop: '2px' }}>{value}</div>
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(hasRevenue || deal.expected_revenue != null) && (
                    <Panel title="KT 매출 지표">
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {deal.expected_revenue != null && metric('매출액', `${deal.expected_revenue}억`)}
                        {deal.margin_rate != null && metric('영업이익률', `${deal.margin_rate}%`)}
                        {deal.contribution_margin != null && metric('공헌이익률', `${deal.contribution_margin}%`)}
                        {deal.subcontract_rate != null && metric('하도율', `${deal.subcontract_rate}%`)}
                        {deal.risk_grade && metric('리스크등급', deal.risk_grade)}
                      </div>
                    </Panel>
                  )}

                  {winning.length > 0 && (
                    <Panel title="Winning 포인트 (고객 핵심성공요소 ↔ Winning)">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['고객 핵심 성공요소', 'Winning 포인트'].map(h => <th key={h} style={{ ...th, width: '50%' }}>{h}</th>)}</tr></thead>
                        <tbody>{winning.map((w, i) => (
                          <tr key={i}>
                            <td style={{ ...td, color: 'var(--text-dim)' }}>{w.customer_cfs || '-'}</td>
                            <td style={{ ...td, color: 'var(--text)' }}>{w.winning_point}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </Panel>
                  )}

                  {org.length > 0 && (
                    <Panel title="제안/이행 담당 조직">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['부문', '본부', '담당', '팀', '역할', '명수'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>{org.map((m, i) => (
                          <tr key={i}>
                            <td style={td}>{m.division ?? '-'}</td>
                            <td style={td}>{m.hq ?? '-'}</td>
                            <td style={td}>{m.dept ?? m.name ?? '-'}</td>
                            <td style={td}>{m.team ?? '-'}</td>
                            <td style={td}>{m.role ?? '-'}</td>
                            <td style={{ ...td, fontFamily: 'IBM Plex Mono', color: 'var(--cyan)' }}>{m.count != null ? `${m.count}명` : '-'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </Panel>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: vdcB.length > 0 && qna.length > 0 ? '1fr 1fr' : '1fr', gap: '16px' }}>
                    {vdcB.length > 0 && (
                      <Panel title="VDC-B 결과">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr>{['의결', '의결내용'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                          <tbody>{vdcB.map((v, i) => (
                            <tr key={i}>
                              <td style={{ ...td, color: 'var(--cyan)', whiteSpace: 'nowrap' }}>{v.decision}</td>
                              <td style={{ ...td, color: 'var(--text-dim)' }}>{v.detail}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </Panel>
                    )}
                    {qna.length > 0 && (
                      <Panel title="주요질의 (별첨)">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr>{['질의', '답변'].map(h => <th key={h} style={{ ...th, width: '50%' }}>{h}</th>)}</tr></thead>
                          <tbody>{qna.map((q, i) => (
                            <tr key={i}>
                              <td style={{ ...td, color: 'var(--text-dim)' }}>{q.question}</td>
                              <td style={td}>{q.answer}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </Panel>
                    )}
                  </div>

                  {(deal.pt_format || deal.customer_eval_criteria) && (
                    <Panel title="제안발표회 · 고객 평가기준">
                      {deal.pt_format && <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}><span style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}>제안발표회 </span>{deal.pt_format}</div>}
                      {deal.customer_eval_criteria && <div style={{ fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}><span style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '10px' }}>평가기준 </span>{deal.customer_eval_criteria}</div>}
                    </Panel>
                  )}
                </div>
              );
            })()}

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
                    {simDelta !== null && simDelta !== 0 && (
                      <button
                        onClick={async () => {
                          const name = prompt('시나리오 이름을 입력하세요');
                          if (!name || !selectedId || !simSubs) return;
                          const path = [baseProb ?? 0, simProb ?? 0];
                          const revPath = rev ? [Math.round(rev * (baseProb ?? 0)) / 100, Math.round(rev * (simProb ?? 0)) / 100] : [];
                          await fetch(`/api/deals/${selectedId}/scenarios`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, actions: simSubs, prob_path: path, revenue_path: revPath }),
                          });
                          fetch(`/api/deals/${selectedId}/scenarios`)
                            .then(r => r.json())
                            .then(d => { if (d.scenarios) setScenarios(d.scenarios); })
                            .catch(() => {});
                        }}
                        style={{
                          fontSize: '11px', padding: '4px 10px', cursor: 'pointer',
                          background: 'var(--surface2)', color: 'var(--cyan)',
                          border: '1px solid var(--cyan)', borderRadius: '2px', fontFamily: 'IBM Plex Mono',
                        }}
                      >
                        저장
                      </button>
                    )}
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

            {/* ── 저장된 시나리오 목록 ────────────────────────────── */}
            {scenarios.length > 0 && (
              <Panel title="저장된 시나리오">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {scenarios.map(s => {
                    const p0 = s.prob_path[0] ?? 0;
                    const p1 = s.prob_path[1] ?? 0;
                    const delta = Math.round((p1 - p0) * 10) / 10;
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: 'var(--surface2)', borderRadius: '2px', padding: '8px 12px',
                        borderLeft: `3px solid ${delta >= 0 ? 'var(--green)' : 'var(--red)'}`,
                      }}>
                        <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1, fontWeight: 500 }}>{s.name}</span>
                        <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                          {p0.toFixed(1)}% → {p1.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', fontWeight: 700, color: delta >= 0 ? 'var(--green)' : 'var(--red)', minWidth: '48px', textAlign: 'right' }}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', minWidth: '60px' }}>
                          {new Date(s.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </span>
                        <button
                          onClick={() => { setSimSubs(s.actions); setSimMode(false); }}
                          style={{ fontSize: '10px', padding: '3px 8px', cursor: 'pointer', background: 'var(--surface)', color: 'var(--cyan)', border: '1px solid var(--cyan)', borderRadius: '2px', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}
                        >
                          불러오기
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`/api/deals/${selectedId}/scenarios?id=${s.id}`, { method: 'DELETE' });
                            setScenarios(prev => prev.filter(x => x.id !== s.id));
                          }}
                          style={{ fontSize: '10px', padding: '3px 8px', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '2px', fontFamily: 'IBM Plex Mono' }}
                        >
                          삭제
                        </button>
                      </div>
                    );
                  })}
                </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            {m.prob_before.toFixed(1)}% → {m.prob_after.toFixed(1)}%
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', letterSpacing: '1px' }}>
                              {effortDots}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{m.owner}</span>
                            <button
                              onClick={async () => {
                                if (!selectedId) return;
                                await fetch(`/api/deals/${selectedId}/action-log`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action_id: m.action_id,
                                    sub_scores_before: pred.sub_scores,
                                    sub_scores_after: null,
                                  }),
                                });
                                fetch(`/api/deals/${selectedId}/action-log`)
                                  .then(r => r.json())
                                  .then(d => { if (d.action_log) setActionLog(d.action_log); })
                                  .catch(() => {});
                              }}
                              style={{ fontSize: '9px', padding: '2px 7px', cursor: 'pointer', background: 'var(--surface)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: '2px', fontFamily: 'IBM Plex Mono' }}
                            >
                              완료
                            </button>
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

            {/* ── 액션 실행 이력 ───────────────────────────────────── */}
            {actionLog.length > 0 && (
              <Panel title="액션 실행 이력">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {actionLog.map(entry => {
                    const action = ACTION_CATALOG.find(a => a.id === entry.action_id);
                    const pillarColor: Record<string, string> = {
                      S: 'var(--cyan)', V: 'var(--brand)', D: 'var(--yellow)', P: 'var(--green)', E: 'var(--red)',
                    };
                    const color = action ? (pillarColor[action.pillar] ?? 'var(--text-dim)') : 'var(--text-dim)';
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: 'var(--surface2)', borderRadius: '2px', padding: '7px 12px',
                        borderLeft: `3px solid ${color}`,
                      }}>
                        {action && (
                          <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color, fontWeight: 700, minWidth: '16px' }}>
                            {action.pillar}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>
                          {action?.label ?? entry.action_id}
                        </span>
                        {entry.taken_by && (
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{entry.taken_by}</span>
                        )}
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}>
                          {new Date(entry.taken_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                          {' '}
                          {new Date(entry.taken_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
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
            </>
          )}
        </main>
      </div>
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

// ─── Geo: Process Sidebar ─────────────────────────────────────────────────────

function GeoProcessSidebar({ step, onStepClick }: { step: number; onStepClick: (s: number) => void }) {
  const steps = [
    { n: 1, label: '주제 입력' },
    { n: 2, label: '자동 분석' },
    { n: 3, label: '확률 진단' },
    { n: 5, label: '리포트 발행' },
  ];
  return (
    <div style={{
      width: '200px', flexShrink: 0, borderRight: '1px solid var(--border)',
      padding: '24px 16px', display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', minHeight: 'calc(100vh - 56px)',
    }}>
      <div style={{ fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginBottom: '20px' }}>
        ANALYSIS PROCESS
      </div>
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n}>
            <div
              onClick={() => onStepClick(s.n)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 0 7px 10px', cursor: 'pointer',
                borderLeft: active ? '3px solid var(--brand)' : done ? '3px solid var(--green)' : '3px solid transparent',
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                background: done ? 'var(--green)' : active ? 'var(--brand)' : 'var(--surface2)',
                border: done || active ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: done || active ? '#fff' : 'var(--text-dim)',
                fontFamily: 'IBM Plex Mono', fontWeight: 700,
              }}>
                {done ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: '12px',
                color: active ? 'var(--text)' : done ? 'var(--green)' : 'var(--text-dim)',
                fontWeight: active ? 600 : 400,
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ marginLeft: '22px', width: '1px', height: '14px', borderLeft: '1px dashed var(--border)' }} />
            )}
          </div>
        );
      })}

    </div>
  );
}

// ─── Polymarket Step ──────────────────────────────────────────────────────────

interface PolyMarketItem {
  slug: string;
  label: string;
  category: '지정학' | 'AI' | '글로벌경제';
  ourProb: boolean;
  question: string;
  yesPrice: number | null;
  endDate: string | null;
}

const CATEGORY_ORDER: ('지정학' | 'AI' | '글로벌경제')[] = ['지정학', 'AI', '글로벌경제'];

function PolymarketStep({ geoProb, topic, onReport }: {
  geoProb: number;
  topic: string;
  onReport: () => void;
}) {
  const [markets, setMarkets] = useState<PolyMarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/polymarket')
      .then(r => r.json())
      .then((data: PolyMarketItem[]) => {
        setMarkets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    items: markets.filter(m => m.category === cat),
  }));

  const catColor: Record<string, string> = {
    '지정학': 'var(--red)',
    'AI': 'var(--brand)',
    '글로벌경제': 'var(--yellow)',
  };
  const catBg: Record<string, string> = {
    '지정학': 'rgba(220,38,38,0.12)',
    'AI': 'rgba(34,211,238,0.12)',
    '글로벌경제': 'rgba(217,119,6,0.12)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="폴리마켓 vs 우리 분석">
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 9, padding: '3px 8px', borderRadius: 3, fontFamily: 'IBM Plex Mono',
            letterSpacing: '1px', background: 'rgba(34,211,238,0.12)', color: 'var(--brand)',
          }}>POLYMARKET vs OUR ANALYSIS</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {topic} — 우리 확률 <strong style={{ color: 'var(--brand)', fontFamily: 'IBM Plex Mono' }}>{geoProb}%</strong>
          </span>
        </div>

        {loading && (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '24px 0', textAlign: 'center', fontFamily: 'IBM Plex Mono' }}>
            시장 데이터 로딩 중...
          </div>
        )}

        {!loading && grouped.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, letterSpacing: '1.5px', fontFamily: 'IBM Plex Mono', marginBottom: 8,
              color: catColor[cat], display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ padding: '2px 7px', borderRadius: 3, background: catBg[cat] }}>{cat}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => {
                const poly = item.yesPrice;
                const ours = item.ourProb ? geoProb : null;
                const diff = poly != null && ours != null ? poly - ours : null;
                return (
                  <div key={item.slug} style={{
                    display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px',
                    gap: 8, alignItems: 'center', padding: '8px 10px',
                    background: 'var(--surface2)', borderRadius: 4,
                    border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.3 }}>{item.label}</div>
                      {item.endDate && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                          {new Date(item.endDate).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                    {/* Polymarket probability */}
                    <div style={{ textAlign: 'center' }}>
                      {poly != null ? (
                        <>
                          <div style={{
                            fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono',
                            color: poly >= 65 ? 'var(--green)' : poly >= 40 ? 'var(--yellow)' : 'var(--red)',
                          }}>{poly}%</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>Polymarket</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>—</div>
                      )}
                    </div>
                    {/* Our analysis probability */}
                    <div style={{ textAlign: 'center' }}>
                      {ours != null ? (
                        <>
                          <div style={{
                            fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono',
                            color: 'var(--brand)',
                          }}>{ours}%</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>우리 분석</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>—</div>
                      )}
                    </div>
                    {/* Diff badge */}
                    <div style={{ textAlign: 'center' }}>
                      {diff != null ? (
                        <span style={{
                          fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: 700,
                          color: Math.abs(diff) <= 5 ? 'var(--green)' : Math.abs(diff) <= 15 ? 'var(--yellow)' : 'var(--red)',
                        }}>
                          {diff > 0 ? '+' : ''}{diff}pp
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!loading && markets.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
            시장 데이터를 불러올 수 없습니다. 리포트는 계속 발행할 수 있습니다.
          </div>
        )}
      </Panel>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={onReport} style={{
          padding: '9px 18px', fontSize: '12px', fontFamily: 'IBM Plex Mono',
          background: 'var(--brand)', color: '#06262d', border: 'none',
          borderRadius: '2px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.5px',
        }}>
          리포트 발행 →
        </button>
      </div>
    </div>
  );
}

// ─── Geo: Step Content ────────────────────────────────────────────────────────

interface GeoSignalCard {
  id: number;
  label: string;
  description: string;
  driver_deltas: Record<string, number>;
  direction: string;
  evidence?: string;
}

function GeoContent({ step, setStep }: { step: number; setStep: (s: number) => void }) {
  const [query, setQuery] = useState('');
  // 토픽별 동적 드라이버 (analyze 응답으로 채워짐). 초기엔 범용 fallback.
  const [driverScores, setDriverScores] = useState<Record<string, number>>({ ...FALLBACK_DRIVER_SCORES });
  const [driverMeta, setDriverMeta] = useState<GeoDriver[]>(FALLBACK_DRIVER_META);
  const [analyzing, setAnalyzing] = useState(false);
  const drivers = driverScores;

  // Session state
  const [geoSessionId, setGeoSessionId] = useState<number | null>(null);
  const [geoToken, setGeoToken] = useState<string | null>(null);
  const [, setGeoCards] = useState<GeoSignalCard[]>([]);
  const [geoVoteCounts, setGeoVoteCounts] = useState<Record<number, number>>({});
  const [geoRoleCounts, setGeoRoleCounts] = useState<Record<string, number>>({});
  const [liveDrivers, setLiveDrivers] = useState<Record<string, number> | null>(null);
  const [liveMeta, setLiveMeta] = useState<GeoDriver[] | null>(null);
  const [liveProb, setLiveProb] = useState<number | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [geoHypothesis, setGeoHypothesis] = useState('');
  const [geoStrategy, setGeoStrategy] = useState('');
  const [geoStrategyLow, setGeoStrategyLow] = useState('');
  const [geoStrategyMid, setGeoStrategyMid] = useState('');
  const [geoStrategyHigh, setGeoStrategyHigh] = useState('');
  const [geoPriorProb, setGeoPriorProb] = useState<number | null>(null);
  const [geoFacts, setGeoFacts] = useState<Array<{ type: string; key: string; value: string; source: string }>>([]);
  const [gistArticles, setGistArticles] = useState<GistArticle[]>([]);
  const [gistInsight, setGistInsight] = useState('');
  const [gistAnalysis, setGistAnalysis] = useState('');
  const [gistClusters, setGistClusters] = useState<GistCluster[]>([]);
  const [calibration, setCalibration] = useState<{ entries: Array<{ topic: string; predictedProb: number; actualOutcome: string; resolvedAt: string; correct: boolean; note: string }>; totalCount: number; correctCount: number; brierScore: number | null } | null>(null);

  const activeDrivers = liveDrivers ?? drivers;
  const activeMeta = liveMeta ?? driverMeta;
  const geoProb = liveProb ?? computeGeoProb(activeMeta, activeDrivers);
  const totalVotes = Object.values(geoVoteCounts).reduce((a, b) => a + b, 0);

  // geoProb 변화 시 strategy 구간 재선택
  useEffect(() => {
    if (!geoStrategyLow) return;
    setGeoStrategy(geoProb < 40 ? geoStrategyLow : geoProb < 65 ? geoStrategyMid : geoStrategyHigh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoProb, geoStrategyLow]);

  const [voteUrl, setVoteUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined' && geoToken) {
      setVoteUrl(`${window.location.origin}/vote/geo/${geoToken}`);
    }
  }, [geoToken]);

  // Polling: refresh session data every 5s while in step 3
  useEffect(() => {
    if (step !== 3 || !geoToken) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/geo/session/${geoToken}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.drivers) setLiveDrivers(json.drivers);
        if (Array.isArray(json.driverMeta) && json.driverMeta.length > 0) setLiveMeta(normalizeDriverMeta(json.driverMeta));
        if (json.geoProb != null) setLiveProb(json.geoProb);
        if (json.voteCounts) setGeoVoteCounts(json.voteCounts);
        if (json.roleCounts) setGeoRoleCounts(json.roleCounts);
        if (json.strategyLow) {
          setGeoStrategyLow(json.strategyLow);
          setGeoStrategyMid(json.strategyMid ?? '');
          setGeoStrategyHigh(json.strategyHigh ?? '');
          const p = json.geoProb ?? 50;
          setGeoStrategy(p < 40 ? json.strategyLow : p < 65 ? (json.strategyMid ?? '') : (json.strategyHigh ?? ''));
        }
        if (json.hypothesis) setGeoHypothesis(json.hypothesis);
        if (json.priorProb != null) setGeoPriorProb(json.priorProb);
        if (Array.isArray(json.facts) && json.facts.length > 0) setGeoFacts(json.facts);
        if (json.cards) setGeoCards(json.cards);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(id);
  }, [step, geoToken]);

  // Calibration data fetch (step 3 진입 시 1회)
  useEffect(() => {
    if (step !== 3) return;
    fetch('/api/geo/calibration').then(r => r.json()).then(d => setCalibration(d)).catch(() => {});
  }, [step]);

  // Step2 진입 시 Gist 기사 + AI 드라이버 점수 수집
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    setAnalyzing(true);
    setGistArticles([]);
    setGistInsight('');
    setGistAnalysis('');
    setGistClusters([]);
    (async () => {
      try {
        const res = await fetch('/api/geo/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: query || '지정학 리스크' }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.gistArticles)) setGistArticles(json.gistArticles);
        if (typeof json.gistInsight === 'string') setGistInsight(json.gistInsight);
        if (typeof json.gistAnalysis === 'string') setGistAnalysis(json.gistAnalysis);
        if (Array.isArray(json.gistClusters)) setGistClusters(json.gistClusters);
        if (Array.isArray(json.driverMeta) && json.driverMeta.length > 0) setDriverMeta(normalizeDriverMeta(json.driverMeta));
        if (json.driverScores && typeof json.driverScores === 'object') setDriverScores(json.driverScores);
      } catch { /* fallback 드라이버 유지 */ }
      finally { if (!cancelled) setAnalyzing(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleEnterStep3 = async () => {
    setStartingSession(true);
    // geo/start Gemini용: analysis.full_text를 주 컨텍스트로, 없으면 기사 목록으로 대체
    const articleLines = gistArticles.map(a =>
      `[${a.published_at?.slice(0, 10) ?? ''} ${a.topic_category ?? ''}] ${a.title}${a.description ? ': ' + a.description : ''}`
    );
    const analysisText = gistAnalysis || [gistInsight, ...articleLines].filter(Boolean).join('\n\n');
    try {
      const res = await fetch('/api/geo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: query || '지정학 리스크',
          analysisText: analysisText || `분석 주제: ${query || '지정학 리스크'}`,
          driverScores: drivers,
          driverMeta,
          geoProb: computeGeoProb(driverMeta, drivers),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setGeoSessionId(json.sessionId);
        setGeoToken(json.token);
        setGeoCards(json.cards ?? []);
        setGeoHypothesis(json.hypothesis ?? '');
        setGeoStrategyLow(json.strategyLow ?? '');
        setGeoStrategyMid(json.strategyMid ?? '');
        setGeoStrategyHigh(json.strategyHigh ?? '');
        if (Array.isArray(json.driverMeta) && json.driverMeta.length > 0) setDriverMeta(normalizeDriverMeta(json.driverMeta));
        if (json.priorProb != null) setGeoPriorProb(json.priorProb);
        if (Array.isArray(json.facts)) setGeoFacts(json.facts);
        const initProb = computeGeoProb(driverMeta, drivers);
        setGeoStrategy(initProb < 40 ? (json.strategyLow ?? '') : initProb < 65 ? (json.strategyMid ?? '') : (json.strategyHigh ?? ''));
      }
    } catch { /* proceed anyway */ }
    setStartingSession(false);
    setStep(3);
  };


  const startAnalysis = () => { if (query.trim() || true) setStep(2); };

  // 동적 드라이버 메타 → 표시용 (라벨/축/색상). Step1·2는 driverMeta, Step3는 activeMeta.
  const metaForView = step === 3 ? activeMeta : driverMeta;
  const DRIVER_META = metaForView.map((m, i) => ({
    key: m.key, label: m.labelKo, axis: m.labelEn, invert: m.invert,
    color: DRIVER_COLORS[i % DRIVER_COLORS.length],
  }));
  const contrib = (key: string, raw: number) => {
    const m = metaForView.find(d => d.key === key);
    return m ? contribution(m, raw) : raw;   // 0~10 종전 기여도
  };

  // ── Step 1: Search ──
  if (step === 1) return (
    <Panel title="분석 주제 입력">
      <div style={{ display:'flex', flexDirection:'column', gap:'16px', maxWidth:'640px' }}>
        <input
          type="text"
          placeholder="예: 유가 100달러, 2025 Q3 재돌파 가능성은?"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') startAnalysis(); }}
          style={{
            width:'100%', padding:'14px 16px', fontSize:'16px',
            border:'1px solid var(--border)', borderRadius:'2px',
            background:'var(--surface2)', color:'var(--text)',
            fontFamily:'inherit', outline:'none', boxSizing:'border-box',
          }}
        />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[
            '이란-이스라엘, 6월 내 종전 가능성은?',
            '트럼프 관세, 7월 전 완전 철회 가능성은?',
            '유가 100달러, 2026 Q3 재돌파 가능성은?',
            '러-우, 2026년 내 평화협정 타결 가능성은?',
            '중국-대만, 올해 봉쇄 현실화 가능성은?',
          ].map(hint => (
            <button key={hint} onClick={() => setQuery(hint)} style={{
              ...badgeStyle, cursor:'pointer', background:'var(--surface)',
              color:'var(--text-mid)', padding:'4px 10px',
            }}>
              {hint}
            </button>
          ))}
        </div>
        <div>
          <button onClick={startAnalysis} style={actionBtn}>분석 시작</button>
        </div>
      </div>
    </Panel>
  );

  // ── Step 2: News articles + driver scores ──
  if (step === 2) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px' }}>
        <Panel title="글로벌 뉴스 RAG">
          <div style={{ minHeight:'320px' }}>
            {analyzing && gistArticles.length === 0 && (
              <AlgorithmLoader />
            )}
            {!analyzing && !gistAnalysis && gistArticles.length === 0 && (
              <div style={{ fontSize:'12px', color:'var(--text-dim)', padding:'20px 0', fontFamily:'IBM Plex Mono' }}>
                뉴스 데이터를 불러오지 못했습니다. 확인을 눌러 계속할 수 있습니다.
              </div>
            )}
            {/* 핵심 인사이트 배너 */}
            {gistInsight && (
              <div style={{ padding:'10px 12px', background:'rgba(34,211,238,0.08)', border:'1px solid var(--brand)',
                borderRadius:'4px', marginBottom:'12px', fontSize:'12px', color:'var(--text)', lineHeight:1.6 }}>
                <span style={{ fontSize:'9px', letterSpacing:'1px', fontFamily:'IBM Plex Mono', color:'var(--brand)', marginRight:'8px' }}>RAG INSIGHT</span>
                {gistInsight}
              </div>
            )}
            {/* 종합 분석 본문 (analysis.full_text) */}
            {gistAnalysis && (
              <div style={{ padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)',
                borderRadius:'6px', marginBottom:'14px', fontSize:'13px', color:'var(--text)', lineHeight:1.8,
                whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {gistAnalysis}
              </div>
            )}
            {/* 핵심 관점 클러스터 */}
            {gistClusters.length > 0 && (
              <div style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'9px', letterSpacing:'1px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono', marginBottom:'6px' }}>
                  핵심 관점 클러스터
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {gistClusters.map((c, i) => (
                    <span key={i} style={{ fontSize:'11px', color:'var(--text-mid)', background:'var(--surface2)',
                      border:'1px solid var(--border)', borderRadius:'12px', padding:'3px 10px', lineHeight:1.5 }}>
                      {c.question || c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* 수집 기사 목록 */}
            {gistArticles.length > 0 && (
              <div>
                <div style={{ fontSize:'9px', letterSpacing:'1px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono', marginBottom:'6px' }}>
                  수집 기사 — {gistArticles.length}건
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {gistArticles.slice(0, 8).map((a, i) => (
                    <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', padding:'7px 10px',
                      background:'var(--surface2)', borderRadius:'4px', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0, paddingTop:'1px' }}>
                        {a.published_at && (
                          <span style={{ fontSize:'9px', fontFamily:'IBM Plex Mono', color:'var(--text-dim)', whiteSpace:'nowrap' }}>
                            {a.published_at.slice(0, 10)}
                          </span>
                        )}
                        {a.topic_category && (
                          <span style={{ fontSize:'9px', fontFamily:'IBM Plex Mono', color:'var(--text-dim)',
                            background:'var(--surface2)', border:'1px solid var(--border)', padding:'1px 5px', borderRadius:'2px', whiteSpace:'nowrap' }}>
                            {a.topic_category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--text)', lineHeight:1.4, flex:1 }}>
                        <a href={gistArticleUrl(a)} target="_blank" rel="noopener noreferrer"
                            style={{ color:'var(--text)', textDecoration:'none' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>
                          {a.title}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop:'16px' }}>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'12px', alignItems:'center' }}>
              {startingSession && <span style={{ fontSize:'11px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>팩트 수집 · 가설 생성 중...</span>}
              <button onClick={handleEnterStep3} disabled={analyzing || startingSession} style={{ ...actionBtn, opacity: (analyzing || startingSession) ? 0.6 : 1 }}>확인 →</button>
            </div>
          </div>
        </Panel>

        <Panel title="Win Factors">
          {/* ALGORITHM 배지 */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'10px', flexWrap:'wrap' }}>
            <div style={{ fontSize:'9px', letterSpacing:'1px', color:'var(--brand)', fontFamily:'IBM Plex Mono',
              background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.3)', padding:'2px 8px', borderRadius:'2px' }}>
              RAG-DRIVEN
            </div>
            <div style={{ fontSize:'9px', letterSpacing:'1px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono',
              background:'var(--surface2)', padding:'2px 8px', borderRadius:'2px' }}>
              o4-mini SCORED
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
            {DRIVER_META.map(m => {
              const v = contrib(m.key, drivers[m.key]);
              return (
                <div key={m.key}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                    <span style={{ fontSize:'11px', color:'var(--text-mid)' }}>{m.label}</span>
                    <span style={{ fontSize:'11px', fontFamily:'IBM Plex Mono', color: m.color }}>{v.toFixed(1)}/10</span>
                  </div>
                  <div style={{ height:'5px', background:'var(--surface2)', borderRadius:'2px' }}>
                    <div style={{ width:`${Math.max(4, v * 10)}%`, height:'100%', background: m.color, borderRadius:'2px', transition:'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* 수식 블록 */}
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'3px',
            padding:'8px 10px', marginBottom:'14px', fontFamily:'IBM Plex Mono' }}>
            <div style={{ fontSize:'9px', color:'var(--text-dim)', letterSpacing:'1px', marginBottom:'4px' }}>PROBABILITY FORMULA</div>
            <div style={{ fontSize:'11px', color:'var(--brand)' }}>P = Σ contrib(dᵢ) / n × 10</div>
            <div style={{ fontSize:'9px', color:'var(--text-dim)', marginTop:'4px' }}>
              contrib(d) = score if invert=false · 10−score if invert=true
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'9px', color:'var(--text-dim)', background:'rgba(34,211,238,0.06)',
                border:'1px solid rgba(34,211,238,0.2)', padding:'1px 6px', borderRadius:'2px' }}>
                PRIOR_STRENGTH = 10
              </span>
              <span style={{ fontSize:'9px', color:'var(--text-dim)', background:'var(--surface2)',
                padding:'1px 6px', borderRadius:'2px', border:'1px solid var(--border)' }}>
                clamp [5, 95]
              </span>
            </div>
          </div>
          {/* AI-generated facts (event/market types) */}
          {geoFacts.filter(f => f.type !== 'driver').length > 0 && (
            <div style={{ marginBottom:'16px', display:'flex', flexDirection:'column', gap:'5px' }}>
              {geoFacts.filter(f => f.type !== 'driver').map((f, i) => (
                <div key={i} style={{ display:'flex', gap:'8px', padding:'6px 8px', background:'var(--surface2)', borderRadius:'3px', fontSize:'11px' }}>
                  <span style={{ fontFamily:'IBM Plex Mono', color: f.type === 'market' ? '#818cf8' : 'var(--text-mid)', minWidth:'40px', fontSize:'9px', marginTop:'1px' }}>
                    {f.type === 'market' ? 'MKT' : 'EVT'}
                  </span>
                  <div style={{ flex:1 }}>
                    <span style={{ color:'var(--text)', fontWeight:600 }}>{f.key}</span>
                    <span style={{ color:'var(--text-dim)', marginLeft:'6px' }}>{f.value}</span>
                  </div>
                  <span style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono', textAlign:'right', maxWidth:'80px', lineHeight:1.3 }}>{f.source}</span>
                </div>
              ))}
            </div>
          )}
          {/* HYPOTHESIS 영역 — API 응답 후 표시 */}
          {(geoHypothesis || startingSession) && (
            <div>
              <div style={{ fontSize:'9px', letterSpacing:'1px', color:'var(--brand)', fontFamily:'IBM Plex Mono',
                background:'rgba(34,211,238,0.08)', padding:'2px 8px', borderRadius:'2px', display:'inline-block', marginBottom:'8px' }}>
                AI HYPOTHESIS
              </div>
              {geoHypothesis
                ? <div style={{ fontSize:'12px', color:'var(--text)', lineHeight:1.6, padding:'8px 10px',
                    border:'1px solid var(--brand)', borderRadius:'4px', background:'var(--surface2)' }}>{geoHypothesis}</div>
                : <div style={{ fontSize:'11px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>AI 추론 중...</div>
              }
            </div>
          )}
        </Panel>
      </div>
    );
  }

  // ── Step 3: Probability dashboard ──
  if (step === 3) {
    const polymarket = 34;
    // 시그널이 누적될수록 표준편차가 줄어 분포가 좁아진다.
    const sigma = 18 / Math.sqrt(1 + totalVotes / 3);
    const ci = {
      low: Math.max(0, Math.round(geoProb - sigma)),
      high: Math.min(100, Math.round(geoProb + sigma)),
    };
    // 바·오각형 모두 동일한 종전 기여도(0~10)를 그린다. 오각형 면적 = 종전 가능성.
    const radarScores: Record<string, number> = {};
    const geoPillars = DRIVER_META.map(m => {
      radarScores[m.axis] = contrib(m.key, activeDrivers[m.key]) / 10;
      return { key: m.axis, label: m.axis };
    });
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 260px', gap:'16px' }}>

          {/* Left: drivers + radar */}
          <Panel title="Win Factors">
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
              {DRIVER_META.map(m => {
                const v = contrib(m.key, activeDrivers[m.key]);
                return (
                  <div key={m.key}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'11px', color:'var(--text-mid)' }}>{m.label}</span>
                      <span style={{ fontSize:'11px', fontFamily:'IBM Plex Mono', color: m.color }}>{v.toFixed(1)}/10</span>
                    </div>
                    <div style={{ height:'6px', background:'var(--surface2)', borderRadius:'2px' }}>
                      <div style={{ width:`${Math.max(4, v * 10)}%`, height:'100%', background: m.color, borderRadius:'2px', transition:'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <RadarChart scores={radarScores} size={200} pillars={geoPillars} color="var(--brand)" />
            </div>
          </Panel>

          {/* Center: probability */}
          <Panel title="종전 가능성">
            <div style={{ textAlign:'center', padding:'12px 0' }}>
              {geoPriorProb !== null && (
                <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'10px', fontFamily:'IBM Plex Mono', color:'var(--text-dim)' }}>PRIOR</span>
                  <span style={{ fontSize:'14px', fontFamily:'IBM Plex Mono', fontWeight:600, color:'var(--text-mid)' }}>{geoPriorProb}%</span>
                  <span style={{ fontSize:'12px', color:'var(--text-dim)' }}>→</span>
                  <span style={{ fontSize:'10px', fontFamily:'IBM Plex Mono', color:'var(--text-dim)' }}>POSTERIOR</span>
                  {totalVotes > 0 && (
                    <span style={{ fontSize:'10px', fontFamily:'IBM Plex Mono', color: geoProb > geoPriorProb ? 'var(--green)' : geoProb < geoPriorProb ? 'var(--red)' : 'var(--text-dim)' }}>
                      {geoProb > geoPriorProb ? `+${geoProb - geoPriorProb}pp` : geoProb < geoPriorProb ? `${geoProb - geoPriorProb}pp` : '±0pp'}
                    </span>
                  )}
                </div>
              )}
              <div style={{ fontSize:'64px', fontWeight:700, fontFamily:'IBM Plex Mono', color: probColor(geoProb), lineHeight:1 }}>
                {geoProb}%
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
                <div style={{ fontSize:'11px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>
                  95% CI {ci.low}–{ci.high}%
                </div>
                <span style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'3px', fontFamily:'IBM Plex Mono', letterSpacing:'0.5px', background:'rgba(99,102,241,0.15)', color:'#818cf8', fontWeight:700 }}>
                  ENSEMBLE v2
                </span>
              </div>
              {/* 앙상블 알고리즘 스택 표시 */}
              <div style={{ display:'flex', justifyContent:'center', gap:'5px', marginTop:'8px', flexWrap:'wrap' }}>
                {['Bayesian Prior', 'RAG Alignment/Conflict', 'Vote-Weighted Δ'].map(tag => (
                  <span key={tag} style={{ fontSize:'8px', padding:'2px 6px', borderRadius:'2px',
                    fontFamily:'IBM Plex Mono', background:'var(--surface2)', color:'var(--text-dim)',
                    border:'1px solid var(--border)', letterSpacing:'0.3px' }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* 정규분포 — 시그널 누적 시 좁아짐 */}
              <div style={{ margin:'16px 0', display:'flex', justifyContent:'center' }}>
                <ProbabilityDistribution mean={geoProb} sigma={sigma} marketValue={polymarket} width={240} height={150} />
              </div>

              {/* Market comparison */}
              <div style={{ background:'var(--surface2)', borderRadius:'2px', padding:'10px 14px', textAlign:'left' }}>
                <div style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono', letterSpacing:'1px', marginBottom:'8px' }}>시장 예측 비교</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', alignItems:'center' }}>
                  <div>
                    <span style={{ fontSize:'12px', color:'var(--text)' }}>Ensemble Model</span>
                    <span style={{ fontSize:'8px', fontFamily:'IBM Plex Mono', color:'var(--brand)',
                      background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.25)',
                      padding:'1px 5px', borderRadius:'2px', marginLeft:'6px' }}>RAG+Bayes</span>
                  </div>
                  <span style={{ fontSize:'14px', fontFamily:'IBM Plex Mono', fontWeight:700, color: probColor(geoProb) }}>{geoProb}%</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12px', color:'var(--text-dim)' }}>Polymarket</span>
                  <span style={{ fontSize:'14px', fontFamily:'IBM Plex Mono', fontWeight:700, color:'var(--text-mid)' }}>{polymarket}%</span>
                </div>
                <div style={{ marginTop:'6px', fontSize:'10px', color:'var(--text-dim)' }}>
                  {geoProb < polymarket ? `시장 대비 −${polymarket - geoProb}pp (보수적 판단)` : `시장 대비 +${geoProb - polymarket}pp`}
                </div>
              </div>
            </div>
          </Panel>

          {/* Right: QR + signal cards */}
          <Panel title="분석 공유">
            {/* QR */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'12px' }}>
              <div style={{ padding:'8px', background:'#fff', border:'1px solid var(--border)', borderRadius:'2px' }}>
                {voteUrl
                  ? <QRCodeSVG value={voteUrl} size={120} level="M" fgColor="#1A1A1A" bgColor="#FFFFFF" />
                  : <div style={{ width:120, height:120, display:'flex', alignItems:'center', justifyContent:'center', color:'#999', fontSize:'11px' }}>QR 생성 중...</div>
                }
              </div>
            </div>
            <div style={{ fontSize:'11px', color:'var(--text-dim)', textAlign:'center', marginBottom:'12px', fontFamily:'IBM Plex Mono' }}>
              QR로 의견 제출
            </div>
            <div style={{ background:'var(--surface2)', borderRadius:'2px', padding:'10px', textAlign:'center', marginBottom:'12px' }}>
              <div style={{ fontSize:'24px', fontWeight:700, fontFamily:'IBM Plex Mono', color:'var(--text)' }}>{totalVotes}</div>
              <div style={{ fontSize:'10px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>누적 응답</div>
            </div>

            {/* Role breakdown — 역할별 참여자 수 */}
            <div style={{ fontSize:'10px', color:'var(--text-dim)', marginBottom:'8px', fontFamily:'IBM Plex Mono', letterSpacing:'0.5px' }}>역할별 참여</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'4px', marginBottom:'12px' }}>
              {(Object.keys(ROLE_WEIGHTS) as VoterRole[]).map(r => {
                const c = geoRoleCounts[r] ?? 0;
                return (
                  <div key={r} style={{
                    padding:'6px 4px', borderRadius:'2px', textAlign:'center',
                    background:'var(--surface2)', opacity: c > 0 ? 1 : 0.4,
                  }}>
                    <div style={{ fontFamily:'IBM Plex Mono', fontWeight:700, fontSize:'14px', color: c > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{c}</div>
                    <div style={{ fontSize:'9px', color:'var(--text-dim)' }}>{ROLE_LABEL[r]}</div>
                    <div style={{ fontSize:'8px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>{ROLE_WEIGHTS[r].toFixed(1)}×</div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize:'10px', color:'var(--text-dim)', lineHeight:1.5, marginTop:'8px' }}>
              역할 가중치가 반영된 응답으로 Win Factors가 실시간 업데이트됩니다.
            </div>
          </Panel>
        </div>

        {/* 전략 패널 — 항상 확률 제고 방향 */}
        {geoStrategy && (
          <Panel title="확률 제고 전략">
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
              <span style={{
                fontSize:'10px', padding:'3px 10px', borderRadius:'3px',
                fontFamily:'IBM Plex Mono', letterSpacing:'0.5px',
                background: geoProb < 40 ? 'rgba(34,211,238,0.15)' : geoProb < 65 ? 'rgba(34,211,238,0.12)' : 'rgba(22,163,74,0.15)',
                color: geoProb < 40 ? 'var(--brand)' : geoProb < 65 ? 'var(--brand)' : 'var(--green)',
                fontWeight: 700,
              }}>
                {geoProb < 40 ? 'ACTION REQUIRED' : geoProb < 65 ? 'PUSH — MOMENTUM' : 'LOCK IT IN'}
              </span>
              <span style={{
                fontSize:'10px', padding:'3px 10px', borderRadius:'3px',
                fontFamily:'IBM Plex Mono', letterSpacing:'0.5px',
                background:'rgba(34,211,238,0.08)', color:'var(--brand)',
              }}>
                현재 {geoProb}% → 목표 {geoProb < 40 ? '65' : geoProb < 65 ? '80' : '90+'}% 달성 전략
              </span>
            </div>
            {geoHypothesis && (
              <div style={{
                margin:'0 0 16px', padding:'12px 16px',
                background:'rgba(34,211,238,0.06)', borderLeft:'3px solid var(--brand)',
                borderRadius:'0 4px 4px 0',
              }}>
                <div style={{ fontSize:'9px', letterSpacing:'1px', fontFamily:'IBM Plex Mono', color:'var(--brand)', marginBottom:'6px' }}>CORE HYPOTHESIS</div>
                <div style={{ fontSize:'13px', color:'var(--text)', lineHeight:1.7, fontStyle:'italic' }}>
                  ❝ {geoHypothesis} ❞
                </div>
              </div>
            )}
            <div style={{ fontSize:'13px', color:'var(--text)', lineHeight:2, whiteSpace:'pre-wrap' }}>
              {geoStrategy.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ display:'flex', gap:'10px', marginBottom:'4px' }}>
                  <span style={{ color:'var(--brand)', fontWeight:700, flexShrink:0, fontFamily:'IBM Plex Mono', fontSize:'12px', marginTop:'2px' }}>→</span>
                  <span>{line.replace(/^[-→•]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Calibration panel — Judgment DB */}
        {calibration && calibration.totalCount > 0 && (
          <Panel title="과거 판단 정확도 (Judgment DB)">
            <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'12px', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 16px', background:'var(--surface2)', borderRadius:'4px' }}>
                <span style={{ fontSize:'22px', fontWeight:700, fontFamily:'IBM Plex Mono', color:'var(--text)' }}>{calibration.correctCount}/{calibration.totalCount}</span>
                <span style={{ fontSize:'10px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>예측 정확도</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {calibration.entries.map((e, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'var(--surface2)', borderRadius:'3px', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'IBM Plex Mono', fontWeight:700, fontSize:'13px', color: probColor(e.predictedProb), minWidth:'38px' }}>{e.predictedProb}%</span>
                  <span style={{ fontSize:'10px', color:'var(--text-dim)', flex:1 }}>{e.topic}</span>
                  <span style={{ fontSize:'10px', fontFamily:'IBM Plex Mono', color: e.correct ? 'var(--green)' : 'var(--red)' }}>{e.actualOutcome}</span>
                  <span style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'IBM Plex Mono' }}>{e.resolvedAt}</span>
                  <span style={{ fontSize:'11px' }}>{e.correct ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
          <button onClick={() => { setStep(5); if (geoSessionId) window.open(`/report/geo/${geoSessionId}`, '_blank'); }} style={actionBtn}>리포트 발행 →</button>
        </div>
      </div>
    );
  }

  // ── Step 4: Polymarket comparison ──
  if (step === 4) {
    return (
      <PolymarketStep
        geoProb={geoProb}
        topic={query || '이란 전쟼 종전 가능성'}
        onReport={() => { setStep(5); if (geoSessionId) window.open(`/report/geo/${geoSessionId}`, '_blank'); }}
      />
    );
  }

  // ── Step 5: Report published ──
  return (
    <Panel title="리포트 발행 완료">
      <div style={{ textAlign:'center', padding:'40px 0' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>✓</div>
        <div style={{ fontSize:'16px', fontWeight:700, color:'var(--text)', marginBottom:'8px' }}>
          지정학 분석 리포트가 발행되었습니다
        </div>
        <div style={{ fontSize:'13px', color:'var(--text-dim)', marginBottom:'24px' }}>
          {query || '이란 전쟼 종전 가능성'} — 종전 가능성 {geoProb}%
        </div>
        <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
          <button onClick={() => window.open(`/report/geo/${geoSessionId}`, '_blank')} style={actionBtn}>
            리포트 열기
          </button>
          <button onClick={() => setStep(1)} style={{
            ...actionBtn, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)',
          }}>
            새 분석
          </button>
        </div>
      </div>
    </Panel>
  );
}
