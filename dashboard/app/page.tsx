'use client';

import { useState, useEffect, useRef } from 'react';
import RadarChart from '@/components/charts/RadarChart';
import PositionMatrix from '@/components/charts/PositionMatrix';
import PartnerNetwork from '@/components/charts/PartnerNetwork';
import TimelineChart from '@/components/charts/TimelineChart';
import RiskBubble from '@/components/charts/RiskBubble';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioDeal {
  id: number;
  client_name: string;
  win_probability: number;
  deal_size_eok: number;
  recommendation: string;
}

interface Partner { name: string; role: string; description?: string }
interface Risk { name: string; probability: number; impact: number; difficulty: number; level: string }
interface Milestone { date: string; label: string; type: string }
interface CompPos { self?: { x: number; y: number }; competitors?: { name: string; x: number; y: number; size?: string }[] }

interface DashboardData {
  deal: {
    id: number; client_name: string; deal_size: string | null; industry: string | null;
    execution_unit: string | null; pm: string | null; duration_months: number | null;
    due_date: string | null; partners: Partner[]; risks: Risk[];
    milestones: Milestone[]; competitive_positioning: CompPos;
  };
  prediction: {
    probability: number;
    method_probs: Record<string, number>;
    pillar_scores: Record<string, number>;
    weaknesses: Array<{ id: string; label: string; pillar: string; score: number; contribution: number }>;
    confidence_interval: { low: number; high: number };
    created_at: string;
  } | null;
  portfolio_rank: number;
  portfolio_size: number;
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
    fetch(`/api/dashboard/${selectedId}`)
      .then(r => r.json())
      .then(setDashData)
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
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                  {deal.client_name}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {deal.execution_unit && (
                    <span style={badgeStyle}>{deal.execution_unit}</span>
                  )}
                  {deal.pm && (
                    <span style={{ ...badgeStyle, color: 'var(--text-mid)' }}>PM: {deal.pm}</span>
                  )}
                  {deal.duration_months && (
                    <span style={badgeStyle}>{deal.duration_months}개월</span>
                  )}
                  {deal.due_date && (
                    <span style={{ ...badgeStyle, color: 'var(--red)' }}>
                      D-{Math.max(0, Math.ceil((new Date(deal.due_date).getTime() - Date.now()) / 86400000))}
                      &nbsp;({new Date(deal.due_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '.').replace('.', '')})
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
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PositionMatrix
                      self={deal.competitive_positioning.self}
                      competitors={deal.competitive_positioning.competitors ?? []}
                    />
                  </div>
                ) : (
                  <EmptyPanel label="포지셔닝 데이터 없음" />
                )}
              </Panel>

              <Panel title="협력 파트너 구조">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PartnerNetwork partners={deal.partners} />
                </div>
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

            {/* ── ZONE 5: Portfolio bar ─────────────────────────── */}
            {pred && (
              <Panel title="4-Method 앙상블 분해">
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
