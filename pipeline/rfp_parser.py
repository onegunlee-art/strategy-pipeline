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


def extract_text_from_pdf(pdf_path: Path) -> tuple[str, bool]:
    """pdfplumber로 텍스트 추출. 반환: (text, success)"""
    try:
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(f"[PAGE {i+1}]\n{text}")
        full_text = "\n\n".join(pages)
        return full_text, bool(full_text.strip())
    except Exception:
        return "", False


def extract_text_via_vision(pdf_path: Path) -> str:
    """Claude Vision으로 PDF 이미지 → 텍스트 추출 (fallback)"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return ""

    client = anthropic.Anthropic()
    pages_text = []

    doc = fitz.open(str(pdf_path))
    for i, page in enumerate(doc):
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        img_data = base64.standard_b64encode(pix.tobytes("png")).decode()

        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_data}},
                    {"type": "text", "text": f"이 페이지({i+1})의 텍스트를 그대로 추출하세요. 표 구조도 최대한 보존하세요. 페이지 번호만 출력: [PAGE {i+1}]로 시작."}
                ]
            }]
        )
        pages_text.append(msg.content[0].text)

    return "\n\n".join(pages_text)


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
