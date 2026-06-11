'use client';

const FONT = "'Malgun Gothic', '맑은 고딕', -apple-system, BlinkMacSystemFont, sans-serif";

const sections = [
  {
    num: '01',
    title: '왜 만들었는가',
    subsections: [
      {
        heading: 'Pain Point',
        content: (
          <>
            <p style={{ marginBottom: 10, lineHeight: 1.9, wordBreak: 'keep-all' }}>
              KT 수주전략팀의 입찰 승률 판단은 현재 <strong>담당자의 경험치와 직관</strong>에 의존한다.
            </p>
            <ul>
              <li>판단 기준이 개인마다 달라 <strong>일관성 부재</strong></li>
              <li>복수 입찰 건의 우선순위 비교가 어렵고 <strong>의사결정 지연</strong></li>
              <li>승패 원인이 축적되지 않아 <strong>학습 효과 미흡</strong></li>
            </ul>
          </>
        ),
      },
      {
        heading: '목표',
        content: (
          <blockquote>
            상충하는 정보의 흐름 속에서 <strong>수주 성공 확률을 자동·정량 산출</strong>하고,
            확률을 높이는 전략을 즉시 제시하는 <strong>살아있는 대시보드</strong> 구축
          </blockquote>
        ),
      },
    ],
  },
  {
    num: '02',
    title: '핵심 통찰 — 수주와 뉴스는 "같은 수학 문제"다',
    subsections: [
      {
        heading: '문제의 본질',
        content: (
          <>
            <p style={{ lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 12 }}>
              수주 승률 예측의 본질은 <strong>불완전하고 서로 상충하는 정보가 매일 들어오는 가운데,
              미래의 이분형 결과(수주 성공/실패)의 확률을 추정하는 문제</strong>다.
              글로벌 뉴스 분석도 정확히 동일한 구조다 — 미래 사건을 매일 갱신되는 상충된 보도로부터 확률 추정한다.
              이 <strong>동형성(isomorphism)</strong>이 데모의 근거다.
            </p>
            <table>
              <thead>
                <tr>
                  <th>수주 환경의 특성</th>
                  <th>글로벌 뉴스의 동형 특성</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>매일 입찰 변수·경쟁 구도 변동</td><td>매일 새 기사 생성</td></tr>
                <tr><td>영업·기술·경쟁사 견해 <strong>상충</strong></td><td>매체별 상충 견해 (FA vs FT vs Economist)</td></tr>
                <tr><td>단일 정답 없음 → 확률 추정</td><td>미래 사건 → 확률 추정</td></tr>
                <tr><td>정보 누적 → 판단 수렴</td><td>신호 누적 → Posterior 수렴</td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 13, color: '#22d3ee', wordBreak: 'keep-all', lineHeight: 1.8 }}>
              → <strong>&ldquo;매일 생성 + 다양한 견해의 충돌&rdquo;</strong>이라는 수주 환경의 본질을 뉴스가 그대로 재현한다.
              뉴스는 수주 데이터의 <strong>완벽한 대리 시험장(proxy testbed)</strong>이다.
            </p>
          </>
        ),
      },
    ],
  },
  {
    num: '03',
    title: '글로벌 뉴스로 무엇을 검증했나 — 수학적 트리거',
    subsections: [
      {
        heading: '확률은 "내용"이 아니라 "일치/충돌 지점"에서 발화된다',
        content: (
          <>
            <p style={{ lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 10 }}>
              엔진은 기사 원문을 읽어 확률을 매기지 않는다. 복수 소스를 <strong>N개 드라이버 축</strong>으로
              정규화한 뒤, 소스 간 <strong>일치(alignment)·충돌(conflict)</strong>을 정량화하여 확률을 계산한다.
            </p>
            <ul>
              <li><strong style={{ color: '#86efac' }}>Alignment</strong>: 복수 소스가 같은 방향 → 드라이버 신뢰도↑, 확률 기여 강화</li>
              <li><strong style={{ color: '#fca5a5' }}>Conflict</strong>: 소스가 반대 방향 → 불확실성↑ (분포 σ 확대), 순델타 상쇄</li>
            </ul>
          </>
        ),
      },
      {
        heading: '확률 수식 (실제 구현)',
        content: (
          <div style={{
            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 6, padding: '18px 20px', fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12.5, lineHeight: 1.95, color: '#cbd5e1',
          }}>
            <div style={{ color: '#22d3ee', marginBottom: 4 }}>① 드라이버 기여도 (invert 축은 뒤집어 정규화)</div>
            <div style={{ marginBottom: 14 }}>contribution(d) = d.invert ? (10 − score) : score&nbsp;&nbsp;<span style={{ color: '#64748b' }}>// 0~10</span></div>

            <div style={{ color: '#22d3ee', marginBottom: 4 }}>② Prior 확률 (기여도 평균 × 10)</div>
            <div style={{ marginBottom: 14 }}>P₀ = clamp(5, 95, round( mean(contribution) × 10 ))</div>

            <div style={{ color: '#22d3ee', marginBottom: 4 }}>③ Bayesian Posterior (일치/충돌을 가중 델타로 누적)</div>
            <div>score&apos; = clamp(0, 10, score + <span style={{ color: '#f1f5f9' }}>Σ(δᵢ·wᵢ) / (κ + Σwᵢ)</span>)</div>
            <div style={{ color: '#64748b', fontSize: 11.5, margin: '4px 0 4px 12px', lineHeight: 1.8 }}>
              δᵢ = 시그널 i의 방향 델타 (일치 +, 충돌 −)<br />
              wᵢ = 소스/투표자 가중치 (역할별)<br />
              κ&nbsp; = PRIOR_STRENGTH = 10 (AI 사전판단을 10표로 취급)
            </div>
            <div style={{ marginBottom: 14 }}>P = clamp(5, 95, round( mean(contribution(score&apos;)) × 10 ))</div>

            <div style={{ color: '#22d3ee', marginBottom: 4 }}>④ 신뢰구간 수렴 (신호 누적 시 분포가 좁아짐)</div>
            <div>σ = σ₀ / √(1 + n/3)&nbsp;&nbsp;<span style={{ color: '#64748b' }}>// n = 누적 신호 수</span></div>
          </div>
        ),
      },
      {
        heading: '결정적 성질 — 도메인 불변(domain-invariant)',
        content: (
          <div style={{
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 6, padding: '14px 18px', lineHeight: 1.9, wordBreak: 'keep-all',
          }}>
            <p style={{ margin: 0 }}>
              위 어느 수식에도 <strong style={{ color: '#f1f5f9' }}>&ldquo;뉴스&rdquo;라는 단어가 박혀 있지 않다.</strong>{' '}
              입력은 오직 <strong>(드라이버 점수, 일치/충돌 가중 델타)</strong>뿐이다.
              초기엔 AI 사전판단(κ=10표)이 지배하고, 신호가 쌓일수록 집단 판단으로 수렴한다
              (1표의 최대 확률 이동 ≈ 0.9%로 과민반응 방지).
            </p>
            <p style={{ margin: '10px 0 0', color: '#a5b4fc', fontWeight: 600 }}>
              → 입력의 출처가 뉴스든 수주 데이터든, 엔진은 같은 방식으로 작동한다.
            </p>
          </div>
        ),
      },
      {
        heading: '검증 결과',
        content: (
          <div style={{
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 6, padding: '12px 16px', color: '#86efac', fontSize: 14,
            fontWeight: 600, wordBreak: 'keep-all', lineHeight: 1.8,
          }}>
            ✓ 데이터 없이도 확률 트리거 · Bayesian 수렴 · 투표 메커니즘 · 리포트 생성 전체 동작 확인 완료
          </div>
        ),
      },
    ],
  },
  {
    num: '04',
    title: '왜 그대로 수주에 적용되는가',
    subsections: [
      {
        heading: '뉴스 수집부만 떼고, 동일 엔진에 수주 데이터를 연결',
        content: (
          <>
            <p style={{ lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 12 }}>
              <strong style={{ color: '#fbbf24' }}>실제 Winning Ratio 대시보드는 글로벌 뉴스를 쓰지 않는다.</strong>{' '}
              뉴스 수집부를 떼어내고 <strong>동일한 확률 엔진</strong>에 수주 데이터를 입력으로 연결하기만 하면 된다.
              <strong> 수식·로직 변경 0.</strong>
            </p>
            <table>
              <thead>
                <tr>
                  <th>구성 요소</th>
                  <th>데모 (뉴스)</th>
                  <th>실 운영 (수주)</th>
                  <th>엔진 변경</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>입력 소스</td><td>글로벌 뉴스 기사</td><td>수실주·경쟁사·발주사 DB</td><td><strong style={{ color: '#86efac' }}>없음</strong></td></tr>
                <tr><td>드라이버 5축</td><td>외교·군사·경제·국내·외부</td><td>기술력·가격·관계·레퍼런스·리스크</td><td>라벨만 교체</td></tr>
                <tr><td>일치/충돌 신호</td><td>매체 간 보도 상충</td><td>영업·기술·경쟁사 인텔리전스 상충</td><td><strong style={{ color: '#86efac' }}>없음</strong></td></tr>
                <tr><td>투표자</td><td>데모 참여자</td><td>수주팀·BD팀·임원</td><td><strong style={{ color: '#86efac' }}>없음</strong></td></tr>
                <tr><td>확률 의미</td><td>사건 발생 가능성</td><td><strong>수주 성공 확률</strong></td><td><strong style={{ color: '#86efac' }}>없음</strong></td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 13, color: '#22d3ee', wordBreak: 'keep-all' }}>
              → Bayesian 업데이트 · 일치/충돌 트리거 · 투표 가중 · 리포트 생성 <strong>코드 재사용률 90%+</strong>
            </p>
          </>
        ),
      },
    ],
  },
  {
    num: '05',
    title: '승인 후 로드맵 — "살아있는" Winning Ratio 대시보드',
    subsections: [
      {
        heading: 'Phase 1 — 실 DB 연결 (1~2개월)',
        content: (
          <ol>
            <li>수실주 DB 연결: 과거 5년 입찰 결과 → 드라이버 가중치·κ 보정 학습</li>
            <li>경쟁사·발주사 정보 파이프라인 → 일치/충돌 신호 자동 생성</li>
          </ol>
        ),
      },
      {
        heading: 'Phase 2 — Weekly 시장조사 레포트 발간 (정례화)',
        content: (
          <ol start={3}>
            <li>매주 시장·경쟁 동향 자동 수집 → 진행 입찰 건 확률 갱신</li>
            <li>변동 사유(어느 드라이버가 왜 움직였는지)까지 리포트로 발간</li>
          </ol>
        ),
      },
      {
        heading: 'Phase 3 — 집단지성 + 살아있는 대시보드',
        content: (
          <>
            <ol start={5}>
              <li>수주팀 실시간 투표 → 현장 인텔리전스 즉시 반영</li>
              <li>승패 피드백 루프 → 드라이버 가중치 자동 재보정 (정확도 지속 향상)</li>
              <li>임원 대시보드: 전체 포트폴리오 수주 확률 히트맵</li>
            </ol>
            <p style={{ marginTop: 12, fontSize: 13, color: '#fbbf24', wordBreak: 'keep-all', lineHeight: 1.8 }}>
              → 데모의 &ldquo;정지된 스냅샷&rdquo;이, 매주 갱신되는 <strong>정확하고 살아있는 수주 확률 대시보드</strong>로 전환된다.
            </p>
          </>
        ),
      },
    ],
  },
];

