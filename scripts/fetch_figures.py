#!/usr/bin/env python3
"""Save the paper figures that are hot-linked from other sites into this repository.

Some paper pages show figures straight from arxiv.org (and one from a temporary
preview host). If those addresses change, the figure disappears. Run this once on
a machine with normal internet access:

    python scripts/fetch_figures.py            # download, then update the data file
    python scripts/fetch_figures.py --dry-run  # only list what would be fetched
    python scripts/build_site.py               # regenerate the pages

Each image is saved as assets/figures/<paper-id>-fig<N>.<ext>; the figure's `src`
in data/publications.json becomes that local path and the original address is
kept as `source`. A figure that cannot be downloaded is left as it is.
Before committing, check that the paper's licence lets you host the figure
(arXiv's default licence does not grant redistribution; CC BY does).
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {"image/png": ".png", "image/jpeg": ".jpg", "image/svg+xml": ".svg", "image/webp": ".webp", "image/gif": ".gif"}


def fetch(url: str, timeout: int = 30) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "academic-site-figure-fetcher/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        kind = response.headers.get_content_type()
        return response.read(), kind


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", default=str(ROOT / "data" / "publications.json"))
    parser.add_argument("--out", default=str(ROOT / "assets" / "figures"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data_path, out_dir = Path(args.data), Path(args.out)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    changed = failed = 0

    for pub in data["publications"]:
        for index, fig in enumerate((pub.get("page") or {}).get("figures") or [], 1):
            src = fig.get("src", "")
            if not src.startswith(("http://", "https://")):
                continue
            print(f"{pub['id']} figure {index}: {src}")
            if args.dry_run:
                continue
            try:
                body, kind = fetch(src)
            except Exception as error:  # network, 404, TLS: report and move on
                print(f"  could not download: {error}")
                failed += 1
                continue
            if not kind.startswith("image/"):
                print(f"  skipped: the address returned {kind}, not an image")
                failed += 1
                continue
            ext = EXTENSIONS.get(kind) or mimetypes.guess_extension(kind) or ".img"
            out_dir.mkdir(parents=True, exist_ok=True)
            target = out_dir / f"{pub['id'].lower()}-fig{index}{ext}"
            target.write_bytes(body)
            try:
                fig["src"] = target.relative_to(ROOT).as_posix()
            except ValueError:
                fig["src"] = target.as_posix()
            fig["source"] = src
            changed += 1
            print(f"  saved {fig['src']} ({len(body) // 1024} KB)")

    if changed:
        data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"updated {data_path.name}: {changed} figure(s) now local. Run python scripts/build_site.py")
    if failed:
        print(f"{failed} figure(s) could not be saved")
    return 1 if failed and not changed else 0


if __name__ == "__main__":
    sys.exit(main())
