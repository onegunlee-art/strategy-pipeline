import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.font_manager as fm
import numpy as np

# Register Korean font
fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumSquareR.ttf')

import matplotlib as mpl
mpl.rcParams['font.family'] = 'NanumBarunGothic'
mpl.rcParams['axes.unicode_minus'] = False

# ── Color palette ──────────────────────────────────────────
BG       = '#0A0E1A'
CARD     = '#121A2E'
CARD2    = '#0D1525'
BORDER   = '#1E2D4A'
ACCENT   = '#00D4FF'
GREEN    = '#00FFA3'
YELLOW   = '#FFD600'
RED      = '#FF4D6D'
WHITE    = '#FFFFFF'
GRAY     = '#8A9BB8'
GRAY2    = '#4A5A78'
SIDEBAR  = '#0C1220'

fig = plt.figure(figsize=(24, 14), facecolor=BG)
fig.patch.set_facecolor(BG)

# ── Helper functions ────────────────────────────────────────
def card(ax_or_fig, x, y, w, h, color=CARD, border=BORDER, radius=0.012, zorder=2):
    if isinstance(ax_or_fig, plt.Figure):
        ax = fig.add_axes([x, y, w, h])
        ax.set_facecolor(color)
        for spine in ax.spines.values():
            spine.set_color(border)
            spine.set_linewidth(0.8)
        return ax
    else:
        rect = FancyBboxPatch((x, y), w, h,
            boxstyle=f"round,pad=0.005",
            facecolor=color, edgecolor=border, linewidth=0.8, zorder=zorder,
            transform=ax_or_fig.transAxes)
        ax_or_fig.add_patch(rect)

def lbl(ax, x, y, text, size=9, color=WHITE, bold=False, ha='left', va='center', zorder=5):
    weight = 'bold' if bold else 'normal'
    ax.text(x, y, text, fontsize=size, color=color, fontweight=weight,
            ha=ha, va=va, zorder=zorder, transform=ax.transAxes,
            fontfamily='DejaVu Sans')

# ═══════════════════════════════════════════════════════════
# LAYOUT: sidebar (0.0~0.13) + main (0.14~1.0)
# ═══════════════════════════════════════════════════════════

# ── Sidebar ────────────────────────────────────────────────
ax_side = fig.add_axes([0.0, 0.0, 0.13, 1.0])
ax_side.set_facecolor(SIDEBAR)
ax_side.set_xlim(0,1); ax_side.set_ylim(0,1)
ax_side.axis('off')

# Logo
ax_side.text(0.5, 0.95, '전략', fontsize=11, color=ACCENT, fontweight='bold',
             ha='center', transform=ax_side.transAxes)
ax_side.text(0.5, 0.91, '인텔리전스', fontsize=8, color=GRAY,
             ha='center', transform=ax_side.transAxes)
ax_side.axhline(0.88, color=BORDER, linewidth=0.8, xmin=0.1, xmax=0.9)

menu_items = [
    ('🔍', '새 분석', True),
    ('📊', '수주전략', False),
    ('🌍', '지정학', False),
    ('⚡', '시그널', False),
    ('📋', '리포트', False),
    ('⚙️',  '설정', False),
]
for i, (icon, label, active) in enumerate(menu_items):
    y = 0.82 - i * 0.08
    if active:
        rect = FancyBboxPatch((0.05, y-0.025), 0.9, 0.055,
            boxstyle="round,pad=0.01", facecolor='#0A2A3A',
            edgecolor=ACCENT, linewidth=1.0)
        ax_side.add_patch(rect)
        ax_side.text(0.22, y+0.005, icon, fontsize=10, ha='center',
                     transform=ax_side.transAxes)
        ax_side.text(0.62, y+0.005, label, fontsize=9, color=ACCENT,
                     fontweight='bold', ha='center', transform=ax_side.transAxes)
    else:
        ax_side.text(0.22, y+0.005, icon, fontsize=10, ha='center',
                     transform=ax_side.transAxes)
        ax_side.text(0.62, y+0.005, label, fontsize=9, color=GRAY,
                     ha='center', transform=ax_side.transAxes)