export default function KtReportPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      fontFamily: FONT,
      color: '#e2e8f0',
      padding: '0 0 80px',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        strong { color: #f1f5f9; }
        ul, ol { padding-left: 22px; line-height: 2; margin: 8px 0; }
        li { margin-bottom: 4px; word-break: keep-all; }
        code { font-family: 'IBM Plex Mono', monospace; font-size: 12px;
               background: rgba(34,211,238,0.1); color: #67e8f9;
               padding: 2px 6px; border-radius: 3px; }
        blockquote {
          border-left: 3px solid #22d3ee;
          margin: 0; padding: 10px 16px;
          background: rgba(34,211,238,0.05);
          border-radius: 0 6px 6px 0;
          font-style: italic; color: #94a3b8;
          line-height: 1.9; word-break: keep-all;
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: rgba(34,211,238,0.08); color: #22d3ee;
             padding: 8px 12px; text-align: left; font-size: 11px;
             letter-spacing: 0.5px; border-bottom: 1px solid rgba(34,211,238,0.2); }
        td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);
             line-height: 1.6; word-break: keep-all; vertical-align: top; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        @media print {
          body { background: white; color: #1e293b; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(99,102,241,0.08) 100%)',
        borderBottom: '1px solid rgba(34,211,238,0.15)',
        padding: '48px 0 40px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10, fontFamily: 'IBM Plex Mono', letterSpacing: '3px',
          color: '#22d3ee', marginBottom: 16, opacity: 0.8,
        }}>
          INTERNAL MEMO · KT 수주전략팀 · 2026.06
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 700, margin: '0 0 12px',
          color: '#f1f5f9', letterSpacing: '-0.5px', wordBreak: 'keep-all',
        }}>
          KT 수주전략 Winning Ratio 자동화 툴
        </h1>
        <div style={{ fontSize: 15, color: '#64748b', marginBottom: 20 }}>
          데모 개요 보고서
        </div>
        <div style={{
          display: 'inline-block', textAlign: 'left',
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 8, padding: '16px 22px', fontSize: 13.5, color: '#cbd5e1',
          maxWidth: 640, wordBreak: 'keep-all', lineHeight: 1.95,
        }}>
          <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', letterSpacing: '2px', color: '#fbbf24', marginBottom: 8 }}>
            한 줄 요약
          </div>
          <strong style={{ color: '#fbbf24' }}>실제 Winning Ratio 대시보드는 글로벌 뉴스를 쓰지 않는다.</strong>{' '}
          이번 데모는 &ldquo;정보 간 일치·충돌에서 확률을 산출하는 엔진&rdquo;이 제대로 작동하는지를
          수주 데이터 대신 <strong>글로벌 뉴스로 먼저 검증</strong>한 것이다.
          엔진은 정보의 <em>내용</em>이 아니라 <em>구조</em>만 입력받기 때문에,
          승인 후 입력을 수주 데이터로 교체하면 <strong>수식 변경 없이</strong> 그대로 작동한다.
        </div>
      </div>

      {/* Sections */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
        {sections.map((sec) => (
          <div key={sec.num} style={{ marginTop: 56 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
              <span style={{
                fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700,
                color: '#22d3ee', letterSpacing: '1px', opacity: 0.7,
              }}>{sec.num}</span>
              <h2 style={{
                fontSize: 20, fontWeight: 700, margin: 0,
                color: '#f1f5f9', wordBreak: 'keep-all',
              }}>{sec.title}</h2>
            </div>
            <div style={{ borderTop: '1px solid rgba(34,211,238,0.12)', paddingTop: 24 }}>
              {sec.subsections.map((sub) => (
                <div key={sub.heading} style={{ marginBottom: 28 }}>
                  <h3 style={{
                    fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                    color: '#64748b', marginBottom: 12, marginTop: 0,
                    wordBreak: 'keep-all',
                  }}>{sub.heading}</h3>
                  <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.9 }}>
                    {sub.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Summary box */}
        <div style={{
          marginTop: 56,
          background: 'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(99,102,241,0.06) 100%)',
          border: '1px solid rgba(34,211,238,0.2)',
          borderRadius: 10, padding: '28px 32px',
        }}>
          <div style={{
            fontSize: 10, fontFamily: 'IBM Plex Mono', letterSpacing: '2px',
            color: '#22d3ee', marginBottom: 14,
          }}>SUMMARY</div>
          <p style={{ margin: 0, lineHeight: 2, fontSize: 14, color: '#94a3b8', wordBreak: 'keep-all' }}>
            이 데모는 폴리마켓의 집단지성 확률 수렴 구조에서 착안하여,{' '}
            <strong style={{ color: '#f1f5f9' }}>일치/충돌 지점에서 확률을 산출하는 도메인 불변 엔진</strong>을 구현하고
            글로벌 뉴스로 그 수학적 타당성을 검증한 것이다.
            엔진이 정보의 <em>내용</em>이 아니라 <em>구조</em>만 입력받기에,{' '}
            <strong style={{ color: '#f1f5f9' }}>승인 후 입력을 수주 데이터로 교체하면 수식 변경 없이 그대로 작동한다.</strong>
          </p>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, textAlign: 'center',
          fontSize: 11, color: '#334155', fontFamily: 'IBM Plex Mono',
          letterSpacing: '0.5px',
        }}>
          본 보고서는 KT 수주전략 Winning Ratio 자동화 플랫폼 데모 내부 검토용으로 작성되었습니다.
        </div>
      </div>
    </div>
  );
}
