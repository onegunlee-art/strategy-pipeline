#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
하나은행 관통 장표 2장 — "AI를 통제하는 금융, 하나은행"
slide 1: 본질 진단 — RFP 한 문장에 숨겨진 진짜 의도
slide 2: 우리의 답 — 3축 × 3행위 매트릭스 (Ready to AI Foundation)
"""

from pptx import Presentation
from pptx.util import Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ─── 색상 팔레트 (generate_pptx.py 와 동일) ────────────────────────────────────
NAVY        = RGBColor(0x0A, 0x16, 0x28)
NAVY2       = RGBColor(0x0D, 0x1F, 0x3C)
NAVY3       = RGBColor(0x13, 0x2A, 0x4D)   # 매트릭스 셀용 약간 더 밝게
CYAN        = RGBColor(0x00, 0xD4, 0xFF)
ORANGE      = RGBColor(0xFF, 0x6B, 0x35)
YELLOW      = RGBColor(0xFF, 0xD7, 0x00)
GREEN       = RGBColor(0x00, 0xE0, 0x96)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY  = RGBColor(0xCC, 0xD6, 0xE0)
MID_BLUE    = RGBColor(0x1A, 0x4A, 0x7A)
DARK_TEXT   = RGBColor(0xA0, 0xB8, 0xCC)
RED_SOFT    = RGBColor(0xE5, 0x4B, 0x4B)

FONT_KO = "맑은 고딕"

SLIDE_W = Cm(33.87)
SLIDE_H = Cm(19.05)

FOOTER_TEXT = "하나은행 비정형 데이터 자산화 플랫폼 제안  |  2026.05  |  KT B2B 수주전략팀"


# ─── 유틸리티 ────────────────────────────────────────────────────────────────────

def blank_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def fill_bg(slide, color):
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = color


def add_rect(slide, x, y, w, h, fill_color, line_color=None, line_width=None):
    shape = slide.shapes.add_shape(1, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if line_color:
        shape.line.color.rgb = line_color
        if line_width:
            shape.line.width = line_width
    else:
        shape.line.fill.background()
    return shape


def add_textbox(slide, text, x, y, w, h,
                font_size=14, bold=False, color=WHITE,
                align=PP_ALIGN.LEFT, italic=False, word_wrap=True):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = word_wrap
    tf = txb.text_frame
    tf.word_wrap = word_wrap
    tf.margin_left = Cm(0.1)
    tf.margin_right = Cm(0.1)
    tf.margin_top = Cm(0.05)
    tf.margin_bottom = Cm(0.05)
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = FONT_KO
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txb


def add_rich_textbox(slide, runs, x, y, w, h, align=PP_ALIGN.LEFT, word_wrap=True):
    """여러 run을 한 단락에 넣어 부분 컬러 강조 가능. runs = [(text, font_size, bold, color), ...]"""
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = word_wrap
    tf = txb.text_frame
    tf.word_wrap = word_wrap
    tf.margin_left = Cm(0.15)
    tf.margin_right = Cm(0.15)
    tf.margin_top = Cm(0.1)
    tf.margin_bottom = Cm(0.1)
    p = tf.paragraphs[0]
    p.alignment = align
    for (text, fs, bold, color) in runs:
        r = p.add_run()
        r.text = text
        r.font.name = FONT_KO
        r.font.size = Pt(fs)
        r.font.bold = bold
        r.font.color.rgb = color
    return txb


def add_footer(slide, page_num):
    add_rect(slide, Cm(1.5), SLIDE_H - Cm(1.2),
             SLIDE_W - Cm(3), Cm(0.04), MID_BLUE)
    add_textbox(slide, FOOTER_TEXT,
                Cm(1.5), SLIDE_H - Cm(1.1),
                SLIDE_W - Cm(5), Cm(0.9),
                font_size=8, color=DARK_TEXT, align=PP_ALIGN.LEFT)
    add_textbox(slide, f"{page_num} / 2",
                SLIDE_W - Cm(3.5), SLIDE_H - Cm(1.1),
                Cm(2), Cm(0.9),
                font_size=8, color=DARK_TEXT, align=PP_ALIGN.RIGHT)


# ─── 슬라이드 1: 본질 진단 ─────────────────────────────────────────────────────

def slide_01_diagnosis(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    # ── 상단 캐치프레이즈 띠 ─────────────────────────────────────────────
    add_rect(sl, 0, 0, SLIDE_W, Cm(3.0), NAVY2)
    # 좌측 컬러바
    add_rect(sl, 0, 0, Cm(0.25), Cm(3.0), CYAN)

    # 작은 태그
    add_rect(sl, Cm(1.2), Cm(0.55), Cm(4.5), Cm(0.55), CYAN)
    add_textbox(sl, "MASTER MESSAGE  ·  본질 진단",
                Cm(1.2), Cm(0.55), Cm(4.5), Cm(0.55),
                font_size=9, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    # 메인 캐치프레이즈
    add_textbox(sl, "AI를 통제하는 금융, 하나은행",
                Cm(1.2), Cm(1.15), SLIDE_W - Cm(2.4), Cm(1.3),
                font_size=32, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    add_textbox(sl, "Ready to AI Foundation — 모든 판단이 AI 실행 자산 위에서 움직이는 첫 번째 은행",
                Cm(1.2), Cm(2.35), SLIDE_W - Cm(2.4), Cm(0.6),
                font_size=12, color=CYAN, align=PP_ALIGN.LEFT)

    # ── 슬라이드 제목 ─────────────────────────────────────────────────────
    add_textbox(sl, "이 사업은 RAG가 아닙니다. 은행의 OS 교체입니다.",
                Cm(1.2), Cm(3.4), SLIDE_W - Cm(2.4), Cm(0.9),
                font_size=18, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    # ── RFP 원문 인용 박스 ───────────────────────────────────────────────
    quote_y = Cm(4.6)
    quote_h = Cm(2.7)
    add_rect(sl, Cm(1.2), quote_y, SLIDE_W - Cm(2.4), quote_h, NAVY3, MID_BLUE, Pt(0.75))
    # 좌측 인용바
    add_rect(sl, Cm(1.2), quote_y, Cm(0.15), quote_h, YELLOW)

    add_rect(sl, Cm(1.6), quote_y + Cm(0.25), Cm(3.5), Cm(0.5), YELLOW)
    add_textbox(sl, "RFP 원문 분석",
                Cm(1.6), quote_y + Cm(0.25), Cm(3.5), Cm(0.5),
                font_size=8, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    # 본문 — rich text 로 핵심 단어 컬러 강조
    add_rich_textbox(sl, [
        ('"주요 ', 14, False, LIGHT_GRAY),
        ('비정형 데이터', 14, True, YELLOW),
        ('를 대상으로 ', 14, False, LIGHT_GRAY),
        ('수집 · 저장 · 가공', 14, True, CYAN),
        ('하여 자산화함으로써  ', 14, False, LIGHT_GRAY),
        ('대직원 · 대손님 · 리스크', 14, True, ORANGE),
        (' 등 전 영역에서 생성형 AI Agent를 활용할 수 있는  ', 14, False, LIGHT_GRAY),
        ('공통 데이터 기반', 14, True, GREEN),
        (' 플랫폼을 구축한다"', 14, False, LIGHT_GRAY),
    ], Cm(1.6), quote_y + Cm(0.85), SLIDE_W - Cm(3.2), Cm(1.8), align=PP_ALIGN.LEFT)

    # ── 표면 vs 본질 비교표 ──────────────────────────────────────────────
    tbl_y = Cm(7.7)
    col_w = (SLIDE_W - Cm(2.4) - Cm(0.4)) / 2
    left_x = Cm(1.2)
    right_x = left_x + col_w + Cm(0.4)

    # 헤더
    add_rect(sl, left_x, tbl_y, col_w, Cm(0.7), MID_BLUE)
    add_textbox(sl, "표면 — RFP 문구",
                left_x, tbl_y, col_w, Cm(0.7),
                font_size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(sl, right_x, tbl_y, col_w, Cm(0.7), CYAN)
    add_textbox(sl, "본질 — 하나은행이 진짜 원하는 것",
                right_x, tbl_y, col_w, Cm(0.7),
                font_size=11, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    pairs = [
        ("비정형 데이터 플랫폼",
         "은행의 모든 판단 흐름을 AI 중심으로 재구성"),
        ("생성형 AI Agent 활용",
         "'사람이 찾는 조직' → 'AI가 즉시 실행하는 조직'"),
        ("데이터 자산화",
         "AI Agent 생태계의 기반 인프라"),
        ("'공통 데이터 기반' (가장 핵심)",
         "부서별 사일로 제거 → 조직 전체가 동일 컨텍스트 공유"),
    ]
    row_h = Cm(1.25)
    row_y = tbl_y + Cm(0.8)
    for i, (surf, ess) in enumerate(pairs):
        # 좌측 셀 (어두운 회색조)
        add_rect(sl, left_x, row_y, col_w, row_h, NAVY2, MID_BLUE, Pt(0.5))
        add_textbox(sl, surf,
                    left_x + Cm(0.3), row_y, col_w - Cm(0.6), row_h,
                    font_size=12, color=DARK_TEXT, align=PP_ALIGN.LEFT)
        # 우측 셀 (강조)
        emphasis_color = NAVY3 if i < 3 else NAVY3
        add_rect(sl, right_x, row_y, col_w, row_h, emphasis_color, CYAN, Pt(0.5))
        bold_flag = i == 3
        color = YELLOW if i == 3 else WHITE
        add_textbox(sl, ess,
                    right_x + Cm(0.3), row_y, col_w - Cm(0.6), row_h,
                    font_size=12, bold=bold_flag, color=color, align=PP_ALIGN.LEFT)
        row_y += row_h + Cm(0.1)

    # ── 하단 결론 띠 (오렌지) ─────────────────────────────────────────────
    concl_y = SLIDE_H - Cm(3.4)
    add_rect(sl, Cm(1.2), concl_y, SLIDE_W - Cm(2.4), Cm(1.85), ORANGE)
    add_textbox(sl, "이번 사업은 Elasticsearch 구축도, RAG 구축도, 데이터 레이크 구축도 아닙니다.",
                Cm(1.5), concl_y + Cm(0.2), SLIDE_W - Cm(3), Cm(0.7),
                font_size=14, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
    add_textbox(sl, "은행의 판단 체계를 AI 기반으로 재설계하는 — 첫 번째 인프라 사업입니다.",
                Cm(1.5), concl_y + Cm(0.85), SLIDE_W - Cm(3), Cm(0.9),
                font_size=18, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    add_footer(sl, 1)


# ─── 슬라이드 2: 3축 × 3행위 매트릭스 ──────────────────────────────────────────

def slide_02_matrix(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    # ── 상단 헤더 띠 ──────────────────────────────────────────────────────
    add_rect(sl, 0, 0, SLIDE_W, Cm(2.6), NAVY2)
    add_rect(sl, 0, 0, Cm(0.25), Cm(2.6), CYAN)

    add_rect(sl, Cm(1.2), Cm(0.45), Cm(4.5), Cm(0.55), CYAN)
    add_textbox(sl, "OUR ANSWER  ·  3축 × 3행위 매트릭스",
                Cm(1.2), Cm(0.45), Cm(4.5), Cm(0.55),
                font_size=9, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    add_textbox(sl, "고객 · 직원 · 리스크를 하나의 AI Ready 기반 위에 연결합니다",
                Cm(1.2), Cm(1.05), SLIDE_W - Cm(2.4), Cm(1.1),
                font_size=22, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_textbox(sl, "Enterprise AI Operating Foundation",
                Cm(1.2), Cm(1.95), SLIDE_W - Cm(2.4), Cm(0.55),
                font_size=11, color=CYAN, align=PP_ALIGN.LEFT)

    # ── 매트릭스 영역 ─────────────────────────────────────────────────────
    # 4열 (라벨 + 3 process), 4행 (헤더 + 3 axis)
    mtx_x = Cm(1.2)
    mtx_y = Cm(3.2)
    mtx_w = SLIDE_W - Cm(2.4)
    label_col_w = Cm(7.2)
    proc_col_w = (mtx_w - label_col_w) / 3
    header_row_h = Cm(1.5)
    axis_row_h = Cm(3.0)

    # ── 상단 헤더 행 (수집 / 저장 / 가공) ────────────────────────────────
    process_headers = [
        ("수집", "흩어진 비정형 데이터 통합", "은행의 암묵지를 디지털화", CYAN),
        ("저장", "AI 활용 가능한 구조화", "'AI Ready 자산 관리 체계'", CYAN),
        ("가공", "AI가 판단 가능한 형태", "비정형 데이터의 AI Ready 化", ORANGE),
    ]
    # 좌상단 공백 셀
    add_rect(sl, mtx_x, mtx_y, label_col_w, header_row_h, NAVY2, MID_BLUE, Pt(0.5))
    add_textbox(sl, "3대 의사결정 축",
                mtx_x, mtx_y + Cm(0.1), label_col_w, Cm(0.6),
                font_size=10, color=DARK_TEXT, align=PP_ALIGN.CENTER)
    add_textbox(sl, "▼  3대 데이터 공정 (수집 → 저장 → 가공)  ▶",
                mtx_x, mtx_y + Cm(0.7), label_col_w, Cm(0.7),
                font_size=10, bold=True, color=CYAN, align=PP_ALIGN.CENTER)

    for i, (name, desc, msg, accent) in enumerate(process_headers):
        cx = mtx_x + label_col_w + i * proc_col_w
        add_rect(sl, cx, mtx_y, proc_col_w, header_row_h, NAVY3, accent, Pt(0.75))
        add_textbox(sl, name,
                    cx, mtx_y + Cm(0.1), proc_col_w, Cm(0.6),
                    font_size=16, bold=True, color=accent, align=PP_ALIGN.CENTER)
        add_textbox(sl, desc,
                    cx, mtx_y + Cm(0.7), proc_col_w, Cm(0.4),
                    font_size=9, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)
        add_textbox(sl, msg,
                    cx, mtx_y + Cm(1.05), proc_col_w, Cm(0.4),
                    font_size=8, bold=True, italic=True, color=accent, align=PP_ALIGN.CENTER)

    # ── 3행 (고객 / 직원 / 리스크) ────────────────────────────────────────
    axes = [
        # (이름, 의미, Agent 유형, 컬러, 9칸 채울 내용 [수집, 저장, 가공])
        ("고객", "수익 창출", "초개인화 상담 Agent", CYAN,
         ["상담 로그 · VoC 통합",
          "손님 컨텍스트 자산화",
          "초개인화 Prompt-Ready"]),
        ("직원", "생산성 혁신", "업무 실행 Agent", YELLOW,
         ["규정·매뉴얼·업무지식 수집",
          "업무 지식 그래프 구축",
          "업무 흐름별 Skill 화"]),
        ("리스크", "은행 생존", "판단·통제 Agent", ORANGE,
         ["심사·사고·감사 데이터 통합",
          "통제 이력 자산화",
          "판단 근거 추적 가능화"]),
    ]
    ry = mtx_y + header_row_h
    for axis_name, meaning, agent_type, axis_color, cells in axes:
        # 좌측 axis 라벨 셀
        add_rect(sl, mtx_x, ry, label_col_w, axis_row_h, NAVY2, axis_color, Pt(0.75))
        # 좌측 컬러 바
        add_rect(sl, mtx_x, ry, Cm(0.2), axis_row_h, axis_color)
        add_textbox(sl, axis_name,
                    mtx_x + Cm(0.4), ry + Cm(0.25), label_col_w - Cm(0.6), Cm(0.85),
                    font_size=22, bold=True, color=axis_color, align=PP_ALIGN.LEFT)
        add_textbox(sl, meaning,
                    mtx_x + Cm(0.4), ry + Cm(1.15), label_col_w - Cm(0.6), Cm(0.55),
                    font_size=10, color=DARK_TEXT, align=PP_ALIGN.LEFT)
        add_textbox(sl, "▸  " + agent_type,
                    mtx_x + Cm(0.4), ry + Cm(1.75), label_col_w - Cm(0.6), Cm(0.7),
                    font_size=12, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

        # 우측 3개 셀 (수집/저장/가공)
        for i, content in enumerate(cells):
            cx = mtx_x + label_col_w + i * proc_col_w
            # 가공 컬럼 (마지막)은 강조
            is_emphasis = (i == 2)
            cell_bg = NAVY3 if is_emphasis else NAVY2
            border = ORANGE if is_emphasis else MID_BLUE
            add_rect(sl, cx, ry, proc_col_w, axis_row_h, cell_bg, border, Pt(0.5))
            # 상단 작은 인디케이터
            add_rect(sl, cx + Cm(0.3), ry + Cm(0.3),
                     Cm(0.25), Cm(0.25), axis_color)
            color = ORANGE if is_emphasis else WHITE
            bold = is_emphasis
            add_textbox(sl, content,
                        cx + Cm(0.4), ry + Cm(0.8), proc_col_w - Cm(0.5), axis_row_h - Cm(1.0),
                        font_size=12, bold=bold, color=color, align=PP_ALIGN.LEFT)
        ry += axis_row_h

    # ── 하단 결론 띠 ──────────────────────────────────────────────────────
    concl_y = SLIDE_H - Cm(3.0)
    add_rect(sl, Cm(1.2), concl_y, SLIDE_W - Cm(2.4), Cm(1.55), CYAN)
    add_textbox(sl,
                "우리는 단순 RAG가 아닌, 비정형 데이터를 AI 실행 자산으로 전환하는",
                Cm(1.5), concl_y + Cm(0.15), SLIDE_W - Cm(3), Cm(0.6),
                font_size=12, color=NAVY, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "Enterprise AI Operating Foundation 을 구축합니다.",
                Cm(1.5), concl_y + Cm(0.65), SLIDE_W - Cm(3), Cm(0.85),
                font_size=20, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
    # 우측 사인
    add_textbox(sl, "Ready to AI  ·  KT B2B 수주전략팀",
                SLIDE_W - Cm(11), concl_y + Cm(0.9), Cm(9.5), Cm(0.6),
                font_size=10, bold=True, color=NAVY, align=PP_ALIGN.RIGHT)

    # 핵심 한 문장 (오렌지 띠)
    quote_y = SLIDE_H - Cm(1.25)
    add_rect(sl, Cm(1.2), quote_y, SLIDE_W - Cm(2.4), Cm(0.05), ORANGE)

    add_footer(sl, 2)


# ─── 메인 ────────────────────────────────────────────────────────────────────────

def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    slide_01_diagnosis(prs)
    slide_02_matrix(prs)

    out = "/home/user/strategy-pipeline/하나은행_AI_통제하는금융.pptx"
    prs.save(out)
    print(f"✓ Saved: {out}")


if __name__ == "__main__":
    main()
