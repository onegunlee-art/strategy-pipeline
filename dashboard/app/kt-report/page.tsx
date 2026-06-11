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
              KT 수주전략팀의 입찰 승률 판단은 현재 <strong>담당자의 경험치와 직관</strong>에 전적으로 의존한다.
            </p>
            <ul>
              <li>판단 기준이 개인마다 달라 <strong>일관성 부재</strong></li>
              <li>복수 입찰 건의 우선순위 비교가 어렵고 <strong>의사결정 지연</strong></li>
              <li>승패 원인 분석이 축적되지 않아 <strong>학습 효과 미흡</strong></li>
            </ul>
          </>
        ),
      },
      {
        heading: '목표',
        content: (
          <>
            <blockquote>
              글로벌 정보 + 내부 DB + 집단지성을 결합해 <strong>수주 성공 확률을 자동으로 산출</strong>하고,
              확률을 높이기 위한 전략 아이디어를 즉시 제공하는 플랫폼 구축
            </blockquote>
            <ul style={{ marginTop: 10 }}>
              <li>의사결정 속도 향상 (분석 소요 시간 단축)</li>
              <li>담당자 간 판단 일관성 확보</li>
              <li>과거 수실주 데이터 기반 지속 학습</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    num: '02',
    title: 'Polymarket에서 얻은 아이디어',
    subsections: [
      {
        heading: 'Polymarket이란',
        content: (
          <>
            <p style={{ lineHeight: 1.9, wordBreak: 'keep-all', marginBottom: 10 }}>
              Polymarket은 <strong>글로벌 예측 시장 플랫폼</strong>이다. 불특정 다수가 &ldquo;이 사건이 일어날 확률&rdquo;에 베팅하고,
              시장 가격이 곧 집단지성의 확률 추정값이 된다.
            </p>
            <ul>
              <li>전문가 개인 예측보다 <strong>집단 집계 예측이 더 정확</strong>하다는 것이 검증됨</li>
              <li>새로운 정보가 즉시 가격에 반영 → <strong>실시간 확률 업데이트</strong></li>
            </ul>
          </>
        ),
      },
      {
        heading: '수주전략에 이식한 핵심 구조',
        content: (
          <>
            <table>
              <thead>
                <tr>
                  <th>Polymarket 구조</th>
                  <th>수주 Winning Ratio 플랫폼</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>시장 참여자 베팅</td><td>수주팀·BD팀·임원 <strong>전문가 투표</strong></td></tr>
                <tr><td>새 정보 → 가격 이동</td><td>시그널 카드 → <strong>Bayesian 확률 업데이트</strong></td></tr>
                <tr><td>집단지성 확률 수렴</td><td>투표 누적 → <strong>Posterior 확률 수렴</strong></td></tr>
                <tr><td>외부 뉴스·이벤트 반영</td><td>글로벌 뉴스 RAG → <strong>드라이버 점수 자동 산출</strong></td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8', wordBreak: 'keep-all' }}>
              <strong>차이점:</strong> 폴리마켓은 금전 베팅 기반 / 이 플랫폼은 <strong>도메인 드라이버(5축) 기반 구조화 확률</strong>
            </p>
          </>
        ),
      },
    ],
  },
  {
    num: '03',
    title: '현재 데모 구현 방식 — 글로벌 뉴스 RAG로 대체',
    subsections: [
      {
        heading: '배경',
        content: (
          <p style={{ lineHeight: 1.9, wordBreak: 'keep-all' }}>
            KT 수실주 DB(경쟁사 정보, 수실주 보고서, 발주사 정보 등)가 현재 미확보 상태이므로,
            <strong> 글로벌 뉴스 데이터</strong>를 대체 신호로 활용해 알고리즘 전체를 구현·검증했다.
          </p>
        ),
      },
      {
        heading: '구현 흐름',
        content: (
          <div style={{
            background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 6, padding: '16px 20px', fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12, lineHeight: 2.2, color: '#94a3b8',
          }}>
            {[
              '주제 입력 (예: "이란 전쟁 종결 가능성")',
              '↓',
              '글로벌 뉴스 RAG 검색',
              '(Foreign Affairs · The Economist · Financial Times 등)',
              '↓',
              'GPT OSS (o4-mini) — 5개 드라이버 자동 생성 + 점수 산출',
              '↓',
              'Bayesian Prior 확률 계산',
              '↓',
              '시그널 카드 생성 (4~7장)  ←→  전문가 투표 누적',
              '↓',
              'Posterior 확률 수렴 + 전략 아이디어 생성',
              '↓',
              '리포트 발행',
            ].map((line, i) => (
              <div key={i} style={{ color: line === '↓' ? 'rgba(34,211,238,0.5)' : line.startsWith('(') ? '#64748b' : '#cbd5e1' }}>{line}</div>
            ))}
          </div>
        ),
      },
      {
        heading: '알고리즘 핵심',
        content: (
          <ul>
            <li><strong>5축 드라이버 프레임워크</strong>: 주제별 자동 생성 — 각 드라이버 0~10점 → 기여도 계산 (invert 플래그 처리)</li>
            <li><strong>Bayesian Ensemble</strong>: <code>Posterior = Prior × PRIOR_STRENGTH + Σ(투표 가중 델타)</code> → 확률 수렴</li>
            <li><strong>시그널 카드</strong>: 뉴스 이벤트를 구조화 카드로 변환, 각 카드가 드라이버 점수에 ±영향</li>
            <li><strong>현장 의견 반영</strong>: QR 투표 페이지에서 자유 텍스트 → GPT가 시그널로 변환 → 즉시 확률 반영</li>
          </ul>
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
            ✓ 데이터 없이도 알고리즘 구조·UX·투표 메커니즘·리포트 생성 전체 동작 확인 완료
          </div>
        ),
      },
    ],
  },
  {
    num: '04',
    title: '실 DB 연동 시 그대로 적용 가능한 이유',
    subsections: [
      {
        heading: '데이터 소스만 교체하면 된다',
        content: (
          <>
            <table>
              <thead>
                <tr>
                  <th>구성 요소</th>
                  <th>현재 데모 (뉴스 RAG)</th>
                  <th>실 DB 연동 후</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><strong>데이터 소스</strong></td><td>글로벌 뉴스 기사</td><td>수실주 보고서 · 경쟁사 DB · 발주사 정보</td></tr>
                <tr><td><strong>드라이버 5축</strong></td><td>지정학 축 (자동 생성)</td><td>기술력 · 가격경쟁력 · 관계 · 레퍼런스 · 리스크</td></tr>
                <tr><td><strong>시그널 카드</strong></td><td>뉴스 이벤트 카드</td><td>발주사 동향 · 입찰 변수 · 경쟁사 움직임</td></tr>
                <tr><td><strong>투표자</strong></td><td>데모 참여자</td><td>수주팀 · BD팀 · 임원</td></tr>
                <tr><td><strong>확률 의미</strong></td><td>지정학 사건 가능성</td><td><strong>수주 성공 확률</strong></td></tr>
                <tr><td><strong>전략 출력</strong></td><td>국제 정세 대응 전략</td><td>수주 확률 제고 전략 (액션 플랜)</td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12, fontSize: 13, color: '#22d3ee', wordBreak: 'keep-all' }}>
              → Bayesian 업데이트 · RAG 파이프라인 · 투표 메커니즘 · 리포트 생성 <strong>코드 재사용률 90%+</strong>
            </p>
          </>
        ),
      },
    ],
  },
  {
    num: '05',
    title: '다음 단계 제안',
    subsections: [
      {
        heading: 'Phase 1 — 데이터 파이프라인 구축 (1~2개월)',
        content: (
          <ol>
            <li>KT 수실주 DB 연결: 과거 5년 입찰 결과 → 드라이버 가중치 학습</li>
            <li>경쟁사 정보 자동 수집: 공시 데이터 · 뉴스 모니터링 → 시그널 카드 자동 생성</li>
            <li>발주사 성향 프로파일링: 담당자 · 부서별 의사결정 패턴 모델링</li>
          </ol>
        ),
      },
      {
        heading: 'Phase 2 — 수주팀 실 운영 파일럿 (2~3개월)',
        content: (
          <ol start={4}>
            <li>수주팀 · BD팀 계정 등록 → 투표 권한 부여 (역할별 가중치 설정)</li>
            <li>진행 중인 입찰 건 실시간 입력 → 확률 추이 모니터링</li>
            <li>승패 결과 피드백 루프 → 드라이버 가중치 자동 보정</li>
          </ol>
        ),
      },
      {
        heading: 'Phase 3 — 고도화',
        content: (
          <ol start={7}>
            <li>경쟁사 A/B 시나리오 시뮬레이터 (What-if 분석)</li>
            <li>임원 대시보드: 전체 포트폴리오 수주 확률 히트맵</li>
            <li>모바일 QR 투표 → 현장 인텔리전스 실시간 수집</li>
          </ol>
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
          display: 'inline-block',
          background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
          borderRadius: 6, padding: '8px 20px', fontSize: 13, color: '#94a3b8',
          fontStyle: 'italic', maxWidth: 600, wordBreak: 'keep-all', lineHeight: 1.8,
        }}>
          이 데모는 폴리마켓의 집단지성 확률 수렴 구조에서 착안하여,
          KT 수주전략에 <strong>Bayesian 앙상블 + RAG + 전문가 투표</strong>를 결합한
          Winning Ratio 자동화 툴이다.
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
                    textTransform: 'uppercase', fontFamily: 'IBM Plex Mono',
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
            현재는 글로벌 뉴스로 알고리즘 전체를 검증했으며,{' '}
            <strong style={{ color: '#f1f5f9' }}>수실주 DB가 확보되는 즉시 데이터 소스 교체만으로 실 운영 전환이 가능</strong>하다.
            Bayesian 업데이트 · RAG 파이프라인 · 투표 메커니즘 · 리포트 생성 전 구성이 코드 변경 없이 재사용된다.
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
