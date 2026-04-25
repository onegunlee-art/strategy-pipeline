"""Page 1 — RFP 입력 및 파싱"""
import json
import tempfile
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="RFP 입력", page_icon="📄", layout="wide")

DATA_DIR = Path("data/projects")


def get_project() -> Path | None:
    project = st.session_state.get("project")
    if not project:
        st.warning("메인 화면에서 프로젝트를 선택하세요.")
        st.stop()
    return DATA_DIR / project


st.title("📄 Page 1 — RFP 입력")
st.markdown("RFP PDF를 업로드하면 전체 구조를 자동 분석합니다.")

project_dir = get_project()
rfp_path = project_dir / "rfp.json"

# ── PDF 업로드 ─────────────────────────────────────────────────────
col_h1, col_h2 = st.columns([4, 1])
with col_h1:
    st.markdown("### PDF 업로드")
with col_h2:
    if rfp_path.exists() and st.button("🔄 재업로드", use_container_width=True):
        rfp_path.unlink()
        st.rerun()

uploaded = st.file_uploader("RFP PDF 파일", type=["pdf"])

if uploaded:
    col1, col2 = st.columns([3, 1])
    with col1:
        st.success(f"파일 선택됨: **{uploaded.name}** ({uploaded.size:,} bytes)")
    with col2:
        parse_btn = st.button("🔍 파싱 시작", type="primary", use_container_width=True)

    if parse_btn:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(uploaded.read())
            tmp_path = Path(tmp.name)

        try:
            from pipeline.rfp_parser import extract_full_text, parse_rfp_basics
            status = st.status("RFP 파싱 중...", expanded=True)
            progress_bar = st.empty()

            def update_progress(done, total, page_num):
                progress_bar.progress(done / total, text=f"Vision 처리 중: {page_num}페이지 ({done}/{total})")

            with status:
                st.write("📄 PDF 분석 중 (스캔 여부 자동 감지)...")
                text, source = extract_full_text(tmp_path, progress_cb=update_progress)
                progress_bar.empty()

                if not text.strip():
                    raise ValueError("텍스트 추출 실패 — PDF가 손상되었거나 지원하지 않는 형식입니다.")

                st.write(f"✅ 텍스트 추출 완료 ({source}, {len(text):,}자)")
                st.write("🤖 RFP 구조 분석 중 (전략 연결 스키마)...")
                basics = parse_rfp_basics(text)

            rfp_data = {
                "text": text,
                "basics": basics,
                "source": source,
                "filename": uploaded.name,
            }
            rfp_path.write_text(json.dumps(rfp_data, ensure_ascii=False, indent=2), encoding="utf-8")
            st.session_state.rfp_parsed = True
            st.success(f"파싱 완료! (소스: {source})")
            st.rerun()
        except Exception as e:
            st.error(f"파싱 실패: {e}")
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except PermissionError:
                pass

