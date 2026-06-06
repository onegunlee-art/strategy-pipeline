import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch
import matplotlib.font_manager as fm
import matplotlib as mpl
import numpy as np

fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/nanum/NanumSquareR.ttf')
mpl.rcParams['font.family'] = 'NanumBarunGothic'
mpl.rcParams['axes.unicode_minus'] = False

BG      = '#080C14'
CARD    = '#0F1622'
CARD2   = '#141E30'
BORDER  = '#1A2540'
ACCENT  = '#00CFFF'
GREEN   = '#00F5A0'
YELLOW  = '#FFD100'
RED     = '#FF4060'
WHITE   = '#F0F4FF'
GRAY    = '#7A8BAA'
GRAY2   = '#3A4A62'

def make_fig(w=20, h=11):
    fig = plt.figure(figsize=(w, h), facecolor=BG)
    fig.patch.set_facecolor(BG)
    return fig

def rbox(ax, x, y, w, h, fc=CARD, ec=BORDER, lw=0.8, radius=0.02, zorder=2, alpha=1.0):
    r = FancyBboxPatch((x, y), w, h,
        boxstyle=f"round,pad=0.005",
        facecolor=fc, edgecolor=ec, linewidth=lw,
        zorder=zorder, alpha=alpha, transform=ax.transAxes)
    ax.add_patch(r)
    return r

def t(ax, x, y, s, size=10, color=WHITE, bold=False, ha='left', va='center', zorder=5, alpha=1.0):
    ax.text(x, y, s, fontsize=size, color=color,
            fontweight='bold' if bold else 'normal',
            ha=ha, va=va, zorder=zorder, alpha=alpha,
            transform=ax.transAxes)

def ax_full(fig):
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis('off')
    return ax

# ════════════════════════════════════════════════════
# SCREEN 1 — 검색
# ════════════════════════════════════════════════════
fig1 = make_fig(20, 11)
ax = ax_full(fig1)

# Subtle radial glow
for r, a in [(0.35, 0.04), (0.25, 0.06), (0.15, 0.10)]:
    circle = plt.Circle((0.5, 0.52), r, color=ACCENT,
                         alpha=a, transform=ax.transAxes, zorder=0)
    ax.add_patch(circle)

# Logo / title
t(ax, 0.5, 0.82, '전략 인텔리전스', size=13, color=GRAY, ha='center')
t(ax, 0.5, 0.72, '어떤 주제든 드라이버로 분해하고', size=18, color=WHITE, ha='center', bold=False)
t(ax, 0.5, 0.63, '확률로 환산합니다', size=18, color=ACCENT, ha='center', bold=True)

# Search box
rbox(ax, 0.18, 0.44, 0.54, 0.075, fc='#0A1220', ec=ACCENT, lw=1.8)
t(ax, 0.215, 0.478, '이란 전쟼 종전 가능성', size=15, color=GRAY, ha='left')

# Cursor blink simulation
rbox(ax, 0.605, 0.455, 0.004, 0.042, fc=ACCENT, ec='none', lw=0)

# Analyze button
rbox(ax, 0.745, 0.44, 0.115, 0.075, fc=ACCENT, ec='none', lw=0)
t(ax, 0.8025, 0.478, '분석 시작', size=13, color=BG, bold=True, ha='center')

# Hint tags
hints = ['이란 전쟼 종전', '미중 무역분쟁', '반도체 공급망', '북한 핵 협상']
for i, hint in enumerate(hints):
    x = 0.24 + i * 0.145
    rbox(ax, x, 0.355, 0.125, 0.042, fc=CARD2, ec=BORDER, lw=0.7)
    t(ax, x + 0.0625, 0.376, hint, size=9, color=GRAY, ha='center')

t(ax, 0.5, 0.315, '최근 분석', size=8, color=GRAY2, ha='center')

