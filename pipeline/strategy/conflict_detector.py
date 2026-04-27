"""
전략 충돌 감지 — pairwise 충돌 + 다중 연쇄 시나리오 분석
"""
from __future__ import annotations

KNOWN_CONFLICTS = [
    {
        "a_keywords": ["운영 강화", "운영안정", "24/7", "SLA"],
        "b_keywords": ["가격 절감", "가격 경쟁", "최저가", "원가"],
        "type": "strategy_vs_strategy",
        "description": "운영 강화와 가격 절감은 동시 추구 시 마진 붕괴 위험",
        "risk": "HIGH",
    },
    {
        "a_keywords": ["인력 확대", "전담 인력", "전문 인력"],
        "b_keywords": ["가격 절감", "원가 절감", "최저가"],
        "type": "strategy_vs_strategy",
        "description": "인력 확대와 가격 절감은 수익성 상충",
        "risk": "HIGH",
    },
    {
        "a_keywords": ["커스터마이징", "맞춤 개발", "전용 개발"],
        "b_keywords": ["빠른 납기", "단기 구축", "즉시 도입"],
        "type": "strategy_vs_reality",
        "description": "커스터마이징 개발과 단기 납기 동시 주장 시 신뢰도 저하",
        "risk": "MID",
    },
    {
        "a_keywords": ["AI 전환", "AI 혁신", "최신 AI"],
        "b_keywords": ["안정성", "검증된", "보수적"],
        "type": "strategy_vs_reality",
        "description": "AI 혁신과 검증된 안정성을 동시 강조 시 메시지 충돌",
        "risk": "MID",
    },
]

REALITY_CHECKS = [
    {
        "keywords": ["24/7 운영", "24/7 대응", "연중무휴"],
        "check": "견적서에 24/7 운영 인력 비용이 반영되어 있나요?",
        "type": "strategy_vs_reality",
        "risk": "MID",
    },
    {
        "keywords": ["AI 엔진 자체 개발", "독자 AI", "자체 LLM"],
        "check": "자체 AI 엔진 개발 일정과 납기가 현실적으로 맞나요?",
        "type": "strategy_vs_reality",
        "risk": "MID",
    },
    {
        "keywords": ["레퍼런스", "동일 사례", "유사 구축"],
        "check": "제시하는 레퍼런스가 이번 사업 규모/분야와 실제로 유사한가요?",
        "type": "strategy_vs_reality",
        "risk": "LOW",
    },
]


def _text_matches(text: str, keywords: list[str]) -> bool:
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)


def detect_pairwise_conflicts(strategies: list[dict]) -> list[dict]:
    """전략 간 pairwise 충돌 감지"""
    conflicts = []

    for i, s_a in enumerate(strategies):
        a_text = f"{s_a.get('title', '')} {s_a.get('description', '')}"
        for s_b in strategies[i+1:]:
            b_text = f"{s_b.get('title', '')} {s_b.get('description', '')}"

            for rule in KNOWN_CONFLICTS:
                if rule["type"] != "strategy_vs_strategy":
                    continue
                if _text_matches(a_text, rule["a_keywords"]) and _text_matches(b_text, rule["b_keywords"]):
                    conflicts.append({
                        "type": "strategy_vs_strategy",
                        "strategy_a": s_a.get("title", ""),
                        "strategy_b": s_b.get("title", ""),
                        "description": rule["description"],
                        "risk": rule["risk"],
                    })
                elif _text_matches(b_text, rule["a_keywords"]) and _text_matches(a_text, rule["b_keywords"]):
                    conflicts.append({
                        "type": "strategy_vs_strategy",
                        "strategy_a": s_b.get("title", ""),
                        "strategy_b": s_a.get("title", ""),
                        "description": rule["description"],
                        "risk": rule["risk"],
                    })

    return conflicts


def detect_reality_conflicts(strategies: list[dict]) -> list[dict]:
    """전략-현실 충돌 감지"""
    conflicts = []
    for strategy in strategies:
        text = f"{strategy.get('title', '')} {strategy.get('description', '')} " + \
               " ".join(imp.get("action", "") for imp in strategy.get("score_impact", []))

        for check in REALITY_CHECKS:
            if _text_matches(text, check["keywords"]):
                conflicts.append({
                    "type": "strategy_vs_reality",
                    "strategy": strategy.get("title", ""),
                    "description": check["check"],
                    "risk": check["risk"],
                })

    return conflicts


def compute_scenario_impact(strategies: list[dict]) -> dict:
    """다중 전략 조합의 전체 시나리오 영향"""
    up_items: dict[str, list] = {}
    down_items: dict[str, list] = {}

    for s in strategies:
        for impact in s.get("score_impact", []):
            item = impact.get("item", "")
            direction = impact.get("direction", "neutral")
            if direction == "up":
                up_items.setdefault(item, []).append(s.get("title", ""))
            elif direction == "down":
                down_items.setdefault(item, []).append(s.get("title", ""))

    conflicts = detect_pairwise_conflicts(strategies)
    risk_level = "LOW"
    if any(c["risk"] == "HIGH" for c in conflicts):
        risk_level = "HIGH"
    elif any(c["risk"] == "MID" for c in conflicts):
        risk_level = "MID"

    return {
        "positive_items": up_items,
        "negative_items": down_items,
        "pairwise_conflicts": conflicts,
        "reality_checks": detect_reality_conflicts(strategies),
        "overall_risk": risk_level,
    }


def annotate_strategies_with_conflicts(strategies: list[dict]) -> list[dict]:
    """각 전략에 충돌 정보를 주입하여 반환"""
    pairwise = detect_pairwise_conflicts(strategies)
    reality = detect_reality_conflicts(strategies)

    for s in strategies:
        s_conflicts = []
        title = s.get("title", "")

        for c in pairwise:
            if c["strategy_a"] == title or c["strategy_b"] == title:
                s_conflicts.append(c)

        for r in reality:
            if r["strategy"] == title:
                s_conflicts.append(r)

        s["conflicts"] = s_conflicts

    return strategies
