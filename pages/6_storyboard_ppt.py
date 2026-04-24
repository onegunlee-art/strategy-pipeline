"""Page 6 — 스토리보드 + PPT 생성 (Layer 1/2/3)"""
import json
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="스토리보드 + PPT", page_icon="📋", layout="wide")

DATA_DIR = Path("data/projects")
OUTPUT_DIR = Path("output")


def get_project() -> Path:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("📋 Page 6 — 스토리보드 + PPT")
st.markdown("슬라이드 구조를 설계하고 평가항목 태그를 확인한 뒤 PPT를 생성합니다.")

project_dir = get_project()
rfp_path = project_dir / "rfp.json"
scoring_path = project_dir / "scoring.json"
strategy_path = project_dir / "strategy.json"
top3_path = project_dir / "top3.json"
storyboard_path = project_dir / "storyboard.json"

for req_path, req_name in [
    (rfp_path, "RFP"), (strategy_path, "전략 3축"), (top3_path, "Top3")
]:
    if not req_path.exists():
        st.error(f"{req_name} 데이터가 없습니다. 이전 단계를 완료하세요.")
        st.stop()

rfp_data = json.loads(rfp_path.read_text())
strategies = json.loads(strategy_path.read_text())
top3_data = json.loads(top3_path.read_text())
scoring_data = json.loads(scoring_path.read_text()) if scoring_path.exists() else {}

# ── 스토리보드 생성 ────────────────────────────────────────────────
col1, col2 = st.columns([3, 1])
with col2:
    gen_btn = st.button(
        "🤖 스토리보드 생성" if not storyboard_path.exists() else "🔄 재생성",
        type="primary", use_container_width=True
    )

if gen_btn:
    with st.spinner("스토리보드 생성 중... (1분 소요)"):
        try:
            from pipeline.ppt.storyboard import generate_storyboard, validate_coverage
            slides = generate_storyboard(
                strategies=strategies,
                top3=top3_data,
                scoring_data=scoring_data,
                rfp_basics=rfp_data.get("basics", {}),
            )
            storyboard_path.write_text(json.dumps(slides, ensure_ascii=False, indent=2))

            # 커버리지 검증
            eval_items = [
                item["name"]
                for cat in scoring_data.get("evaluation_structure", [])
                for item in cat.get("items", [])
            ]
            coverage = validate_coverage(slides, eval_items)
            if coverage.get("uncovered"):
                st.warning(f"미커버 평가항목: {', '.join(coverage['uncovered'])}")

            st.success(f"스토리보드 생성 완료! (총 {len(slides)}장)")
            st.rerun()
        except Exception as e:
            st.error(f"생성 실패: {e}")

