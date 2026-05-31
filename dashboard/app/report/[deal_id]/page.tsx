'use client';

import { useState, useEffect } from 'react';
import '../../brief/print.css';

interface Props {
  params: { deal_id: string };
}

interface ReportData {
  business_objective: { client_name: string; deal_size: string | null; industry: string | null; importance_stars: number; summary: string };
  bid_timeline: { rfp_published?: string; bid_deadline?: string; pt_date?: string; announcement_date?: string; d_day?: number | null };
  competition: { competitors: { name: string; strength?: string; threat?: string }[]; positioning?: string };
  collaboration: { partners: { name: string; role?: string; task_scope?: string }[] };
  winning_points: string[];
  win_assessment: {
    probability: number; ci_low: number; ci_high: number;
    pillar_scores: Record<string, number>; method_probs: Record<string, number>;
    weaknesses: { label: string; score: number; pillar: string }[]; voter_count: number;
  };
  proposal_strategy: { pillar: string; how_to: string[]; value_proposition: string }[];
  execution_risks: { name: string; level: string; mitigation: string }[];
  team: { size: number | null; members: { name: string; dept?: string; role?: string }[]; execution_unit: string | null; pm: string | null };
  recommendation: string;
  recommendation_rationale: string;
}

const PILLAR_LABEL: Record<string, string> = { S: '사전영업', V: 'Value', D: '차별화', P: '가격', E: 'Delivery' };

function probColor(p: number) { return p >= 65 ? '#16a34a' : p >= 45 ? '#d97706' : '#dc2626'; }

