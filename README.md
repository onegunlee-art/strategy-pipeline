# KT AI 서비스 수주전략 PPT 파이프라인

## 빠른 시작

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python run_pipeline.py
```

## 폴더 구조

```
strategy-pipeline/
├── config/
│   ├── pipeline_config.yaml    ← 슬라이드 구성, 모델, 프로젝트 정보
│   ├── ppt_style.yaml          ← 컬러·폰트·레이아웃 (디자인 튜닝)
│   └── strategy_params.yaml    ← 전략 파라미터, 경쟁사, 슬라이드별 지시
├── data/
│   ├── strategy_images/        ← 전략 도출 이미지 (PNG/JPG) 여기에 넣기
│   ├── field_intelligence/     ← 영업 현장 인텔
│   ├── client_db/              ← 고객사 정보
│   └── knowledge_base/         ← 시장 트렌드 DB
├── src/                        ← 파이프라인 소스
├── output/                     ← 생성된 PPT 저장 위치
├── run_pipeline.py             ← 메인 실행
├── add_intel.py                ← 영업 인텔 입력 CLI
└── add_market_data.py          ← 시장 데이터 입력 CLI
```

## 전략 이미지 추가

`data/strategy_images/` 에 PNG/JPG 파일을 넣으면 Claude가 자동으로 분석합니다.

## 영업 현장 정보 입력

```bash
python add_intel.py            # 대화형 입력
python add_intel.py --list     # 기존 항목 확인
python add_intel.py --delete 0 # 0번 항목 삭제
```

## 시장 데이터 업데이트

```bash
python add_market_data.py         # 새 트렌드 추가
python add_market_data.py --list  # 전체 목록
```

## 주요 파라미터 튜닝

### `config/pipeline_config.yaml`

| 항목 | 설명 |
|------|------|
| `model` | Claude 모델 (claude-sonnet-4-6 / claude-opus-4-7) |
| `project.client` | 고객사 |
| `project.opportunity` | 수주 기회명 |
| `strategy_weights` | 전략 가중치 (1~5) |
| `slides[].enabled` | 슬라이드 on/off |

### `config/strategy_params.yaml`

| 항목 | 설명 |
|------|------|
| `analysis_depth` | brief / standard / detailed |
| `tone` | professional / aggressive / conservative |
| `known_competitors` | 경쟁사 목록 |
| `slide_instructions` | 슬라이드별 커스텀 지시 |

## 옵션

```bash
python run_pipeline.py --dry-run    # API 호출 없이 PPT 구조만 생성
python run_pipeline.py --use-cache  # 이전 API 응답 재사용 (비용 절약)
```
