"""Page 4 — 전략 3축 + 충돌 감지 + Decision Trace"""
import json
from datetime import datetime
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="전략 3축", page_icon="⚡", layout="wide")

DATA_DIR = Path("data/projects")


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("⚡ Page 4 — 전략 3축")
st.markdown("경쟁사 조건 기반으로 프레임 / 고객 / 경쟁 전략을 생성합니다. 충돌 감지 후 승인하세요.")

project_dir = get_project()
rfp_path = project_dir / "rfp.json"
scoring_path = project_dir / "scoring.json"
gap_path = project_dir / "gap_matrix.json"
top3_path = project_dir / "top3.json"
strategy_path = project_dir / "strategy.json"
decision_path = project_dir / "decision.json"
meta_path = project_dir / "meta.json"

for req_path, req_name in [(rfp_path, "RFP"), (gap_path, "점수갭"), (top3_path, "Top3")]:
    if not req_path.exists():
        st.error(f"{req_name} 데이터가 없습니다. 이전 단계를 먼저 완료하세요.")
        st.stop()

rfp_data = json.loads(rfp_path.read_text(encoding="utf-8"))
scoring_data = json.loads(scoring_path.read_text(encoding="utf-8")) if scoring_path.exists() else {}
gap_matrix = json.loads(gap_path.read_text(encoding="utf-8"))
top3_data = json.loads(top3_path.read_text(encoding="utf-8"))
meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
competitor = meta.get("competitor", "경쟁사")

st.info(f"경쟁사: **{competitor}** | 승부 포인트: **{', '.join(top3_data.get('selected_focus', []))}**")

# ── 전략 생성 ──────────────────────────────────────────────────────
col1, col2 = st.columns([3, 1])
with col1:
    if strategy_path.exists():
        st.success("전략 데이터 존재. 아래에서 검토/수정하세요.")
with col2:
    gen_btn = st.button(
        "🤖 전략 생성" if not strategy_path.exists() else "🔄 재생성",
        type="primary", use_container_width=True
    )

if gen_btn:
    with st.spinner(f"전략 3축 생성 중... ({competitor} 상정)"):
        try:
            from pipeline.strategy.generator import generate_strategies
            from pipeline.strategy.conflict_detector import annotate_strategies_with_conflicts

            strategies = generate_strategies(
                top3=top3_data,
                rfp_basics=rfp_data.get("basics", {}),
                gap_matrix=gap_matrix,
                competitor=competitor,
            )
            strategies = annotate_strategies_with_conflicts(strategies)
            strategy_path.write_text(json.dumps(strategies, ensure_ascii=False, indent=2, encoding="utf-8"))
            st.success("전략 생성 완료!")
            st.rerun()
        except Exception as e:
            st.error(f"전략 생성 실패: {e}")

