#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
하나은행 관통 장표 2장 — "AI를 통제하는 금융, 하나은행"
slide 1: 대고객·대직원·리스크 → AI 통제 비정형 데이터 플랫폼 구조도
slide 2: 데이터 출처 → 수집·저장·가공·활용 통제 파이프라인 구조도
"""

from pptx import Presentation
from pptx.util import Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# ─── 팔레트 ──────────────────────────────────────────────────────────────────────
NAVY        = RGBColor(0x0A, 0x16, 0x28)
NAVY2       = RGBColor(0x0D, 0x1F, 0x3C)
NAVY3       = RGBColor(0x13, 0x2A, 0x4D)
NAVY4       = RGBColor(0x18, 0x33, 0x5A)
CYAN        = RGBColor(0x00, 0xD4, 0xFF)
CYAN_DIM    = RGBColor(0x00, 0x88, 0xA8)
ORANGE      = RGBColor(0xFF, 0x6B, 0x35)
YELLOW      = RGBColor(0xFF, 0xD7, 0x00)
GREEN       = RGBColor(0x00, 0xE0, 0x96)
PURPLE      = RGBColor(0xB4, 0x6B, 0xFF)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY  = RGBColor(0xCC, 0xD6, 0xE0)
MID_BLUE    = RGBColor(0x1A, 0x4A, 0x7A)
DARK_TEXT   = RGBColor(0xA0, 0xB8, 0xCC)

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


def add_rect(slide, x, y, w, h, fill_color, line_color=None, line_width=None, shape=MSO_SHAPE.RECTANGLE):
    sh = slide.shapes.add_shape(shape, x, y, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill_color
    if line_color:
        sh.line.color.rgb = line_color
        if line_width:
            sh.line.width = line_width
    else:
        sh.line.fill.background()
    return sh


def add_textbox(slide, text, x, y, w, h,
                font_size=12, bold=False, color=WHITE,
                align=PP_ALIGN.LEFT, italic=False):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = True
    tf = txb.text_frame
    tf.word_wrap = True
    tf.margin_left = Cm(0.08)
    tf.margin_right = Cm(0.08)
    tf.margin_top = Cm(0.04)
    tf.margin_bottom = Cm(0.04)
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


def add_arrow_down(slide, x, y, w, h, color):
    """아래 방향 화살표"""
    sh = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, x, y, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    return sh


def add_arrow_right(slide, x, y, w, h, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x, y, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    return sh


def add_chevron_right(slide, x, y, w, h, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, x, y, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    return sh


def add_footer(slide, page_num):
    add_rect(slide, Cm(1.5), SLIDE_H - Cm(1.0),
             SLIDE_W - Cm(3), Cm(0.04), MID_BLUE)
    add_textbox(slide, FOOTER_TEXT,
                Cm(1.5), SLIDE_H - Cm(0.9),
                SLIDE_W - Cm(5), Cm(0.7),
                font_size=8, color=DARK_TEXT, align=PP_ALIGN.LEFT)
    add_textbox(slide, f"{page_num} / 2",
                SLIDE_W - Cm(3.5), SLIDE_H - Cm(0.9),
                Cm(2), Cm(0.7),
                font_size=8, color=DARK_TEXT, align=PP_ALIGN.RIGHT)


def header_band(slide, tag_text, title_text, subtitle_text):
    """슬라이드 상단 캐치프레이즈 띠"""
    add_rect(slide, 0, 0, SLIDE_W, Cm(2.6), NAVY2)
    add_rect(slide, 0, 0, Cm(0.25), Cm(2.6), CYAN)

    add_rect(slide, Cm(1.2), Cm(0.45), Cm(5.5), Cm(0.55), CYAN)
    add_textbox(slide, tag_text,
                Cm(1.2), Cm(0.45), Cm(5.5), Cm(0.55),
                font_size=9, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_textbox(slide, title_text,
                Cm(1.2), Cm(1.05), SLIDE_W - Cm(2.4), Cm(1.0),
                font_size=22, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_textbox(slide, subtitle_text,
                Cm(1.2), Cm(1.95), SLIDE_W - Cm(2.4), Cm(0.55),
                font_size=11, color=CYAN, align=PP_ALIGN.LEFT)


# ─── 슬라이드 1 — 4-Layer 구조도 ───────────────────────────────────────────────

def slide_01_architecture(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    header_band(sl,
                "MASTER ARCHITECTURE  ·  AI를 통제하는 비정형 데이터 플랫폼",
                "대고객 · 대직원 · 리스크를 구조적으로 해결하는 단 하나의 플랫폼",
                "AI를 통제하는 금융, 하나은행 — 통제된 AI Agent 위에서 모든 판단이 움직인다")

    # ── 다이어그램 영역 ────────────────────────────────────────────────────
    diag_x = Cm(1.2)
    diag_y = Cm(3.0)
    diag_w = SLIDE_W - Cm(2.4)

    # ── Layer A (Top): 통제된 AI Agent 결과 ───────────────────────────────
    la_y = diag_y
    la_h = Cm(2.6)

    # 좌측 레이블
    label_w = Cm(4.5)
    add_rect(sl, diag_x, la_y, label_w, la_h, NAVY3, CYAN, Pt(0.75))
    add_textbox(sl, "LAYER A",
                diag_x, la_y + Cm(0.2), label_w, Cm(0.5),
                font_size=9, bold=True, color=CYAN, align=PP_ALIGN.CENTER)
    add_textbox(sl, "통제된 AI Agent",
                diag_x, la_y + Cm(0.7), label_w, Cm(0.7),
                font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(sl, "각 도메인 의사결정 실행",
                diag_x, la_y + Cm(1.4), label_w, Cm(0.5),
                font_size=9, color=DARK_TEXT, align=PP_ALIGN.CENTER)

    # 우측 3개 Agent 박스
    cards_x = diag_x + label_w + Cm(0.4)
    cards_w = diag_w - label_w - Cm(0.4)
    card_w = (cards_w - Cm(0.6)) / 3

    agent_cards = [
        ("대고객", "초개인화 상담 Agent", "손님 맥락 즉시 파악 · 상품 추천", CYAN),
        ("대직원", "업무 실행 Agent", "문서·규정·업무 자동화", YELLOW),
        ("리스크", "판단·통제 Agent", "사고 예방 · 준법 · 심사 추적", ORANGE),
    ]
    for i, (domain, agent, desc, color) in enumerate(agent_cards):
        cx = cards_x + i * (card_w + Cm(0.3))
        add_rect(sl, cx, la_y, card_w, la_h, NAVY2, color, Pt(1.0))
        # 좌측 컬러바
        add_rect(sl, cx, la_y, Cm(0.2), la_h, color)
        # 도메인 태그
        add_rect(sl, cx + Cm(0.5), la_y + Cm(0.25), Cm(2.0), Cm(0.5), color)
        add_textbox(sl, domain,
                    cx + Cm(0.5), la_y + Cm(0.25), Cm(2.0), Cm(0.5),
                    font_size=10, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        # Agent 명
        add_textbox(sl, agent,
                    cx + Cm(0.4), la_y + Cm(0.95), card_w - Cm(0.6), Cm(0.8),
                    font_size=15, bold=True, color=color, align=PP_ALIGN.LEFT)
        add_textbox(sl, "▸  " + desc,
                    cx + Cm(0.4), la_y + Cm(1.75), card_w - Cm(0.6), Cm(0.6),
                    font_size=10, color=LIGHT_GRAY, align=PP_ALIGN.LEFT)

    # ── 화살표 1 (Layer A ← Layer B) ──────────────────────────────────────
    arr_y = la_y + la_h + Cm(0.1)
    for i in range(3):
        ax = cards_x + i * (card_w + Cm(0.3)) + card_w/2 - Cm(0.4)
        add_arrow_down(sl, ax, arr_y, Cm(0.8), Cm(0.55), CYAN_DIM)

    # ── Layer B: AI Governance Layer (통제 계층) ─────────────────────────
    lb_y = arr_y + Cm(0.7)
    lb_h = Cm(2.4)

    add_rect(sl, diag_x, lb_y, label_w, lb_h, NAVY3, PURPLE, Pt(0.75))
    add_textbox(sl, "LAYER B",
                diag_x, lb_y + Cm(0.2), label_w, Cm(0.5),
                font_size=9, bold=True, color=PURPLE, align=PP_ALIGN.CENTER)
    add_textbox(sl, "AI Governance",
                diag_x, lb_y + Cm(0.7), label_w, Cm(0.7),
                font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(sl, "통제 · 출처 · 감사",
                diag_x, lb_y + Cm(1.4), label_w, Cm(0.5),
                font_size=9, color=DARK_TEXT, align=PP_ALIGN.CENTER)

    # 거버넌스 5개 통제 컴포넌트
    gov_items = [
        ("출처 추적", "Provenance"),
        ("접근 통제", "Access Control"),
        ("정책 엔진", "Policy"),
        ("응답 검증", "Validation"),
        ("감사 로그", "Audit Trail"),
    ]
    gov_w = (cards_w - Cm(0.4)) / 5
    for i, (ko, en) in enumerate(gov_items):
        gx = cards_x + i * (gov_w + Cm(0.1))
        add_rect(sl, gx, lb_y, gov_w, lb_h, NAVY2, PURPLE, Pt(0.75))
        # 작은 아이콘 자리 (원형)
        add_rect(sl, gx + gov_w/2 - Cm(0.35), lb_y + Cm(0.3), Cm(0.7), Cm(0.7),
                 PURPLE, shape=MSO_SHAPE.OVAL)
        add_textbox(sl, ko,
                    gx, lb_y + Cm(1.1), gov_w, Cm(0.6),
                    font_size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        add_textbox(sl, en,
                    gx, lb_y + Cm(1.7), gov_w, Cm(0.5),
                    font_size=8, color=DARK_TEXT, italic=True, align=PP_ALIGN.CENTER)

    # ── 화살표 2 ──────────────────────────────────────────────────────────
    arr2_y = lb_y + lb_h + Cm(0.1)
    add_arrow_down(sl, cards_x + cards_w/2 - Cm(0.4), arr2_y, Cm(0.8), Cm(0.55), PURPLE)
    add_textbox(sl, "거버넌스가 통과한 데이터만 Agent에게 노출",
                cards_x, arr2_y, cards_w, Cm(0.55),
                font_size=9, italic=True, color=PURPLE, align=PP_ALIGN.CENTER)

    # ── Layer C: AI Ready 데이터 자산화 계층 ──────────────────────────────
    lc_y = arr2_y + Cm(0.7)
    lc_h = Cm(1.8)

    add_rect(sl, diag_x, lc_y, label_w, lc_h, NAVY3, GREEN, Pt(0.75))
    add_textbox(sl, "LAYER C",
                diag_x, lc_y + Cm(0.15), label_w, Cm(0.45),
                font_size=9, bold=True, color=GREEN, align=PP_ALIGN.CENTER)
    add_textbox(sl, "AI Ready 자산",
                diag_x, lc_y + Cm(0.55), label_w, Cm(0.6),
                font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(sl, "정형화 · 임베딩 · 메타데이터",
                diag_x, lc_y + Cm(1.15), label_w, Cm(0.5),
                font_size=9, color=DARK_TEXT, align=PP_ALIGN.CENTER)

    add_rect(sl, cards_x, lc_y, cards_w, lc_h, NAVY4, GREEN, Pt(1.0))
    add_textbox(sl,
                "비정형 데이터 → 임베딩 · 청크 · 메타데이터 · 분류 · 출처 태그가 부착된 AI Ready Data Asset",
                cards_x, lc_y + Cm(0.2), cards_w, Cm(0.7),
                font_size=13, bold=True, color=GREEN, align=PP_ALIGN.CENTER)
    add_textbox(sl,
                "공통 데이터 기반 — 부서별 사일로 제거, 조직 전체가 동일 컨텍스트 공유",
                cards_x, lc_y + Cm(0.95), cards_w, Cm(0.6),
                font_size=11, color=WHITE, italic=True, align=PP_ALIGN.CENTER)

    # ── 화살표 3 ──────────────────────────────────────────────────────────
    arr3_y = lc_y + lc_h + Cm(0.1)
    add_arrow_down(sl, cards_x + cards_w/2 - Cm(0.4), arr3_y, Cm(0.8), Cm(0.5), GREEN)

    # ── Layer D: 원천 비정형 데이터 ───────────────────────────────────────
    ld_y = arr3_y + Cm(0.65)
    ld_h = Cm(2.3)

    add_rect(sl, diag_x, ld_y, label_w, ld_h, NAVY3, MID_BLUE, Pt(0.75))
    add_textbox(sl, "LAYER D",
                diag_x, ld_y + Cm(0.2), label_w, Cm(0.5),
                font_size=9, bold=True, color=DARK_TEXT, align=PP_ALIGN.CENTER)
    add_textbox(sl, "원천 비정형 데이터",
                diag_x, ld_y + Cm(0.7), label_w, Cm(0.7),
                font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(sl, "도메인별 raw source",
                diag_x, ld_y + Cm(1.4), label_w, Cm(0.5),
                font_size=9, color=DARK_TEXT, align=PP_ALIGN.CENTER)

    raw_items = [
        ("대고객 raw", "상담 로그 · VoC · 거래 메모 · 손님 동의서 · 영업 보고서", CYAN),
        ("대직원 raw", "내규 · 매뉴얼 · 업무 지식 · 결재 문서 · 회의록", YELLOW),
        ("리스크 raw", "심사 보고서 · 사고 사례 · 감사 의견 · 법규 변경", ORANGE),
    ]
    for i, (name, desc, color) in enumerate(raw_items):
        rx = cards_x + i * (card_w + Cm(0.3))
        add_rect(sl, rx, ld_y, card_w, ld_h, NAVY2, color, Pt(0.75))
        add_rect(sl, rx, ld_y, Cm(0.2), ld_h, color)
        add_textbox(sl, name,
                    rx + Cm(0.4), ld_y + Cm(0.3), card_w - Cm(0.6), Cm(0.7),
                    font_size=13, bold=True, color=color, align=PP_ALIGN.LEFT)
        add_textbox(sl, desc,
                    rx + Cm(0.4), ld_y + Cm(1.05), card_w - Cm(0.6), Cm(1.2),
                    font_size=10, color=LIGHT_GRAY, align=PP_ALIGN.LEFT)

    add_footer(sl, 1)


# ─── 슬라이드 2 — 수집~활용 통제 파이프라인 구조도 ──────────────────────────────

def slide_02_pipeline(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    header_band(sl,
                "CONTROLLABLE AI PIPELINE  ·  데이터 출처부터 활용까지",
                "데이터 출처를 명확히 하는 — 통제 가능한 AI를 위한 구조",
                "수집 단계부터 출처가 박힌다 — 모든 AI 응답이 추적 가능해야 통제할 수 있다")

    # ── 다이어그램 영역 ────────────────────────────────────────────────────
    diag_x = Cm(1.2)
    diag_y = Cm(3.0)
    diag_w = SLIDE_W - Cm(2.4)

    # ── 4-stage 파이프라인 ────────────────────────────────────────────────
    stages = [
        ("수집", "Ingest",
         "원천 → 출처 태그 부착",
         ["• 출처(source) 기록",
          "• 소유 부서·작성자",
          "• 분류·민감도 등급",
          "• 작성 시점 메타"],
         CYAN),
        ("저장", "Govern",
         "출처 보존 + 접근 통제",
         ["• 접근 권한 매트릭스",
          "• 버전 관리·이력",
          "• 감사 로그 자동 적재",
          "• 보존 기간 정책"],
         PURPLE),
        ("가공", "Process",
         "AI Ready化 + 정합성 검증",
         ["• 비식별화·마스킹",
          "• 청킹 + 임베딩",
          "• 출처 메타 동행 전이",
          "• 정합성 2-Pass 검증"],
         GREEN),
        ("활용", "Serve",
         "출처 인용 + 응답 검증",
         ["• 출처 인용 강제",
          "• 정책 엔진 사전 차단",
          "• 응답 추적 가능 (XAI)",
          "• 피드백 → 재학습"],
         ORANGE),
    ]

    # 통제축 (vertical lines across all stages) - 위쪽
    ctrl_y = diag_y
    ctrl_h = Cm(1.4)
    ctrl_axes = [
        ("출처 (Provenance)", "어디서 왔는지", YELLOW),
        ("감사 (Audit)",      "무엇이 일어났는지", PURPLE),
        ("접근 (Access)",     "누가 볼 수 있는지", CYAN),
        ("품질 (Quality)",    "신뢰할 수 있는지", GREEN),
    ]
    add_rect(sl, diag_x, ctrl_y, diag_w, ctrl_h, NAVY3, MID_BLUE, Pt(0.5))
    add_textbox(sl, "▼  4대 통제축 — 모든 단계를 관통하며 적용 (Cross-cutting Controls)",
                diag_x + Cm(0.2), ctrl_y + Cm(0.1), diag_w - Cm(0.4), Cm(0.4),
                font_size=9, italic=True, color=DARK_TEXT, align=PP_ALIGN.LEFT)
    ctrl_w = (diag_w - Cm(0.4)) / 4
    for i, (name, desc, color) in enumerate(ctrl_axes):
        cx = diag_x + Cm(0.2) + i * ctrl_w
        # 컬러 닷
        add_rect(sl, cx + Cm(0.1), ctrl_y + Cm(0.55), Cm(0.3), Cm(0.3),
                 color, shape=MSO_SHAPE.OVAL)
        add_textbox(sl, name,
                    cx + Cm(0.5), ctrl_y + Cm(0.5), ctrl_w - Cm(0.5), Cm(0.5),
                    font_size=11, bold=True, color=color, align=PP_ALIGN.LEFT)
        add_textbox(sl, desc,
                    cx + Cm(0.5), ctrl_y + Cm(0.95), ctrl_w - Cm(0.5), Cm(0.4),
                    font_size=8, color=LIGHT_GRAY, italic=True, align=PP_ALIGN.LEFT)

    # ── Pipeline 단계들 ───────────────────────────────────────────────────
    pipe_y = ctrl_y + ctrl_h + Cm(0.3)
    pipe_h = Cm(6.3)

    # 가로로 4단계 + 사이에 화살표
    gap = Cm(0.25)
    stage_w = (diag_w - 3 * gap) / 4

    for i, (ko, en, sub, items, color) in enumerate(stages):
        sx = diag_x + i * (stage_w + gap)

        # 카드 본체
        add_rect(sl, sx, pipe_y, stage_w, pipe_h, NAVY2, color, Pt(1.0))
        # 상단 컬러 헤더 바
        add_rect(sl, sx, pipe_y, stage_w, Cm(1.4), color)
        add_textbox(sl, f"{i+1}",
                    sx + Cm(0.3), pipe_y + Cm(0.1), Cm(0.8), Cm(0.5),
                    font_size=10, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
        add_textbox(sl, ko,
                    sx, pipe_y + Cm(0.15), stage_w, Cm(0.7),
                    font_size=18, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        add_textbox(sl, en,
                    sx, pipe_y + Cm(0.85), stage_w, Cm(0.45),
                    font_size=9, italic=True, color=NAVY, align=PP_ALIGN.CENTER)
        # 부제
        add_textbox(sl, sub,
                    sx + Cm(0.3), pipe_y + Cm(1.55), stage_w - Cm(0.6), Cm(0.7),
                    font_size=11, bold=True, color=color, align=PP_ALIGN.LEFT)
        # 구분선
        add_rect(sl, sx + Cm(0.3), pipe_y + Cm(2.25),
                 stage_w - Cm(0.6), Cm(0.04), color)
        # 항목들
        iy = pipe_y + Cm(2.4)
        for item in items:
            add_textbox(sl, item,
                        sx + Cm(0.3), iy, stage_w - Cm(0.6), Cm(0.55),
                        font_size=10, color=WHITE, align=PP_ALIGN.LEFT)
            iy += Cm(0.55)
        # 데이터 상태 라벨 (하단)
        state_y = pipe_y + pipe_h - Cm(0.8)
        states = ["raw + meta", "stored + audit", "ai-ready", "served + cited"]
        add_rect(sl, sx + Cm(0.3), state_y, stage_w - Cm(0.6), Cm(0.5), color)
        add_textbox(sl, "→ " + states[i],
                    sx + Cm(0.3), state_y, stage_w - Cm(0.6), Cm(0.5),
                    font_size=9, bold=True, italic=True, color=NAVY, align=PP_ALIGN.CENTER)

        # 화살표 (마지막 단계 뒤에는 없음)
        if i < 3:
            arr_x = sx + stage_w + Cm(0.02)
            arr_y_pos = pipe_y + pipe_h/2 - Cm(0.4)
            add_chevron_right(sl, arr_x, arr_y_pos, Cm(0.20), Cm(0.8), color)

    # ── 하단 결론 띠 ──────────────────────────────────────────────────────
    concl_y = pipe_y + pipe_h + Cm(0.35)
    add_rect(sl, diag_x, concl_y, diag_w, Cm(1.5), CYAN)
    add_textbox(sl,
                "출처가 박힌 데이터만 학습되고, 인용 가능한 응답만 사용자에게 전달된다",
                diag_x + Cm(0.4), concl_y + Cm(0.15), diag_w - Cm(0.8), Cm(0.6),
                font_size=12, color=NAVY, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "→ 이것이 '통제 가능한 AI' 의 유일한 구현 방법입니다",
                diag_x + Cm(0.4), concl_y + Cm(0.7), diag_w - Cm(0.8), Cm(0.7),
                font_size=18, bold=True, color=NAVY, align=PP_ALIGN.LEFT)

    add_footer(sl, 2)


# ─── 메인 ────────────────────────────────────────────────────────────────────────

def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    slide_01_architecture(prs)
    slide_02_pipeline(prs)

    out = "/home/user/strategy-pipeline/하나은행_AI_통제하는금융.pptx"
    prs.save(out)
    print(f"✓ Saved: {out}")


if __name__ == "__main__":
    main()