# Recent analyses
ax_side.axhline(0.36, color=BORDER, linewidth=0.8, xmin=0.1, xmax=0.9)
ax_side.text(0.5, 0.34, '최근 분석', fontsize=7, color=GRAY2,
             ha='center', transform=ax_side.transAxes)
recents = ['이란 종전 가능성', 'SG 제주 위성센터', 'KT 하나은행 딜']
for i, r in enumerate(recents):
    ax_side.text(0.5, 0.29 - i*0.055, r, fontsize=7.5, color=GRAY,
                 ha='center', transform=ax_side.transAxes)

# ── MAIN AREA ──────────────────────────────────────────────
ax_main = fig.add_axes([0.135, 0.0, 0.865, 1.0])
ax_main.set_facecolor(BG)
ax_main.set_xlim(0, 1); ax_main.set_ylim(0, 1)
ax_main.axis('off')

# ── Header bar ─────────────────────────────────────────────
header = FancyBboxPatch((0.0, 0.91), 1.0, 0.09,
    boxstyle="square,pad=0", facecolor=CARD2, edgecolor=BORDER, linewidth=0.5)
ax_main.add_patch(header)

ax_main.text(0.02, 0.955, '새 분석 시작', fontsize=14, color=WHITE,
             fontweight='bold', transform=ax_main.transAxes)

# Search box
search = FancyBboxPatch((0.22, 0.925), 0.50, 0.055,
    boxstyle="round,pad=0.005", facecolor='#0A1525', edgecolor=ACCENT, linewidth=1.5)
ax_main.add_patch(search)
ax_main.text(0.235, 0.953, '🔍  이란 전쟼 종전 가능성', fontsize=10,
             color=GRAY, transform=ax_main.transAxes, va='center')

# Analyze button
btn = FancyBboxPatch((0.735, 0.928), 0.10, 0.048,
    boxstyle="round,pad=0.005", facecolor=ACCENT, edgecolor='none')
ax_main.add_patch(btn)
ax_main.text(0.785, 0.952, '분석 시작', fontsize=9, color=BG,
             fontweight='bold', ha='center', transform=ax_main.transAxes)

# Status chip
chip = FancyBboxPatch((0.85, 0.928), 0.13, 0.048,
    boxstyle="round,pad=0.005", facecolor='#0A2A1A', edgecolor=GREEN, linewidth=1.0)
ax_main.add_patch(chip)
ax_main.text(0.915, 0.952, '● GIST 연결됨', fontsize=8, color=GREEN,
             ha='center', transform=ax_main.transAxes)

# ── GIST 분석 결과 배너 ─────────────────────────────────────
banner = FancyBboxPatch((0.0, 0.83), 1.0, 0.075,
    boxstyle="square,pad=0", facecolor='#0A1A2A', edgecolor=BORDER, linewidth=0.5)
ax_main.add_patch(banner)

ax_main.text(0.02, 0.875, '📡 the gist. 분석 완료', fontsize=10,
             color=ACCENT, fontweight='bold', transform=ax_main.transAxes)
ax_main.text(0.02, 0.845, '기사 20건 검색  |  일치 신호 14건  |  충돌 신호 6건',
             fontsize=8.5, color=GRAY, transform=ax_main.transAxes)

ax_main.text(0.38, 0.875,
             '"이란은 호르무즈 해협 통제를 새 협상 레버리지로 확보.\n같은 전쟼을 서로 다른 게임으로 치르고 있다."',
             fontsize=8, color=WHITE, transform=ax_main.transAxes, style='italic')

