"""
공통 JSON 파싱 유틸 — Claude API 응답에서 JSON 추출
raw_decode 방식으로 앞뒤 여분 텍스트 및 잘린 JSON 모두 처리
"""
import json
import re


def _repair_json(raw: str) -> str:
    raw = re.sub(r",\s*([\]}])", r"\1", raw)
    stack = []
    for ch in raw:
        if ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if stack and stack[-1] == ch:
                stack.pop()
    raw = raw.rstrip(", \n\r\t")
    raw += "".join(reversed(stack))
    return raw


def parse_json_robust(raw: str):
    """
    Claude API 응답에서 첫 번째 유효한 JSON 객체/배열을 추출·반환.
    앞뒤 설명 텍스트, 마크다운 코드블록, 잘린 JSON 모두 처리.
    """
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    raw = raw.strip()

    decoder = json.JSONDecoder()

    # 1차: raw_decode — 첫 번째 { 또는 [ 에서 파싱 시작, 이후 텍스트 무시
    for i, ch in enumerate(raw):
        if ch in "{[":
            try:
                obj, _ = decoder.raw_decode(raw, i)
                return obj
            except json.JSONDecodeError:
                continue

    # 2차: 괄호 복구 후 재시도
    repaired = _repair_json(raw)
    for i, ch in enumerate(repaired):
        if ch in "{[":
            try:
                obj, _ = decoder.raw_decode(repaired, i)
                return obj
            except json.JSONDecodeError:
                continue

    raise ValueError(f"유효한 JSON 추출 실패: {raw[:300]}")
