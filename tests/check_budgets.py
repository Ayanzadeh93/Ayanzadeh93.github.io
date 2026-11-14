#!/usr/bin/env python3
"""Byte budgets for the in-scope pages and the assets they load.

A page that quietly doubles in weight fails CI here, long before anyone
notices it on a slow connection. Budgets are uncompressed sizes; GitHub Pages
serves HTML, CSS, JS and SVG gzip-compressed, so the wire size is smaller.

    python tests/check_budgets.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KB = 1024

BUDGETS = {
    "index.html": 140 * KB,
    "publications.html": 120 * KB,
    "cv.html": 80 * KB,
    "contact.html": 40 * KB,
    "blog.html": 40 * KB,
    "accessibility.html": 40 * KB,
    "404.html": 30 * KB,
    "css/site.css": 100 * KB,
    "js/site.js": 40 * KB,
    "js/theme-init.js": 2 * KB,
    "assets/icons/tech.svg": 48 * KB,
    "images/profile-640.webp": 90 * KB,
    "images/profile-320.webp": 40 * KB,
}
GROUPS = {
    # every paper page
    "*/index.html (paper pages)": ([p for p in ROOT.glob("*/index.html") if (ROOT / "data").exists()], 60 * KB),
    "fonts/*.woff2 (all together)": (list(ROOT.glob("fonts/*.woff2")), 420 * KB),
    "assets/og/*.png (each)": (list(ROOT.glob("assets/og/*.png")), 160 * KB),
}
# Folders that are separate projects, with their own budgets.
SKIP = {"projects", "adhd-study-pack", "claude-code-encyclopedia", "blog"}


def main() -> int:
    failures = []
    for relative, limit in BUDGETS.items():
        size = (ROOT / relative).stat().st_size
        if size > limit:
            failures.append(f"{relative}: {size // KB} KB > {limit // KB} KB")
    for label, (paths, limit) in GROUPS.items():
        if "all together" in label:
            total = sum(p.stat().st_size for p in paths)
            if total > limit:
                failures.append(f"{label}: {total // KB} KB > {limit // KB} KB")
            continue
        for path in paths:
            if path.parent.name in SKIP:
                continue
            size = path.stat().st_size
            if size > limit:
                failures.append(f"{path.relative_to(ROOT)}: {size // KB} KB > {limit // KB} KB")
    for failure in failures:
        print(f"OVER BUDGET {failure}")
    print(f"size budgets: {'FAIL' if failures else 'PASS'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
