#!/usr/bin/env python3
"""
시장 트렌드 DB 관리 CLI
사용법:
  python add_market_data.py          # 대화형 입력
  python add_market_data.py --list   # 조회
"""
import json
import argparse
from datetime import date
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "knowledge_base" / "market_trends.json"

CATEGORIES = ["AI 인프라", "통신사 AI", "AICC", "sLLM", "공공 AI", "경쟁사", "기술 트렌드", "규제", "기타"]
RELEVANCE = ["high", "medium", "low"]


def load() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    data["last_updated"] = date.today().strftime("%Y-%m-%d")
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def list_entries() -> None:
    data = load()
    for t in data.get("trends", []):
        flag = {"high": "🔴", "medium": "🟡", "low": "⚪"}.get(t.get("relevance"), "")
        print(f"{flag} [{t['category']}] {t['insight']} ({t.get('source','')})")


def add_entry() -> None:
    data = load()
    trends = data.setdefault("trends", [])

    print("\n── 시장 트렌드 입력 ──────────────────────────")
    print("카테고리:")
    for i, c in enumerate(CATEGORIES):
        print(f"  {i+1}. {c}")
    cat_idx = input("선택 (번호): ").strip()
    try:
        category = CATEGORIES[int(cat_idx) - 1]
    except (ValueError, IndexError):
        category = "기타"

    insight = input("인사이트 내용: ").strip()
    source = input("출처: ").strip()
    rel = input("관련도 (high/medium/low) [high]: ").strip() or "high"

    if not insight:
        print("내용이 비어있어 저장하지 않았습니다.")
        return

    trends.append({"category": category, "insight": insight, "source": source, "relevance": rel})
    save(data)
    print(f"✓ 저장 완료 (총 {len(trends)}건)\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true")
    args = parser.parse_args()
    if args.list:
        list_entries()
    else:
        add_entry()


if __name__ == "__main__":
    main()