for i, (label, color) in enumerate([('일치 14', GREEN), ('충돌 6', RED), ('신뢰도 72%', YELLOW)]):
    chip2 = FancyBboxPatch((0.80 + i*0.065, 0.843), 0.058, 0.038,
        boxstyle="round,pad=0.004", facecolor='#0D1525', edgecolor=color, linewidth=1.0)
    ax_main.add_patch(chip2)
    ax_main.text(0.829 + i*0.065, 0.862, label, fontsize=7.5, color=color,
                 ha='center', transform=ax_main.transAxes)

# ─────────────────────────────────────────────────────────
# 3-column layout: [Driver] [Probability] [Signal]
# ─────────────────────────────────────────────────────────

# ── COL 1: 드라이버 분석 ──────────────────────────────────
col1 = FancyBboxPatch((0.0, 0.02), 0.30, 0.80,
    boxstyle="round,pad=0.005", facecolor=CARD, edgecolor=BORDER, linewidth=0.8)
ax_main.add_patch(col1)

ax_main.text(0.015, 0.80, '드라이버 분석', fontsize=11, color=WHITE,
             fontweight='bold', transform=ax_main.transAxes)
ax_main.text(0.015, 0.775, 'AI 초안 점수 (1-10)', fontsize=8, color=GRAY,
             transform=ax_main.transAxes)

drivers = [
    ('외교 채널',  3, RED,    '협상 채널 있으나 조건 격차 큼'),
    ('군사 강도',  7, RED,    '주 3회 공습, 전선 확대 중'),
    ('경제 압박',  6, YELLOW, '유가 급등, 제재 추가 논의'),
    ('이란 내부',  3, RED,    '민족주의 결집, 체제 강화'),
    ('호르무즈',   4, YELLOW, '해협 통제 새 레버리지 확보'),
]

for i, (name, score, color, desc) in enumerate(drivers):
    y_base = 0.715 - i * 0.135
    # driver name
    ax_main.text(0.015, y_base + 0.03, name, fontsize=9.5, color=WHITE,
                 fontweight='bold', transform=ax_main.transAxes)
    ax_main.text(0.015, y_base + 0.008, desc, fontsize=7, color=GRAY,
                 transform=ax_main.transAxes)
    # bar background
    bar_bg = FancyBboxPatch((0.015, y_base - 0.022), 0.245, 0.022,
        boxstyle="square,pad=0", facecolor=BORDER, edgecolor='none')
    ax_main.add_patch(bar_bg)
    # bar fill
    bar_w = 0.245 * score / 10
    bar_fill = FancyBboxPatch((0.015, y_base - 0.022), bar_w, 0.022,
        boxstyle="square,pad=0", facecolor=color, edgecolor='none', alpha=0.85)
    ax_main.add_patch(bar_fill)
    # score text
    ax_main.text(0.272, y_base - 0.01, f'{score}/10', fontsize=8.5,
                 color=color, fontweight='bold', transform=ax_main.transAxes,
                 ha='right')

# Radar chart (mini)
ax_radar = fig.add_axes([0.163, 0.04, 0.10, 0.18])
ax_radar.set_facecolor(CARD)
categories = ['외교', '군사\n(역산)', '경제', '내부', '호르무즈']
N = len(categories)
angles = [n / float(N) * 2 * np.pi for n in range(N)]
angles += angles[:1]
values = [3, 3, 6, 3, 4]  # 군사강도는 역산(10-7=3)
values += values[:1]

ax_radar.set_xlim(-1.3, 1.3); ax_radar.set_ylim(-1.3, 1.3)
ax_radar.axis('off')

# Grid circles
for r in [0.3, 0.6, 0.9]:
    circle = plt.Circle((0, 0), r, fill=False, color=BORDER, linewidth=0.5)
    ax_radar.add_patch(circle)

# Lines
for angle in angles[:-1]:
    ax_radar.plot([0, np.cos(angle)], [0, np.sin(angle)], color=BORDER, linewidth=0.5)

# Data
radar_vals = [v/10 for v in values]
xs = [r * np.cos(a) for r, a in zip(radar_vals, angles)]
ys = [r * np.sin(a) for r, a in zip(radar_vals, angles)]
ax_radar.fill(xs, ys, alpha=0.25, color=ACCENT)
ax_radar.plot(xs, ys, color=ACCENT, linewidth=1.5)

