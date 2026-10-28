#!/usr/bin/env python3
"""Generate the illustrated testimonial avatars: public/images/avatars/{man,woman,boy,girl,student}-{1..4}.svg

Deliberately simple drawings (never photos) so nobody mistakes them for the actual reviewer.
Mild variations: skin tone, hair style/colour, clothing and background colour.
Run:  python3 tools/make_avatars.py public
"""
import os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "public"
OUT = os.path.join(ROOT, "images", "avatars")
os.makedirs(OUT, exist_ok=True)

NAVY, GOLD, ORANGE, INDIGO = "#2f3192", "#cbbd9e", "#f7941d", "#6d70c9"  # GOLD = ivory-sand (yellow retired)
BGS = ["#f6f1e7", "#e9eaf8", "#fde8d2", "#eef6ee"]
SKINS = ["#e0ac85", "#c68863", "#f1c7a1", "#a86f4c"]
HAIRS = ["#2b2118", "#4a2f1d", "#1b1b1b", "#5a3a22"]


def svg(bg, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">'
            f'<circle cx="48" cy="48" r="48" fill="{bg}"/>'
            '<clipPath id="c"><circle cx="48" cy="48" r="48"/></clipPath>'
            f'<g clip-path="url(#c)">{body}</g></svg>\n')


def glasses(y, col="#2b2118"):
    return (f'<g fill="none" stroke="{col}" stroke-width="1.8"><circle cx="42" cy="{y}" r="4.2"/>'
            f'<circle cx="54" cy="{y}" r="4.2"/><path d="M46.2 {y}h3.6"/></g>')


def adult_body(cloth, skin, neck_y=56):
    return (f'<path d="M14 100c0-20 15-32 34-32s34 12 34 32z" fill="{cloth}"/>'
            f'<rect x="42" y="{neck_y}" width="12" height="13" rx="4" fill="{skin}"/>')


def child_body(cloth, skin):
    return (f'<path d="M20 100c0-17 12-27 28-27s28 10 28 27z" fill="{cloth}"/>'
            f'<rect x="43" y="60" width="10" height="12" rx="4" fill="{skin}"/>')


def man(v):
    skin, hair, cloth, bg = SKINS[v], HAIRS[v], [NAVY, INDIGO, GOLD, NAVY][v], BGS[v]
    b = adult_body(cloth, skin)
    b += '<path d="M40 68l8 10 8-10z" fill="#fff"/>' if cloth != GOLD else ''
    b += f'<ellipse cx="48" cy="40" rx="15" ry="17" fill="{skin}"/>'
    if v == 0:
        b += f'<path d="M33 38c0-12 6-18 15-18s15 6 15 18c-3-6-8-8-15-8s-12 2-15 8z" fill="{hair}"/>'
    elif v == 1:  # side parting
        b += f'<path d="M33 40c-1-13 6-20 16-20 9 0 15 6 14 18-4-7-9-9-14-9-3 0-5 1-7 3-3 1-6 4-9 8z" fill="{hair}"/>'
    elif v == 2:  # short hair + beard
        b += f'<path d="M34 36c0-11 6-16 14-16s14 5 14 16c-3-5-8-7-14-7s-11 2-14 7z" fill="{hair}"/>'
        b += f'<path d="M33.5 42C34 54 40 58 48 58S62 54 62.5 42C60 50 55 53 48 53S36 50 33.5 42Z" fill="{hair}"/>'
    else:  # glasses
        b += f'<path d="M33 37c0-11 6-17 15-17s15 6 15 17c-3-5-8-7-15-7s-12 2-15 7z" fill="{hair}"/>'
        b += glasses(42)
    return svg(bg, b)


def woman(v):
    skin, hair, cloth, bg = SKINS[(v + 2) % 4], HAIRS[v], [GOLD, NAVY, ORANGE, INDIGO][v], BGS[(v + 1) % 4]
    b = ""
    if v in (0, 3):  # shoulder-length hair behind
        b += f'<path d="M30 40c0-14 8-21 18-21s18 7 18 21v24c-6 4-30 4-36 0z" fill="{hair}"/>'
    if v == 2:  # long hair
        b += f'<path d="M29 40c0-14 8-21 19-21s19 7 19 21v40H29z" fill="{hair}"/>'
    b += adult_body(cloth, skin)
    b += f'<ellipse cx="48" cy="41" rx="14" ry="16" fill="{skin}"/>'
    if v == 1:  # bun
        b += f'<circle cx="48" cy="20" r="8" fill="{hair}"/>'
        b += f'<path d="M34 40c0-12 6-17 14-17s14 5 14 17c-4-6-9-8-14-8s-10 2-14 8z" fill="{hair}"/>'
    elif v == 2:  # fringe
        b += f'<path d="M34 38c1-10 7-15 14-15s13 5 14 15c-5-2-9-6-12-7-4 3-10 6-16 7z" fill="{hair}"/>'
    else:
        b += f'<path d="M34 40c1-11 7-17 14-17s13 6 14 17c-5-7-10-9-16-9-6 0-9 3-12 9z" fill="{hair}"/>'
    if v == 3:
        b += glasses(43)
    return svg(bg, b)


