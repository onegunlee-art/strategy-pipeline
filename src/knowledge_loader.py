"""
지식 베이스 로더
- strategy_images/ 이미지 목록 반환
- field_intelligence/intel_entries.json 로드
- client_db/clients.json 로드
- knowledge_base/market_trends.json 로드
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def get_strategy_images() -> list[Path]:
    img_dir = DATA / "strategy_images"
    return sorted(p for p in img_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def get_field_intel() -> list[dict]:
    path = DATA / "field_intelligence" / "intel_entries.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("entries", [])


def get_client(client_id: str) -> dict | None:
    path = DATA / "client_db" / "clients.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for c in data.get("clients", []):
        if c["id"] == client_id:
            return c
    return None


def get_market_trends() -> list[dict]:
    path = DATA / "knowledge_base" / "market_trends.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("trends", [])