for angle, label in zip(angles[:-1], categories):
    x = 1.15 * np.cos(angle)
    y = 1.15 * np.sin(angle)
    ax_radar.text(x, y, label, ha='center', va='center',
                  fontsize=6, color=GRAY)

# ── COL 2: 확률 진단 ──────────────────────────────────────
col2 = FancyBboxPatch((0.315, 0.02), 0.36, 0.80,
    boxstyle="round,pad=0.005", facecolor=CARD, edgecolor=BORDER, linewidth=0.8)
ax_main.add_patch(col2)

ax_main.text(0.33, 0.80, '종전 가능성 진단', fontsize=11, color=WHITE,
             fontweight='bold', transform=ax_main.transAxes)

# BIG probability number
ax_main.text(0.495, 0.74, '26%', fontsize=52, color=ACCENT,
             fontweight='bold', ha='center', transform=ax_main.transAxes)
ax_main.text(0.495, 0.695, '± 7%p', fontsize=14, color=GRAY,
             ha='center', transform=ax_main.transAxes)
ax_main.text(0.495, 0.672, '임원 투표 반영 후', fontsize=8, color=GRAY2,
             ha='center', transform=ax_main.transAxes)

# Probability distribution curve
ax_dist = fig.add_axes([0.459, 0.44, 0.195, 0.20])
ax_dist.set_facecolor(CARD)
ax_dist.axis('off')

x = np.linspace(0, 10, 300)
mu, sigma = 5.2, 1.4
y_dist = np.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi))
y_dist = y_dist / y_dist.max()

ax_dist.fill_between(x, y_dist, where=(x >= 3) & (x <= 7),
                      color=ACCENT, alpha=0.3)
ax_dist.fill_between(x, y_dist, where=(x < 3) | (x > 7),
                      color=GRAY2, alpha=0.15)
ax_dist.plot(x, y_dist, color=ACCENT, linewidth=2)
ax_dist.axvline(x=5.2, color=ACCENT, linewidth=1.5, linestyle='--', alpha=0.8)

ax_dist.text(1.2, -0.15, '8%', fontsize=7, color=GRAY,
             transform=ax_dist.transAxes, ha='center')
ax_dist.text(0.5, -0.15, '26%', fontsize=8, color=ACCENT,
             transform=ax_dist.transAxes, ha='center', fontweight='bold')
ax_dist.text(-0.15, -0.15, '44%', fontsize=7, color=GRAY,
             transform=ax_dist.transAxes, ha='center')

# Before/After comparison
ax_main.text(0.33, 0.43, '투표 전', fontsize=8, color=GRAY2, transform=ax_main.transAxes)
ax_main.text(0.33, 0.407, '22%  ±12%p', fontsize=9, color=GRAY, transform=ax_main.transAxes)
ax_main.text(0.485, 0.43, '→', fontsize=14, color=GRAY2, ha='center', transform=ax_main.transAxes)
ax_main.text(0.545, 0.43, '투표 후', fontsize=8, color=GREEN, transform=ax_main.transAxes)
ax_main.text(0.545, 0.407, '26%  ±7%p', fontsize=9, color=GREEN, fontweight='bold', transform=ax_main.transAxes)

# Divider
ax_main.axhline(0.395, color=BORDER, linewidth=0.7,
                xmin=0.315, xmax=0.675)

# Polymarket comparison
ax_main.text(0.33, 0.375, 'Polymarket 비교', fontsize=9, color=GRAY,
             transform=ax_main.transAxes)

poly_bg = FancyBboxPatch((0.318, 0.28), 0.352, 0.088,
    boxstyle="round,pad=0.005", facecolor='#0A1A2A', edgecolor=BORDER, linewidth=0.6)
ax_main.add_patch(poly_bg)

