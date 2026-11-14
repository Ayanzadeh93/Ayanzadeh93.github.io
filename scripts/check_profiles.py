#!/usr/bin/env python3
"""Compare data/publications.json with your DBLP and ORCID records.

Reports papers that one side lists and the other does not, so a new paper
indexed by DBLP or added to ORCID is not forgotten on the site. It only reads;
nothing is changed.

    python scripts/check_profiles.py              # needs internet access
    python scripts/check_profiles.py --self-test  # offline check of the parsers

Titles are compared after folding case, accents and punctuation, so
"PURSUhInT: In Search of…" matches "Pursuhint - in search of…". A paper that
was renamed between versions will show up on both sides of the report.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DBLP_PID = "207/7890"
ORCID = "0000-0002-8816-3204"
UA = {"User-Agent": "academic-site-profile-check/1.0"}


def norm(title: str) -> str:
    folded = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", folded)


def get(url: str, accept: str) -> bytes:
    request = urllib.request.Request(url, headers={**UA, "Accept": accept})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def parse_dblp(xml: bytes) -> list[tuple[str, str]]:
    root = ET.fromstring(xml)
    papers = []
    for record in root.iter("r"):
        for item in record:
            title = "".join(item.find("title").itertext()) if item.find("title") is not None else ""
            year = item.findtext("year") or ""
            if title:
                papers.append((title.rstrip("."), year))
    return papers


def parse_orcid(payload: bytes) -> list[tuple[str, str]]:
    data = json.loads(payload)
    papers = []
    for group in data.get("group", []):
        summary = (group.get("work-summary") or [{}])[0]
        title = ((summary.get("title") or {}).get("title") or {}).get("value", "")
        year = (((summary.get("publication-date") or {}).get("year")) or {}).get("value", "")
        if title:
            papers.append((title, year or ""))
    return papers


def compare(site: list[dict], remote: list[tuple[str, str]], name: str) -> int:
    site_titles = {norm(p["title"]): p for p in site}
    remote_titles = {norm(t): (t, y) for t, y in remote}

    def known(key: str, pool) -> bool:
        return any(key[:40] and (key[:40] in other or other[:40] in key) for other in pool)

    missing_here = [remote_titles[k] for k in remote_titles if not known(k, site_titles)]
    missing_there = [site_titles[k] for k in site_titles if not known(k, remote_titles)]
    print(f"\n{name}: {len(remote)} records")
    for title, year in missing_here:
        print(f"  on {name}, not on the site: {title} ({year})")
    for pub in missing_there:
        print(f"  on the site, not on {name}: {pub['title']} ({pub['year']})")
    if not missing_here and not missing_there:
        print("  in agreement")
    return len(missing_here)


def self_test() -> int:
    dblp = b"""<dblpperson><r><inproceedings key="x"><title>Floorplan2Guide: LLM-Guided Floorplan Parsing for BLV Indoor Navigation.</title><year>2025</year></inproceedings></r>
    <r><article key="y"><title>A Paper Only On <i>DBLP</i>.</title><year>2024</year></article></r></dblpperson>"""
    orcid = json.dumps({"group": [{"work-summary": [{"title": {"title": {"value": "PURSUhInT: in search of informative hint points based on layer clustering for knowledge distillation"}},
                                                      "publication-date": {"year": {"value": "2023"}}}]}]}).encode()
    site = [{"title": "Floorplan2Guide: LLM-Guided Floorplan Parsing for BLV Indoor Navigation", "year": 2025},
            {"title": "PURSUhInT: In Search of Informative Hint Points Based on Layer Clustering for Knowledge Distillation", "year": 2023}]
    d, o = parse_dblp(dblp), parse_orcid(orcid)
    checks = [
        (len(d) == 2 and d[1][0] == "A Paper Only On DBLP", "DBLP parser reads titles with markup"),
        (len(o) == 1 and o[0][1] == "2023", "ORCID parser reads title and year"),
        (compare(site, d, "DBLP (fixture)") == 1, "a DBLP-only paper is reported"),
        (compare(site, o, "ORCID (fixture)") == 0, "case and punctuation do not matter"),
    ]
    failed = [name for ok, name in checks if not ok]
    for name in failed:
        print(f"FAIL {name}")
    print("\nprofile check self-test:", "FAIL" if failed else "PASS")
    return 1 if failed else 0


def main() -> int:
    if "--self-test" in sys.argv[1:]:
        return self_test()
    site = json.loads((ROOT / "data" / "publications.json").read_text(encoding="utf-8"))["publications"]
    missing = 0
    for name, load in (("DBLP", lambda: parse_dblp(get(f"https://dblp.org/pid/{DBLP_PID}.xml", "application/xml"))),
                       ("ORCID", lambda: parse_orcid(get(f"https://pub.orcid.org/v3.0/{ORCID}/works", "application/json")))):
        try:
            missing += compare(site, load(), name)
        except Exception as error:
            print(f"\n{name}: could not fetch the record ({error})")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
