"""
전략 3축 생성기 — 경쟁사 선택이 전략 생성 조건
"""
import json
import re
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()


COMPETITORS_DB = Path(__file__).parent.parent.parent / "data/knowledge_base/competitors.json"


def _parse_json(raw: str) -> dict | list:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    raw = raw.strip()
    # 배열이면 [...], 객체면 {...} 추출
    match = re.search(r"(\[.*\]|\{.*\})", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return json.loads(raw)


def _get_competitor_profile(competitor: str) -> str:
    if COMPETITORS_DB.exists():
        db = json.loads(COMPETITORS_DB.read_text(encoding="utf-8"))
        data = db.get(competitor, {})
        if data:
            strengths = ", ".join(data.get("base_strength", []))
            weaknesses = ", ".join(data.get("base_weakness", []))
            return f"강점: {strengths} / 약점: {weaknesses}"
    return "정보 없음"


STRATEGY_PROMPT = """당신은 B2B ICT 수주전략 전문 컨설턴트입니다.
아래 정보를 기반으로 전략 3축을 생성하세요.

경쟁사: {competitor}
경쟁사 프로파일: {competitor_profile}

TOP 3 승부 포인트:
{top3}

RFP 사업 개요:
{rfp_basics}

점수 갭 매트릭스 (상위 항목):
{gap_matrix_summary}

전략 3축을 생성하세요. 각 전략은 반드시:
1. 어느 평가 항목 점수를 올리는지 명시
2. 왜 점수가 올라가는지 논리적 근거 제시
3. 구체적인 실행 방법 포함
4. 경쟁사 특성에 맞는 차별화 포인트 포함

순수 JSON만 응답하세요:
[
  {{
    "axis": "frame",
    "title": "프레임 전략 제목 (15자 이내)",
    "description": "전략 설명 (2-3문장)",
    "score_impact": [
      {{
        "item": "영향받는 평가항목명",
        "direction": "up",
        "reason": "점수가 올라가는 이유 (구체적)",
        "action": "실행 방법 (구체적 액션)"
      }}
    ],
    "competitor_angle": "이 전략이 {competitor}를 어떻게 압도하는지"
  }},
  {{
    "axis": "customer",
    "title": "고객 니즈 전략 제목",
    "description": "...",
    "score_impact": [...],
    "competitor_angle": "..."
  }},
  {{
    "axis": "competitive",
    "title": "경쟁 전략 제목",
    "description": "...",
    "score_impact": [...],
    "competitor_angle": "..."
  }}
]

axis 정의:
- frame: 이번 사업의 프레임(평가 기준)을 KT에 유리하게 재정의
- customer: 고객의 숨겨진 니즈 발굴 및 집중 공략
- competitive: 경쟁사 약점을 정확히 공략
"""


def generate_strategies(
    top3: dict,
    rfp_basics: dict,
    gap_matrix: list[dict],
    competitor: str,
) -> list[dict]:
    """
    전략 3축 생성.
    competitor는 전략 생성 조건 (파라미터가 아님)
    """
    client = anthropic.Anthropic()

    competitor_profile = _get_competitor_profile(competitor)
    top3_text = json.dumps(top3.get("top3", [])[:3], ensure_ascii=False, indent=2)

    # 갭 매트릭스 상위 5개만
    sorted_gap = sorted(gap_matrix, key=lambda x: abs(x["gap"]), reverse=True)[:5]
    gap_text = json.dumps(sorted_gap, ensure_ascii=False, indent=2)

    basics_text = json.dumps(rfp_basics, ensure_ascii=False, indent=2)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system="당신은 B2B 수주전략 전문가입니다. 정확한 JSON만 출력합니다.",
        messages=[{"role": "user", "content": STRATEGY_PROMPT.format(
            competitor=competitor,
            competitor_profile=competitor_profile,
            top3=top3_text,
            rfp_basics=basics_text,
            gap_matrix_summary=gap_text,
        )}]
    )

    strategies = _parse_json(response.content[0].text)

    # axis 필드 보정
    axis_map = {"frame": "프레임 전략", "customer": "고객 니즈 전략", "competitive": "경쟁 전략"}
    for s in strategies:
        s["axis_label"] = axis_map.get(s.get("axis", ""), s.get("axis", ""))
        s["conflicts"] = []  # conflict_detector가 채움

    return strategies