plt.savefig('/home/user/strategy-pipeline/ui_screen1_search.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print("Screen 1 saved")

# ════════════════════════════════════════════════════
# SCREEN 2 — 분석 타이핑
# ════════════════════════════════════════════════════
fig2 = make_fig(20, 11)
ax = ax_full(fig2)

# Header
rbox(ax, 0, 0.88, 1.0, 0.12, fc='#0A1220', ec=BORDER, lw=0, radius=0)
t(ax, 0.03, 0.945, '이란 전쟼 종전 가능성', size=16, color=WHITE, bold=True)
t(ax, 0.03, 0.905, '분석 중 · 기사 20건 검토 완료', size=9, color=GRAY)

# Status chips
chips = [('일치 14건', GREEN), ('충돌 6건', RED), ('신뢰도 72%', YELLOW)]
for i, (label, color) in enumerate(chips):
    x = 0.72 + i * 0.085
    rbox(ax, x, 0.907, 0.075, 0.038, fc=CARD2, ec=color, lw=1.0)
    t(ax, x + 0.0375, 0.926, label, size=8, color=color, ha='center')

# Main typing area (2 columns)
rbox(ax, 0.02, 0.06, 0.58, 0.80, fc=CARD, ec=BORDER, lw=0.8)
rbox(ax, 0.62, 0.06, 0.36, 0.80, fc=CARD, ec=BORDER, lw=0.8)

# Left: streaming analysis text
t(ax, 0.04, 0.825, '핵심 결론', size=11, color=ACCENT, bold=True)
t(ax, 0.04, 0.795,
  '미국·이스라엘은 지도부 제거와 인프라 타격으로 "위에서 아래로"',
  size=9.5, color=WHITE)
t(ax, 0.04, 0.770,
  '이란 국가역량을 약화시켜 체제 변화를 유도하려 하지만,',
  size=9.5, color=WHITE)
t(ax, 0.04, 0.745,
  '이란은 전쟼을 "아래에서 위로" 버티는 동원전으로 전환해',
  size=9.5, color=WHITE)
t(ax, 0.04, 0.720,
  '같은 전쟼을 서로 다른 게임으로 치르고 있다.',
  size=9.5, color=ACCENT)

# Divider
ax.axhline(0.700, color=BORDER, linewidth=0.8, xmin=0.025, xmax=0.595)

t(ax, 0.04, 0.675, '일치하는 신호', size=10, color=GREEN, bold=True)
agreements = [
    '전쟼이 단순 군사 충돌이 아닌 체제와 정치의 문제로 번지고 있음',
    '"약화"와 "붕괴"는 다르다는 문제의식이 공통으로 나타남',
    '휴전 또는 전쟼 종결이 필요하다는 현실 인식은 양측 공유',
]
for i, a in enumerate(agreements):
    t(ax, 0.045, 0.645 - i*0.040, f'•  {a}', size=9, color=WHITE)

ax.axhline(0.550, color=BORDER, linewidth=0.8, xmin=0.025, xmax=0.595)

t(ax, 0.04, 0.530, '충돌하는 신호', size=10, color=RED, bold=True)
conflicts = [
    '"체제 흔들기"의 효과 평가에서 결이 갈림 — 군사 손실 vs 정치 결집',
    '휴전의 의미를 놓고 전략과 수사가 어긋날 위험 강조',
    '협상 지렛대 이동 — 호르무즈 통제가 새 카드로 부상',
]
for i, c in enumerate(conflicts):
    t(ax, 0.045, 0.500 - i*0.040, f'•  {c}', size=9, color=WHITE)

ax.axhline(0.400, color=BORDER, linewidth=0.8, xmin=0.025, xmax=0.595)

t(ax, 0.04, 0.380, '종합 판단', size=10, color=YELLOW, bold=True)
t(ax, 0.04, 0.350,
  '양측 모두 종전 필요성에는 동의하나 기대하는 종착점이',
  size=9, color=WHITE)
t(ax, 0.04, 0.325,
  '멀리 떨어져 있어 "전쟼은 멈춰도 충돌의 시대는 길어질" 가능성',
  size=9, color=WHITE)

# Typing cursor
t(ax, 0.04, 0.290, '▌', size=14, color=ACCENT, alpha=0.8)

# Right: driver extraction (auto-derived)
t(ax, 0.64, 0.825, '드라이버 자동 추출', size=11, color=ACCENT, bold=True)
t(ax, 0.64, 0.793, '분석 결과로부터 도출', size=8, color=GRAY)

drivers = [
    ('외교 채널',  3, RED,    '협상 채널 존재, 조건 격차 큼'),
    ('군사 강도',  7, RED,    '공습 지속, 전선 확대'),
    ('경제 압박',  6, YELLOW, '유가·제재 압박 복합'),
    ('내부 동향',  3, RED,    '외부 공격 → 오히려 결집'),
    ('협상 조건',  2, RED,    '양측 요구 구조적 충돌'),
]
for i, (name, score, color, desc) in enumerate(drivers):
    y = 0.740 - i * 0.110
    t(ax, 0.64, y + 0.025, name, size=10, color=WHITE, bold=True)
    t(ax, 0.64, y + 0.002, desc, size=7.5, color=GRAY)
    # bar bg
    rbox(ax, 0.640, y - 0.022, 0.300, 0.020, fc=BORDER, ec='none', lw=0)
    # bar fill
    rbox(ax, 0.640, y - 0.022, 0.300 * score/10, 0.020, fc=color, ec='none', lw=0, alpha=0.8)
    t(ax, 0.950, y - 0.010, f'{score}/10', size=8.5, color=color, bold=True, ha='right')

# Probability preview
rbox(ax, 0.630, 0.180, 0.355, 0.130, fc='#0A1A2A', ec=ACCENT, lw=1.2)
t(ax, 0.808, 0.270, '예상 확률', size=9, color=GRAY, ha='center')
t(ax, 0.808, 0.228, '22%', size=32, color=ACCENT, bold=True, ha='center')
t(ax, 0.808, 0.196, '±12%p', size=10, color=GRAY, ha='center')

# Confirm button
rbox(ax, 0.25, 0.02, 0.50, 0.060, fc=ACCENT, ec='none', lw=0)
t(ax, 0.50, 0.050, '확인  →  확률 대시보드로', size=13, color=BG, bold=True, ha='center')

plt.savefig('/home/user/strategy-pipeline/ui_screen2_analysis.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print("Screen 2 saved")

# ════════════════════════════════════════════════════
# SCREEN 3 — 확률 대시보드 + QR + 리포트
# ════════════════════════════════════════════════════
fig3 = make_fig(20, 11)
ax = ax_full(fig3)

# Header
rbox(ax, 0, 0.89, 1.0, 0.11, fc='#0A1220', ec=BORDER, lw=0, radius=0)
t(ax, 0.03, 0.947, '이란 전쟼 종전 가능성', size=15, color=WHITE, bold=True)
t(ax, 0.03, 0.908, '마지막 업데이트  3분 전', size=8.5, color=GRAY)

# Live badge
rbox(ax, 0.86, 0.912, 0.065, 0.034, fc='#001A0A', ec=GREEN, lw=1.0)
t(ax, 0.8925, 0.929, '● LIVE', size=8.5, color=GREEN, bold=True, ha='center')

# ── LEFT PANEL: drivers ──────────────────────────
rbox(ax, 0.01, 0.06, 0.28, 0.81, fc=CARD, ec=BORDER, lw=0.8)
t(ax, 0.025, 0.845, '드라이버 분석', size=11, color=WHITE, bold=True)

drivers_d = [
    ('외교 채널',  4, YELLOW, '+1 (협상 재개 신호)'),
    ('군사 강도',  7, RED,    '변동 없음'),
    ('경제 압박',  6, YELLOW, '변동 없음'),
    ('내부 동향',  3, RED,    '변동 없음'),
    ('협상 조건',  3, YELLOW, '+1 (카타르 중재)'),
]
for i, (name, score, color, status) in enumerate(drivers_d):
    y = 0.785 - i * 0.135
    t(ax, 0.025, y + 0.025, name, size=10, color=WHITE, bold=True)
    rbox(ax, 0.025, y - 0.010, 0.240, 0.024, fc=BORDER, ec='none', lw=0)
    rbox(ax, 0.025, y - 0.010, 0.240 * score/10, 0.024, fc=color, ec='none', lw=0, alpha=0.75)
    t(ax, 0.272, y + 0.004, f'{score}', size=10, color=color, bold=True, ha='right')
    t(ax, 0.025, y - 0.036, status, size=7.5, color=GRAY)

# Radar (mini)
ax_r = fig3.add_axes([0.025, 0.065, 0.13, 0.16])
ax_r.set_facecolor(CARD)
ax_r.axis('off')
N = 5
angles = [n/N*2*np.pi for n in range(N)] + [0]
vals = [4, 3, 6, 3, 3]; vals += vals[:1]
for r in [0.33, 0.66, 1.0]:
    xs = [r*np.cos(a) for a in angles]
    ys = [r*np.sin(a) for a in angles]
    ax_r.plot(xs, ys, color=BORDER, linewidth=0.6)
for a in angles[:-1]:
    ax_r.plot([0, np.cos(a)], [0, np.sin(a)], color=BORDER, linewidth=0.5)
rx = [v/10*np.cos(a) for v,a in zip(vals, angles)]
ry = [v/10*np.sin(a) for v,a in zip(vals, angles)]
ax_r.fill(rx, ry, color=ACCENT, alpha=0.25)
ax_r.plot(rx, ry, color=ACCENT, linewidth=2)
labels = ['외교', '군사\n역산', '경제', '내부', '협상']
for a, lbl in zip(angles[:-1], labels):
    ax_r.text(1.25*np.cos(a), 1.25*np.sin(a), lbl,
              ha='center', va='center', fontsize=6.5, color=GRAY)
ax_r.set_xlim(-1.5, 1.5); ax_r.set_ylim(-1.5, 1.5)

# ── CENTER PANEL: probability ────────────────────
rbox(ax, 0.305, 0.06, 0.390, 0.81, fc=CARD, ec=BORDER, lw=0.8)

# Big number
t(ax, 0.5, 0.800, '종전 가능성', size=11, color=GRAY, ha='center')
t(ax, 0.5, 0.720, '26%', size=62, color=ACCENT, bold=True, ha='center')
t(ax, 0.5, 0.668, '± 7%p', size=14, color=GRAY, ha='center')

# Before/after
rbox(ax, 0.315, 0.615, 0.185, 0.040, fc=CARD2, ec=BORDER, lw=0.5)
rbox(ax, 0.510, 0.615, 0.175, 0.040, fc='#0A2A1A', ec=GREEN, lw=0.7)
t(ax, 0.408, 0.635, '시작  22%  ±12%p', size=8, color=GRAY, ha='center')
t(ax, 0.598, 0.635, '현재  26%  ±7%p', size=8, color=GREEN, bold=True, ha='center')

# Distribution curve
ax_dist = fig3.add_axes([0.335, 0.39, 0.33, 0.19])
ax_dist.set_facecolor(CARD)
ax_dist.axis('off')
x = np.linspace(0, 10, 400)
# Before (faint)
mu0, s0 = 4.4, 2.4
y0 = np.exp(-0.5*((x-mu0)/s0)**2)
y0 /= y0.max()
ax_dist.fill_between(x, y0, color=GRAY2, alpha=0.20)
ax_dist.plot(x, y0, color=GRAY2, linewidth=1, linestyle='--', alpha=0.5)
# After (bright)
mu1, s1 = 5.2, 1.4
y1 = np.exp(-0.5*((x-mu1)/s1)**2)
y1 /= y1.max()
ax_dist.fill_between(x, y1, where=(x>=3)&(x<=7), color=ACCENT, alpha=0.30)
ax_dist.fill_between(x, y1, where=(x<3)|(x>7), color=ACCENT, alpha=0.08)
ax_dist.plot(x, y1, color=ACCENT, linewidth=2.5)
ax_dist.axvline(5.2, color=ACCENT, linewidth=1.5, linestyle=':', alpha=0.7)
ax_dist.text(0.5, -0.15, '26%', ha='center', fontsize=9,
             color=ACCENT, fontweight='bold', transform=ax_dist.transAxes)
ax_dist.text(0.05, -0.15, '8%', ha='center', fontsize=7.5,
             color=GRAY, transform=ax_dist.transAxes)
ax_dist.text(0.95, -0.15, '44%', ha='center', fontsize=7.5,
             color=GRAY, transform=ax_dist.transAxes)
ax_dist.text(0.18, 0.85, '투표 전', ha='center', fontsize=7,
             color=GRAY2, transform=ax_dist.transAxes)
ax_dist.text(0.55, 0.90, '현재', ha='center', fontsize=7,
             color=ACCENT, transform=ax_dist.transAxes)

# Divider
ax.axhline(0.375, color=BORDER, linewidth=0.7, xmin=0.308, xmax=0.692)

# Sensitivity
t(ax, 0.500, 0.355, '가장 중요한 변수', size=9, color=GRAY, ha='center')
sens = [('외교 채널 +1', '+9%p', ACCENT), ('군사 강도 -1', '+6%p', YELLOW), ('협상 조건 +1', '+5%p', YELLOW)]
for i, (drv, delta, color) in enumerate(sens):
    x0 = 0.325 + i * 0.130
    rbox(ax, x0, 0.290, 0.118, 0.052, fc=CARD2, ec=BORDER, lw=0.5)
    t(ax, x0+0.059, 0.330, drv, size=7.5, color=GRAY, ha='center')
    t(ax, x0+0.059, 0.305, delta, size=9, color=color, bold=True, ha='center')

# Polymarket
rbox(ax, 0.310, 0.195, 0.375, 0.085, fc='#08121E', ec=BORDER, lw=0.8)
t(ax, 0.388, 0.254, '우리 분석', size=8, color=GRAY, ha='center')
t(ax, 0.388, 0.221, '26%', size=17, color=ACCENT, bold=True, ha='center')
t(ax, 0.498, 0.237, 'vs', size=11, color=GRAY2, ha='center')
t(ax, 0.608, 0.254, '시장 예측', size=8, color=GRAY, ha='center')
t(ax, 0.608, 0.221, '34%', size=17, color=YELLOW, bold=True, ha='center')
rbox(ax, 0.310, 0.155, 0.375, 0.036, fc='#001A08', ec='none', lw=0)
t(ax, 0.498, 0.173, '차이 -8%p  →  호르무즈 레버리지 변수 미반영',
  size=7.5, color=GREEN, ha='center')

# Report buttons
rbox(ax, 0.310, 0.073, 0.182, 0.068, fc=GREEN, ec='none', lw=0)
t(ax, 0.401, 0.107, '📋  리포트 미리보기', size=9.5, color=BG, bold=True, ha='center')

rbox(ax, 0.503, 0.073, 0.182, 0.068, fc=CARD2, ec=GREEN, lw=1.2)
t(ax, 0.594, 0.107, '⬇  PDF 다운로드', size=9.5, color=GREEN, bold=True, ha='center')

# ── RIGHT PANEL: QR voting ───────────────────────
rbox(ax, 0.710, 0.06, 0.280, 0.81, fc=CARD, ec=BORDER, lw=0.8)
t(ax, 0.850, 0.845, '실시간 투표', size=11, color=WHITE, bold=True, ha='center')
t(ax, 0.850, 0.813, '아래 QR을 스캔하세요', size=8.5, color=GRAY, ha='center')

# QR box (large, prominent)
rbox(ax, 0.740, 0.600, 0.218, 0.195, fc='#060E18', ec=ACCENT, lw=2.0)
# QR pixel pattern (simulated)
np.random.seed(42)
qr_data = np.random.randint(0, 2, (9, 9))
# Force corners
for r, c in [(0,0),(0,1),(1,0),(0,7),(0,8),(1,8),(7,0),(8,0),(8,1),(7,8),(8,8),(8,7)]:
    qr_data[r][c] = 1
cell = 0.018
ox, oy = 0.757, 0.618
for r in range(9):
    for c in range(9):
        if qr_data[r][c]:
            rbox(ax, ox + c*cell, oy + (8-r)*cell, cell*0.85, cell*0.85,
                 fc=ACCENT, ec='none', lw=0)

# Participation counter
t(ax, 0.850, 0.565, '참여', size=9, color=GRAY, ha='center')
t(ax, 0.850, 0.528, '3 / 5', size=28, color=YELLOW, bold=True, ha='center')

# Progress dots
for i in range(5):
    color = GREEN if i < 3 else GRAY2
    dot = plt.Circle((0.782 + i*0.034, 0.500), 0.009,
                      color=color, transform=ax.transAxes, zorder=5)
    ax.add_patch(dot)

# Divider
ax.axhline(0.480, color=BORDER, linewidth=0.7, xmin=0.712, xmax=0.988)

# Probability change feed (anonymous)
t(ax, 0.850, 0.460, '확률 변화 이력', size=9, color=GRAY, ha='center')

changes = [
    ('+4%p', '26%', GREEN,  '방금'),
    ('-3%p', '22%', RED,    '4분 전'),
    ('+5%p', '25%', GREEN,  '6분 전'),
    ('+2%p', '20%', GREEN,  '9분 전'),
]
for i, (delta, result, color, when) in enumerate(changes):
    y = 0.425 - i * 0.075
    rbox(ax, 0.718, y - 0.008, 0.260, 0.058, fc=CARD2, ec=BORDER, lw=0.4)
    t(ax, 0.730, y + 0.020, delta, size=11, color=color, bold=True)
    t(ax, 0.830, y + 0.020, f'→ {result}', size=10, color=WHITE, bold=True)
    t(ax, 0.968, y + 0.020, when, size=7.5, color=GRAY2, ha='right')

# Share link button
rbox(ax, 0.718, 0.073, 0.260, 0.055, fc=CARD2, ec=ACCENT, lw=1.2)
t(ax, 0.848, 0.100, '🔗  투표 링크 공유', size=9.5, color=ACCENT, bold=True, ha='center')

plt.savefig('/home/user/strategy-pipeline/ui_screen3_dashboard.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print("Screen 3 saved")
print("All done.")
