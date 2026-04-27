"""
RFP PDF 파싱 모듈
pdfplumber로 텍스트 추출 → 실패 시 Claude Vision fallback
"""
import base64
import json
import re
from pathlib import Path

import anthropic
import pdfplumber
from dotenv import load_dotenv

from pipeline.utils import parse_json_robust

load_dotenv()


def _parse_claude_json(raw: str) -> dict:
    return parse_json_robust(raw)


def extract_text_from_pdf(pdf_path: Path) -> tuple[str, list[int]]:
    """
    pdfplumber로 페이지별 텍스트 추출.
    반환: (full_text, thin_pages) — thin_pages는 내용이 부족한 페이지 번호 목록
    """
    try:
        pages = []
        thin_pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages.append((i, text))
                if len(text.strip()) < 80:  # 페이지당 80자 미만 = 스캔 이미지 페이지
                    thin_pages.append(i)
        full_text = "\n\n".join(
            f"[PAGE {i+1}]\n{text}" for i, text in pages if text.strip()
        )
        return full_text, thin_pages
    except Exception:
        return "", []


def extract_pages_via_vision(pdf_path: Path, page_indices: list[int], progress_cb=None) -> dict[int, str]:
    """
    지정된 페이지 인덱스만 Vision으로 처리.
    반환: {page_index: extracted_text}
    """
    import pypdfium2 as pdfium
    import io

    client = anthropic.Anthropic()
    results = {}

    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        for idx, page_idx in enumerate(page_indices):
            if progress_cb:
                progress_cb(idx + 1, len(page_indices), page_idx + 1)

            page = doc[page_idx]
            bitmap = page.render(scale=2.0)
            pil_img = bitmap.to_pil()

            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            img_data = base64.standard_b64encode(buf.getvalue()).decode()

            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_data}},
                        {"type": "text", "text": f"[PAGE {page_idx+1}]로 시작하여 이 페이지의 텍스트를 그대로 추출하세요. 표·배점·숫자 구조를 정확히 보존하세요. 내용이 없는 빈 페이지면 '[BLANK]'만 출력하세요."}
                    ]
                }]
            )
            results[page_idx] = msg.content[0].text
    finally:
        doc.close()

    return results


def extract_full_text(pdf_path: Path, progress_cb=None) -> tuple[str, str]:
    """
    하이브리드 추출: pdfplumber 우선, 내용 부족 페이지는 Vision 보완.
    반환: (full_text, source_summary)
    """
    import pypdfium2 as pdfium

    full_text, thin_pages = extract_text_from_pdf(pdf_path)

    # 전체 페이지 수 확인
    doc = pdfium.PdfDocument(str(pdf_path))
    total_pages = len(doc)
    doc.close()

    thin_ratio = len(thin_pages) / max(total_pages, 1)

    if thin_ratio > 0.5:
        # 절반 이상이 스캔 페이지 → 전체 Vision 처리
        source = f"vision (전체 {total_pages}페이지)"
        vision_results = extract_pages_via_vision(
            pdf_path, list(range(total_pages)), progress_cb
        )
        pages_combined = []
        for i in range(total_pages):
            text = vision_results.get(i, "")
            if text and "[BLANK]" not in text:
                pages_combined.append(text)
        full_text = "\n\n".join(pages_combined)
    elif thin_pages:
        # 일부만 스캔 → 부족한 페이지만 Vision 보완
        source = f"hybrid (Vision {len(thin_pages)}페이지 보완)"
        vision_results = extract_pages_via_vision(pdf_path, thin_pages, progress_cb)
        # 기존 텍스트에 Vision 결과 추가
        extra = []
        for page_idx, text in sorted(vision_results.items()):
            if text and "[BLANK]" not in text:
                extra.append(text)
        if extra:
            full_text = full_text + "\n\n" + "\n\n".join(extra)
    else:
        source = "pdfplumber"

    return full_text, source


