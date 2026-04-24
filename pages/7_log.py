"""Page 7 — 결과 로그 (학습루프 연료)"""
import json
from datetime import datetime
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="결과 로그", page_icon="✅", layout="wide")

DATA_DIR = Path("data/projects")
PAST_BIDS = Path("data/knowledge_base/past_bids.json")


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("✅ Page 7 — 결과 로그")
st.markdown("수주 결과를 입력하면 다음 프로젝트 전략 가중치 보정에 활용됩니다.")

project_dir = get_project()
result_path = project_dir / "result.json"
decision_path = project_dir / "decision.json"
rfp_path = project_dir / "rfp.json"
top3_path = project_dir / "top3.json"
gap_path = project_dir / "gap_matrix.json"
meta_path = project_dir / "meta.json"

# ── Decision Trace 표시 ────────────────────────────────────────────
if decision_path.exists():
    decision = json.loads(decision_path.read_text())
    st.markdown("### 📋 Decision Trace (이 프로젝트의 전략 선택 기록)")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.info(f"**집중 항목:** {', '.join(decision.get('selected_focus', []))}")
    with col2:
        st.info(f"**경쟁사:** {decision.get('competitor', '-')}")
    with col3:
        st.info(f"**포기 항목:** {', '.join(decision.get('rejected', []))}")
    st.caption(f"이유: {decision.get('reason', '-')}")
    st.caption(f"트레이드오프: {decision.get('tradeoff', '-')}")

# ── 결과 입력 ──────────────────────────────────────────────────────
st.markdown("---")
st.markdown("### 수주 결과 입력")

existing = json.loads(result_path.read_text()) if result_path.exists() else {}

with st.form("result_form"):
    col1, col2 = st.columns(2)
    with col1:
        outcome = st.selectbox(
            "수주 결과",
            ["수주", "실주", "진행중", "포기"],
            index=["수주", "실주", "진행중", "포기"].index(existing.get("outcome", "진행중"))
        )
        kt_total = st.number_input(
            "KT 실제 총점", min_value=0.0, max_value=200.0,
            value=float(existing.get("kt_total_score", 0))
        )

    with col2:
        competitor_total = st.number_input(
            "경쟁사 총점", min_value=0.0, max_value=200.0,
            value=float(existing.get("competitor_total_score", 0))
        )
        rank = st.number_input("최종 순위", min_value=1, max_value=10, value=int(existing.get("rank", 1)))

    st.markdown("**항목별 실제 점수 (선택 입력)**")
    item_scores_input = st.text_area(
        "형식: 항목명:점수 (줄바꿈 구분)",
        value="\n".join(f"{k}:{v}" for k, v in existing.get("item_scores", {}).items()),
        placeholder="운영능력:13\nAI모델:11",
        height=100
    )
    lessons = st.text_area(
        "주요 교훈 (다음에 바꿀 것)",
        value=existing.get("lessons", ""),
        height=80
    )

    save_btn = st.form_submit_button("💾 결과 저장", type="primary")

if save_btn:
    item_scores = {}
    for line in item_scores_input.strip().split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            try:
                item_scores[k.strip()] = float(v.strip())
            except ValueError:
                pass

    result = {
        "outcome": outcome,
        "kt_total_score": kt_total,
        "competitor_total_score": competitor_total,
        "delta": round(kt_total - competitor_total, 1),
        "rank": rank,
        "item_scores": item_scores,
        "lessons": lessons,
        "timestamp": datetime.now().isoformat(),
    }
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))

    # past_bids.json에 추가
    rfp_basics = {}
    if rfp_path.exists():
        rfp_basics = json.loads(rfp_path.read_text()).get("basics", {})
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    bids_data = json.loads(PAST_BIDS.read_text()) if PAST_BIDS.exists() else {"bids": []}
    bids_data["bids"].append({
        "project": st.session_state.get("project", ""),
        "project_name": rfp_basics.get("project_name", ""),
        "client": rfp_basics.get("client", ""),
        "competitor": meta.get("competitor", ""),
        "outcome": outcome,
        "delta": result["delta"],
        "selected_focus": json.loads(decision_path.read_text()).get("selected_focus", []) if decision_path.exists() else [],
        "timestamp": result["timestamp"],
    })
    PAST_BIDS.write_text(json.dumps(bids_data, ensure_ascii=False, indent=2))

    st.success("✅ 결과 저장 완료! 다음 프로젝트 전략 보정에 활용됩니다.")

# ── 갭 예측 vs 실제 비교 ──────────────────────────────────────────
if result_path.exists() and gap_path.exists():
    result = json.loads(result_path.read_text())
    gap_matrix = json.loads(gap_path.read_text())

    st.markdown("---")
    st.markdown("### 📊 예측 vs 실제 비교")

    actual_scores = result.get("item_scores", {})
    if actual_scores:
        for row in gap_matrix:
            item = row["item"]
            if item in actual_scores:
                predicted = row["kt_score"]
                actual = actual_scores[item]
                diff = actual - predicted
                color = "🟢" if abs(diff) <= 1 else ("🟡" if abs(diff) <= 3 else "🔴")
                st.caption(
                    f"{color} **{item}** | 예측 {predicted:.1f}점 → 실제 {actual:.1f}점 | 오차 {diff:+.1f}점"
                )

# ── 과거 수주 이력 ─────────────────────────────────────────────────
if PAST_BIDS.exists():
    bids_data = json.loads(PAST_BIDS.read_text())
    bids = bids_data.get("bids", [])
    if bids:
        st.markdown("---")
        with st.expander(f"📚 과거 수주 이력 ({len(bids)}건)"):
            for bid in reversed(bids[-10:]):
                outcome_icon = {"수주": "✅", "실주": "❌", "진행중": "🔄", "포기": "⏸"}.get(bid.get("outcome", ""), "⬜")
                st.caption(
                    f"{outcome_icon} **{bid.get('project_name', bid.get('project', ''))}** "
                    f"| vs {bid.get('competitor', '-')} | 점수차 {bid.get('delta', 0):+.1f}"
                )
