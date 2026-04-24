"""Page 5 — Price-to-Win (협상형 사업용)"""
import json
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="Price-to-Win", page_icon="💰", layout="wide")

DATA_DIR = Path("data/projects")


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("💰 Page 5 — Price-to-Win")

project_dir = get_project()
rfp_path = project_dir / "rfp.json"
scoring_path = project_dir / "scoring.json"
gap_path = project_dir / "gap_matrix.json"

if not rfp_path.exists():
    st.error("RFP 데이터가 없습니다.")
    st.stop()

rfp_data = json.loads(rfp_path.read_text(encoding="utf-8"))
contract_type = rfp_data.get("basics", {}).get("contract_type", "")

if "협상" not in contract_type:
    st.info(f"계약방식: **{contract_type}**\n\nPTW는 협상에 의한 계약 방식에만 활성화됩니다.")
    st.markdown("이 사업은 입찰 방식으로, 가격은 별도 전략 없이 최적 입찰가를 산정하세요.")
    st.stop()

st.markdown(f"계약방식: **{contract_type}** — PTW 분석 활성화")

if not gap_path.exists():
    st.warning("점수 갭 데이터가 없습니다. Page 3를 먼저 완료하세요.")
    st.stop()

gap_matrix = json.loads(gap_path.read_text(encoding="utf-8"))
scoring_data = json.loads(scoring_path.read_text(encoding="utf-8")) if scoring_path.exists() else {}

# 가격 항목 탐지
price_item = None
tech_items = []
for row in gap_matrix:
    if any(kw in row["item"].lower() for kw in ["가격", "price", "비용", "cost"]):
        price_item = row
    else:
        tech_items.append(row)

tech_kt_sum = sum(r["kt_score"] for r in tech_items)
tech_max = sum(r["max_score"] for r in tech_items)

st.markdown("### 기술 점수 현황")
col1, col2, col3 = st.columns(3)
with col1:
    st.metric("기술 예상 점수", f"{tech_kt_sum:.1f}점")
with col2:
    st.metric("기술 최대 점수", f"{tech_max:.1f}점")
with col3:
    if price_item:
        st.metric("가격 배점", f"{price_item['max_score']:.0f}점")

st.markdown("---")
st.markdown("### PTW 시뮬레이션")

budget_str = rfp_data.get("basics", {}).get("budget", "")
budget_input = st.number_input("예산 기준액 (억원)", min_value=0.0, value=10.0, step=0.5)
price_max = float(price_item["max_score"]) if price_item else 20.0

if st.button("📊 PTW 계산", type="primary"):
    from pipeline.strategy.ptw import compute_ptw
    result = compute_ptw(
        price_score_item=price_item,
        tech_score_sum=tech_kt_sum,
        tech_max=tech_max,
        price_max=price_max,
    )

    if result.get("applicable"):
        st.success(f"**{result['recommendation']}**")

        st.markdown("#### 시나리오별 분석")
        for sc in result.get("scenarios", []):
            color = "🟢" if sc == result.get("optimal") else ""
            st.markdown(
                f"{color} **{sc['price_label']}** → "
                f"가격점수 {sc['price_score']:.1f} + 기술점수 {sc['tech_score']:.1f} = "
                f"**총 {sc['total_score']:.1f}점** ({sc['total_pct']}%)"
            )
