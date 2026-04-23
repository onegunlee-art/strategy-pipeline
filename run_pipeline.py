#!/usr/bin/env python3
"""
KT AI 서비스 수주전략 PPT 생성 파이프라인
사용법: python run_pipeline.py [--dry-run] [--skip-ai]
"""
import sys
import json
import argparse
from pathlib import Path

# rich 없으면 fallback
try:
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, TextColumn
    console = Console()
    def log(msg, style=""):
        console.print(msg, style=style)
except ImportError:
    def log(msg, style=""):
        print(msg)

sys.path.insert(0, str(Path(__file__).parent))
from src.config_loader import load_all
from src.knowledge_loader import get_strategy_images
from src.strategy_generator import generate_strategy
from src.ppt_builder import build_ppt

CACHE_PATH = Path("output/.strategy_cache.json")


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(data: dict) -> None:
    CACHE_PATH.parent.mkdir(exist_ok=True)
    CACHE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="KT AI 전략 PPT 파이프라인")
    parser.add_argument("--dry-run", action="store_true", help="PPT 빌드만, Claude API 호출 없음")
    parser.add_argument("--skip-ai", action="store_true", help="캐시된 전략 콘텐츠 사용")
    parser.add_argument("--use-cache", action="store_true", help="이전 API 응답 재사용")
    args = parser.parse_args()

    log("\n[bold cyan]━━━  KT AI 서비스 수주전략 PPT 파이프라인  ━━━[/bold cyan]\n")

    # 1. 설정 로드
    log("[1/3] 설정 로드 중...", "dim")
    cfg = load_all()
    log(f"     프로젝트: {cfg['project']['client']} / {cfg['project']['opportunity']}")
    log(f"     날짜: {cfg['project']['date']}")

    images = get_strategy_images()
    log(f"     전략 이미지: {len(images)}장")

    # 2. 전략 콘텐츠 생성
    if args.dry_run:
        log("\n[2/3] [DRY-RUN] 전략 생성 건너뜀 — 빈 콘텐츠 사용", "yellow")
        strategy_content = {}
    elif args.skip_ai or args.use_cache:
        cache = load_cache()
        if cache:
            log("\n[2/3] 캐시된 전략 콘텐츠 사용", "yellow")
            strategy_content = cache
        else:
            log("\n[2/3] 캐시 없음 — Claude API 호출", "yellow")
            strategy_content = _call_api(cfg)
            save_cache(strategy_content)
    else:
        log("\n[2/3] Claude API 로 전략 콘텐츠 생성 중...", "dim")
        strategy_content = _call_api(cfg)
        save_cache(strategy_content)

    # 3. PPT 빌드
    log("\n[3/3] PPT 생성 중...", "dim")
    output_path = build_ppt(cfg, strategy_content)
    log(f"\n[bold green]✓ PPT 생성 완료: {output_path}[/bold green]\n")


def _call_api(cfg: dict) -> dict:
    try:
        return generate_strategy(cfg)
    except Exception as e:
        log(f"\n[red]Claude API 오류: {e}[/red]")
        log("전략 콘텐츠 없이 PPT 빌드를 계속합니다.", "yellow")
        return {}


if __name__ == "__main__":
    main()
