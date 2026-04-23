from pathlib import Path
import yaml
from datetime import date

ROOT = Path(__file__).parent.parent


def _load(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_all() -> dict:
    cfg = _load(ROOT / "config" / "pipeline_config.yaml")
    cfg["style"] = _load(ROOT / "config" / "ppt_style.yaml")
    cfg["params"] = _load(ROOT / "config" / "strategy_params.yaml")

    if not cfg.get("project", {}).get("date"):
        cfg.setdefault("project", {})["date"] = date.today().strftime("%Y-%m-%d")

    return cfg