# ── 파싱 결과 표시 ─────────────────────────────────────────────────
if rfp_path.exists() and rfp_path.stat().st_size > 10:
    try:
        rfp_data = json.loads(rfp_path.read_text(encoding="utf-8"))
    except Exception:
        rfp_path.unlink()
        st.warning("손상된 RFP 데이터를 삭제했습니다. PDF를 다시 업로드하세요.")
        st.stop()

    basics = rfp_data.get("basics", {})
    meta = basics.get("meta", {})
    overview = basics.get("project_overview", {})
    timeline = basics.get("timeline", {})
    budget = basics.get("budget", {})
    evaluation = basics.get("evaluation", {})
    intent = basics.get("intent_inference", {})
    strategy_hints = basics.get("strategy_hints", {})
    risk_flags = basics.get("risk_flags", {})
    requirements = basics.get("requirements", {})

    st.markdown("---")
    st.caption(f"파싱 소스: {rfp_data.get('source', '-')} | 파일: {rfp_data.get('filename', '-')} | 신뢰도: {meta.get('confidence_score', '-')}")

    # ── 요약 카드 ──────────────────────────────────────────────────
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("사업명", meta.get("title") or "-")
    with col2:
        st.metric("발주기관", meta.get("issuer") or "-")
    with col3:
        total_budget = budget.get("total_budget")
        st.metric("예산", f"{total_budget:,}원" if total_budget else "미확인")
    with col4:
        st.metric("총점", f"{evaluation.get('total_score', '-')}점")

    # ── 탭 구조로 전체 스키마 표시 ──────────────────────────────────
    tabs = st.tabs(["📋 개요", "⚖️ 평가구조", "📌 요건", "🔍 의도분석", "⚡ 전략힌트", "⚠️ 리스크", "✏️ 수정"])

    with tabs[0]:  # 개요
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**프로젝트 유형**")
            st.write(", ".join(overview.get("project_type", [])) or "-")
            st.markdown("**사업 목적**")
            st.write(overview.get("objective") or "-")
            st.markdown("**추진 배경**")
            st.write(overview.get("background") or "-")
        with col2:
            st.markdown("**타임라인**")
            tl = timeline
            st.caption(f"공고일: {tl.get('announcement_date') or '미확인'}")
            st.caption(f"제출기한: {tl.get('proposal_due_date') or '미확인'}")
            st.caption(f"사업시작: {tl.get('project_start') or '미확인'}")
            st.caption(f"사업기간: {tl.get('project_duration_months') or '미확인'}개월")
            st.markdown("**기대 성과**")
            for o in overview.get("expected_outcomes", []):
                st.caption(f"• {o}")

    with tabs[1]:  # 평가구조
        st.markdown(f"**총점:** {evaluation.get('total_score', 100)}점 | **평가방식:** {evaluation.get('evaluation_method', '-')}")
        for crit in evaluation.get("criteria", []):
            with st.expander(f"**{crit.get('name')}** — {crit.get('weight')}점"):
                for sub in crit.get("sub_criteria", []):
                    st.markdown(f"- **{sub.get('name')}** ({sub.get('weight')}점): {sub.get('description', '')}")

    with tabs[2]:  # 요건
        must = requirements.get("must", [])
        should = requirements.get("should", [])
        st.markdown(f"**필수 요건 {len(must)}개 | 권장 {len(should)}개**")
        for r in must:
            risk_icon = "🔴" if r.get("risk_if_missing") == "disqualified" else "🟡"
            st.caption(f"{risk_icon} **[{r.get('id')}] {r.get('description')}** — {r.get('category')} | {r.get('verification_method', '')}")
        if should:
            st.markdown("---")
            for r in should:
                st.caption(f"🔵 [{r.get('id')}] {r.get('description')}")

    with tabs[3]:  # 의도분석
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**선호 벤더 유형**")
            st.info(intent.get("likely_preferred_vendor_type") or "-")
            st.markdown("**숨겨진 우선순위**")
            for p in intent.get("hidden_priorities", []):
                st.caption(f"• {p}")
        with col2:
            st.markdown("**평가 집중점**")
            st.info(intent.get("inferred_focus") or "-")
            st.markdown("**AI 분석 근거**")
            st.write(intent.get("reasoning") or "-")

    with tabs[4]:  # 전략힌트
        col1, col2 = st.columns(2)
        with col1:
            st.markdown(f"**승부 방향:** {strategy_hints.get('win_focus', '-')}")
            st.markdown(f"**가격 전략:** {strategy_hints.get('price_strategy', '-')}")
            st.markdown("**핵심 차별점**")
            for d in strategy_hints.get("key_differentiators", []):
                st.caption(f"✅ {d}")
            st.markdown("**피해야 할 영역**")
            for a in strategy_hints.get("avoid_areas", []):
                st.caption(f"⚠️ {a}")
        with col2:
            st.markdown("**컨소시엄 필요 역량**")
            for c in strategy_hints.get("consortium_needs", []):
                st.caption(f"• [{c.get('role')}] {c.get('required_capability', '')}")

    with tabs[5]:  # 리스크
        flags = {
            "high_difficulty": "난이도 높음",
            "unclear_requirements": "요건 불명확",
            "over_specification": "과도한 명세",
            "vendor_lock_in_suspected": "특정 벤더 유도 의심",
            "timeline_risk": "일정 리스크",
        }
        for key, label in flags.items():
            val = risk_flags.get(key, False)
            icon = "🔴" if val else "🟢"
            st.caption(f"{icon} {label}")
        if risk_flags.get("notes"):
            st.warning(risk_flags["notes"])

    with tabs[6]:  # 수정
        with st.form("basics_edit_form"):
            st.markdown("**기본 정보 수정**")
            col1, col2 = st.columns(2)
            with col1:
                new_title = st.text_input("사업명", value=meta.get("title", ""))
                new_issuer = st.text_input("발주기관", value=meta.get("issuer", ""))
                new_contract = st.selectbox(
                    "계약방식",
                    ["협상에의한계약", "일반경쟁입찰", "제한경쟁입찰", "수의계약", "기타"],
                )
                new_budget = st.number_input("예산 (억원)", value=float(budget.get("total_budget") or 0) / 1e8, min_value=0.0)
            with col2:
                new_proposal_due = st.text_input("제출기한", value=timeline.get("proposal_due_date") or "")
                new_duration = st.number_input("사업기간 (개월)", value=int(timeline.get("project_duration_months") or 0), min_value=0)
                new_win_focus = st.selectbox("승부 방향", ["technical", "price", "hybrid"],
                    index=["technical", "price", "hybrid"].index(strategy_hints.get("win_focus", "technical")) if strategy_hints.get("win_focus") in ["technical", "price", "hybrid"] else 0)

            save_btn = st.form_submit_button("💾 저장 및 확정", type="primary")

        if save_btn:
            basics["meta"]["title"] = new_title
            basics["meta"]["issuer"] = new_issuer
            basics["timeline"]["proposal_due_date"] = new_proposal_due
            basics["timeline"]["project_duration_months"] = new_duration
            basics["budget"]["total_budget"] = int(new_budget * 1e8) if new_budget else None
            basics["strategy_hints"]["win_focus"] = new_win_focus
            # 하위 모듈 호환용 flat 필드 유지
            basics["project_name"] = new_title
            basics["client"] = new_issuer
            basics["contract_type"] = new_contract
            rfp_data["basics"] = basics
            rfp_path.write_text(json.dumps(rfp_data, ensure_ascii=False, indent=2), encoding="utf-8")
            st.success("✅ 저장 완료! **📊 평가구조 분해**로 이동하세요.")

    # ── 원문 텍스트 미리보기 (페이지네이션) ──────────────────────────
    with st.expander("📄 RFP 원문 텍스트 미리보기"):
        text = rfp_data.get("text", "")
        page_size = 3000
        total_pages = max(1, (len(text) + page_size - 1) // page_size)
        page_num = st.number_input("페이지", min_value=1, max_value=total_pages, value=1, step=1)
        start = (page_num - 1) * page_size
        st.caption(f"전체 {len(text):,}자 | {total_pages}페이지 중 {page_num}페이지")
        st.text_area("원문", text[start:start + page_size], height=400, disabled=True)
