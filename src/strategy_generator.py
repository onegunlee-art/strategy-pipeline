"""
Claude API 를 사용하여 전략 콘텐츠를 생성합니다.
이미지 분석 → 통합 프롬프트 → 슬라이드별 콘텐츠 반환
"""
import base64
import json
from pathlib import Path

import anthropic

from .knowledge_loader import (
    get_client,
    get_field_intel,
    get_market_trends,
    get_strategy_images,
)


def _encode_image(path: Path) -> tuple[str, str]:
    """이미지를 base64로 인코딩, (media_type, data) 반환"""
    suffix_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                  ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
    media_type = suffix_map.get(path.suffix.lower(), "image/png")
    data = base64.standard_b64encode(path.read_bytes()).decode()
    return media_type, data


def _build_context(cfg: dict) -> str:
    project = cfg.get("project", {})
    params = cfg.get("params", {})
    client = get_client(project.get("client", "KT")) or {}
    intel = get_field_intel()
    trends = get_market_trends()
    weights = cfg.get("strategy_weights", {})

    lines = [
        f"## 프로젝트 개요",
        f"- 고객: {project.get('client')}",
        f"- 기회: {project.get('opportunity')}",
        f"- 날짜: {project.get('date')}",
        "",
        "## 고객 주요 니즈",
    ]
    for p in client.get("known_pain_points", []):
        lines.append(f"  - {p}")

    lines += ["", "## 고객 전략 우선순위"]
    for p in client.get("strategic_priorities", []):
        lines.append(f"  - {p}")

    lines += ["", "## 시장 트렌드 (high relevance)"]
    for t in trends:
        if t.get("relevance") == "high":
            lines.append(f"  - [{t['category']}] {t['insight']} ({t['source']})")

    if intel:
        lines += ["", "## 영업 현장 인텔리전스"]
        for e in intel:
            lines.append(f"  - [{e.get('date', '')}][{e.get('source', '')}] {e.get('content', '')}")

    if params.get("known_competitors"):
        comps = [c for c in params["known_competitors"] if c]
        if comps:
            lines += ["", f"## 알려진 경쟁사: {', '.join(comps)}"]

    lines += ["", "## 전략 우선순위 가중치 (1~5)"]
    for k, v in weights.items():
        lines.append(f"  - {k}: {v}")

    if params.get("extra_strategy_keywords"):
        kws = [k for k in params["extra_strategy_keywords"] if k]
        if kws:
            lines += ["", f"## 추가 키워드: {', '.join(kws)}"]

    return "\n".join(lines)


def _build_slide_instruction(cfg: dict) -> str:
    slide_cfg = cfg.get("slides", [])
    enabled = [s["title"] for s in slide_cfg if s.get("enabled", True)]
    custom = cfg.get("params", {}).get("slide_instructions", {})

    text = "## 생성할 슬라이드 목록\n"
    for s in slide_cfg:
        if not s.get("enabled", True):
            continue
        sid = s["id"]
        extra = f"\n  → {custom[sid]}" if sid in custom else ""
        text += f"- {s['title']}{extra}\n"
    return text


def generate_strategy(cfg: dict) -> dict:
    """
    Returns dict: { slide_id: { "title": str, "bullets": [...], "notes": str } }
    """
    client_api = anthropic.Anthropic()
    model = cfg.get("model", "claude-sonnet-4-6")
    params = cfg.get("params", {})
    depth = params.get("analysis_depth", "detailed")
    tone = params.get("tone", "professional")

    images = get_strategy_images()

    # ── 시스템 프롬프트 ──────────────────────────────────────────
    system = (
        "당신은 B2B ICT 수주전략 전문 컨설턴트입니다. "
        "KT의 AI 서비스 수주전을 위한 고품질 전략 PPT 콘텐츠를 작성합니다. "
        f"분석 깊이: {depth}, 톤: {tone}. "
        "반드시 JSON 형식으로만 응답하십시오."
    )

    context_text = _build_context(cfg)
    slide_text = _build_slide_instruction(cfg)

    # ── 메시지 구성 (이미지 포함) ────────────────────────────────
    content: list = []

    if images:
        content.append({
            "type": "text",
            "text": (
                f"아래 {len(images)}장의 전략 도출 프레임워크 이미지를 분석하고, "
                "핵심 인사이트를 전략 콘텐츠에 반영하십시오."
            )
        })
        for img_path in images:
            media_type, data = _encode_image(img_path)
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": data}
            })

    content.append({
        "type": "text",
        "text": (
            f"{context_text}\n\n{slide_text}\n\n"
            "위 정보를 종합하여 각 슬라이드의 콘텐츠를 생성하십시오.\n\n"
            "응답 형식 (순수 JSON만, 마크다운 코드블록 없이):\n"
            "{\n"
            '  "슬라이드_id": {\n'
            '    "title": "슬라이드 제목",\n'
            '    "headline": "핵심 메시지 한 줄",\n'
            '    "bullets": ["항목1", "항목2", ...],\n'
            '    "sub_bullets": {"항목1": ["세부1", "세부2"]},\n'
            '    "notes": "발표자 노트 (선택)"\n'
            "  },\n"
            "  ...\n"
            "}"
        )
    })

    # ── API 호출 ─────────────────────────────────────────────────
    response = client_api.messages.create(
        model=model,
        max_tokens=8096,
        system=system,
        messages=[{"role": "user", "content": content}],
        betas=["prompt-caching-2024-07-31"],
    )

    raw = response.content[0].text.strip()
    # JSON 파싱 — 코드블록 감싸기 방어
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
