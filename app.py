"""
KT 수주전략 파이프라인 — 메인 앱
점수 최적화 엔진
"""
import json
from pathlib import Path

import streamlit as st

st.set_page_config(
    page_title="KT 수주전략 파이프라인",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

DATA_DIR = Path("data/projects")
DATA_DIR.mkdir(parents=True, exist_ok=True)

STAGES = [
    ("rfp", "📄", "RFP 입력", "rfp.json"),
    ("scoring", "📊", "평가구조", "scoring.json"),
    ("gap", "🎯", "점수갭+Top3", "gap_matrix.json"),
    ("strategy", "⚡", "전략 3축", "strategy.json"),
    ("storyboard", "📋", "스토리보드", "storyboard.json"),
    ("result", "✅", "결과 로그", "result.json"),
]


def get_projects() -> list[str]:
    return sorted([d.name for d in DATA_DIR.iterdir() if d.is_dir()])


with st.sidebar:
    st.markdown("## 🎯 KT 수주전략")
    st.markdown("---")

    projects = get_projects()
    options = ["(새 프로젝트 생성)"] + projects
    selected = st.selectbox("프로젝트", options, key="project_selector")

    if selected == "(새 프로젝트 생성)":
        new_name = st.text_input("프로젝트명", placeholder="shinhanlife_ax_hub_2026")
        if st.button("✚ 생성", use_container_width=True) and new_name.strip():
            project_dir = DATA_DIR / new_name.strip()
            project_dir.mkdir(exist_ok=True)
            st.session_state.project = new_name.strip()
            st.rerun()
    else:
        st.session_state.project = selected

    if st.session_state.get("project"):
        project = st.session_state.project
        project_dir = DATA_DIR / project
        st.markdown("---")
        st.caption(f"**현재 프로젝트:** {project}")
        st.markdown("")

        for key, icon, label, fname in STAGES:
            done = (project_dir / fname).exists()
            mark = "✅" if done else "⬜"
            st.caption(f"{mark} {icon} {label}")

        st.markdown("---")
        st.caption("v1.0 · 점수 최적화 엔진")

# ── 메인 화면 ──────────────────────────────────────────────────────
st.title("🎯 KT 수주전략 파이프라인")
st.markdown("> **점수 최적화 엔진** — RFP 평가구조 분해 → 점수 갭 계산 → 전략 생성 → PPT")

if not st.session_state.get("project"):
    st.info("👈 왼쪽에서 프로젝트를 선택하거나 새로 생성하세요.")
    st.stop()

project = st.session_state.project
project_dir = DATA_DIR / project

# 진행 현황 대시보드
st.markdown("---")
cols = st.columns(len(STAGES))
for i, (key, icon, label, fname) in enumerate(STAGES):
    with cols[i]:
        done = (project_dir / fname).exists()
        st.metric(f"{icon} {label}", "완료 ✅" if done else "대기 ⬜")

st.markdown("---")

# 프로젝트 요약 (rfp.json 있으면 표시)
rfp_path = project_dir / "rfp.json"
if rfp_path.exists():
    rfp_data = json.loads(rfp_path.read_text())
    basics = rfp_data.get("basics", {})
    if basics:
        col1, col2, col3 = st.columns(3)
        with col1:
            st.info(f"**사업명:** {basics.get('project_name', '-')}")
        with col2:
            st.info(f"**발주기관:** {basics.get('client', '-')}")
        with col3:
            st.info(f"**계약방식:** {basics.get('contract_type', '-')}")

    top3_path = project_dir / "top3.json"
    if top3_path.exists():
        top3 = json.loads(top3_path.read_text())
        one_line = top3.get("one_line_strategy", "")
        if one_line:
            st.success(f"**핵심 전략:** {one_line}")

st.markdown("**→ 왼쪽 메뉴에서 단계를 선택하여 진행하세요.**")
