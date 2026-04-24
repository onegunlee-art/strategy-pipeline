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
st.markdown("RFP PDF를 업로드하면 사업 기본정보를 자동 추출합니다.")

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
            from pipeline.rfp_parser import extract_text_from_pdf
            status = st.status("RFP 파싱 중...", expanded=True)

            with status:
                st.write("📄 텍스트 추출 시도 중...")
                text, success = extract_text_from_pdf(tmp_path)
                source = "pdfplumber"

                if not success or len(text.strip()) < 200:
                    st.write("🔍 스캔 PDF 감지 — Vision 처리 시작 (페이지당 5~10초 소요)")
                    from pipeline.rfp_parser import extract_text_via_vision
                    text = extract_text_via_vision(tmp_path)
                    source = "vision"
                    if not text.strip():
                        raise ValueError("텍스트 추출 실패 — PDF가 손상되었거나 지원하지 않는 형식입니다.")

                st.write("🤖 기본정보 추출 중...")
                from pipeline.rfp_parser import parse_rfp_basics
                basics = parse_rfp_basics(text)

            rfp_data = {
                "text": text,
                "basics": basics,
                "source": source,
                "filename": uploaded.name,
            }
            rfp_path.write_text(json.dumps(rfp_data, ensure_ascii=False, indent=2, encoding="utf-8"))
            st.session_state.rfp_parsed = True
            st.success(f"파싱 완료! (소스: {source})")
            st.rerun()
        except Exception as e:
            st.error(f"파싱 실패: {e}")
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except PermissionError:
                pass  # Windows에서 파일이 아직 열려 있을 때 무시

# ── 파싱 결과 표시 및 검토 ─────────────────────────────────────────
if rfp_path.exists():
    rfp_data = json.loads(rfp_path.read_text(encoding="utf-8"))
    basics = rfp_data.get("basics", {})

    st.markdown("---")
    st.markdown("### 사업 기본정보 검토 / 수정")
    st.caption(f"파싱 소스: {rfp_data.get('source', '-')} | 파일: {rfp_data.get('filename', '-')}")

    with st.form("basics_form"):
        col1, col2 = st.columns(2)
        with col1:
            project_name = st.text_input("사업명", value=basics.get("project_name", ""))
            client = st.text_input("발주기관", value=basics.get("client", ""))
            contract_type = st.selectbox(
                "계약방식",
                ["협상에의한계약", "일반경쟁입찰", "제한경쟁입찰", "수의계약", "기타"],
                index=0 if basics.get("contract_type", "").startswith("협상") else 0
            )
            budget = st.text_input("사업예산", value=basics.get("budget", ""))
            duration = st.text_input("사업기간", value=basics.get("duration", ""))

        with col2:
            submission_deadline = st.text_input("제안서 제출기한", value=basics.get("submission_deadline", ""))
            reference_requirements = st.text_area("레퍼런스 요건", value=basics.get("reference_requirements", ""), height=80)
            consortium_allowed = st.checkbox("컨소시엄 허용", value=basics.get("consortium_allowed", True))
            tech_stack = st.text_area(
                "요구 기술 (줄바꿈 구분)",
                value="\n".join(basics.get("tech_stack", [])),
                height=80
            )

        scope = st.text_area("사업범위", value=basics.get("project_scope", ""), height=100)
        key_reqs = st.text_area(
            "핵심 요구사항 (줄바꿈 구분)",
            value="\n".join(basics.get("key_requirements", [])),
            height=100
        )

        save_btn = st.form_submit_button("💾 저장 및 확정", type="primary")

    if save_btn:
        basics_updated = {
            "project_name": project_name,
            "client": client,
            "contract_type": contract_type,
            "budget": budget,
            "duration": duration,
            "submission_deadline": submission_deadline,
            "reference_requirements": reference_requirements,
            "consortium_allowed": consortium_allowed,
            "tech_stack": [t.strip() for t in tech_stack.split("\n") if t.strip()],
            "project_scope": scope,
            "key_requirements": [r.strip() for r in key_reqs.split("\n") if r.strip()],
        }
        rfp_data["basics"] = basics_updated
        rfp_path.write_text(json.dumps(rfp_data, ensure_ascii=False, indent=2, encoding="utf-8"))
        st.success("✅ 저장 완료! 다음 단계: **📊 평가구조 분해**로 이동하세요.")

    # RFP 텍스트 미리보기
    with st.expander("📄 RFP 원문 텍스트 미리보기"):
        text = rfp_data.get("text", "")
        st.text_area("원문", text[:3000] + ("..." if len(text) > 3000 else ""), height=300, disabled=True)
