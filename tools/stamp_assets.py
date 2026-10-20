#!/usr/bin/env python3
"""Cache-busting: add ?v=<content hash> to every local CSS/JS/image link in public/**/*.html.

Cloudflare tells browsers to keep static files for hours, so without this a visitor can see a new
page with an old stylesheet. The hash changes only when the file changes.
Run after editing any HTML, CSS or JS:   python3 tools/stamp_assets.py public
(tools/build_pages.py runs it automatically.)
"""
import hashlib, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "public"
REF = re.compile(r'((?:href|src)=")(/(?:assets|app|brand|images)/[^"?#]+\.(?:css|js|svg|png|webp|jpg))(?:\?v=[0-9a-f]+)?(")')
_cache = {}


def version(url):
    if url not in _cache:
        path = os.path.join(ROOT, url.lstrip("/"))
        try:
            with open(path, "rb") as f:
                _cache[url] = hashlib.sha256(f.read()).hexdigest()[:10]
        except FileNotFoundError:
            _cache[url] = None
    return _cache[url]


def stamp(m):
    v = version(m.group(2))
    return f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}" if v else m.group(0)


changed = 0
for dirpath, _, files in os.walk(ROOT):
    for name in files:
        if not name.endswith(".html"):
            continue
        p = os.path.join(dirpath, name)
        with open(p, encoding="utf-8") as f:
            s = f.read()
        t = REF.sub(stamp, s)
        if t != s:
            with open(p, "w", encoding="utf-8") as f:
                f.write(t)
            changed += 1
print(f"stamped {changed} page(s)")