# ── 전략 검토 UI ───────────────────────────────────────────────────
if strategy_path.exists():
    strategies = json.loads(strategy_path.read_text(encoding="utf-8"))

    # 시나리오 영향 계산
    from pipeline.strategy.conflict_detector import compute_scenario_impact
    scenario = compute_scenario_impact(strategies)

    # 전체 리스크 요약
    risk_colors = {"LOW": "🟢", "MID": "🟡", "HIGH": "🔴"}
    overall_risk = scenario.get("overall_risk", "LOW")
    st.markdown(f"**전략 조합 리스크:** {risk_colors.get(overall_risk, '⬜')} {overall_risk}")

    if scenario.get("pairwise_conflicts"):
        st.error("⚠ 전략 간 충돌 감지:")
        for c in scenario["pairwise_conflicts"]:
            st.error(f"  • [{c['risk']}] {c['strategy_a']} ↔ {c['strategy_b']}: {c['description']}")

    if scenario.get("reality_checks"):
        st.warning("⚠ 전략-현실 확인 필요:")
        for r in scenario["reality_checks"]:
            st.warning(f"  • [{r['risk']}] {r['strategy']}: {r['description']}")

    st.markdown("---")

    updated_strategies = []
    axis_icons = {"frame": "🖼", "customer": "👥", "competitive": "⚔"}

    for s in strategies:
        axis = s.get("axis", "")
        icon = axis_icons.get(axis, "")
        axis_label = s.get("axis_label", axis)

        st.markdown(f"### {icon} {axis_label}")

        with st.form(f"strategy_form_{axis}"):
            title = st.text_input("전략 제목", value=s.get("title", ""), key=f"title_{axis}")
            description = st.text_area("전략 설명", value=s.get("description", ""), height=80, key=f"desc_{axis}")
            competitor_angle = st.text_area(
                f"{competitor} 대비 차별화 포인트",
                value=s.get("competitor_angle", ""), height=60, key=f"angle_{axis}"
            )

            st.markdown("**점수 영향 항목:**")
            impacts = s.get("score_impact", [])
            for imp in impacts:
                direction_icon = "▲" if imp.get("direction") == "up" else "▼"
                st.caption(
                    f"{direction_icon} **{imp.get('item', '')}** — "
                    f"{imp.get('reason', '')} | 실행: {imp.get('action', '')}"
                )

            if s.get("conflicts"):
                for c in s["conflicts"]:
                    st.warning(f"⚠ [{c.get('risk', '')}] {c.get('description', '')}")

            saved = st.form_submit_button("이 전략 저장")
            if saved:
                updated_s = {**s, "title": title, "description": description,
                             "competitor_angle": competitor_angle}
                strategies = [updated_s if x["axis"] == axis else x for x in strategies]
                strategy_path.write_text(json.dumps(strategies, ensure_ascii=False, indent=2, encoding="utf-8"))
                st.success("저장됨")

        st.markdown("")

    updated_strategies = json.loads(strategy_path.read_text(encoding="utf-8"))

    # 점수 시뮬레이터
    st.markdown("---")
    with st.expander("📊 점수 시뮬레이터 (방향성)"):
        from pipeline.scoring.simulator import compute_scenario_summary
        sim = compute_scenario_summary(updated_strategies, gap_matrix)

        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown("**▲ 점수 상승 예상:**")
            for item in sim.get("up_items", []):
                st.success(f"  • {item}")
        with col2:
            st.markdown("**▼ 점수 하락 위험:**")
            for item in sim.get("down_items", []):
                st.error(f"  • {item}")
        with col3:
            st.markdown("**? 불확실:**")
            for item in sim.get("uncertain_items", []):
                st.warning(f"  • {item}")

    # Decision Trace + 최종 승인
    st.markdown("---")
    st.markdown("### ✅ 최종 전략 승인 + Decision Trace")
    st.caption("전략을 승인하면 이유와 트레이드오프가 자동 기록됩니다.")

    with st.form("decision_form"):
        selected_focus = top3_data.get("selected_focus", [])
        reason = st.text_area(
            "이 전략 조합을 선택한 이유",
            placeholder="예: 갭이 가장 크고 LG CNS 대비 역전 가능성이 높기 때문",
            height=80
        )
        rejected_items = st.text_input(
            "포기한 항목 (쉼표 구분)",
            placeholder="예: 가격"
        )
        tradeoff = st.text_area(
            "감수하는 트레이드오프",
            placeholder="예: 가격 점수 -2 감수, 기술 점수 +8 목표",
            height=60
        )

        approve_btn = st.form_submit_button("🎯 전략 확정", type="primary")

    if approve_btn:
        decision = {
            "selected_focus": selected_focus,
            "reason": reason,
            "rejected": [r.strip() for r in rejected_items.split(",") if r.strip()],
            "tradeoff": tradeoff,
            "competitor": competitor,
            "scenario_accepted": f"충돌 수준: {overall_risk}",
            "timestamp": datetime.now().isoformat(),
        }
        decision_path.write_text(json.dumps(decision, ensure_ascii=False, indent=2, encoding="utf-8"))
        st.success("✅ 전략 확정 완료! **📋 스토리보드 + PPT** 페이지로 이동하세요.")
