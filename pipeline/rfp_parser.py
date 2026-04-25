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


RFP_SCHEMA_PROMPT = """당신은 B2B ICT 입찰 전문 분석가입니다.
아래 RFP 텍스트를 분석하여 수주 판단에 필요한 전체 구조를 추출하세요.
모르는 값은 null로 두고, 추론 가능한 값은 reasoning과 함께 채우세요.

순수 JSON만 응답하세요:
{
  "meta": {
    "title": "사업명",
    "issuer": "발주기관",
    "industry": "finance|public|enterprise|telecom|other",
    "source_type": "pdf|scanned|mixed",
    "confidence_score": 0.0
  },
  "project_overview": {
    "objective": "사업 목적 (1-2문장)",
    "project_type": ["ai_platform","data_platform","agent_system","infra","integration","si"],
    "background": "추진 배경",
    "expected_outcomes": ["기대 성과1", "기대 성과2"]
  },
  "timeline": {
    "announcement_date": null,
    "proposal_due_date": null,
    "evaluation_period": null,
    "project_start": null,
    "project_duration_months": null
  },
  "budget": {
    "total_budget": null,
    "currency": "KRW",
    "pricing_model": "fixed|t&m|hybrid",
    "price_weight": null
  },
  "requirements": {
    "must": [
      {
        "id": "M01",
        "description": "필수 요건 설명",
        "category": "technical|legal|experience|infra",
        "verification_method": "서류|시연|인증",
        "risk_if_missing": "disqualified|score_loss"
      }
    ],
    "should": [
      {"id": "S01", "description": "권장 요건", "category": "technical"}
    ],
    "optional": []
  },
  "evaluation": {
    "total_score": 100,
    "criteria": [
      {
        "name": "기술능력",
        "weight": 70,
        "sub_criteria": [
          {"name": "세부항목명", "weight": 20, "description": "평가기준 설명"}
        ]
      },
      {"name": "가격", "weight": 30, "sub_criteria": []}
    ],
    "evaluation_method": "relative|absolute|hybrid",
    "pass_threshold": null
  },
  "deliverables": {
    "mandatory_outputs": ["proposal_doc","technical_doc","demo","presentation"],
    "format_constraints": [],
    "submission_method": "online|offline|both"
  },
  "constraints": {
    "legal": [],
    "technical": [],
    "operational": [],
    "partner_restrictions": []
  },
  "risk_flags": {
    "high_difficulty": false,
    "unclear_requirements": false,
    "over_specification": false,
    "vendor_lock_in_suspected": false,
    "timeline_risk": false,
    "notes": ""
  },
  "intent_inference": {
    "likely_preferred_vendor_type": "si|cloud|niche|telecom",
    "hidden_priorities": ["stability","reference","cost_efficiency","innovation","security"],
    "inferred_focus": "technical|price|balance",
    "reasoning": "이 RFP에서 발주자가 진짜 원하는 것에 대한 분석"
  },
  "competition_assumption": {
    "likely_competitors": ["LG CNS","SK C&C","삼성SDS"],
    "expected_strengths": ["경쟁사 예상 강점"],
    "expected_weaknesses": ["경쟁사 예상 약점"]
  },
  "strategy_hints": {
    "win_focus": "technical|price|hybrid",
    "key_differentiators": ["KT가 강조해야 할 차별점"],
    "avoid_areas": ["피해야 할 영역"],
    "consortium_needs": [
      {"role": "ai_model|infra|data|consulting", "required_capability": ""}
    ],
    "price_strategy": "aggressive|balanced|premium",
    "risk_mitigation": ["리스크 대응 방안"]
  },
  "validation": {
    "score_sum_check": true,
    "must_requirement_present": true,
    "timeline_valid": false,
    "budget_consistency": false
  }
}

RFP 텍스트:
__RFP_TEXT__
"""


def parse_rfp_basics(rfp_text: str) -> dict:
    """RFP 텍스트에서 전체 구조 추출 (신 스키마)"""
    client = anthropic.Anthropic()

    # 앞부분 + 평가 관련 섹션 집중 전송 (토큰 최적화)
    text_sample = rfp_text[:6000] + "\n\n...(중략)...\n\n" + rfp_text[-4000:] if len(rfp_text) > 10000 else rfp_text

    prompt = RFP_SCHEMA_PROMPT.replace("__RFP_TEXT__", text_sample)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system="당신은 RFP 구조화 전문가입니다. 지정된 JSON 스키마를 정확히 채워 순수 JSON만 출력합니다.",
        messages=[{"role": "user", "content": prompt}]
    )
    return _parse_claude_json(response.content[0].text)

    basics = parse_rfp_basics(text)
    return {"text": text, "basics": basics, "source": source}
