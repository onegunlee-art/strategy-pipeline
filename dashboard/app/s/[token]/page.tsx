'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const PILLARS = ['S', 'V', 'D', 'P', 'E'] as const;
const PILLAR_KO: Record<string, string> = {
  S: '사전영업', V: 'Value Impact', D: '차별화', P: '가격경쟁력', E: 'Delivery',
};

interface SignalData {
  pillarScores: Record<string, number>;
  pillarRationale: Record<string, string>;
  totalScore: number;
  items: { pillar: string; label: string; weight: number; rating: number; score: number; rationale: string }[];
  itemCount: number;
  source?: string;
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 70 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 700, color, minWidth: '42px', textAlign: 'right' }}>{value.toFixed(1)}</span>
    </div>
  );
}

export default function SignalPage() {
  const { token } = useParams<{ token: string }>();
  const [dealName, setDealName] = useState('');
  const [data, setData] = useState<SignalData | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/signal-link?token=${token}`)
      .then(r => r.json())
      .then(r => {
        if (r.error) { setError(r.error); return; }
        setDealName(r.deal_name ?? '');
        setData(r.data as SignalData);
        setCreatedAt(r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '');
      })
      .catch(() => setError('불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono', color: '#6b7280', fontSize: '13px' }}>
      LOADING...
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#ef4444', fontSize: '14px' }}>
      {error || '데이터 없음'}
    </div>
  );

  const ratingLabel = (r: number) => r === 3 ? '우수' : r === 2 ? '보통' : '미흡';
  const ratingColor = (r: number) => r === 3 ? '#22c55e' : r === 2 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* 헤더 */}
      <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#64748b', letterSpacing: '1.5px' }}>WIN-RATE SIGNAL</div>
          <div style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
            {dealName || '수주가능성 분석'}
          </div>
        </div>
        <button
          onClick={copyLink}
          style={{ padding: '8px 14px', fontSize: '12px', background: copied ? '#22c55e' : '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer' }}
        >
          {copied ? '복사됨 ✓' : '🔗 링크 복사'}
        </button>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 총점 카드 */}
        <div style={{ background: '#fff', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontFamily: 'IBM Plex Mono' }}>WIN POSSIBILITY SCORE</div>
          <div style={{ fontSize: '52px', fontWeight: 800, color: data.totalScore >= 70 ? '#22c55e' : data.totalScore >= 50 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
            {data.totalScore.toFixed(1)}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>/ 100 {createdAt && `· ${createdAt}`}</div>
        </div>

        {/* Pillar 점수 카드 */}
        <div style={{ background: '#fff', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'IBM Plex Mono', letterSpacing: '1px', marginBottom: '16px' }}>PILLAR SCORES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {PILLARS.map(pid => {
              const score = data.pillarScores?.[pid] ?? 0;
              const rationale = data.pillarRationale?.[pid];
              return (
                <div key={pid}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{PILLAR_KO[pid]}</span>
                  </div>
                  <ScoreBar value={score} />
                  {rationale && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>{rationale}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 세부 항목 */}
        {data.items && data.items.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'IBM Plex Mono', letterSpacing: '1px', marginBottom: '16px' }}>
              SUB-FACTORS ({data.items.length}개)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {PILLARS.map(pid => {
                const pillarItems = data.items.filter(i => i.pillar === pid);
                if (pillarItems.length === 0) return null;
                return (
                  <div key={pid}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', fontFamily: 'IBM Plex Mono', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      {pid} — {PILLAR_KO[pid]}
                    </div>
                    {pillarItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: i < pillarItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: ratingColor(item.rating), background: `${ratingColor(item.rating)}15`, borderRadius: '4px', padding: '2px 6px', flexShrink: 0, marginTop: '1px' }}>
                          {ratingLabel(item.rating)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{item.label}</div>
                          {item.rationale && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', lineHeight: 1.5 }}>{item.rationale}</div>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{item.weight}%</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#cbd5e1', padding: '8px 0 24px', fontFamily: 'IBM Plex Mono' }}>
          WIN-RATE · B2B 수주 예측 플랫폼
        </div>
      </div>
    </div>
  );
}
