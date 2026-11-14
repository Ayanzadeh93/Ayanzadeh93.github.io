#!/usr/bin/env python3
"""Validate the publication data and the pages generated from it.

Run before committing a change to data/publications.json, data/news.json or
data/site.json (CI runs it too):

    python tests/validate_publications.py
    python tests/validate_publications.py --self-test   # prove the rules can fail

Checks, in order:
  1. schema of data/publications.json, data/news.json, data/site.json
  2. identifiers are well formed (DOI, arXiv id, BibTeX entry, unique keys)
  3. every local file a record points at exists (figures, slides, paper pages)
  4. every internal link and in-page anchor in the in-scope HTML resolves

It never opens the network: whether a DOI *resolves* is for the author to
confirm at https://doi.org/<doi> before adding it.
"""

from __future__ import annotations

import copy
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]

TYPES = {"article", "inproceedings", "incollection", "preprint"}
STATUSES = {"published", "accepted", "under-review", "preprint"}
REQUIRED = {"id", "title", "authors", "type", "year", "venue", "venue_short", "venue_line",
            "status", "topic", "summary", "bibtex"}
DOI = re.compile(r"^10\.\d{4,9}/\S+$")
ARXIV = re.compile(r"^\d{4}\.\d{4,5}$")
DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
BIB_HEAD = re.compile(r"^@(\w+)\{([^,\s]+),")

# Pages this validator owns. Projects pages are deliberately not listed.
STATIC_PAGES = ["index.html", "publications.html", "cv.html", "contact.html", "blog.html", "blog/multi-task-learning/index.html", "accessibility.html", "404.html"]


def read_json(relative: str):
    with (ROOT / relative).open(encoding="utf-8") as handle:
        return json.load(handle)


def is_url(value: str) -> bool:
    return isinstance(value, str) and value.startswith(("https://", "http://"))


# ── 1–3: data ──────────────────────────────────────────────────────────────

