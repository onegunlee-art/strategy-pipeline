"""
점수 갭 매트릭스 + TOP3 승부 포인트 도출
"""
import json
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()


COMPETITORS_DB = Path(__file__).parent.parent.parent / "data/knowledge_base/competitors.json"


def load_competitor_db() -> dict:
    if COMPETITORS_DB.exists():
        return json.loads(COMPETITORS_DB.read_text(encoding="utf-8"))
    return {}


def get_competitor_adjustment(competitor: str, project_type: str) -> float:
    """경쟁사 점수 보정값 계산"""
    db = load_competitor_db()
    comp_data = db.get(competitor, {})
    adjustments = comp_data.get("project_adjustments", {})

    adjustment = 0.0
    for key, val in adjustments.items():
        if key.lower() in project_type.lower():
            adjustment += val

    return adjustment


def estimate_competitor_score(item_name: str, max_score: int, competitor: str, project_type: str = "") -> float:
    """경쟁사 추정 점수 계산 (기본값 기반 + 보정)"""
    db = load_competitor_db()
    comp_data = db.get(competitor, {})
    base_strengths = comp_data.get("base_strength", [])
    base_weaknesses = comp_data.get("base_weakness", [])

    # 기본 추정: max의 70%
    base_ratio = 0.70

    # 강점/약점 키워드 매칭
    item_lower = item_name.lower()
    for strength in base_strengths:
        if any(kw in item_lower for kw in strength.lower().split()):
            base_ratio += 0.08

    for weakness in base_weaknesses:
        if any(kw in item_lower for kw in weakness.lower().split()):
            base_ratio -= 0.08

    adjustment = get_competitor_adjustment(competitor, project_type)
    base_ratio += adjustment / 100

    base_ratio = max(0.4, min(0.95, base_ratio))
    return round(max_score * base_ratio, 1)


def compute_gap_matrix(scoring_data: dict, kt_scores: dict, competitor: str, project_type: str = "") -> list[dict]:
    """
    점수 갭 매트릭스 계산.
    kt_scores: {item_name: score}
    반환: [{category, item, max_score, kt_score, competitor_score, gap, structure_confidence}]
    """
    rows = []
    for cat in scoring_data.get("evaluation_structure", []):
        cat_name = cat["category"]
        for item in cat.get("items", []):
            item_name = item["name"]
            max_s = item["max_score"]
            kt_s = kt_scores.get(item_name, max_s * 0.7)
            comp_s = estimate_competitor_score(item_name, max_s, competitor, project_type)

            rows.append({
                "category": cat_name,
                "item": item_name,
                "max_score": max_s,
                "kt_score": kt_s,
                "competitor_score": comp_s,
                "gap": round(kt_s - comp_s, 1),
                "structure_confidence": item.get("structure_confidence", 1.0),
                "criteria": item.get("criteria", ""),
            })

    return rows


FEASIBILITY_MAP = {
    "Low": 0.3,
    "Mid": 0.6,
    "High": 0.9,
}

TOP3_PROMPT = """당신은 B2B 입찰 전략 전문가입니다.
아래 점수 갭 매트릭스를 분석하여 TOP 3 승부 포인트를 도출하세요.

점수 갭 매트릭스:
{gap_matrix}

경쟁사: {competitor}
프로젝트 유형: {project_type}

각 항목의 우선순위 산식: gap × 실행가능성 × 경쟁사역전가능성

순수 JSON만 응답하세요:
{{
  "top3": [
    {{
      "rank": 1,
      "eval_item": "항목명",
      "category": "카테고리명",
      "gap": 5.0,
      "feasibility": "Mid",
      "competitor_reversibility": "Low",
      "priority_score": 0.83,
      "required_capability": "필요한 KT 역량 설명",
      "win_logic": "이 항목에서 이길 수 있는 핵심 논리",
      "ai_recommended": true
    }}
  ],
  "one_line_strategy": "이번 수주의 핵심 전략 한 줄",
  "excluded_items": [
    {{"item": "항목명", "reason": "structure_confidence 낮음 등"}}
  ]
}}

feasibility 기준:
- Low: KT 현재 역량으로 실행 어려움 (6개월+ 준비 필요)
- Mid: 준비 필요하나 가능 (1-3개월)
- High: 즉시 실행 가능한 역량 보유

competitor_reversibility: 경쟁사가 역전하기 어려운 정도
- Low: 경쟁사가 쉽게 따라올 수 있음
- Mid: 일정 준비 필요
- High: 역전 어려움 (KT 고유 강점)
"""


def compute_top3(gap_matrix: list[dict], competitor: str, project_type: str = "") -> dict:
    """AI 기반 Top3 승부 포인트 도출"""
    client = anthropic.Anthropic()

    # structure_confidence < 0.8 항목 필터링
    filtered = [r for r in gap_matrix if r.get("structure_confidence", 1.0) >= 0.8]
    excluded = [r for r in gap_matrix if r.get("structure_confidence", 1.0) < 0.8]

    gap_text = json.dumps(filtered, ensure_ascii=False, indent=2)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": TOP3_PROMPT
            .replace("{gap_matrix}", gap_text)
            .replace("{competitor}", competitor)
            .replace("{project_type}", project_type)
        }]
    )

    import re
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)

    result = json.loads(raw)
    result["low_confidence_excluded"] = [
        {"item": r["item"], "structure_confidence": r["structure_confidence"]}
        for r in excluded
    ]
    return result