def boy(v):
    skin, hair, cloth, bg = SKINS[(v + 1) % 4], HAIRS[(v + 2) % 4], [GOLD, ORANGE, NAVY, INDIGO][v], BGS[(v + 2) % 4]
    b = child_body(cloth, skin) + f'<ellipse cx="48" cy="46" rx="15" ry="16" fill="{skin}"/>'
    if v == 0:  # spiky
        b += f'<path d="M33 44c-1-12 6-19 15-19s16 7 15 19l-3-6-4 3-3-5-5 4-4-5-4 5-3-3z" fill="{hair}"/>'
    elif v == 1:  # neat side sweep
        b += f'<path d="M33 45c-1-13 7-19 16-19 8 0 15 6 14 17-5-6-11-8-17-6-5 1-9 4-13 8z" fill="{hair}"/>'
    elif v == 2:  # curly
        b += ''.join(f'<circle cx="{x}" cy="{y}" r="5.5" fill="{hair}"/>' for x, y in
                     [(36, 36), (42, 30), (49, 28), (56, 30), (61, 36), (34, 43), (63, 43)])
    else:  # short + glasses
        b += f'<path d="M34 42c0-11 6-16 14-16s14 5 14 16c-4-5-9-7-14-7s-10 2-14 7z" fill="{hair}"/>'
        b += glasses(47)
    return svg(bg, b)


def girl(v):
    skin, hair, cloth, bg = SKINS[(v + 3) % 4], HAIRS[(v + 1) % 4], [NAVY, GOLD, INDIGO, ORANGE][v], BGS[(v + 3) % 4]
    b = ""
    if v == 0:  # pigtails
        b += f'<circle cx="28" cy="40" r="7" fill="{hair}"/><circle cx="68" cy="40" r="7" fill="{hair}"/>'
    if v == 2:  # bob
        b += f'<path d="M31 46c0-14 7-21 17-21s17 7 17 21v12c-6 3-28 3-34 0z" fill="{hair}"/>'
    b += child_body(cloth, skin) + f'<ellipse cx="48" cy="46" rx="15" ry="16" fill="{skin}"/>'
    if v == 1:  # ponytail
        b += f'<path d="M60 34c10 2 13 12 9 24-2-7-5-12-11-15z" fill="{hair}"/>'
    b += f'<path d="M33 45c0-13 7-19 15-19s15 6 15 19c-4-7-9-10-15-10s-11 3-15 10z" fill="{hair}"/>'
    if v == 0:
        b += f'<circle cx="31" cy="40" r="2.5" fill="{ORANGE}"/><circle cx="65" cy="40" r="2.5" fill="{ORANGE}"/>'
    if v == 2:  # hairband
        b += f'<path d="M34 37c4-6 9-9 14-9s10 3 14 9" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>'
    if v == 3:  # side clip
        b += f'<rect x="54" y="31" width="9" height="3.5" rx="1.75" fill="{GOLD}" transform="rotate(-20 58 33)"/>'
    return svg(bg, b)


def student(v):
    col, bg = [NAVY, INDIGO, NAVY, INDIGO][v], BGS[v]
    b = (f'<path d="M18 100c0-18 13-29 30-29s30 11 30 29z" fill="{col}" opacity=".85"/>'
         f'<circle cx="48" cy="47" r="15" fill="{col}" opacity=".85"/>'
         f'<path d="M22 30l26-11 26 11-26 11z" fill="{NAVY}"/>'
         f'<path d="M33 35v8c4 4 26 4 30 0v-8l-15 6z" fill="{NAVY}"/>'
         f'<path d="M70 31v13" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>'
         f'<circle cx="70" cy="46" r="3" fill="{ORANGE}"/>')
    return svg(bg, b)


for name, fn in [("man", man), ("woman", woman), ("boy", boy), ("girl", girl), ("student", student)]:
    for v in range(4):
        with open(os.path.join(OUT, f"{name}-{v + 1}.svg"), "w") as f:
            f.write(fn(v))
print("avatars written")