def validate_publications(data: dict, check_files: bool = True) -> list[str]:
    errors: list[str] = []
    if data.get("schemaVersion") != 1:
        errors.append("publications.json: schemaVersion must be 1")

    topics = data.get("topics") or []
    topic_ids = [t.get("id") for t in topics]
    if not topics or len(topic_ids) != len(set(topic_ids)):
        errors.append("publications.json: topics must be a non-empty list with unique ids")
    for topic in topics:
        if not (topic.get("name") and topic.get("summary") and topic.get("icon")):
            errors.append(f"topic {topic.get('id')}: needs a name, a summary and an icon")

    pubs = data.get("publications") or []
    if not pubs:
        errors.append("publications.json: no publications")
    ids = [p.get("id") for p in pubs]
    if len(ids) != len(set(ids)):
        errors.append("publication ids must be unique")

    keys: dict[str, str] = {}
    for pub in pubs:
        pid = pub.get("id") or "<missing id>"
        missing = REQUIRED - pub.keys()
        if missing:
            errors.append(f"{pid}: missing fields {sorted(missing)}")
            continue

        if pub["type"] not in TYPES:
            errors.append(f"{pid}: unknown type {pub['type']!r}")
        if pub["status"] not in STATUSES:
            errors.append(f"{pid}: unknown status {pub['status']!r}")
        if pub["topic"] not in topic_ids:
            errors.append(f"{pid}: unknown topic {pub['topic']!r}")
        if not (isinstance(pub["year"], int) and 1990 <= pub["year"] <= 2100):
            errors.append(f"{pid}: year must be an integer")
        if not (isinstance(pub["authors"], list) and pub["authors"] and all(isinstance(a, str) and a.strip() for a in pub["authors"])):
            errors.append(f"{pid}: authors must be a non-empty list of names")
        for field in ("title", "venue", "venue_short", "venue_line", "summary"):
            if not str(pub[field]).strip():
                errors.append(f"{pid}: {field} is empty")
        if pub.get("title_lead") and not pub["title"].startswith(pub["title_lead"]):
            errors.append(f"{pid}: title_lead must be the beginning of title")

        if "doi" in pub and not DOI.match(pub["doi"]):
            errors.append(f"{pid}: malformed DOI {pub['doi']!r}")
        if "arxiv" in pub and not ARXIV.match(pub["arxiv"]):
            errors.append(f"{pid}: malformed arXiv id {pub['arxiv']!r}")

        # BibTeX: one well-formed entry with a unique key and consistent ids.
        bib = pub["bibtex"].strip()
        head = BIB_HEAD.match(bib)
        if not head or not bib.endswith("}"):
            errors.append(f"{pid}: bibtex must be a single '@type{{key, … }}' entry")
        else:
            if bib.count("{") != bib.count("}"):
                errors.append(f"{pid}: bibtex has unbalanced braces")
            key = head.group(2)
            if key in keys:
                errors.append(f"{pid}: bibtex key {key!r} is also used by {keys[key]}")
            keys[key] = pid
            bib_doi = re.search(r"\bdoi\s*=\s*\{([^}]*)\}", bib)
            if bib_doi and pub.get("doi") and bib_doi.group(1).strip().lower() != pub["doi"].lower():
                errors.append(f"{pid}: bibtex doi {bib_doi.group(1)!r} differs from doi {pub['doi']!r}")
            bib_arxiv = re.search(r"\beprint\s*=\s*\{([^}]*)\}", bib)
            if bib_arxiv and pub.get("arxiv") and bib_arxiv.group(1).strip() != pub["arxiv"]:
                errors.append(f"{pid}: bibtex eprint {bib_arxiv.group(1)!r} differs from arxiv {pub['arxiv']!r}")

        for label, target in (pub.get("links") or {}).items():
            if is_url(target):
                continue
            if check_files and not (ROOT / target).is_file():
                errors.append(f"{pid}: links.{label} points at a missing file: {target}")

        page = pub.get("page")
        if page is None:
            if not is_url(pub.get("external_page", "")):
                errors.append(f"{pid}: needs either a page block or an external_page URL")
            continue
        if not page.get("description", "").strip():
            errors.append(f"{pid}: page.description is empty")
        if not (isinstance(page.get("abstract"), list) and page["abstract"] and all(p.strip() for p in page["abstract"])):
            errors.append(f"{pid}: page.abstract must be a non-empty list of paragraphs")
        for index, fig in enumerate(page.get("figures") or [], 1):
            if not fig.get("caption", "").strip():
                errors.append(f"{pid}: figure {index} has no caption")
            if fig.get("svg"):
                if check_files and not (ROOT / fig["svg"]).is_file():
                    errors.append(f"{pid}: figure {index} file missing: {fig['svg']}")
            elif fig.get("src"):
                if not fig.get("alt", "").strip():
                    errors.append(f"{pid}: figure {index} is an image and needs alt text")
                if not is_url(fig["src"]) and check_files and not (ROOT / fig["src"].lstrip("/")).is_file():
                    errors.append(f"{pid}: figure {index} file missing: {fig['src']}")
            else:
                errors.append(f"{pid}: figure {index} needs an svg file, a local image or an https src")
        for item in page.get("highlights") or []:
            if not (str(item.get("value", "")).strip() and str(item.get("label", "")).strip()):
                errors.append(f"{pid}: every highlight needs a value and a label")
            elif not any(str(item["value"]).replace("–", "-").split()[0].rstrip("%") in paragraph.replace("–", "-")
                         for paragraph in page.get("abstract") or []):
                errors.append(f"{pid}: highlight {item['value']!r} does not appear in the abstract")
        for card in page.get("method") or []:
            if not (card.get("title") and card.get("text")):
                errors.append(f"{pid}: every method card needs a title and text")
        for res in page.get("resources") or []:
            if not (res.get("label") and res.get("text")):
                errors.append(f"{pid}: every resource needs a label and text")
            if res.get("url") and not is_url(res["url"]):
                errors.append(f"{pid}: resource {res.get('label')!r} url must be absolute")
        if check_files and not (ROOT / pid / "index.html").is_file():
            errors.append(f"{pid}: paper page not generated — run python scripts/build_site.py")
    return errors


def validate_news(news: dict) -> list[str]:
    errors = []
    for index, item in enumerate(news.get("items") or [], 1):
        if not DATE.match(str(item.get("date", ""))):
            errors.append(f"news item {index}: date must be YYYY, YYYY-MM or YYYY-MM-DD")
        if not (item.get("kind") and item.get("text")):
            errors.append(f"news item {index}: needs kind and text")
    return errors