PROMPT_PART1 = """당신은 B2B ICT 입찰 전문 분석가입니다. RFP 텍스트를 분석하세요.
순수 JSON만 응답하세요 (마크다운 없이):
{
  "meta": {"title": "사업명", "issuer": "발주기관", "industry": "finance|public|enterprise|telecom|other", "source_type": "scanned|pdf|mixed", "confidence_score": 0.85},
  "project_overview": {"objective": "목적(1-2문장)", "project_type": ["ai_platform"], "background": "배경", "expected_outcomes": ["성과1"]},
  "timeline": {"announcement_date": null, "proposal_due_date": null, "evaluation_period": null, "project_start": null, "project_duration_months": null},
  "budget": {"total_budget": null, "currency": "KRW", "pricing_model": "fixed", "price_weight": null},
  "deliverables": {"mandatory_outputs": ["proposal_doc"], "format_constraints": [], "submission_method": "offline"},
  "constraints": {"legal": [], "technical": [], "operational": [], "partner_restrictions": []},
  "risk_flags": {"high_difficulty": false, "unclear_requirements": false, "over_specification": false, "vendor_lock_in_suspected": false, "timeline_risk": false, "notes": ""},
  "intent_inference": {"likely_preferred_vendor_type": "si", "hidden_priorities": ["stability"], "inferred_focus": "technical", "reasoning": "분석 근거"},
  "competition_assumption": {"likely_competitors": [], "expected_strengths": [], "expected_weaknesses": []},
  "strategy_hints": {"win_focus": "technical", "key_differentiators": [], "avoid_areas": [], "consortium_needs": [], "price_strategy": "balanced", "risk_mitigation": []}
}

RFP 텍스트:
__RFP_TEXT__
"""

PROMPT_PART2 = """당신은 B2B ICT 입찰 평가구조 전문 분석가입니다. RFP에서 평가 기준과 필수 요건을 추출하세요.
순수 JSON만 응답하세요 (마크다운 없이):
{
  "evaluation": {
    "total_score": 100,
    "criteria": [
      {"name": "기술능력", "weight": 70, "sub_criteria": [{"name": "세부항목", "weight": 20, "description": "기준설명"}]},
      {"name": "가격", "weight": 30, "sub_criteria": []}
    ],
    "evaluation_method": "relative",
    "pass_threshold": null
  },
  "requirements": {
    "must": [{"id": "M01", "description": "필수요건", "category": "technical", "verification_method": "서류", "risk_if_missing": "score_loss"}],
    "should": [{"id": "S01", "description": "권장요건", "category": "technical"}],
    "optional": []
  },
  "validation": {"score_sum_check": true, "must_requirement_present": true, "timeline_valid": false, "budget_consistency": false}
}

RFP 텍스트:
__RFP_TEXT__
"""


def parse_rfp_basics(rfp_text: str) -> dict:
    """RFP 텍스트에서 전체 구조 추출 — 2회 호출로 분리"""
    client = anthropic.Anthropic()

    text_front = rfp_text[:8000]
    text_eval = rfp_text[:5000] + "\n\n...\n\n" + rfp_text[-5000:] if len(rfp_text) > 10000 else rfp_text

    # 1차: 기본 구조 + 의도 분석
    r1 = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system="순수 JSON만 출력합니다. 마크다운 사용 금지.",
        messages=[{"role": "user", "content": PROMPT_PART1.replace("__RFP_TEXT__", text_front)}]
    )
    part1 = _parse_claude_json(r1.content[0].text)

    # 2차: 평가구조 + 요건 (전체 텍스트 활용)
    r2 = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system="순수 JSON만 출력합니다. 마크다운 사용 금지.",
        messages=[{"role": "user", "content": PROMPT_PART2.replace("__RFP_TEXT__", text_eval)}]
    )
    part2 = _parse_claude_json(r2.content[0].text)

    # 병합
    result = {**part1, **part2}

    # 하위 모듈 호환용 flat 필드
    result["project_name"] = result.get("meta", {}).get("title", "")
    result["client"] = result.get("meta", {}).get("issuer", "")
    result["contract_type"] = result.get("budget", {}).get("pricing_model", "")

    return result
