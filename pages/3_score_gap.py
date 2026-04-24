"""Page 3 — 점수 갭 분석 + TOP 3 승부 포인트"""
import json
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="점수 갭 분석", page_icon="🎯", layout="wide")

DATA_DIR = Path("data/projects")
COMPETITORS = ["LG CNS", "SK C&C", "삼성SDS", "SK텔레콤", "직접 입력"]


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("🎯 Page 3 — 점수 갭 분석 + TOP 3 승부 포인트")
st.markdown("KT 기준점수를 입력하고, 경쟁사를 선택하면 점수 갭과 승부 포인트가 자동 도출됩니다.")

project_dir = get_project()
scoring_path = project_dir / "scoring.json"
gap_path = project_dir / "gap_matrix.json"
top3_path = project_dir / "top3.json"

if not scoring_path.exists():
    st.error("평가구조 데이터가 없습니다. **Page 2**에서 먼저 평가구조를 분해하세요.")
    st.stop()

scoring_data = json.loads(scoring_path.read_text(encoding="utf-8"))
structure = scoring_data.get("evaluation_structure", [])

# ── 경쟁사 선택 ────────────────────────────────────────────────────
st.markdown("### 1. 경쟁사 선택")
st.caption("경쟁사 변경 시 점수 갭 + Top3 + 전략이 자동 재계산됩니다.")

col1, col2 = st.columns([2, 2])
with col1:
    comp_select = st.selectbox("경쟁사", COMPETITORS, key="competitor_select")
    if comp_select == "직접 입력":
        competitor = st.text_input("경쟁사명 직접 입력", key="competitor_custom")
    else:
        competitor = comp_select

with col2:
    project_type = st.text_input(
        "프로젝트 유형 키워드",
        placeholder="예: AI_heavy, cloud, SI, infra_heavy",
        help="경쟁사 점수 보정에 사용됩니다"
    )

# ── KT 기준점수 입력 ───────────────────────────────────────────────
st.markdown("---")
st.markdown("### 2. KT 기준점수 입력 (자사분석)")
st.caption("⭐ 가장 중요한 Human 입력 단계 — 현실적으로 KT가 받을 수 있는 점수를 입력하세요.")

kt_scores = {}
if gap_path.exists():
    saved_gap = json.loads(gap_path.read_text(encoding="utf-8"))
    kt_scores = {r["item"]: r["kt_score"] for r in saved_gap}

updated_kt_scores = {}
for cat in structure:
    st.markdown(f"**{cat.get('category')} ({cat.get('max_score', 0)}점)**")
    cols = st.columns(min(len(cat.get("items", [])), 4))
    for i, item in enumerate(cat.get("items", [])):
        name = item["name"]
        max_s = item["max_score"]
        default_val = kt_scores.get(name, round(max_s * 0.75, 1))
        sc = item.get("structure_confidence", 1.0)
        label = name
        if sc < 0.8:
            label = f"⚠ {name} (신뢰도낮음)"
        with cols[i % 4]:
            val = st.number_input(
                f"{label}\n(max {max_s})",
                min_value=0.0, max_value=float(max_s),
                value=float(default_val),
                step=0.5,
                key=f"kt_{name}"
            )
            updated_kt_scores[name] = val

# ── 갭 계산 + Top3 ─────────────────────────────────────────────────
st.markdown("---")
col1, col2 = st.columns([2, 1])
with col1:
    calc_btn = st.button(
        "📊 갭 계산 + TOP3 도출",
        type="primary",
        use_container_width=True,
        disabled=not competitor
    )
with col2:
    if top3_path.exists():
        st.success("Top3 데이터 있음 (재계산 가능)")

if calc_btn and competitor:
    with st.spinner("점수 갭 계산 + AI Top3 도출 중..."):
        try:
            from pipeline.scoring.gap_analyzer import compute_gap_matrix, compute_top3
            gap_matrix = compute_gap_matrix(scoring_data, updated_kt_scores, competitor, project_type)
            gap_path.write_text(json.dumps(gap_matrix, ensure_ascii=False, indent=2), encoding="utf-8")

            top3_result = compute_top3(gap_matrix, competitor, project_type)
            top3_path.write_text(json.dumps(top3_result, ensure_ascii=False, indent=2), encoding="utf-8")

            # competitor 저장
            (project_dir / "meta.json").write_text(json.dumps({
                "competitor": competitor,
                "project_type": project_type,
            }, ensure_ascii=False), encoding="utf-8")

            st.success("계산 완료!")
            st.rerun()
        except Exception as e:
            st.error(f"계산 실패: {e}")

