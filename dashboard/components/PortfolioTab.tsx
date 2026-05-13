'use client';

import { useEffect, useState } from 'react';
interface CalibPoint { bucket: string; predicted: number; actual: number; count: number; }
interface Weight { variable_id: string; weight_value: number; version: number; updated_at: string; }
interface EnsembleW { pillar_mult: number; bayesian: number; elo: number; monte_carlo: number; version: number; }

interface Props { refreshKey: number; }

export default function PortfolioTab({ refreshKey }: Props) {
  const [data, setData] = useState<{
    sub_weights: Weight[];
    pillar_weights: Weight[];
    ensemble_weights: EnsembleW | null;
    calibration: CalibPoint[];
    stats: { total_deals: number; win_rate: number; avg_brier: number };
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/weights').then(r => r.json()).then(setData);
  }, [refreshKey]);

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => { rec[h] = cells[i] ?? ''; });
      return rec;
    });
  };

  const doImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const rows = parseCsv(csvText);
      const records = rows.map(r => ({
        client_name: r.client_name || r['고객사명'] || '미상',
        deal_size: r.deal_size || r['딜규모'] || undefined,
        industry: r.industry || r['산업'] || undefined,
        expected_revenue: r.expected_revenue ? parseFloat(r.expected_revenue) : undefined,
        closed_at: r.closed_at || r['종료일'] || undefined,
        actual_result: (parseInt(r.actual_result || r['수주여부'] || '0') === 1 ? 1 : 0) as 0 | 1,
        competitors: (r.competitors || r['경쟁사'] || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean),
        V: r.V ? parseFloat(r.V) : undefined,
        P: r.P ? parseFloat(r.P) : undefined,
        D: r.D ? parseFloat(r.D) : undefined,
        E: r.E ? parseFloat(r.E) : undefined,
      }));
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const d = await res.json();
      setImportMsg(d.message || d.error || '완료');
      // refresh
      fetch('/api/weights').then(r => r.json()).then(setData);
    } catch (e: unknown) {
      setImportMsg(String(e));
    } finally {
      setImporting(false);
    }
  };

  const doRetrain = async () => {
    setRetraining(true);
    setRetrainMsg(null);
    try {
      const res = await fetch('/api/retrain', { method: 'POST' });
      const d = await res.json();
      setRetrainMsg(d.reasoning || d.message || (d.ok ? '완료' : '실패'));
      fetch('/api/weights').then(r => r.json()).then(setData);
    } catch (e: unknown) {
      setRetrainMsg(String(e));
    } finally {
      setRetraining(false);
    }
  };

  if (!data) return <div style={{ color: 'var(--text-dim)' }}>로딩 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Stat label="TOTAL DEALS" value={data.stats.total_deals.toString()} />
        <Stat label="WIN RATE" value={`${(data.stats.win_rate * 100).toFixed(1)}%`} />
        <Stat label="AVG BRIER" value={data.stats.avg_brier.toFixed(3)} small="낮을수록 좋음" />
      </div>

      {/* CSV 임포트 */}
      <Card title="IMPORT HISTORICAL DATA (CSV)">
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' }}>
          헤더 예시: <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-mid)' }}>
            client_name, deal_size, industry, closed_at, actual_result, competitors, V, P, D, E
          </span>
          <br />
          (V/P/D/E는 1-10 점수, 미입력 시 5. competitors는 콤마/세미콜론 구분. actual_result는 1/0)
        </div>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
          placeholder="client_name,deal_size,actual_result,competitors,V,P,D,E&#10;KT엔터,50억,1,&quot;LG CNS,SKT&quot;,8,7,9,6"
          rows={6}
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '12px', color: 'var(--text)',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', resize: 'vertical',
          }} />
        <button onClick={doImport} disabled={importing || !csvText.trim()}
          style={{
            marginTop: '12px', padding: '10px 16px', borderRadius: '6px', border: 'none',
            background: importing ? 'var(--surface2)' : 'var(--cyan)', color: importing ? 'var(--text-dim)' : '#000',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', cursor: importing ? 'wait' : 'pointer',
          }}>
          {importing ? 'IMPORTING...' : '▶ IMPORT'}
        </button>
        {importMsg && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--green)' }}>{importMsg}</div>
        )}
      </Card>

      {/* Calibration Plot */}
      <Card title="CALIBRATION PLOT (예측 vs 실제)">
        {data.calibration.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
            데이터 부족 — 예측+결과 기록이 누적되면 표시됩니다.
          </div>
        ) : (
          <CalibrationChart points={data.calibration} />
        )}
      </Card>

      {/* AI 재학습 */}
      <Card title="AI RETRAIN (Claude Sonnet 4.6)">
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' }}>
          최근 데이터로 Pillar 가중치 + Sub-factor 가중치 + Ensemble 가중치 모두 재학습합니다.
        </div>
        <button onClick={doRetrain} disabled={retraining}
          style={{
            padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--cyan)',
            background: 'transparent', color: 'var(--cyan)',
            fontFamily: 'IBM Plex Mono', fontSize: '12px', cursor: retraining ? 'wait' : 'pointer',
          }}>
          {retraining ? 'RETRAINING...' : '◈ 재학습 실행'}
        </button>
        {retrainMsg && (
          <div style={{ marginTop: '12px', padding: '10px', background: 'var(--surface2)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-mid)' }}>
            {retrainMsg}
          </div>
        )}
      </Card>

      {/* Ensemble + Pillar weights */}
      <Card title="CURRENT WEIGHTS">
        {data.ensemble_weights && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>
              ENSEMBLE (v{data.ensemble_weights.version})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <WeightCell label="Pillar" value={data.ensemble_weights.pillar_mult} />
              <WeightCell label="Bayesian" value={data.ensemble_weights.bayesian} />
              <WeightCell label="Elo" value={data.ensemble_weights.elo} />
              <WeightCell label="Monte Carlo" value={data.ensemble_weights.monte_carlo} />
            </div>
          </div>
        )}

        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            PILLAR WEIGHTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {data.pillar_weights.map(w => (
              <WeightCell key={w.variable_id} label={w.variable_id.slice(7)} value={w.weight_value} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '32px', color: 'var(--cyan)', marginTop: '6px' }}>
        {value}
      </div>
      {small && <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>{small}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function WeightCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '10px', background: 'var(--surface2)', borderRadius: '6px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '18px', color: 'var(--cyan)' }}>
        {(value * 100).toFixed(1)}%
      </div>
    </div>
  );
}

function CalibrationChart({ points }: { points: CalibPoint[] }) {
  const size = 240;
  return (
    <div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: 'var(--surface2)', borderRadius: '6px' }}>
        {/* 이상 직선 */}
        <line x1={0} y1={size} x2={size} y2={0} stroke="var(--border)" strokeDasharray="4 4" />
        {/* 축 */}
        <line x1={0} y1={size} x2={size} y2={size} stroke="var(--border)" />
        <line x1={0} y1={0} x2={0} y2={size} stroke="var(--border)" />
        {/* 점 */}
        {points.map((p, i) => {
          const cx = p.predicted * size;
          const cy = size - p.actual * size;
          const r = Math.max(4, Math.min(12, Math.sqrt(p.count) * 2));
          return <circle key={i} cx={cx} cy={cy} r={r} fill="var(--cyan)" opacity={0.7} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
        <span>점선에 가까울수록 잘 보정됨</span>
        <span>x: 예측 / y: 실제</span>
      </div>
    </div>
  );
}
