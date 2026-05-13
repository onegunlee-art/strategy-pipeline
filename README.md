# strategy-pipeline

B2B 수주 예측 대시보드 — AI 기반 멀티 에이전트 승률 계산 시스템

## 구조

```
dashboard/          Next.js 14 앱 (프론트 + API Routes)
├── app/
│   ├── api/        API 엔드포인트
│   │   ├── predict/    수주 확률 계산 및 저장
│   │   ├── outcome/    실제 결과 입력
│   │   ├── deals/      딜 목록 조회
│   │   ├── weights/    현재 가중치 조회
│   │   └── retrain/    Claude API 기반 가중치 재학습
│   └── page.tsx    메인 대시보드 (4탭)
├── components/
│   ├── InterviewTab.tsx    변수 입력 (7개 슬라이더)
│   ├── AnalysisTab.tsx     확률 결과 + 기여도 차트
│   ├── SimulatorTab.tsx    시나리오 시뮬레이터
│   └── LearningTab.tsx     학습 현황 + AI 재학습
└── lib/
    ├── algorithm.ts    확률 계산 (가중합 + logistic)
    └── db.ts           SQLite (better-sqlite3)
```

## 실행

```bash
cd dashboard
cp .env.example .env.local
# .env.local에 ANTHROPIC_API_KEY 입력

npm install
npm run dev
```

## 핵심 기능

- **7개 변수** 기반 수주 확률 계산 (가중 평균 + logistic squish)
- **피드백 루프**: 실제 결과 입력 → Brier Score 계산 → Claude API가 가중치 재조정
- **SQLite** 로컬 저장 (Supabase PostgreSQL로 교체 가능)
- 다크 테마, IBM Plex Mono 폰트, 시안색 액센트

## 배포

- 프론트: Vercel (`npm run build` → Vercel 연결)
- DB: Supabase (PostgreSQL)로 교체 시 `lib/db.ts`만 수정
