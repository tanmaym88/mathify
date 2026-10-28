#!/usr/bin/env python3
"""Builds every Mathify logo file from the bulb icon + the "Mathify" wordmark.

Wordmark: Lexend ExtraBold (a typeface designed for easier reading — fitting for a teaching brand),
"Math" in navy, "ify" in orange, and the dot of the i replaced by a plus sign that echoes the plus
in the bulb. Stacked lockups add the tagline MATHS SIMPLIFIED.

Run:  python3 tools/make_logo.py        (needs: pip install fonttools brotli; Playwright for PNGs)
Writes public/brand/*.svg|png, public/assets/logo-invoice*.png.
"""
import os, re
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
BRAND = os.path.join(PUB, "brand")
NAVY, ORANGE, GREY, YELLOW, WHITE = "#2f3192", "#f7941d", "#6b6b73", "#ffd54f", "#ffffff"
BOLD = os.path.join(HERE, "fonts", "lexend-latin-800-normal.woff2")
SEMI = os.path.join(HERE, "fonts", "lexend-latin-600-normal.woff2")

ICON = re.search(r"<title>Mathify</title>(.*)</svg>", open(os.path.join(BRAND, "mathify-icon.svg")).read(), re.S).group(1).strip()
ICON_W, ICON_H = 909, 1246


# ---------- text -> SVG paths ----------
class Font:
    def __init__(self, path):
        self.f = TTFont(path); self.gs = self.f.getGlyphSet(); self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm; self.cap = self.f["OS/2"].sCapHeight

    def contours(self, ch):
        rp = RecordingPen(); self.gs[self.cmap[ord(ch)]].draw(rp)
        out, cur = [], []
        for op, args in rp.value:
            cur.append((op, args))
            if op in ("closePath", "endPath"): out.append(cur); cur = []
        return out

    def adv(self, ch): return self.f["hmtx"][self.cmap[ord(ch)]][0]


def bbox(rec):
    pts = [a for _, args in rec for a in args]
    return min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)


def path_d(rec, dx, s):
    """font units (y up) -> px with baseline at y=0 (y down)."""
    P = lambda p: f"{(p[0]+dx)*s:.1f},{-p[1]*s:.1f}"
    d = []
    for op, args in rec:
        if op == "moveTo": d.append("M" + P(args[0]))
        elif op == "lineTo": d.append("L" + P(args[0]))
        elif op == "curveTo": d.append("C" + " ".join(P(a) for a in args))
        elif op == "qCurveTo":
            pts = list(args)
            for i in range(len(pts) - 1):
                e = pts[i+1] if i == len(pts) - 2 else ((pts[i][0]+pts[i+1][0])/2, (pts[i][1]+pts[i+1][1])/2)
                d.append("Q" + P(pts[i]) + " " + P(e))
        elif op == "closePath": d.append("Z")
    return "".join(d)


def text_paths(font, text, cap_px, colours, tracking=0, plus_dot=None):
    """Returns (svg, width_px). Baseline at y=0; caps reach y=-cap_px."""
    s = cap_px / font.cap; x = 0; by_col = {}; extra = []
    for i, ch in enumerate(text):
        cs = font.contours(ch); col = colours[i] if isinstance(colours, list) else colours
        if ch == "i" and plus_dot:
            dot = max(cs, key=lambda c: bbox(c)[1]); cs = [c for c in cs if c is not dot]
            x0, y0, x1, y1 = bbox(dot); w = (x1 - x0) * s
            cx, cy = ((x0 + x1) / 2 + x) * s, -((y0 + y1) / 2) * s + w * 0.04
            L, T = w * 1.06, w * 0.36; r = T * 0.22
            extra.append(f'<g fill="{plus_dot}"><rect x="{cx-L/2:.1f}" y="{cy-T/2:.1f}" width="{L:.1f}" height="{T:.1f}" rx="{r:.1f}"/>'
                         f'<rect x="{cx-T/2:.1f}" y="{cy-L/2:.1f}" width="{T:.1f}" height="{L:.1f}" rx="{r:.1f}"/></g>')
        for c in cs: by_col.setdefault(col, []).append(path_d(c, x, s))
        x += font.adv(ch) + (tracking if i < len(text) - 1 else 0)
    last = text[-1]; width = (x - font.adv(last) + bbox([a for c in font.contours(last) for a in c])[2]) * s
    svg = "".join(f'<path fill="{c}" d="{"".join(ds)}"/>' for c, ds in by_col.items()) + "".join(extra)
    return svg, width


B, T = Font(BOLD), Font(SEMI)


def wordmark(cap, scheme):
    math_c, ify_c, plus_c = {"colour": (NAVY, ORANGE, ORANGE), "white": (WHITE, ORANGE, ORANGE),
                             "yellow": (NAVY, NAVY, ORANGE)}[scheme]
    return text_paths(B, "Mathify", cap, [math_c] * 4 + [ify_c] * 3, tracking=-12, plus_dot=plus_c)


def tagline(width, colour):
    # letter-spaced caps sized to span the wordmark width
    cap = 100.0
    for _ in range(8):
        tr = 0.42 * T.cap  # font units of tracking
        svg, w = text_paths(T, "MATHS SIMPLIFIED", cap, colour, tracking=tr)
        cap *= width / w
    return text_paths(T, "MATHS SIMPLIFIED", cap, colour, tracking=0.42 * T.cap) + (cap,)