# ── 결과 표시 ──────────────────────────────────────────────────────
if gap_path.exists() and top3_path.exists():
    gap_matrix = json.loads(gap_path.read_text(encoding="utf-8"))
    top3_data = json.loads(top3_path.read_text(encoding="utf-8"))

    # 한 줄 전략
    one_line = top3_data.get("one_line_strategy", "")
    if one_line:
        st.success(f"**핵심 전략 한 줄:** {one_line}")

    st.markdown("---")

    # TOP 3 선택 UI
    st.markdown("### ★ TOP 3 승부 포인트")
    st.caption("AI 추천 항목을 확인하고 집중할 승부 포인트를 선택하세요. (최소 1개, 2개 이상 권장)")

    top3_items = top3_data.get("top3", [])
    selected_focus = st.session_state.get("selected_focus", [])

    for item in top3_items:
        feasibility_color = {"Low": "🔴", "Mid": "🟡", "High": "🟢"}.get(item.get("feasibility", ""), "⬜")
        rev_color = {"Low": "🔴", "Mid": "🟡", "High": "🟢"}.get(item.get("competitor_reversibility", ""), "⬜")

        col1, col2 = st.columns([4, 1])
        with col1:
            checked = st.checkbox(
                f"**{item.get('rank', '?')}위. {item.get('eval_item', '')}** "
                f"— 갭 {item.get('gap', 0):+.1f}점 | "
                f"실행난이도 {feasibility_color} {item.get('feasibility', '')} | "
                f"역전가능성 {rev_color} {item.get('competitor_reversibility', '')}",
                key=f"top3_check_{item.get('eval_item')}",
                value=item.get("eval_item") in selected_focus
            )
        with col2:
            st.caption(f"우선순위 점수: {item.get('priority_score', 0):.2f}")

        if checked and item.get("eval_item") not in selected_focus:
            selected_focus.append(item.get("eval_item"))
        elif not checked and item.get("eval_item") in selected_focus:
            selected_focus.remove(item.get("eval_item"))

        with st.expander(f"상세 — {item.get('eval_item', '')}"):
            st.markdown(f"**필요 역량:** {item.get('required_capability', '')}")
            st.markdown(f"**승리 논리:** {item.get('win_logic', '')}")

    # 직접 추가
    custom_focus = st.text_input("+ 항목 직접 추가", placeholder="추가할 평가 항목명")
    if custom_focus and custom_focus not in selected_focus:
        if st.button("추가"):
            selected_focus.append(custom_focus)
            st.rerun()

    st.session_state.selected_focus = selected_focus

    if len(selected_focus) == 0:
        st.error("최소 1개 항목을 선택하세요.")
    elif len(selected_focus) == 1:
        st.warning("1개 선택됨 — 2개 이상 선택을 강력 권장합니다.")
    else:
        st.success(f"✅ {len(selected_focus)}개 승부 포인트 선택됨: {', '.join(selected_focus)}")

    # 제외된 항목 표시
    excluded = top3_data.get("low_confidence_excluded", [])
    if excluded:
        with st.expander(f"⚠ 구조 신뢰도 낮아 Top3 제외된 항목 ({len(excluded)}개)"):
            for ex in excluded:
                st.caption(f"• {ex['item']} (confidence: {ex['structure_confidence']:.2f})")

    # 갭 매트릭스 상세
    st.markdown("---")
    with st.expander("📊 전체 점수 갭 매트릭스"):
        for row in gap_matrix:
            gap = row["gap"]
            color = "🟢" if gap > 0 else ("🔴" if gap < 0 else "⬜")
            st.caption(
                f"{color} **{row['item']}** ({row['category']}) | "
                f"KT {row['kt_score']:.1f} vs {competitor} {row['competitor_score']:.1f} | "
                f"갭 {gap:+.1f}점 | max {row['max_score']}점"
            )

    # 저장 + 다음 단계
    st.markdown("---")
    if len(selected_focus) >= 1:
        if st.button("💾 선택 저장 → 전략 3축으로", type="primary", use_container_width=True):
            top3_data["selected_focus"] = selected_focus
            top3_path.write_text(json.dumps(top3_data, ensure_ascii=False, indent=2), encoding="utf-8")
            st.success("✅ 저장 완료! **⚡ 전략 3축** 페이지로 이동하세요.")
