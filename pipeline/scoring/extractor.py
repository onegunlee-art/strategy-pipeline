"""
평가구조 분해 엔진
RFP 텍스트 → 평가항목 / 배점 / 세부기준 + confidence 점수
"""
import json
import re

import anthropic
from dotenv import load_dotenv

load_dotenv()


def _parse_claude_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


EXTRACT_PROMPT = """당신은 B2B 입찰 평가구조 전문 분석가입니다.
아래 RFP 텍스트에서 평가 배점 구조를 정확히 추출하세요.

중요:
- 항목/배점/세부기준을 같은 블록으로 묶어야 합니다 (구조 신뢰도)
- 텍스트 근거를 반드시 포함하세요
- 배점 합계가 일치하는지 확인하세요

순수 JSON만 응답하세요:
{
  "total_score": 100,
  "evaluation_structure": [
    {
      "category": "카테고리명 (예: 기술능력)",
      "max_score": 40,
      "items": [
        {
          "name": "세부항목명",
          "max_score": 15,
          "criteria": "세부 평가 기준 설명 (원문에서 추출)",
          "evidence": [
            {"text": "원문에서 발췌한 텍스트", "page_hint": "p.xx 또는 섹션명"}
          ],
          "text_confidence": 0.90,
          "structure_confidence": 0.85
        }
      ]
    }
  ],
  "anomalies": [
    {"item": "항목명", "signal": "이상치 설명 (예: 전년 대비 배점 변화 의심)"}
  ],
  "parsing_notes": "파싱 시 주의사항 또는 불확실한 부분"
}

confidence 기준:
- text_confidence: 해당 텍스트가 실제 평가기준인지 확신도
- structure_confidence: 항목/배점/기준이 올바르게 묶였는지 확신도
- 0.8 이상: 신뢰, 0.6~0.8: 주의, 0.6 미만: 검토 필요

RFP 텍스트:
{rfp_text}
"""


def extract_scoring_structure(rfp_text: str) -> dict:
    """
    RFP 텍스트에서 평가구조 추출.
    반환: evaluation_structure dict with confidence scores
    """
    client = anthropic.Anthropic()

    # 평가 관련 섹션만 추출 (토큰 절약)
    eval_section = _extract_eval_section(rfp_text)
    text_to_use = eval_section if eval_section else rfp_text[:12000]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system="당신은 RFP 평가구조 추출 전문가입니다. 정확한 JSON만 출력합니다.",
        messages=[{"role": "user", "content": EXTRACT_PROMPT.format(rfp_text=text_to_use)}]
    )

    result = _parse_claude_json(response.content[0].text)
    result["_extraction_source_length"] = len(text_to_use)
    return result


def _extract_eval_section(text: str) -> str:
    """RFP 텍스트에서 평가 관련 섹션만 추출"""
    keywords = ["평가기준", "평가항목", "배점", "심사기준", "기술평가", "제안서 평가", "평가표"]
    lines = text.split("\n")
    relevant_lines = []
    window = 0

    for i, line in enumerate(lines):
        if any(kw in line for kw in keywords):
            start = max(0, i - 2)
            window = i + 60
            relevant_lines.extend(lines[start:i])

        if i <= window:
            relevant_lines.append(line)

    return "\n".join(relevant_lines)


def validate_structure(scoring_data: dict) -> list[str]:
    """구조 검증 — 경고 목록 반환"""
    warnings = []
    structure = scoring_data.get("evaluation_structure", [])
    total = scoring_data.get("total_score", 100)

    calc_total = sum(cat.get("max_score", 0) for cat in structure)
    if abs(calc_total - total) > 5:
        warnings.append(f"배점 합계 불일치: 선언값 {total}점 vs 계산값 {calc_total}점")

    for cat in structure:
        for item in cat.get("items", []):
            sc = item.get("structure_confidence", 1.0)
            if sc < 0.8:
                warnings.append(
                    f"구조 신뢰도 낮음: [{cat['category']}] {item['name']} ({sc:.2f})"
                )

    return warnings