def validate_site(site: dict) -> list[str]:
    errors = []
    if not is_url(site.get("url", "")) or site["url"].endswith("/"):
        errors.append("site.json: url must be absolute, without a trailing slash")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(site.get("updated", ""))):
        errors.append("site.json: updated must be YYYY-MM-DD")
    labels = [item.get("label") for item in site.get("nav") or []]
    if "Projects" not in labels:
        errors.append("site.json: the navigation must keep a Projects entry")
    for profile in site.get("profiles") or []:
        if not (profile.get("label") and is_url(profile.get("url", ""))):
            errors.append(f"site.json: profile {profile.get('label')!r} needs an absolute url")
    return errors


# ── 4: links inside the generated and hand-written pages ───────────────────

class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.add(attributes["id"])
        for name in ("href", "src"):
            value = attributes.get(name)
            if value and not (tag == "use" and name == "href"):
                self.links.append(value)
        if tag == "use" and attributes.get("href", "").startswith("#"):
            self.links.append(attributes["href"])
        for candidate in (attributes.get("srcset") or attributes.get("imagesrcset") or "").split(","):
            if candidate.strip():
                self.links.append(candidate.strip().split()[0])


def collect(path: Path) -> LinkCollector:
    parser = LinkCollector()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def validate_links(pages: list[str]) -> list[str]:
    errors = []
    cache: dict[Path, LinkCollector] = {}

    def page(path: Path) -> LinkCollector:
        if path not in cache:
            cache[path] = collect(path)
        return cache[path]

    for relative in pages:
        source = ROOT / relative
        if not source.is_file():
            errors.append(f"{relative}: file missing")
            continue
        for link in page(source).links:
            parsed = urlparse(link)
            if parsed.scheme or link.startswith("//"):
                continue  # external, mailto:, data: — not checked offline
            target_path = unquote(parsed.path)
            if not target_path:
                target = source
            elif target_path.startswith("/"):
                target = ROOT / target_path.lstrip("/")
            else:
                target = source.parent / target_path
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                errors.append(f"{relative}: broken link {link}")
                continue
            if parsed.fragment and target.suffix == ".html" and parsed.fragment not in page(target).ids:
                errors.append(f"{relative}: anchor #{parsed.fragment} not found in {target.relative_to(ROOT)}")
    return errors


# ── Self-test: every rule family must be able to fail ──────────────────────

def self_test(data: dict) -> list[str]:
    def broken(mutate) -> bool:
        clone = copy.deepcopy(data)
        mutate(clone)
        return bool(validate_publications(clone, check_files=False))

    first = lambda d: d["publications"][0]  # noqa: E731
    cases = {
        "missing field": lambda d: first(d).pop("venue"),
        "bad type": lambda d: first(d).update(type="poster"),
        "bad status": lambda d: first(d).update(status="rejected"),
        "unknown topic": lambda d: first(d).update(topic="nope"),
        "duplicate id": lambda d: d["publications"].append(copy.deepcopy(first(d))),
        "malformed doi": lambda d: first(d).update(doi="doi:10.1/x"),
        "malformed arxiv": lambda d: first(d).update(arxiv="arXiv:2609.17763"),
        "unbalanced bibtex": lambda d: first(d).update(bibtex=first(d)["bibtex"] + "}"),
        "doi mismatch": lambda d: first(d).update(doi="10.9999/elsewhere"),
        "empty authors": lambda d: first(d).update(authors=[]),
        "title_lead mismatch": lambda d: first(d).update(title_lead="Not the title"),
        "highlight not in abstract": lambda d: first(d)["page"].update(highlights=[{"value": "99.99%", "label": "x"}]),
    }
    return [f"self-test: rule did not fire for '{name}'" for name, mutate in cases.items() if not broken(mutate)]


def main() -> int:
    data = read_json("data/publications.json")

    if "--self-test" in sys.argv[1:]:
        failures = self_test(data)
        for failure in failures:
            print(failure)
        print("publication validation self-test:", "FAIL" if failures else "PASS")
        return 1 if failures else 0

    errors = validate_publications(data)
    errors += validate_news(read_json("data/news.json"))
    errors += validate_site(read_json("data/site.json"))
    pages = STATIC_PAGES + [f"{p['id']}/index.html" for p in data.get("publications", []) if p.get("page")]
    errors += validate_links(pages)

    for error in errors:
        print(f"ERROR {error}")
    print(f"publication validation: {'FAIL' if errors else 'PASS'} "
          f"({len(data.get('publications', []))} publications, {len(pages)} pages)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