ax_main.text(0.385, 0.338, '우리', fontsize=8, color=GRAY, ha='center', transform=ax_main.transAxes)
ax_main.text(0.385, 0.308, '26%', fontsize=16, color=ACCENT, fontweight='bold',
             ha='center', transform=ax_main.transAxes)
ax_main.text(0.495, 0.322, 'vs', fontsize=12, color=GRAY2,
             ha='center', transform=ax_main.transAxes)
ax_main.text(0.605, 0.338, 'Polymarket', fontsize=8, color=GRAY,
             ha='center', transform=ax_main.transAxes)
ax_main.text(0.605, 0.308, '34%', fontsize=16, color=YELLOW, fontweight='bold',
             ha='center', transform=ax_main.transAxes)

edge_box = FancyBboxPatch((0.318, 0.23), 0.352, 0.045,
    boxstyle="round,pad=0.005", facecolor='#001A0A', edgecolor=GREEN, linewidth=0.8)
ax_main.add_patch(edge_box)
ax_main.text(0.495, 0.252, '차이 -8%p  →  호르무즈 변수 미반영 (우리 엣지)',
             fontsize=7.5, color=GREEN, ha='center', transform=ax_main.transAxes)

# Sensitivity
ax_main.text(0.33, 0.215, '핵심 드라이버 민감도', fontsize=9, color=GRAY,
             transform=ax_main.transAxes)
sens = [('외교채널 +1', '+9%p', ACCENT, '★★★'),
        ('군사강도 -1', '+6%p', YELLOW, '★★'),
        ('호르무즈 -1', '+5%p', YELLOW, '★★')]
for i, (driver, delta, color, stars) in enumerate(sens):
    y = 0.185 - i * 0.048
    sens_bg = FancyBboxPatch((0.318, y - 0.01), 0.352, 0.038,
        boxstyle="round,pad=0.003", facecolor=CARD2, edgecolor=BORDER, linewidth=0.5)
    ax_main.add_patch(sens_bg)
    ax_main.text(0.33, y + 0.01, driver, fontsize=8, color=WHITE, transform=ax_main.transAxes)
    ax_main.text(0.545, y + 0.01, delta, fontsize=9, color=color, fontweight='bold',
                 transform=ax_main.transAxes)
    ax_main.text(0.645, y + 0.01, stars, fontsize=8, color=YELLOW,
                 transform=ax_main.transAxes)

# Report button
report_btn = FancyBboxPatch((0.318, 0.03), 0.352, 0.055,
    boxstyle="round,pad=0.005", facecolor=GREEN, edgecolor='none')
ax_main.add_patch(report_btn)
ax_main.text(0.495, 0.058, '📋  리포트 생성', fontsize=11, color=BG,
             fontweight='bold', ha='center', transform=ax_main.transAxes)

# ── COL 3: 시그널 & 투표 ─────────────────────────────────
col3 = FancyBboxPatch((0.69, 0.02), 0.305, 0.80,
    boxstyle="round,pad=0.005", facecolor=CARD, edgecolor=BORDER, linewidth=0.8)
ax_main.add_patch(col3)

ax_main.text(0.705, 0.80, '임원 시그널', fontsize=11, color=WHITE,
             fontweight='bold', transform=ax_main.transAxes)
ax_main.text(0.705, 0.775, 'QR 스캔 또는 링크 공유', fontsize=8, color=GRAY,
             transform=ax_main.transAxes)

# QR placeholder
qr = FancyBboxPatch((0.76, 0.64), 0.11, 0.12,
    boxstyle="round,pad=0.005", facecolor='#0A1525', edgecolor=ACCENT, linewidth=1.5)
ax_main.add_patch(qr)
ax_main.text(0.815, 0.700, 'QR', fontsize=18, color=ACCENT,
             fontweight='bold', ha='center', transform=ax_main.transAxes)
ax_main.text(0.815, 0.650, '스캔', fontsize=8, color=GRAY,
             ha='center', transform=ax_main.transAxes)

