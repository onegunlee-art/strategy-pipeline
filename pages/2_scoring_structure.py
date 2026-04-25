"""Page 2 — 평가구조 분해 (시스템 생존 여부 결정)"""
import json
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="평가구조 분해", page_icon="📊", layout="wide")

DATA_DIR = Path("data/projects")


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("📊 Page 2 — 평가구조 분해")
st.markdown("RFP에서 평가 배점 구조를 추출하고 **강제 검토**합니다. 검토 완료 후 다음 단계로 이동하세요.")

project_dir = get_project()
rfp_path = project_dir / "rfp.json"
scoring_path = project_dir / "scoring.json"

if not rfp_path.exists():
    st.error("RFP가 아직 파싱되지 않았습니다. **Page 1**에서 먼저 RFP를 파싱하세요.")
    st.stop()

rfp_data = json.loads(rfp_path.read_text(encoding="utf-8"))

# ── AI 추출 ────────────────────────────────────────────────────────
col1, col2 = st.columns([3, 1])
with col1:
    st.markdown("### 평가구조 AI 추출")
    if scoring_path.exists():
        st.success("평가구조 데이터 존재. 아래에서 검토/수정하세요.")
with col2:
    extract_btn = st.button(
        "🤖 AI 추출 실행" if not scoring_path.exists() else "🔄 재추출",
        type="primary", use_container_width=True
    )

if extract_btn:
    rfp_text = rfp_data.get("text", "")
    if not rfp_text.strip():
        st.error("RFP 텍스트가 없습니다. Page 1에서 다시 파싱하세요.")
    else:
        with st.spinner("평가구조 추출 중... (30초 소요)"):
            try:
                from pipeline.scoring.extractor import extract_scoring_structure, validate_structure
                result = extract_scoring_structure(rfp_text)
                scoring_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                st.success("추출 완료!")

                warnings = validate_structure(result)
                if warnings:
                    for w in warnings:
                        st.warning(f"⚠ {w}")
                st.rerun()
            except Exception as e:
                st.error(f"추출 실패: {e}")

# ── 검토 UI ────────────────────────────────────────────────────────
if scoring_path.exists():
    scoring_data = json.loads(scoring_path.read_text(encoding="utf-8"))
    structure = scoring_data.get("evaluation_structure", [])

    st.markdown("---")
    st.markdown("### ✅ 강제 검토 — 항목별 확인 (모두 확인해야 다음 단계 진행 가능)")

    if scoring_data.get("parsing_notes"):
        st.info(f"**파싱 노트:** {scoring_data['parsing_notes']}")

    anomalies = scoring_data.get("anomalies", [])
    if anomalies:
        st.warning("**배점 이상치 감지:**")
        for a in anomalies:
            st.warning(f"  • [{a.get('item', '')}] {a.get('signal', '')}")

    confirmed_items = st.session_state.get("confirmed_items", set())
    total_items = 0
    updated_structure = []

    for cat_idx, cat in enumerate(structure):
        st.markdown(f"#### {cat.get('category', '카테고리')} (배점: {cat.get('max_score', '?')}점)")
        updated_items = []

        for item in cat.get("items", []):
            total_items += 1
            item_key = f"{cat.get('category')}_{item.get('name')}"
            sc = item.get("structure_confidence", 1.0)
            tc = item.get("text_confidence", 1.0)

            col1, col2, col3, col4 = st.columns([3, 1, 1, 1])
            with col1:
                new_name = st.text_input(
                    "항목명", value=item.get("name", ""),
                    key=f"name_{item_key}", label_visibility="collapsed"
                )
            with col2:
                new_score = st.number_input(
                    "배점", value=int(item.get("max_score") or 0),
                    min_value=0, max_value=200,
                    key=f"score_{item_key}", label_visibility="collapsed"
                )
            with col3:
                color = "🟢" if sc >= 0.8 else ("🟡" if sc >= 0.6 else "🔴")
                st.caption(f"{color} 구조신뢰도 {sc:.2f}")
            with col4:
                checked = st.checkbox("확인", key=f"check_{item_key}",
                                       value=item_key in confirmed_items)
                if checked:
                    confirmed_items.add(item_key)
                else:
                    confirmed_items.discard(item_key)

            # 세부 기준 + 근거
            with st.expander(f"세부 기준 / 근거 — {item.get('name', '')}", expanded=sc < 0.8):
                new_criteria = st.text_area(
                    "세부 평가 기준", value=item.get("criteria", ""),
                    key=f"criteria_{item_key}", height=80
                )
                evidence = item.get("evidence", [])
                for ev in evidence:
                    st.caption(f"📌 `{ev.get('page_hint', '')}` → {ev.get('text', '')[:150]}")

            updated_items.append({**item, "name": new_name, "max_score": new_score,
                                   "criteria": new_criteria if True else item.get("criteria")})

        updated_structure.append({**cat, "items": updated_items})

    st.session_state.confirmed_items = confirmed_items

    # 저장
    st.markdown("---")
    all_confirmed = len(confirmed_items) >= total_items
    if not all_confirmed:
        st.warning(f"⚠ {total_items - len(confirmed_items)}개 항목이 아직 확인되지 않았습니다.")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("💾 구조 저장", use_container_width=True, disabled=not all_confirmed, type="primary"):
            scoring_data["evaluation_structure"] = updated_structure
            scoring_data["_human_reviewed"] = True
            scoring_path.write_text(json.dumps(scoring_data, ensure_ascii=False, indent=2), encoding="utf-8")
            st.success("✅ 저장 완료! 다음 단계: **🎯 점수갭 분석**으로 이동하세요.")
    with col2:
        if st.button("⚡ 검토 생략하고 저장 (주의)", use_container_width=True):
            scoring_data["evaluation_structure"] = updated_structure
            scoring_data["_human_reviewed"] = False
            scoring_path.write_text(json.dumps(scoring_data, ensure_ascii=False, indent=2), encoding="utf-8")
            st.warning("저장됨. 구조 신뢰도가 낮은 항목은 Top3 계산에서 제외됩니다.")
