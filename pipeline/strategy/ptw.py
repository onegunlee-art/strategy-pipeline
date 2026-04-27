"""
Price-to-Win 계산 — 협상형 사업용
가격 점수 vs 기술 점수 트레이드오프
"""
from __future__ import annotations


def compute_ptw(
    price_score_item: dict | None,
    tech_score_sum: float,
    tech_max: float,
    price_max: float,
    target_win_probability: float = 0.7,
) -> dict:
    """
    PTW 계산.
    price_score_item: 가격 평가 항목 정보
    tech_score_sum: 기술 부문 예상 점수 합계
    """
    if price_score_item is None:
        return {"applicable": False, "reason": "가격 항목 없음"}

    price_item_max = price_score_item.get("max_score", price_max)

    scenarios = []
    for price_ratio in [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
        price_pts = round(price_item_max * (1 - (price_ratio - 0.5) * 0.5), 1)
        total = tech_score_sum + price_pts
        total_max = tech_max + price_item_max

        scenarios.append({
            "price_ratio": price_ratio,
            "price_label": f"예산 대비 {int(price_ratio*100)}%",
            "price_score": price_pts,
            "tech_score": tech_score_sum,
            "total_score": round(total, 1),
            "total_pct": round(total / total_max * 100, 1),
        })

    optimal = max(scenarios, key=lambda x: x["total_score"])

    return {
        "applicable": True,
        "scenarios": scenarios,
        "optimal": optimal,
        "recommendation": (
            f"가격을 예산 대비 {int(optimal['price_ratio']*100)}%로 설정 시 "
            f"총점 {optimal['total_score']}점 (최대 {tech_max + price_item_max}점 중) 예상"
        ),
    }