# ── 스토리보드 편집 ────────────────────────────────────────────────
if storyboard_path.exists():
    slides = json.loads(storyboard_path.read_text())

    # 커버리지 히트맵
    st.markdown("### 📊 평가항목 커버리지")
    eval_items = [
        item["name"]
        for cat in scoring_data.get("evaluation_structure", [])
        for item in cat.get("items", [])
    ]
    if eval_items:
        from pipeline.ppt.storyboard import validate_coverage
        cov = validate_coverage(slides, eval_items)
        cols = st.columns(min(len(eval_items), 5))
        for i, item in enumerate(eval_items):
            with cols[i % 5]:
                count = len(cov["coverage"].get(item, []))
                color = "🟢" if count >= 2 else ("🟡" if count == 1 else "🔴")
                st.caption(f"{color} {item} ({count}장)")

        layer_counts = cov.get("layer_counts", {})
        st.caption(
            f"Layer 1: {layer_counts.get(1, 0)}장 | "
            f"Layer 2: {layer_counts.get(2, 0)}장 | "
            f"Layer 3: {layer_counts.get(3, 0)}장"
        )

    st.markdown("---")
    st.markdown("### 슬라이드 목록 (클릭해서 편집)")

    arg_colors = {"强": "🟢", "中": "🟡", "弱": "🔴"}
    layer_filters = st.multiselect("레이어 필터", [1, 2, 3], default=[1, 2])
    filtered_slides = [s for s in slides if s.get("layer", 3) in layer_filters]

    updated_slides = list(slides)

    for slide in filtered_slides:
        layer = slide.get("layer", 3)
        slide_type = slide.get("type", "")
        eval_tag = slide.get("eval_tag", "")
        score_target = slide.get("score_target", "")
        arg = slide.get("argumentation", "")
        arg_color = arg_colors.get(arg, "⬜")

        header = (
            f"L{layer} | {slide.get('id', '')} | **{slide.get('title', '')}**"
            + (f" | 📊{eval_tag} {score_target}" if eval_tag else "")
            + (f" | {arg_color}{arg}" if arg else "")
            + (" | ⭐KT전용" if slide.get("kt_only") else "")
        )

        with st.expander(header):
            col1, col2, col3 = st.columns([3, 1, 1])
            with col1:
                new_title = st.text_input("슬라이드 제목", value=slide.get("title", ""),
                                           key=f"title_{slide['id']}")
                new_msg = st.text_input("핵심 메시지", value=slide.get("key_message", ""),
                                         key=f"msg_{slide['id']}")
            with col2:
                new_tag = st.text_input("평가항목 태그", value=eval_tag, key=f"tag_{slide['id']}")
                new_target = st.text_input("기대 점수", value=score_target, key=f"target_{slide['id']}")
            with col3:
                new_arg = st.selectbox("논거 강도", ["强", "中", "弱", ""], index=["强","中","弱",""].index(arg) if arg in ["强","中","弱"] else 3, key=f"arg_{slide['id']}")
                new_layer = st.selectbox("레이어", [1, 2, 3], index=layer-1, key=f"layer_{slide['id']}")

            outline = "\n".join(slide.get("content_outline", []))
            new_outline = st.text_area("내용 아웃라인", value=outline, height=80, key=f"outline_{slide['id']}")
            kt_only = st.checkbox("KT Only", value=slide.get("kt_only", False), key=f"kt_{slide['id']}")

            # updated_slides에서 이 슬라이드 업데이트
            for j, s in enumerate(updated_slides):
                if s["id"] == slide["id"]:
                    updated_slides[j] = {
                        **s,
                        "title": new_title,
                        "key_message": new_msg,
                        "eval_tag": new_tag or None,
                        "score_target": new_target or None,
                        "argumentation": new_arg or None,
                        "layer": new_layer,
                        "content_outline": [l.strip() for l in new_outline.split("\n") if l.strip()],
                        "kt_only": kt_only,
                    }

    if st.button("💾 스토리보드 저장", use_container_width=True):
        storyboard_path.write_text(json.dumps(updated_slides, ensure_ascii=False, indent=2))
        st.success("저장됨!")

    # ── PPT 생성 ──────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("### 📥 PPT 다운로드")

    layer_desc = {
        1: "5장 (PT 발표 오프닝 / 임원용)",
        2: "12장 (의사결정용)",
        3: "전체 (평가위원 제출용)",
    }

    col1, col2, col3 = st.columns(3)
    project_name = st.session_state.get("project", "project")
    ppt_output = OUTPUT_DIR / project_name

    for layer, (col, desc) in zip([1, 2, 3], [(col1, layer_desc[1]), (col2, layer_desc[2]), (col3, layer_desc[3])]):
        with col:
            st.markdown(f"**Layer {layer}** — {desc}")
            if st.button(f"🖨 Layer {layer} 생성", key=f"ppt_layer_{layer}", use_container_width=True):
                with st.spinner(f"Layer {layer} PPT 생성 중..."):
                    try:
                        from pipeline.ppt.builder import build_ppt
                        out_file = build_ppt(
                            slides=updated_slides,
                            layer=layer,
                            rfp_basics=rfp_data.get("basics", {}),
                            strategies=strategies,
                            project_name=project_name,
                            output_dir=ppt_output,
                        )
                        with open(out_file, "rb") as f:
                            st.download_button(
                                label=f"⬇ Layer {layer} 다운로드",
                                data=f.read(),
                                file_name=out_file.name,
                                mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                key=f"dl_layer_{layer}",
                            )
                        st.success(f"생성 완료: {out_file.name}")
                    except Exception as e:
                        st.error(f"PPT 생성 실패: {e}")