def svg_doc(w, h, body, bg=None):
    bgr = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">'
            f'<title>Mathify</title>{bgr}\n{body}\n</svg>\n')


def horizontal(scheme="colour", pad=0, bg=None):
    cap = 600
    wm, ww = wordmark(cap, scheme)
    gap = 170
    base = ICON_H / 2 + cap / 2 + 20         # caps centred on the tile (nudged for the y descender)
    w, h = ICON_W + gap + ww, ICON_H
    body = f'<g transform="translate({pad} {pad})"><g>{ICON}</g><g transform="translate({ICON_W+gap} {base:.1f})">{wm}</g></g>'
    return svg_doc(w + 2 * pad, h + 2 * pad, body, bg), (w + 2 * pad) / (h + 2 * pad)


def stacked(scheme="colour", square=False, bg=None):
    cap = 560
    wm, ww = wordmark(cap, scheme)
    tl, tw, tcap = tagline(ww * 0.9, GREY if scheme != "white" else "#d4d4d8")
    if scheme == "yellow": tl = tl.replace(GREY, NAVY)
    W = max(ww, ICON_W) + 40
    y_word = ICON_H + 200 + cap
    y_tag = y_word + 0.36 * cap + 130 + tcap
    H = y_tag + 20
    body = (f'<g transform="translate({(W-ICON_W)/2:.1f} 0)">{ICON}</g>'
            f'<g transform="translate({(W-ww)/2:.1f} {y_word:.1f})">{wm}</g>'
            f'<g transform="translate({(W-tw)/2:.1f} {y_tag:.1f})">{tl}</g>')
    if square:
        S = max(W, H) * 1.36
        body = f'<g transform="translate({(S-W)/2:.1f} {(S-H)/2:.1f})">{body}</g>'
        return svg_doc(S, S, body, bg)
    return svg_doc(W, H, body, bg)


def write(name, svg):
    with open(os.path.join(BRAND, name), "w") as f: f.write(svg)


def main():
    hz, ratio = horizontal()
    write("mathify-logo-horizontal.svg", hz)
    write("mathify-logo-horizontal-white.svg", horizontal("white")[0])
    write("mathify-logo-horizontal-yellow.svg", horizontal("yellow", pad=300, bg=YELLOW)[0])
    write("mathify-logo-stacked.svg", stacked())
    write("mathify-logo-stacked-yellow.svg", stacked("yellow", square=True, bg=YELLOW))
    print(f"horizontal aspect ratio {ratio:.3f}  (navbar: height 40 -> width {40*ratio:.0f})")
    render_pngs()


def render_pngs():
    from playwright.sync_api import sync_playwright
    jobs = [  # (source svg, out png, width, height or None, background)
        ("mathify-logo-horizontal.svg", "brand/mathify-logo-horizontal.png", 2000, None, None),
        ("mathify-logo-horizontal-white.svg", "brand/mathify-logo-horizontal-white.png", 2000, None, None),
        ("mathify-logo-horizontal-yellow.svg", "brand/mathify-logo-horizontal-yellow.png", 2400, None, None),
        ("mathify-logo-stacked.svg", "brand/mathify-logo-stacked.png", 1500, None, None),
        ("mathify-logo-stacked-yellow.svg", "brand/mathify-logo-stacked-yellow.png", 1500, None, None),
        ("mathify-logo-horizontal.svg", "assets/logo-invoice-wide.png", 600, None, None),
    ]
    with sync_playwright() as p:
        br = p.chromium.launch()
        for src, out, w, h, _ in jobs:
            svg = open(os.path.join(BRAND, src)).read()
            vw, vh = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups())
            h = round(w * vh / vw)
            pg = br.new_page(viewport={"width": w, "height": h})
            pg.set_content(f'<html><body style="margin:0;background:transparent">'
                           f'{svg.replace(f"width=\"{vw:.0f}\" height=\"{vh:.0f}\"", f"width=\"{w}\" height=\"{h}\"")}</body></html>')
            pg.screenshot(path=os.path.join(PUB, out), omit_background=True, clip={"x": 0, "y": 0, "width": w, "height": h})
            pg.close()
        # social share card 1200x630
        pg = br.new_page(viewport={"width": 1200, "height": 630})
        logo = open(os.path.join(BRAND, "mathify-logo-horizontal.svg")).read()
        pg.set_content(f'''<html><head><style>@font-face{{font-family:L;src:url(data:font/woff2;base64,{b64(SEMI)})}}
          body{{margin:0;width:1200px;height:630px;background:{YELLOW};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px}}
          svg{{width:780px;height:auto}} p{{font:600 34px L;color:{NAVY};margin:0}}</style></head>
          <body>{logo.replace(TAG_NAVY_FIX[0], TAG_NAVY_FIX[1])}<p>One-to-one Maths teaching · Online worldwide &amp; in Pune</p></body></html>''')
        pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(BRAND, "mathify-share.png"))
        br.close()


# on the yellow share card, "ify" switches to navy (orange on yellow is hard to read)
TAG_NAVY_FIX = (f'<path fill="{ORANGE}" d="', f'<path fill="{NAVY}" d="')


def b64(path):
    import base64
    return base64.b64encode(open(path, "rb").read()).decode()


if __name__ == "__main__":
    main()
