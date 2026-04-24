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

load_dotenv()


def _parse_claude_json(raw: str) -> dict:
    raw = raw.strip()
    # 마크다운 코드블록 제거
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    raw = raw.strip()
    # JSON 블록만 추출 (앞뒤 설명 텍스트 제거)
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return json.loads(raw)


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


def parse_rfp_basics(rfp_text: str) -> dict:
    """RFP 텍스트에서 사업 기본정보 16항목 추출"""
    client = anthropic.Anthropic()

    prompt = f"""당신은 RFP(제안요청서) 전문 분석가입니다.
아래 RFP 텍스트에서 사업 기본정보를 추출하세요.

순수 JSON만 응답하세요 (마크다운 없이):
{{
  "project_name": "사업명",
  "client": "발주기관명",
  "contract_type": "계약방식 (일반경쟁/제한경쟁/협상에의한계약 등)",
  "budget": "사업예산 (숫자+단위)",
  "duration": "사업기간",
  "submission_deadline": "제안서 제출기한",
  "eval_date": "평가일정",
  "announcement_date": "공고일",
  "project_scope": "사업범위 요약 (2-3줄)",
  "key_requirements": ["핵심 요구사항1", "요구사항2", "요구사항3"],
  "tech_stack": ["요구 기술1", "기술2"],
  "reference_requirements": "레퍼런스 요건",
  "consortium_allowed": true,
  "subcontract_ratio": "하도급 비율 제한",
  "submission_format": "제출 형식",
  "contact": "담당자 연락처"
}}

RFP 텍스트:
{rfp_text[:8000]}
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    return _parse_claude_json(response.content[0].text)


def parse_rfp(pdf_path: Path) -> dict:
    """
    메인 파싱 함수.
    반환: { "text": str, "basics": dict, "source": "pdfplumber"|"vision" }
    """
    text, success = extract_text_from_pdf(pdf_path)
    source = "pdfplumber"

    if not success or len(text.strip()) < 200:
        text = extract_text_via_vision(pdf_path)
        source = "vision"

    basics = parse_rfp_basics(text)
    return {"text": text, "basics": basics, "source": source}
