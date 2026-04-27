"""
내러티브 아크 관리 — Layer별 흐름 보장
"""
from __future__ import annotations

LAYER_ARCS = {
    1: ["cover", "executive_summary", "problem", "solution", "closing"],
    2: ["cover", "executive_summary", "problem", "solution",
        "competitive", "evidence", "risk", "price", "roadmap", "closing"],
    3: None,  # 전체 포함
}

REQUIRED_TYPES_PER_LAYER = {
    1: {"cover", "executive_summary", "problem", "solution", "closing"},
    2: {"cover", "executive_summary", "problem", "solution",
        "competitive", "evidence", "closing"},
    3: set(),  # 제한 없음
}


def get_layer_slides(slides: list[dict], layer: int) -> list[dict]:
    """레이어별 슬라이드 필터링 (Layer N은 Layer 1~N 모두 포함)"""
    if layer == 3:
        return sorted(slides, key=lambda s: (s.get("sequence", 99), s.get("layer", 3)))

    filtered = [s for s in slides if s.get("layer", 3) <= layer]
    return sorted(filtered, key=lambda s: s.get("sequence", 99))


def check_arc_completeness(slides: list[dict], layer: int) -> list[str]:
    """해당 레이어에서 내러티브 완결성 검증 — 누락 type 목록 반환"""
    required = REQUIRED_TYPES_PER_LAYER.get(layer, set())
    if not required:
        return []

    layer_slides = get_layer_slides(slides, layer)
    present_types = {s.get("type") for s in layer_slides}
    missing = required - present_types
    return list(missing)


def reorder_for_narrative(slides: list[dict]) -> list[dict]:
    """내러티브 흐름에 맞게 슬라이드 재정렬"""
    type_order = {
        "cover": 0, "executive_summary": 1, "problem": 2,
        "solution": 3, "value": 4, "competitive": 5,
        "evidence": 6, "roadmap": 7, "price": 8,
        "risk": 9, "detail": 10, "closing": 20,
    }

    def sort_key(s: dict) -> tuple:
        layer = s.get("layer", 3)
        type_rank = type_order.get(s.get("type", "detail"), 10)
        seq = s.get("sequence", 99)
        return (layer, type_rank, seq)

    return sorted(slides, key=sort_key)
