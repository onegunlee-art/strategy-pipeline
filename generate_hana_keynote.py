#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
하나은행 관통 장표 2장 — "AI 시대 금융의 통제권 전쟁"
slide 1: Why Now × Why KT — 통제권 전쟁의 답
slide 2: 통제 × 운영 — AI는 구축이 아니라 운영에서 무너진다
"""

from pptx import Presentation
from pptx.util import Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# ─── 팔레트 ──────────────────────────────────────────────────────────────────────
NAVY        = RGBColor(0x07, 0x10, 0x1E)   # 더 어두운 네이비 (긴장감)
NAVY2       = RGBColor(0x0D, 0x1F, 0x3C)
NAVY3       = RGBColor(0x13, 0x2A, 0x4D)
NAVY4       = RGBColor(0x18, 0x33, 0x5A)
CYAN        = RGBColor(0x00, 0xD4, 0xFF)
CYAN_DIM    = RGBColor(0x00, 0x88, 0xA8)
ORANGE      = RGBColor(0xFF, 0x6B, 0x35)
YELLOW      = RGBColor(0xFF, 0xD7, 0x00)
GOLD        = RGBColor(0xE5, 0xB2, 0x2D)
GREEN       = RGBColor(0x00, 0xE0, 0x96)
PURPLE      = RGBColor(0xB4, 0x6B, 0xFF)
RED         = RGBColor(0xFF, 0x4D, 0x4D)
RED_DEEP    = RGBColor(0xB8, 0x2A, 0x2A)
KT_RED      = RGBColor(0xE3, 0x14, 0x35)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY  = RGBColor(0xCC, 0xD6, 0xE0)
MID_BLUE    = RGBColor(0x1A, 0x4A, 0x7A)
DARK_TEXT   = RGBColor(0xA0, 0xB8, 0xCC)

FONT_KO = "맑은 고딕"
SLIDE_W = Cm(33.87)
SLIDE_H = Cm(19.05)
FOOTER_TEXT = "하나은행 비정형 데이터 자산화 플랫폼 제안  |  2026.05  |  KT B2B 수주전략팀"


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


def add_rich_textbox(slide, runs, x, y, w, h, align=PP_ALIGN.LEFT):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = True
    tf = txb.text_frame
    tf.word_wrap = True
    tf.margin_left = Cm(0.1)
    tf.margin_right = Cm(0.1)
    tf.margin_top = Cm(0.05)
    tf.margin_bottom = Cm(0.05)
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


def add_chevron(slide, x, y, w, h, color):
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


# ─── 슬라이드 1: Why Now × Why KT ───────────────────────────────────────────────

def slide_01_war(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    # ── 상단 헤더 띠 ──────────────────────────────────────────────────────
    add_rect(sl, 0, 0, SLIDE_W, Cm(3.4), NAVY2)
    add_rect(sl, 0, 0, Cm(0.25), Cm(3.4), KT_RED)

    # 경고 태그
    add_rect(sl, Cm(1.2), Cm(0.45), Cm(8.0), Cm(0.55), KT_RED)
    add_textbox(sl, "AI 시대 금융의 통제권 전쟁  ·  WHY NOW",
                Cm(1.2), Cm(0.45), Cm(8.0), Cm(0.55),
                font_size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # 메인 헤드라인 (강렬한 문구)
    add_textbox(sl,
                "AI는 이미 충분히 똑똑해졌습니다. 이제 경쟁력은 통제력입니다.",
                Cm(1.2), Cm(1.1), SLIDE_W - Cm(2.4), Cm(1.2),
                font_size=26, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    # 서브 — 굵게
    add_rich_textbox(sl, [
        ("은행은 ", 14, False, LIGHT_GRAY),
        ("답변하는 조직", 14, True, DARK_TEXT),
        ("이 아니라  ─  ", 14, False, LIGHT_GRAY),
        ("책임지는 조직", 14, True, GOLD),
        ("입니다.", 14, False, LIGHT_GRAY),
    ], Cm(1.2), Cm(2.5), SLIDE_W - Cm(2.4), Cm(0.7))

    # ── 좌·우 2 컬럼 영역 ────────────────────────────────────────────────
    col_y = Cm(3.85)
    col_h = Cm(11.2)
    gap = Cm(0.6)
    col_w = (SLIDE_W - Cm(2.4) - gap) / 2

    # ===== LEFT — AI Organizational Risk (위기감) =====
    lx = Cm(1.2)
    add_rect(sl, lx, col_y, col_w, col_h, NAVY2, RED, Pt(1.0))
    # 좌측 컬러바
    add_rect(sl, lx, col_y, Cm(0.18), col_h, RED)

    # 헤더
    add_rect(sl, lx + Cm(0.6), col_y + Cm(0.5), Cm(2.8), Cm(0.55), RED)
    add_textbox(sl, "AI ORGANIZATIONAL RISK",
                lx + Cm(0.6), col_y + Cm(0.5), Cm(2.8), Cm(0.55),
                font_size=8, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    add_textbox(sl, "은행이 직면한 진짜 공포",
                lx + Cm(0.6), col_y + Cm(1.15), col_w - Cm(1.2), Cm(0.8),
                font_size=18, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "기술 문제가 아닙니다. 은행의 의사결정 구조가 흔들리는 문제입니다.",
                lx + Cm(0.6), col_y + Cm(1.95), col_w - Cm(1.2), Cm(0.55),
                font_size=11, italic=True, color=RED, align=PP_ALIGN.LEFT)

    # 4개 공포 박스
    fears = [
        ("Q1", "AI가 잘못 판단하면",        "— 누가 책임지는가?"),
        ("Q2", "직원이 AI만 믿기 시작하면", "— 조직의 판단력은 어디로?"),
        ("Q3", "최신 규정과 충돌하는 답변이 나가면", "— 어떻게 막는가?"),
        ("Q4", "감사 시점에 재현이 불가능하면", "— 통제는 존재했다고 할 수 있는가?"),
    ]
    fy = col_y + Cm(2.75)
    fh = Cm(1.85)
    for i, (qid, body, suffix) in enumerate(fears):
        add_rect(sl, lx + Cm(0.6), fy, col_w - Cm(1.2), fh, NAVY3, RED_DEEP, Pt(0.5))
        # Q번호
        add_rect(sl, lx + Cm(0.8), fy + Cm(0.3), Cm(1.1), Cm(0.7), RED_DEEP)
        add_textbox(sl, qid,
                    lx + Cm(0.8), fy + Cm(0.3), Cm(1.1), Cm(0.7),
                    font_size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        # 본문
        add_textbox(sl, body,
                    lx + Cm(2.1), fy + Cm(0.25), col_w - Cm(2.8), Cm(0.7),
                    font_size=13, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
        add_textbox(sl, suffix,
                    lx + Cm(2.1), fy + Cm(0.95), col_w - Cm(2.8), Cm(0.7),
                    font_size=13, bold=True, color=RED, align=PP_ALIGN.LEFT)
        fy += fh + Cm(0.15)

    # ===== RIGHT — Why KT (정체성) =====
    rx = lx + col_w + gap
    add_rect(sl, rx, col_y, col_w, col_h, NAVY2, CYAN, Pt(1.0))
    add_rect(sl, rx, col_y, Cm(0.18), col_h, CYAN)

    # 헤더
    add_rect(sl, rx + Cm(0.6), col_y + Cm(0.5), Cm(2.8), Cm(0.55), CYAN)
    add_textbox(sl, "WHY KT",
                rx + Cm(0.6), col_y + Cm(0.5), Cm(2.8), Cm(0.55),
                font_size=10, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    add_textbox(sl, "통제권 전쟁의 답 — KT의 정체성",
                rx + Cm(0.6), col_y + Cm(1.15), col_w - Cm(1.2), Cm(0.8),
                font_size=18, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    # KT identity declaration (큰 인용)
    decl_y = col_y + Cm(2.0)
    decl_h = Cm(2.2)
    add_rect(sl, rx + Cm(0.6), decl_y, col_w - Cm(1.2), decl_h, NAVY4, GOLD, Pt(0.75))
    # 인용 마크
    add_rect(sl, rx + Cm(0.6), decl_y, Cm(0.08), decl_h, GOLD)
    add_textbox(sl,
                "KT는 AI를 화려하게 만드는 회사가 아닙니다.",
                rx + Cm(0.9), decl_y + Cm(0.3), col_w - Cm(1.8), Cm(0.7),
                font_size=14, color=LIGHT_GRAY, italic=True, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "멈추면 안 되는 시스템을 운영해온 회사입니다.",
                rx + Cm(0.9), decl_y + Cm(1.0), col_w - Cm(1.8), Cm(0.9),
                font_size=18, bold=True, color=GOLD, align=PP_ALIGN.LEFT)

    # KT 정체성 4개 증거 (2x2 그리드)
    proofs = [
        ("국가 인프라 DNA",   "통신망 24×365 운영",      "장애 = 국가 단위 영향"),
        ("미션 크리티컬 관제", "관제 · 장애 대응 · 이중화",  "멈춤이 허용되지 않는 운영"),
        ("금융 IT 실적",     "전 시중은행급 인프라 운영",  "규제 · 감사 대응 경험"),
        ("AI Foundation",   "자체 모델 + KT Cloud",      "외부 의존 없는 통제 가능"),
    ]
    py = decl_y + decl_h + Cm(0.3)
    pw = (col_w - Cm(1.2) - Cm(0.2)) / 2
    ph = (col_h - (py - col_y) - Cm(0.4)) / 2
    for i, (title, body, tag) in enumerate(proofs):
        row = i // 2
        col = i % 2
        pxn = rx + Cm(0.6) + col * (pw + Cm(0.2))
        pyn = py + row * (ph + Cm(0.15))
        add_rect(sl, pxn, pyn, pw, ph, NAVY3, CYAN, Pt(0.5))
        # 번호 닷
        add_rect(sl, pxn + Cm(0.3), pyn + Cm(0.3), Cm(0.4), Cm(0.4),
                 CYAN, shape=MSO_SHAPE.OVAL)
        add_textbox(sl, str(i+1),
                    pxn + Cm(0.3), pyn + Cm(0.3), Cm(0.4), Cm(0.4),
                    font_size=9, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        add_textbox(sl, title,
                    pxn + Cm(0.85), pyn + Cm(0.25), pw - Cm(1.0), Cm(0.6),
                    font_size=13, bold=True, color=CYAN, align=PP_ALIGN.LEFT)
        add_textbox(sl, body,
                    pxn + Cm(0.35), pyn + Cm(0.95), pw - Cm(0.5), Cm(0.55),
                    font_size=11, color=WHITE, align=PP_ALIGN.LEFT)
        add_textbox(sl, "▸  " + tag,
                    pxn + Cm(0.35), pyn + Cm(1.5), pw - Cm(0.5), Cm(0.55),
                    font_size=10, italic=True, color=GOLD, align=PP_ALIGN.LEFT)

    # ── 하단 결론 띠 ──────────────────────────────────────────────────────
    concl_y = SLIDE_H - Cm(2.7)
    add_rect(sl, Cm(1.2), concl_y, SLIDE_W - Cm(2.4), Cm(1.55), GOLD)
    add_textbox(sl,
                "통제권을 가진 자가 AI 시대 금융을 이깁니다",
                Cm(1.5), concl_y + Cm(0.15), SLIDE_W - Cm(3), Cm(0.9),
                font_size=22, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "AI를 통제하는 금융, 하나은행  ─  KT가 그 통제 인프라를 짓습니다",
                Cm(1.5), concl_y + Cm(0.95), SLIDE_W - Cm(3), Cm(0.55),
                font_size=12, color=NAVY, align=PP_ALIGN.LEFT)

    add_footer(sl, 1)


# ─── 슬라이드 2: 통제 × 운영 (구축이 아니라 운영) ──────────────────────────────

def slide_02_operation(prs):
    sl = blank_slide(prs)
    fill_bg(sl, NAVY)

    # ── 상단 헤더 띠 ──────────────────────────────────────────────────────
    add_rect(sl, 0, 0, SLIDE_W, Cm(3.4), NAVY2)
    add_rect(sl, 0, 0, Cm(0.25), Cm(3.4), GOLD)

    add_rect(sl, Cm(1.2), Cm(0.45), Cm(9.0), Cm(0.55), GOLD)
    add_textbox(sl, "통제 × 운영  ·  HOW WE WIN THE CONTROL WAR",
                Cm(1.2), Cm(0.45), Cm(9.0), Cm(0.55),
                font_size=10, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

    # 메인 헤드라인
    add_textbox(sl,
                "AI는 구축이 아니라 운영에서 무너집니다.",
                Cm(1.2), Cm(1.1), SLIDE_W - Cm(2.4), Cm(1.2),
                font_size=26, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    # 서브
    add_rich_textbox(sl, [
        ("초기 구축보다 ", 14, False, LIGHT_GRAY),
        ("장기 운영비", 14, True, ORANGE),
        ("가 무섭다  ─  지속 가능한 ", 14, False, LIGHT_GRAY),
        ("통제 체계", 14, True, CYAN),
        ("만이 답이다.", 14, False, LIGHT_GRAY),
    ], Cm(1.2), Cm(2.5), SLIDE_W - Cm(2.4), Cm(0.7))

    # ── 상단: 통제 가능한 AI 파이프라인 ───────────────────────────────────
    section_label_y = Cm(3.85)
    add_rect(sl, Cm(1.2), section_label_y, Cm(0.4), Cm(0.55), CYAN)
    add_textbox(sl, "PART 1.  통제 — 출처가 박힌 데이터만 학습하고, 인용 가능한 응답만 전달한다",
                Cm(1.8), section_label_y, SLIDE_W - Cm(3), Cm(0.55),
                font_size=12, bold=True, color=CYAN, align=PP_ALIGN.LEFT)

    # 통제축 띠 (얇게)
    ctrl_y = section_label_y + Cm(0.7)
    ctrl_h = Cm(0.9)
    add_rect(sl, Cm(1.2), ctrl_y, SLIDE_W - Cm(2.4), ctrl_h, NAVY3, MID_BLUE, Pt(0.5))
    axes = [("출처", YELLOW), ("감사", PURPLE), ("접근", CYAN), ("품질", GREEN)]
    add_textbox(sl, "▼  Cross-cutting Controls",
                Cm(1.5), ctrl_y + Cm(0.18), Cm(5), Cm(0.55),
                font_size=9, italic=True, color=DARK_TEXT, align=PP_ALIGN.LEFT)
    ax_x = Cm(8.0)
    for name, color in axes:
        add_rect(sl, ax_x, ctrl_y + Cm(0.28), Cm(0.3), Cm(0.3), color, shape=MSO_SHAPE.OVAL)
        add_textbox(sl, name,
                    ax_x + Cm(0.4), ctrl_y + Cm(0.2), Cm(2.5), Cm(0.5),
                    font_size=11, bold=True, color=color, align=PP_ALIGN.LEFT)
        ax_x += Cm(3.2)

    # 4-stage 파이프라인
    pipe_y = ctrl_y + ctrl_h + Cm(0.25)
    pipe_h = Cm(3.4)
    diag_w = SLIDE_W - Cm(2.4)
    stages = [
        ("수집",  "Ingest",  "원천 → 출처 태그 부착",  "raw + meta",      CYAN),
        ("저장",  "Govern",  "출처 보존 + 접근 통제",  "stored + audit",  PURPLE),
        ("가공",  "Process", "AI Ready化 + 정합성",    "ai-ready",        GREEN),
        ("활용",  "Serve",   "출처 인용 + 응답 검증",   "served + cited",  ORANGE),
    ]
    gap = Cm(0.2)
    stage_w = (diag_w - 3 * gap) / 4
    for i, (ko, en, sub, state, color) in enumerate(stages):
        sx = Cm(1.2) + i * (stage_w + gap)
        add_rect(sl, sx, pipe_y, stage_w, pipe_h, NAVY2, color, Pt(1.0))
        # 상단 헤더 바
        add_rect(sl, sx, pipe_y, stage_w, Cm(1.1), color)
        add_textbox(sl, f"0{i+1}",
                    sx + Cm(0.25), pipe_y + Cm(0.1), Cm(0.7), Cm(0.4),
                    font_size=9, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
        add_textbox(sl, ko,
                    sx, pipe_y + Cm(0.1), stage_w, Cm(0.65),
                    font_size=18, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        add_textbox(sl, en,
                    sx, pipe_y + Cm(0.7), stage_w, Cm(0.4),
                    font_size=9, italic=True, color=NAVY, align=PP_ALIGN.CENTER)
        # 본문
        add_textbox(sl, sub,
                    sx + Cm(0.3), pipe_y + Cm(1.3), stage_w - Cm(0.6), Cm(0.9),
                    font_size=12, bold=True, color=color, align=PP_ALIGN.LEFT)
        # 데이터 상태
        add_rect(sl, sx + Cm(0.3), pipe_y + pipe_h - Cm(0.8),
                 stage_w - Cm(0.6), Cm(0.5), color)
        add_textbox(sl, "→ " + state,
                    sx + Cm(0.3), pipe_y + pipe_h - Cm(0.8),
                    stage_w - Cm(0.6), Cm(0.5),
                    font_size=10, bold=True, italic=True, color=NAVY, align=PP_ALIGN.CENTER)
        # 화살표
        if i < 3:
            add_chevron(sl, sx + stage_w + Cm(0.0), pipe_y + pipe_h/2 - Cm(0.3),
                        Cm(0.2), Cm(0.7), color)

    # ── 하단: 운영 비용 철학 ──────────────────────────────────────────────
    section2_y = pipe_y + pipe_h + Cm(0.5)
    add_rect(sl, Cm(1.2), section2_y, Cm(0.4), Cm(0.55), ORANGE)
    add_textbox(sl,
                "PART 2.  운영 — 구축의 5배는 운영에서 나간다. 우리는 그 5배를 줄인다.",
                Cm(1.8), section2_y, SLIDE_W - Cm(3), Cm(0.55),
                font_size=12, bold=True, color=ORANGE, align=PP_ALIGN.LEFT)

    # 운영비 폭증 차단 3개 구조
    ops_y = section2_y + Cm(0.7)
    ops_h = Cm(3.6)
    ops_items = [
        ("01", "OpenSearch 기반 자산화",
         "Elastic 상용 라이선스 락인 제거",
         "−40%", "라이선스 비용", CYAN),
        ("02", "Hot · Warm · Cold 티어링",
         "조회 빈도 기반 자동 이관 — 5년 TCO 압축",
         "−60%", "스토리지 TCO", GREEN),
        ("03", "KT Cloud + 자체 모델",
         "외부 토큰 비용 의존 제거 — 운영 예측 가능",
         "3:7 → 7:3", "구축 : 운영", GOLD),
    ]
    ow = (diag_w - 2 * Cm(0.3)) / 3
    for i, (idx, title, body, num, unit, color) in enumerate(ops_items):
        ox = Cm(1.2) + i * (ow + Cm(0.3))
        add_rect(sl, ox, ops_y, ow, ops_h, NAVY2, color, Pt(1.0))
        add_rect(sl, ox, ops_y, Cm(0.18), ops_h, color)

        # 번호 + 제목
        add_textbox(sl, idx,
                    ox + Cm(0.4), ops_y + Cm(0.25), Cm(1.5), Cm(0.6),
                    font_size=11, bold=True, color=color, align=PP_ALIGN.LEFT)
        add_textbox(sl, title,
                    ox + Cm(0.4), ops_y + Cm(0.7), ow - Cm(0.7), Cm(0.8),
                    font_size=15, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
        add_textbox(sl, body,
                    ox + Cm(0.4), ops_y + Cm(1.5), ow - Cm(0.7), Cm(1.0),
                    font_size=11, color=LIGHT_GRAY, align=PP_ALIGN.LEFT)
        # 큰 숫자
        num_y = ops_y + ops_h - Cm(1.4)
        add_rect(sl, ox + Cm(0.3), num_y, ow - Cm(0.6), Cm(1.15), NAVY4, color, Pt(0.5))
        add_textbox(sl, num,
                    ox + Cm(0.3), num_y + Cm(0.05), ow - Cm(0.6), Cm(0.7),
                    font_size=22, bold=True, color=color, align=PP_ALIGN.CENTER)
        add_textbox(sl, unit,
                    ox + Cm(0.3), num_y + Cm(0.7), ow - Cm(0.6), Cm(0.4),
                    font_size=9, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

    # ── 하단 결론 띠 ──────────────────────────────────────────────────────
    concl_y = ops_y + ops_h + Cm(0.4)
    add_rect(sl, Cm(1.2), concl_y, SLIDE_W - Cm(2.4), Cm(1.55), GOLD)
    add_textbox(sl,
                "통제 + 지속성 = 진짜 AI 운영 체계",
                Cm(1.5), concl_y + Cm(0.15), SLIDE_W - Cm(3), Cm(0.9),
                font_size=22, bold=True, color=NAVY, align=PP_ALIGN.LEFT)
    add_textbox(sl,
                "AI 도입이 아니라, 지속 가능한 AI 운영 체계를 짓습니다  ─  하나은행이 요구한 것은 바로 그것입니다",
                Cm(1.5), concl_y + Cm(0.95), SLIDE_W - Cm(3), Cm(0.55),
                font_size=12, color=NAVY, align=PP_ALIGN.LEFT)

    add_footer(sl, 2)


# ─── 메인 ────────────────────────────────────────────────────────────────────────

def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    slide_01_war(prs)
    slide_02_operation(prs)

    out = "/home/user/strategy-pipeline/하나은행_AI_통제하는금융.pptx"
    prs.save(out)
    print(f"✓ Saved: {out}")


if __name__ == "__main__":
    main()
