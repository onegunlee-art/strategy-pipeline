"""
점수 시뮬레이터 — 전략 변경 시 점수 방향성 예측 (정밀 숫자 X)
"""
from __future__ import annotations


DIRECTION_LABELS = {
    "up": "▲ 상승 가능",
    "down": "▼ 하락 위험",
    "neutral": "→ 영향 없음",
    "uncertain": "? 불확실",
}

DIRECTION_COLORS = {
    "up": "green",
    "down": "red",
    "neutral": "gray",
    "uncertain": "orange",
}


def simulate_strategy_impact(
    selected_strategies: list[dict],
    gap_matrix: list[dict],
) -> dict[str, dict]:
    """
    선택된 전략들의 점수 영향 시뮬레이션.
    반환: {eval_item: {direction, label, strategies_affecting}}
    """
    item_impact: dict[str, dict] = {}

    for row in gap_matrix:
        item = row["item"]
        item_impact[item] = {
            "direction": "neutral",
            "label": DIRECTION_LABELS["neutral"],
            "color": DIRECTION_COLORS["neutral"],
            "strategies_affecting": [],
            "base_gap": row["gap"],
        }

    for strategy in selected_strategies:
        for impact in strategy.get("score_impact", []):
            item = impact.get("item")
            direction = impact.get("direction", "neutral")
            if item not in item_impact:
                item_impact[item] = {
                    "direction": direction,
                    "label": DIRECTION_LABELS.get(direction, ""),
                    "color": DIRECTION_COLORS.get(direction, "gray"),
                    "strategies_affecting": [],
                    "base_gap": 0,
                }

            existing = item_impact[item]["direction"]
            if existing == "neutral":
                item_impact[item]["direction"] = direction
            elif existing != direction and direction != "neutral":
                item_impact[item]["direction"] = "uncertain"

            item_impact[item]["label"] = DIRECTION_LABELS.get(item_impact[item]["direction"], "")
            item_impact[item]["color"] = DIRECTION_COLORS.get(item_impact[item]["direction"], "gray")
            item_impact[item]["strategies_affecting"].append(strategy.get("title", ""))

    return item_impact


def compute_scenario_summary(
    selected_strategies: list[dict],
    gap_matrix: list[dict],
) -> dict:
    """선택 전략 조합의 전체 시나리오 요약"""
    impact = simulate_strategy_impact(selected_strategies, gap_matrix)

    up_items = [k for k, v in impact.items() if v["direction"] == "up"]
    down_items = [k for k, v in impact.items() if v["direction"] == "down"]
    uncertain_items = [k for k, v in impact.items() if v["direction"] == "uncertain"]

    risk_level = "LOW"
    if len(down_items) >= 2 or len(uncertain_items) >= 2:
        risk_level = "HIGH"
    elif len(down_items) == 1 or len(uncertain_items) == 1:
        risk_level = "MID"

    return {
        "up_items": up_items,
        "down_items": down_items,
        "uncertain_items": uncertain_items,
        "risk_level": risk_level,
        "impact_detail": impact,
    }
