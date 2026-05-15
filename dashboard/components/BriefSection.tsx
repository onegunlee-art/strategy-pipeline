'use client';

import ConfidenceBadge from './ConfidenceBadge';

interface StrategyAction {
  weakness_area: string;
  current_score: number;
  hypothesis: string;
  actions: { timeline: string; action: string; owner: string }[];
  expected_uplift: string;
  external_evidence: string;
}

interface BriefData {
  deal_id: number;
  client_name: string;
  industry?: string;
  generated_at: string;
  cached?: boolean;
  stale?: boolean;
  executive_summary?: string;
  win_probability_assessment?: {
    probability: number;
    ci_low: number;
    ci_high: number;
    data_source: string;
    key_drivers: string[];
  };
  strategy_actions?: StrategyAction[];
  competitive_landscape?: {
    main_threats: string[];
    our_advantages: string[];
    ai_context_note: string;
  };
  recommendation?: string;
  recommendation_rationale?: string;
  sources?: string[];
  layer1_quant?: {
    win_probability: number;
    ci_low: number;
    ci_high: number;
    voter_count: number;
    weaknesses: { id: string; score: number }[];
  };
  layer2_ai_context?: Record<string, unknown>;
}

const REC_COLOR: Record<string, string> = {
  GO: 'var(--green, #81c784)',
  NO_GO: 'var(--red, #ff4466)',
  CONDITIONAL_GO: '#ffd54f',
};

export default function BriefSection({ data }: { data: BriefData }) {
  const winPct = data.win_probability_assessment?.probability ?? data.layer1_quant?.win_probability ?? 0;
  const ciLow = data.win_probability_assessment?.ci_low ?? data.layer1_quant?.ci_low ?? 0;
  const ciHigh = data.win_probability_assessment?.ci_high ?? data.layer1_quant?.ci_high ?? 0;
  const rec = data.recommendation ?? 'WATCH';
  const recColor = REC_COLOR[rec] ?? '#ffd54f';

  return (
    <div className="brief-root" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text, #e0e0e0)', maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

      {/* ── 헤더 ── */}
      <div style={{ borderBottom: '2px solid var(--cyan, #4dd0e1)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--text-dim, #888)', marginBottom: '6px' }}>
          KT ENTERPRISE SALES — EXECUTIVE BRIEF
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--cyan, #4dd0e1)' }}>
          {data.client_name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim, #888)', marginTop: '4px' }}>
          {data.industry ?? ''} · 생성: {new Date(data.generated_at).toLocaleString('ko-KR')}
          {data.cached && <span style={{ marginLeft: '8px', color: '#ffd54f' }}>(캐시)</span>}
        </div>
      </div>

      {/* ── Section 1: 임원 요약 ── */}
      <BriefCard title="01 EXECUTIVE SUMMARY">
        <div style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--text-mid, #ccc)' }}>
          {data.executive_summary ?? '요약 생성 중...'}
        </div>
      </BriefCard>

      {/* ── Section 2: 정량 결과 (Layer 1) ── */}
      <BriefCard title="02 QUANTITATIVE RESULT" badge={<ConfidenceBadge kind="own_data" label={data.win_probability_assessment?.data_source ?? '자체 데이터'} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)', letterSpacing: '1px', marginBottom: '8px' }}>WIN PROBABILITY</div>
            <div style={{ fontSize: '48px', fontWeight: 700, color: winPct >= 60 ? 'var(--green, #81c784)' : winPct < 30 ? 'var(--red, #ff4466)' : 'var(--cyan, #4dd0e1)' }}>
              {winPct.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim, #888)' }}>
              95% CI: {ciLow.toFixed(1)}% ~ {ciHigh.toFixed(1)}%
            </div>
            {data.layer1_quant?.voter_count ? (
              <div style={{ marginTop: '8px' }}>
                <ConfidenceBadge kind="voting" label={`Voting ${data.layer1_quant.voter_count}명`} />
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)', letterSpacing: '1px', marginBottom: '8px' }}>RECOMMENDATION</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: recColor, border: `1px solid ${recColor}`, display: 'inline-block', padding: '6px 14px', borderRadius: '6px' }}>
              {rec.replace('_', ' ')}
            </div>
            {data.recommendation_rationale && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-mid, #ccc)', lineHeight: 1.6 }}>
                {data.recommendation_rationale}
              </div>
            )}
          </div>
        </div>
        {data.win_probability_assessment?.key_drivers && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)', letterSpacing: '1px', marginBottom: '6px' }}>KEY DRIVERS</div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-mid, #ccc)', lineHeight: 1.8 }}>
              {data.win_probability_assessment.key_drivers.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
      </BriefCard>

      {/* ── Section 3: 전략 액션 ── */}
      {data.strategy_actions && data.strategy_actions.length > 0 && (
        <BriefCard title="03 STRATEGY ACTIONS (약점별 액션 플랜)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {data.strategy_actions.map((sa, i) => (
              <ActionCard key={i} action={sa} index={i + 1} />
            ))}
          </div>
        </BriefCard>
      )}

      {/* ── Section 4: 경쟁 구도 ── */}
      {data.competitive_landscape && (
        <BriefCard title="04 COMPETITIVE LANDSCAPE" badge={<ConfidenceBadge kind="ai_estimate" label="AI 컨텍스트" />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--red, #ff4466)', letterSpacing: '1px', marginBottom: '6px' }}>THREATS</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-mid, #ccc)', lineHeight: 1.8 }}>
                {data.competitive_landscape.main_threats.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--green, #81c784)', letterSpacing: '1px', marginBottom: '6px' }}>OUR ADVANTAGES</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-mid, #ccc)', lineHeight: 1.8 }}>
                {data.competitive_landscape.our_advantages.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          </div>
          {data.competitive_landscape.ai_context_note && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,213,79,0.08)', border: '1px solid rgba(255,213,79,0.25)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-mid, #ccc)' }}>
              <ConfidenceBadge kind="ai_estimate" /> {data.competitive_landscape.ai_context_note}
            </div>
          )}
        </BriefCard>
      )}

      {/* ── 부록: 출처 ── */}
      {data.sources && data.sources.length > 0 && (
        <BriefCard title="APPENDIX — SOURCES">
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: 'var(--text-dim, #888)', lineHeight: 1.8 }}>
            {data.sources.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-dim, #888)' }}>
            ⚠️ AI 추정 수치는 참고용이며 자체 DB 기반 정량 모델에 자동 반영되지 않습니다.
          </div>
        </BriefCard>
      )}

      {/* Print 버튼 (인쇄 시 숨김) */}
      <div className="no-print" style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button onClick={() => window.print()}
          style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--cyan, #4dd0e1)', background: 'transparent', color: 'var(--cyan, #4dd0e1)', fontFamily: 'IBM Plex Mono', fontSize: '13px', cursor: 'pointer' }}>
          ⎙ PRINT / EXPORT PDF
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--border, #333)', background: 'transparent', color: 'var(--text-dim, #888)', fontFamily: 'IBM Plex Mono', fontSize: '13px', cursor: 'pointer' }}>
          ✕ 닫기
        </button>
      </div>
    </div>
  );
}

function BriefCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: '10px', padding: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', color: 'var(--cyan, #4dd0e1)' }}>
          {title}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function ActionCard({ action, index }: { action: StrategyAction; index: number }) {
  return (
    <div style={{ border: '1px solid var(--border, #2a2a2a)', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--text-dim, #888)' }}>WEAKNESS {index}</span>
          <div style={{ fontSize: '14px', color: 'var(--cyan, #4dd0e1)', marginTop: '2px' }}>
            {action.weakness_area}
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--red, #ff4466)' }}>
              {action.current_score.toFixed(1)}/10
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)' }}>예상 상승폭</div>
          <div style={{ fontSize: '16px', color: 'var(--green, #81c784)' }}>{action.expected_uplift}</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-mid, #ccc)', marginBottom: '12px', fontStyle: 'italic' }}>
        가설: {action.hypothesis}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
        {action.actions.map((a, i) => (
          <div key={i} style={{ padding: '10px', background: 'var(--surface2, #222)', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: 'var(--cyan, #4dd0e1)', marginBottom: '4px' }}>{a.timeline}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-mid, #ccc)', lineHeight: 1.5 }}>{a.action}</div>
            {a.owner && <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)', marginTop: '4px' }}>담당: {a.owner}</div>}
          </div>
        ))}
      </div>
      {action.external_evidence && (
        <div style={{ fontSize: '10px', color: 'var(--text-dim, #888)', padding: '6px 10px', background: 'rgba(255,213,79,0.06)', borderRadius: '4px' }}>
          <ConfidenceBadge kind="ai_estimate" /> {action.external_evidence}
        </div>
      )}
    </div>
  );
}
