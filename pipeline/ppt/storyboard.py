"""
스토리보드 생성 — 슬라이드 단위 점수 설계
각 슬라이드: eval_tag / score_target / argumentation / layer 할당
"""
import json
import re

import anthropic


STORYBOARD_PROMPT = """당신은 B2B 입찰 제안서 전문 스토리보드 작가입니다.
아래 정보를 바탕으로 PPT 스토리보드를 설계하세요.

전략 3축:
{strategies}

TOP 3 승부 포인트:
{top3}

평가 항목 구조:
{eval_structure}

사업 기본정보:
{rfp_basics}

핵심 원칙:
1. 각 슬라이드는 반드시 하나의 평가 항목 점수에 기여해야 함
2. Layer 1(5장) = 핵심 메시지만 / Layer 2(12장) = 설득 구조 / Layer 3(24장) = 전체 증거
3. Layer 1 슬라이드는 Layer 2에 포함, Layer 2는 Layer 3에 포함
4. 내러티브 아크: hook → 문제 → 해결 → 증거 → CTA

순수 JSON만 응답하세요 (배열):
[
  {{
    "id": "slide_01",
    "layer": 1,
    "sequence": 1,
    "type": "cover",
    "eval_tag": null,
    "score_target": null,
    "argumentation": null,
    "key_message": "슬라이드 핵심 메시지 (한 문장)",
    "content_outline": ["내용 포인트1", "내용 포인트2"],
    "title": "슬라이드 제목",
    "kt_only": false,
    "extra_proposal": false,
    "strategy_axis": null
  }},
  ...
]

type 옵션: cover, executive_summary, problem, solution, evidence, value, competitive, roadmap, price, risk, closing, detail
eval_tag: 해당하는 평가 항목명 (없으면 null)
score_target: "+2~3점", "-", null 등
argumentation: "强", "中", "弱", null
strategy_axis: "frame", "customer", "competitive", null

Layer 1 (5장) 필수 구성:
- slide_01: 표지
- slide_02: Executive Summary (핵심 한 줄 + Top3 요약)
- slide_03: 고객 문제/니즈 (핵심 1개)
- slide_04: KT 핵심 솔루션 (프레임 전략 적용)
- slide_05: 클로징 (왜 KT인가 한 장)

Layer 2 (12장): Layer 1 + 7장 추가 (경쟁차별화, 레퍼런스, 운영, 가격, 리스크, 로드맵, 팀)
Layer 3 (24장): Layer 2 + 12장 추가 (기술상세, 레퍼런스 상세, 부록 등)
"""


def generate_storyboard(
    strategies: list[dict],
    top3: dict,
    scoring_data: dict,
    rfp_basics: dict,
) -> list[dict]:
    """스토리보드 슬라이드 목록 생성"""
    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=6000,
        system="당신은 B2B 제안서 스토리보드 전문가입니다. 정확한 JSON 배열만 출력합니다.",
        messages=[{"role": "user", "content": STORYBOARD_PROMPT.format(
            strategies=json.dumps(strategies, ensure_ascii=False, indent=2),
            top3=json.dumps(top3.get("top3", [])[:3], ensure_ascii=False, indent=2),
            eval_structure=json.dumps(
                scoring_data.get("evaluation_structure", []), ensure_ascii=False, indent=2
            )[:3000],
            rfp_basics=json.dumps(rfp_basics, ensure_ascii=False, indent=2),
        )}]
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    slides = json.loads(raw)

    # Layer 분류 및 sequence 정렬
    slides.sort(key=lambda s: (s.get("layer", 3), s.get("sequence", 99)))
    return slides


def validate_coverage(slides: list[dict], eval_items: list[str]) -> dict:
    """평가 항목별 커버리지 검증"""
    coverage: dict[str, list] = {item: [] for item in eval_items}
    uncovered = []

    for slide in slides:
        tag = slide.get("eval_tag")
        if tag and tag in coverage:
            coverage[tag].append(slide["id"])

    for item, slide_ids in coverage.items():
        if not slide_ids:
            uncovered.append(item)

    return {
        "coverage": coverage,
        "uncovered": uncovered,
        "total_slides": len(slides),
        "layer_counts": {
            1: len([s for s in slides if s.get("layer") == 1]),
            2: len([s for s in slides if s.get("layer") == 2]),
            3: len([s for s in slides if s.get("layer") == 3]),
        }
    }
