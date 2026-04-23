#!/usr/bin/env python3
"""
영업 현장 인텔리전스 주입 CLI
사용법:
  python add_intel.py                          # 대화형 입력
  python add_intel.py --list                   # 기존 항목 조회
  python add_intel.py --delete <index>         # 항목 삭제
"""
import sys
import json
import argparse
from datetime import date
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "field_intelligence" / "intel_entries.json"

CATEGORIES = [
    "고객 니즈", "경쟁사 동향", "예산 정보",
    "의사결정자", "기술 요구사항", "리스크", "기타"
]


def load() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def list_entries() -> None:
    data = load()
    entries = data.get("entries", [])
    if not entries:
        print("등록된 인텔리전스 항목이 없습니다.")
        return
    print(f"\n총 {len(entries)}건:\n")
    for i, e in enumerate(entries):
        print(f"[{i}] {e.get('date','')} | {e.get('category','')} | {e.get('source','')}")
        print(f"     {e.get('content','')}\n")


def add_entry() -> None:
    data = load()
    entries = data.setdefault("entries", [])

    print("\n── 영업 현장 인텔리전스 입력 ──────────────────")
    today = date.today().strftime("%Y-%m-%d")
    input_date = input(f"날짜 [{today}]: ").strip() or today

    print("카테고리:")
    for i, c in enumerate(CATEGORIES):
        print(f"  {i+1}. {c}")
    cat_idx = input("선택 (번호): ").strip()
    try:
        category = CATEGORIES[int(cat_idx) - 1]
    except (ValueError, IndexError):
        category = "기타"

    source = input("출처 (예: '영업팀 김부장', '고객사 미팅'): ").strip()
    content = input("내용: ").strip()
    priority = input("중요도 (high/medium/low) [medium]: ").strip() or "medium"

    if not content:
        print("내용이 비어있어 저장하지 않았습니다.")
        return

    entry = {
        "date": input_date,
        "category": category,
        "source": source,
        "content": content,
        "priority": priority,
    }
    entries.append(entry)
    save(data)
    print(f"\n✓ 저장 완료 (총 {len(entries)}건)\n")


def delete_entry(index: int) -> None:
    data = load()
    entries = data.get("entries", [])
    if index < 0 or index >= len(entries):
        print(f"인덱스 {index}가 범위를 벗어났습니다.")
        return
    removed = entries.pop(index)
    save(data)
    print(f"✓ 삭제됨: {removed.get('content','')[:50]}")


def main():
    parser = argparse.ArgumentParser(description="영업 인텔리전스 관리")
    parser.add_argument("--list", action="store_true", help="항목 조회")
    parser.add_argument("--delete", type=int, metavar="INDEX", help="항목 삭제")
    args = parser.parse_args()

    if args.list:
        list_entries()
    elif args.delete is not None:
        delete_entry(args.delete)
    else:
        add_entry()


if __name__ == "__main__":
    main()