# Participation
ax_main.text(0.815, 0.625, '참여  3 / 5명', fontsize=9, color=YELLOW,
             ha='center', transform=ax_main.transAxes)

# Progress dots
for i in range(5):
    color = GREEN if i < 3 else GRAY2
    circle = plt.Circle((0.755 + i*0.032, 0.605), 0.008,
                         color=color, transform=ax_main.transAxes)
    ax_main.add_patch(circle)

ax_main.axhline(0.59, color=BORDER, linewidth=0.7, xmin=0.69, xmax=0.995)
ax_main.text(0.705, 0.572, '최근 시그널', fontsize=9, color=GRAY,
             transform=ax_main.transAxes)

signals = [
    ('김 부사장',  '협상 재개 소식',    GREEN,  '▲ +9%p',  '2분 전'),
    ('이 본부장',  '공습 빈도 증가',    RED,    '▼ -6%p',  '4분 전'),
    ('박 상무',    '제재 완화 신호',    GREEN,  '▲ +5%p',  '5분 전'),
    ('최 팀장',    '강경파 집권 신호',  RED,    '▼ -4%p',  '7분 전'),
    ('정 상무',    '협상 재개 소식',    GREEN,  '▲ +9%p',  '9분 전'),
]

for i, (who, signal, color, delta, when) in enumerate(signals):
    y = 0.545 - i * 0.088
    sig_bg = FancyBboxPatch((0.698, y - 0.015), 0.288, 0.072,
        boxstyle="round,pad=0.004", facecolor=CARD2, edgecolor=BORDER, linewidth=0.5)
    ax_main.add_patch(sig_bg)
    ax_main.text(0.710, y + 0.032, who, fontsize=8.5, color=WHITE,
                 transform=ax_main.transAxes, fontweight='bold')
    ax_main.text(0.710, y + 0.008, signal, fontsize=8, color=color,
                 transform=ax_main.transAxes)
    ax_main.text(0.970, y + 0.032, delta, fontsize=8.5, color=color,
                 transform=ax_main.transAxes, ha='right', fontweight='bold')
    ax_main.text(0.970, y + 0.008, when, fontsize=7, color=GRAY2,
                 transform=ax_main.transAxes, ha='right')

ax_main.axhline(0.155, color=BORDER, linewidth=0.7, xmin=0.69, xmax=0.995)
ax_main.text(0.705, 0.138, '딜 파이프라인 영향', fontsize=9, color=GRAY,
             transform=ax_main.transAxes)

deal_impacts = [
    ('제주 위성센터',    '에너지 리스크', '▲', RED),
    ('하나은행 딜',      '납기 리스크',   '▲ +8%p', YELLOW),
]
for i, (deal, risk, arrow, color) in enumerate(deal_impacts):
    y = 0.113 - i * 0.052
    deal_bg = FancyBboxPatch((0.698, y - 0.01), 0.288, 0.04,
        boxstyle="round,pad=0.003", facecolor='#0A1A0A', edgecolor=color, linewidth=0.5)
    ax_main.add_patch(deal_bg)
    ax_main.text(0.710, y + 0.01, deal, fontsize=8, color=WHITE,
                 transform=ax_main.transAxes)
    ax_main.text(0.830, y + 0.01, risk, fontsize=7.5, color=GRAY,
                 transform=ax_main.transAxes)
    ax_main.text(0.970, y + 0.01, arrow, fontsize=8.5, color=color,
                 transform=ax_main.transAxes, ha='right', fontweight='bold')

# ── Bottom accent line ─────────────────────────────────────
ax_main.axhline(0.018, color=ACCENT, linewidth=1.5, xmin=0.0, xmax=1.0, alpha=0.4)

plt.savefig('/home/user/strategy-pipeline/dashboard_ui_mockup.png',
            dpi=160, bbox_inches='tight', facecolor=BG, edgecolor='none')
print("Saved: dashboard_ui_mockup.png")