export default function ReportPage({ params }: Props) {
  const { deal_id } = params;
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('보고서 불러오는 중...');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/report/${deal_id}`, { method: 'POST' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) { setError(json.error ?? `HTTP ${res.status}`); return; }
        setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    setStatus('보고서 생성 중 (10~30초)...');
    load();
    return () => { cancelled = true; };
  }, [deal_id]);

  if (error) return <div style={{ padding: 40, color: '#dc2626', fontFamily: 'system-ui' }}>오류: {error}</div>;
  if (!data) return <div style={{ padding: 40, color: '#666', fontFamily: 'system-ui' }}>{status}</div>;

  const wa = data.win_assessment;
  const S: React.CSSProperties = { background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 };
  const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 12, letterSpacing: 1 };

  return (
    <div className="brief-root" style={{ maxWidth: 880, margin: '0 auto', padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>
          {data.business_objective.client_name} 수주전략 보고서
        </h1>
        <button className="no-print" onClick={() => window.print()}
          style={{ padding: '6px 14px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          인쇄 / PDF
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
        {'★'.repeat(data.business_objective.importance_stars)}{'☆'.repeat(5 - data.business_objective.importance_stars)}
        &nbsp;·&nbsp;{data.business_objective.industry ?? ''}&nbsp;·&nbsp;{data.business_objective.deal_size ?? ''}
      </div>

      {/* 1. 사업 목표 */}
      <div style={S}>
        <div style={H}>1. 사업 목표</div>
        <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14 }}>{data.business_objective.summary}</p>
      </div>

      {/* 2. 입찰 일정 */}
      {(data.bid_timeline.bid_deadline || data.bid_timeline.rfp_published) && (
        <div style={S}>
          <div style={H}>2. 입찰 일정</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
            {data.bid_timeline.rfp_published && <span>공고: {data.bid_timeline.rfp_published.slice(0, 10)}</span>}
            {data.bid_timeline.bid_deadline && <span style={{ fontWeight: 700 }}>마감: {data.bid_timeline.bid_deadline.slice(0, 10)} {data.bid_timeline.d_day != null && `(D-${Math.max(0, data.bid_timeline.d_day)})`}</span>}
            {data.bid_timeline.pt_date && <span>PT: {data.bid_timeline.pt_date.slice(0, 10)}</span>}
            {data.bid_timeline.announcement_date && <span>발표: {data.bid_timeline.announcement_date.slice(0, 10)}</span>}
          </div>
        </div>
      )}

      {/* 7. 수주 가능성 진단 (정량 코어 — 먼저 배치) */}
      <div style={S}>
        <div style={H}>3. 수주 가능성 진단 (정량)</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: probColor(wa.probability) }}>{wa.probability.toFixed(1)}%</span>
          <span style={{ fontSize: 13, color: '#666' }}>95% CI {wa.ci_low.toFixed(0)}–{wa.ci_high.toFixed(0)}% · Voting {wa.voter_count}명</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
          {Object.entries(wa.pillar_scores).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center', padding: 8, background: '#f3f4f6', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#666' }}>{k} {PILLAR_LABEL[k] ?? ''}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{(v * 10).toFixed(1)}</div>
            </div>
          ))}
        </div>
        {wa.weaknesses.length > 0 && (
          <div style={{ fontSize: 12, color: '#666' }}>
            주요 약점: {wa.weaknesses.map(w => `${w.label}(${w.score.toFixed(1)})`).join(', ')}
          </div>
        )}
      </div>

      {/* 4. 경쟁 구도 */}
      <div style={S}>
        <div style={H}>4. 경쟁 구도</div>
        {data.competition.competitors?.length > 0 ? data.competition.competitors.map((c, i) => (
          <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
            <b>{c.name}</b> — 강점: {c.strength} / 위협: {c.threat}
          </div>
        )) : <div style={{ color: '#999', fontSize: 13 }}>경쟁사 미입력</div>}
        {data.competition.positioning && <p style={{ marginTop: 10, fontSize: 13, color: '#374151' }}>{data.competition.positioning}</p>}
      </div>

      {/* 5. 협력 구도 */}
      <div style={S}>
        <div style={H}>5. 협력 구도</div>
        {data.collaboration.partners?.length > 0 ? (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr>{['파트너', '역할', '과업 범위'].map(h => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e5e7eb', color: '#666' }}>{h}</th>)}</tr></thead>
            <tbody>{data.collaboration.partners.map((p, i) => (
              <tr key={i}><td style={{ padding: 6 }}>{p.name}</td><td style={{ padding: 6 }}>{p.role}</td><td style={{ padding: 6 }}>{p.task_scope}</td></tr>
            ))}</tbody>
          </table>
        ) : <div style={{ color: '#999', fontSize: 13 }}>파트너 미입력</div>}
      </div>

      {/* 6. Winning 포인트 */}
      <div style={S}>
        <div style={H}>6. Winning 포인트</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          {data.winning_points.map((w, i) => <li key={i}>{w}</li>)}
        </ol>
      </div>

      {/* 8. 제안 전략 */}
      <div style={S}>
        <div style={H}>7. 제안 전략</div>
        {data.proposal_strategy.map((s, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>[{s.pillar}] {PILLAR_LABEL[s.pillar] ?? ''}</div>
            <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13 }}>{s.how_to?.map((h, j) => <li key={j}>{h}</li>)}</ul>
            <div style={{ fontSize: 13, color: '#374151' }}>→ {s.value_proposition}</div>
          </div>
        ))}
      </div>

      {/* 9. 수행 리스크 */}
      <div style={S}>
        <div style={H}>8. 수행 리스크</div>
        {data.execution_risks.map((r, i) => (
          <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
            <b>{r.name}</b> <span style={{ color: r.level === 'high' ? '#dc2626' : r.level === 'low' ? '#16a34a' : '#d97706' }}>[{r.level}]</span> — {r.mitigation}
          </div>
        ))}
      </div>

      {/* 10. 담당 조직 */}
      {(data.team.size || data.team.execution_unit) && (
        <div style={S}>
          <div style={H}>9. 담당 조직</div>
          <div style={{ fontSize: 13 }}>
            {data.team.execution_unit && <span>실행조직: {data.team.execution_unit} · </span>}
            {data.team.pm && <span>PM: {data.team.pm} · </span>}
            {data.team.size && <span>팀 규모: {data.team.size}명</span>}
          </div>
        </div>
      )}

      {/* 권고 */}
      <div style={{ ...S, background: '#0369a1', color: '#fff' }}>
        <div style={{ ...H, color: '#bae6fd' }}>최종 권고</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{data.recommendation}</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{data.recommendation_rationale}</p>
      </div>
    </div>
  );
}
