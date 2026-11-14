#!/usr/bin/env python3
"""Generate the data-backed parts of ayanzadeh.com.

Sources (edit these):
    data/publications.json   every publication: metadata, links, paper-page content
    data/news.json           hand-written news items
    data/profile.json        education, experience, teaching, service, honours
    data/site.json           name, navigation, profile links, toolkit
    assets/figures/*.svg     redrawn figures inlined into paper pages

Outputs (do not edit by hand — rerun this script):
    <id>/index.html          one page per publication that has a "page" block
    publications.html        the publication library
    cv.html                  the web curriculum vitae
    assets/publications.bib  every curated BibTeX entry
    sitemap.xml              in-scope URLs (Projects entries are kept verbatim)
    regions marked <!-- build:NAME --> … <!-- /build:NAME --> inside
    index.html, contact.html, blog.html, blog/multi-task-learning/index.html, 404.html and llms.txt
    feed.xml, accessibility.html

Usage:
    python scripts/build_site.py           write outputs
    python scripts/build_site.py --check   exit 1 if any output is stale (CI)

No third-party dependencies; Python 3.9+. The site still deploys as plain
committed files — this script only saves the author from maintaining the same
bibliography in four places.

The Projects section (projects/, css/project*.css, js/project*.js,
data/projects.json) is never read or written here.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TYPE_LABEL = {
    "article": "Journal article",
    "inproceedings": "Conference paper",
    "incollection": "Book chapter",
    "preprint": "Preprint",
}
TYPE_CHIP = {
    "article": "Journal",
    "inproceedings": "Conference",
    "incollection": "Book chapter",
    "preprint": "Preprint",
}
# Only work that is still under review carries a visible status pill; an
# accepted or published paper is simply listed under its venue.
STATUS_LABEL = {"under-review": "Under review"}
STATUS_CLASS = {"under-review": "pill--pending"}
# Citation styles still need to say that an accepted paper is not out yet.
CITATION_STATUS = {"accepted": "Accepted", "under-review": "Under review"}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

CSP = (
    "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; "
    "connect-src 'self' https://formspree.io; form-action 'self' https://formspree.io; "
    "frame-src 'none'; manifest-src 'self'"
)


# ── Small helpers ──────────────────────────────────────────────────────────

def esc(value) -> str:
    return html.escape(str(value), quote=True)


def read_json(relative: str):
    with (ROOT / relative).open(encoding="utf-8") as handle:
        return json.load(handle)


def icon(name: str, extra: str = "") -> str:
    solid = " icon--solid" if name in ("github", "linkedin") else ""
    cls = f"icon{solid}{' ' + extra if extra else ''}"
    return f'<svg class="{cls}" aria-hidden="true" focusable="false"><use href="#i-{name}"/></svg>'


def json_ld(payload: dict) -> str:
    body = json.dumps(payload, indent=2, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/ld+json">\n{body}\n</script>'


def indent(block: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in block.split("\n"))


# ── Shared chrome ──────────────────────────────────────────────────────────

SPRITE = """<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" class="visually-hidden" aria-hidden="true" focusable="false">
  <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></symbol>
  <symbol id="i-external" viewBox="0 0 24 24"><path d="M14 5h5v5"/><path d="M19 5 10 14"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></symbol>
  <symbol id="i-quote" viewBox="0 0 24 24"><path d="M10 7H6a1 1 0 0 0-1 1v4h5V8"/><path d="M10 12c0 3-1.5 4.5-4.5 5"/><path d="M19 7h-4a1 1 0 0 0-1 1v4h5V8"/><path d="M19 12c0 3-1.5 4.5-4.5 5"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
  <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13.5 5-3 14"/></symbol>
  <symbol id="i-slides" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></symbol>
  <symbol id="i-t-route" viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 17.6c6-.6 1.6-10.6 7.6-11.2"/></symbol>
  <symbol id="i-t-flame" viewBox="0 0 24 24"><path d="M12 3c.6 3.2 5 5.2 5 10a5 5 0 0 1-10 0c0-1.9.8-3.2 2-4.4.2 1.7.9 2.6 1.9 2.9C10.6 8.600 10.800 6 12 3z"/></symbol>
  <symbol id="i-t-cell" viewBox="0 0 24 24"><path d="M12 3.5c4.800 0 8.500 3.300 8.500 8 0 5-4 9-8.800 9C7 20.500 3.500 17 3.500 12.200 3.500 7.300 7.200 3.500 12 3.500z"/><circle cx="10.5" cy="11" r="2.6"/><circle cx="15.800" cy="15" r="0.9"/></symbol>
  <symbol id="i-t-layers" viewBox="0 0 24 24"><path d="M12 4 4 8l8 4 8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/></symbol>
  <symbol id="i-t-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16M14 14l3 3"/></symbol>
  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></symbol>
  <symbol id="i-github" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></symbol>
  <symbol id="i-linkedin" viewBox="0 0 16 16"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/></symbol>
</svg>"""

BRAND_MARK = (
    '<svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'
    '<rect class="m-plate" width="32" height="32" rx="8"/>'
    '<path class="m-glyph" d="M9.5 23.5 16 8.5l6.5 15M12.2 18.5h7.6" fill="none" stroke-width="2.2" '
    'stroke-linecap="round" stroke-linejoin="round"/>'
    '<circle class="m-dot" cx="25" cy="7" r="2.6"/></svg>'
)


def head_assets() -> str:
    """Fonts, stylesheet and the pre-paint theme script every page shares."""
    return "\n".join([
        '<link rel="preload" href="/fonts/newsreader-var-latin.woff2" as="font" type="font/woff2" crossorigin>',
        '<link rel="preload" href="/fonts/atkinson-hyperlegible-400-latin.woff2" as="font" type="font/woff2" crossorigin>',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="alternate" type="application/rss+xml" title="Aydin Ayanzadeh: publications and news" href="/feed.xml">',
        '<link rel="stylesheet" href="/css/site.css">',
        '<script src="/js/theme-init.js"></script>',
    ])


def render_header(site: dict, current: str | None = None, home: bool = False) -> str:
    """Site header. On the homepage, in-page links carry data-spy for the scroll spy."""
    items = []
    for item in site["nav"]:
        href = item["href"]
        attrs = ""
        if home and href.startswith("/#"):
            href = href[1:]
            attrs = f' data-spy="{esc(item["id"])}"'
        if current == item["id"]:
            attrs += ' aria-current="page"'
        items.append(f'        <li><a class="site-nav__link" href="{esc(href)}"{attrs}>{esc(item["label"])}</a></li>')
    name = esc(site["person"]["name"])
    brand_href = "#top" if home else "/"
    return f"""{SPRITE}
<a class="skip-link ds" href="#main">Skip to main content</a>
<header class="site-header ds" data-site-header>
  <div class="site-header__inner">
    <a class="brand" href="{brand_href}" aria-label="{name}, home">
      {BRAND_MARK}
      <span class="brand__name">{name}</span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="Primary">
      <ul class="site-nav__list">
{chr(10).join(items)}
      </ul>
    </nav>
    <div class="site-header__tools">
      <a class="button button--sm button--cv" href="{esc(site["person"]["cvPage"])}"{' aria-current="page"' if current == "cv" else ""}>{icon("file")}<span>CV</span></a>
      <button class="icon-btn" type="button" data-theme-toggle aria-pressed="false" aria-label="Switch to dark theme">
        {icon("moon", "icon--moon")}{icon("sun", "icon--sun")}
      </button>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
        {icon("menu", "icon--menu")}{icon("close", "icon--close")}
      </button>
    </div>
  </div>
</header>"""


def render_footer(site: dict, pubs: list[dict]) -> str:
    person = site["person"]
    nav = "\n".join(
        f'          <li><a href="{esc(item["href"])}">{esc(item["label"])}</a></li>'
        for item in site["nav"] + site.get("footerExtra", [])
    )
    profiles = "\n".join(
        f'          <li><a href="{esc(p["url"])}" rel="me noopener">{esc(p["label"])}</a></li>' for p in site["profiles"]
    )
    year = site["updated"][:4]
    return f"""<footer class="site-footer ds">
  <div class="wrap">
    <div class="site-footer__grid">
      <div class="site-footer__about">
        <a class="brand" href="/">{BRAND_MARK}<span class="brand__name">{esc(person["name"])}</span></a>
        <p>{esc(person["blurb"])}</p>
      </div>
      <nav aria-label="Site">
        <h2>Site</h2>
        <ul class="site-footer__links">
{nav}
        </ul>
      </nav>
      <nav aria-label="Profiles">
        <h2>Profiles</h2>
        <ul class="site-footer__links">
{profiles}
        </ul>
      </nav>
      <nav aria-label="Downloads">
        <h2>Downloads</h2>
        <ul class="site-footer__links">
          <li><a href="{esc(person["cvPage"])}">Curriculum vitae</a></li>
          <li><a href="{esc(person["cv"])}">Curriculum vitae (PDF)</a></li>
          <li><a href="/assets/publications.bib" download>All publications (BibTeX)</a></li>
          <li><a href="/sitemap.xml">Sitemap</a></li>
          <li><a href="mailto:{esc(person["email"])}">{esc(person["email"])}</a></li>
        </ul>
      </nav>
    </div>
    <div class="site-footer__base">
      <p>&copy; {year} {esc(person["name"])}. Last updated {esc(human_date(site["updated"]))}.</p>
      <p>Set in Newsreader and Atkinson Hyperlegible, a typeface designed for low-vision readers. No tracking cookies.</p>
    </div>
  </div>
</footer>"""


def human_date(value: str) -> str:
    parts = value.split("-")
    if len(parts) == 1:
        return parts[0]
    month = MONTHS[int(parts[1]) - 1]
    if len(parts) == 2:
        return f"{month} {parts[0]}"
    return f"{int(parts[2])} {month} {parts[0]}"


def page_shell(*, title: str, description: str, canonical: str, og_type: str, og_image: str,
               head_extra: str, body: str, site: dict, pubs: list[dict], current: str | None,
               og_title: str | None = None, og_image_alt: str | None = None, robots: str = "index, follow") -> str:
    """A complete document for the fully generated pages."""
    person = site["person"]
    alt = f'\n<meta property="og:image:alt" content="{esc(og_image_alt)}">' if og_image_alt else ""
    return f"""<!doctype html>
<!-- Generated by scripts/build_site.py from data/. Edit the data, not this file. -->
<html lang="en" class="ds-root" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="author" content="{esc(person["name"])}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#1c4f6b">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{esc(person["name"])}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:title" content="{esc(og_title or title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{esc(og_image)}">{alt}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="{esc(person["twitter"])}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/manifest.json">
{head_assets()}
{head_extra}
</head>
<body class="ds">
{render_header(site, current=current)}
{body}
{render_footer(site, pubs)}
<cite-dialog></cite-dialog>
<script defer src="/js/site.js"></script>
<script type="module" src="/js/components/index.js"></script>
</body>
</html>
"""


# ── Publication model ──────────────────────────────────────────────────────

def pub_url(pub: dict) -> str:
    """Root-relative URL of the page a title should link to."""
    if pub.get("page"):
        return f'/{pub["id"]}/'
    return pub.get("external_page") or best_paper_link(pub)[1]


def is_arxiv_doi(doi: str) -> bool:
    return doi.lower().startswith("10.48550/arxiv.")


def best_paper_link(pub: dict) -> tuple[str, str]:
    """(label, url) of the most authoritative place to read the paper."""
    for label, url in paper_links(pub):
        return label, url
    return "", ""


def paper_links(pub: dict) -> list[tuple[str, str]]:
    """Every place the paper can be read, most useful first. Only real links."""
    links = pub.get("links", {})
    out: list[tuple[str, str]] = []
    if links.get("pdf"):
        out.append(("PDF", links["pdf"]))
    elif pub.get("arxiv"):
        out.append(("PDF", f'https://arxiv.org/pdf/{pub["arxiv"]}'))
    doi = pub.get("doi", "")
    if doi and not is_arxiv_doi(doi):
        out.append(("Publisher", f"https://doi.org/{doi}"))
    elif links.get("publisher"):
        out.append(("Publisher", links["publisher"]))
    if pub.get("arxiv"):
        out.append(("arXiv", f'https://arxiv.org/abs/{pub["arxiv"]}'))
    return out


LINK_ICON = {"PDF": "file", "Publisher": "external", "arXiv": "external", "Code": "code",
             "Slides": "slides", "Book": "book", "Project site": "external"}


def resource_links(pub: dict) -> list[tuple[str, str]]:
    links = pub.get("links", {})
    out = paper_links(pub)
    if links.get("code"):
        out.append(("Code", links["code"]))
    if links.get("slides"):
        url = links["slides"]
        out.append(("Slides", url if url.startswith("http") else "/" + url.lstrip("/")))
    if links.get("book"):
        out.append(("Book", links["book"]))
    return out


def ext_attrs(url: str) -> str:
    return ' target="_blank" rel="noopener noreferrer"' if url.startswith("http") else ""


def authors_inline(pub: dict, me: str) -> str:
    names = [f'<span class="me">{esc(n)}</span>' if n == me else esc(n) for n in pub["authors"]]
    if len(names) > 2:
        return ", ".join(names[:-1]) + ", and " + names[-1]
    return " and ".join(names)


def venue_html(pub: dict) -> str:
    """The citation line, with the container title set as <cite> when it appears verbatim."""
    line = pub["venue_line"]
    venue = pub["venue"]
    if venue in line and pub["type"] != "preprint":
        before, after = line.split(venue, 1)
        return f"{esc(before)}<cite>{esc(venue)}</cite>{esc(after)}"
    return esc(line)


def status_tag(pub: dict) -> str:
    label = STATUS_LABEL.get(pub["status"])
    if not label:
        return ""
    return f'<span class="pill {STATUS_CLASS[pub["status"]]}">{label}</span>'


def pub_entry(pub: dict, me: str, heading: str = "h3", summary: bool = True) -> str:
    """One publication as it appears in a list (library, home, related)."""
    url = pub_url(pub)
    links = []
    if pub.get("page"):
        links.append(f'<a class="pub__link pub__link--page" href="{esc(url)}">{icon("file")}Paper page</a>')
    elif pub.get("external_page"):
        links.append(f'<a class="pub__link pub__link--page" href="{esc(url)}">{icon("external")}Project site</a>')
    for label, href in resource_links(pub):
        links.append(f'<a class="pub__link" href="{esc(href)}"{ext_attrs(href)}>{icon(LINK_ICON[label])}{label}</a>')
    links.append(f'<button class="pub__link" type="button" data-cite="{esc(pub["id"])}" hidden>{icon("quote")}Cite</button>')

    summary_html = f'\n  <p class="pub__summary">{esc(pub["summary"])}</p>' if summary and pub.get("summary") else ""
    tag = status_tag(pub)
    type_tag = f'<span class="pill">{TYPE_LABEL[pub["type"]]}</span>'
    return f"""<article class="pub">
  <{heading} class="pub__title"><a href="{esc(url)}">{esc(pub["title"])}</a></{heading}>
  <p class="pub__authors">{authors_inline(pub, me)}</p>
  <p class="pub__venue"><span>{venue_html(pub)}</span>{type_tag}{tag}</p>{summary_html}
  <p class="pub__links">{"".join(links)}</p>
</article>"""


def citation_record(pub: dict, topics: dict) -> dict:
    """The record js/lib/citations.js formats; also what the library searches."""
    label, url = best_paper_link(pub)
    record = {
        "title": pub["title"],
        "authors": pub["authors"],
        "venue": pub["venue"],
        "venueShort": pub["venue_short"],
        "year": str(pub["year"]),
        "type": pub["type"],
        "url": url or pub.get("external_page", ""),
        "status": CITATION_STATUS.get(pub["status"], ""),
        "bibtex": pub["bibtex"],
        "keywords": " ".join([TYPE_LABEL[pub["type"]], topics[pub["topic"]]["name"], pub.get("summary", "")]),
    }
    for key in ("volume", "number", "pages", "publisher", "doi", "arxiv"):
        if pub.get(key):
            record[key] = pub[key]
    return record


def data_island(pubs: list[dict], topics: dict) -> str:
    payload = {pub["id"]: citation_record(pub, topics) for pub in pubs}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<script type="application/json" id="pub-data">{body}</script>'


# ── Structured data ────────────────────────────────────────────────────────

def person_ref(site: dict) -> dict:
    return {"@id": f'{site["url"]}/#person'}


def scholarly_ld(pub: dict, site: dict, with_abstract: bool = True) -> dict:
    base = site["url"]
    url = f'{base}/{pub["id"]}/' if pub.get("page") else pub.get("external_page", "")
    me = site["person"]["name"]
    authors = []
    for name in pub["authors"]:
        author = {"@type": "Person", "name": name}
        if name == me:
            author["@id"] = f"{base}/#person"
            author["url"] = f"{base}/"
        authors.append(author)

    kind = "Chapter" if pub["type"] == "incollection" else "ScholarlyArticle"
    data: dict = {
        "@type": kind,
        "@id": f"{url}#work" if url else None,
        "name": pub["title"],
        "headline": pub["title"][:110],
        "author": authors,
        "datePublished": str(pub["year"]),
        "inLanguage": "en",
        "url": url,
    }
    if pub["type"] == "article":
        part: dict = {"@type": "Periodical", "name": pub["venue"]}
        if pub.get("volume"):
            part = {"@type": "PublicationVolume", "volumeNumber": pub["volume"], "isPartOf": part}
        data["isPartOf"] = part
    elif pub["type"] == "incollection":
        book: dict = {"@type": "Book", "name": pub["venue"]}
        if pub.get("publisher"):
            book["publisher"] = {"@type": "Organization", "name": pub["publisher"]}
        data["isPartOf"] = book
    elif pub["type"] == "inproceedings":
        data["isPartOf"] = {"@type": "PublicationEvent", "name": pub["venue"]}
    else:
        data["creativeWorkStatus"] = "Preprint"
    if pub.get("pages") and re.fullmatch(r"\d+-\d+", pub["pages"]):
        data["pageStart"], data["pageEnd"] = pub["pages"].split("-")
    if pub["status"] == "accepted":
        data["creativeWorkStatus"] = "Accepted for publication"
    elif pub["status"] == "under-review":
        data["creativeWorkStatus"] = "Preprint, under review"

    same_as, identifiers = [], []
    if pub.get("doi"):
        same_as.append(f'https://doi.org/{pub["doi"]}')
        identifiers.append({"@type": "PropertyValue", "propertyID": "DOI", "value": pub["doi"]})
    if pub.get("arxiv"):
        same_as.append(f'https://arxiv.org/abs/{pub["arxiv"]}')
        identifiers.append({"@type": "PropertyValue", "propertyID": "arXiv", "value": pub["arxiv"]})
    if same_as:
        data["sameAs"] = same_as
    if identifiers:
        data["identifier"] = identifiers
    page = pub.get("page") or {}
    if with_abstract and page.get("abstract") and page.get("abstract_heading") == "Abstract":
        data["abstract"] = " ".join(page["abstract"])
    if with_abstract and pub.get("summary"):
        data["description"] = pub["summary"]
    return {key: value for key, value in data.items() if value not in (None, "")}


def breadcrumb_ld(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": name, "item": url}
            for index, (name, url) in enumerate(items, 1)
        ],
    }


def scholar_meta(pub: dict, site: dict) -> str:
    """Highwire Press tags — what Google Scholar reads to index a paper page."""
    tags = [("citation_title", pub["title"])]
    tags += [("citation_author", name) for name in pub["authors"]]
    tags.append(("citation_publication_date", str(pub["year"])))
    if pub["type"] == "article":
        tags.append(("citation_journal_title", pub["venue"]))
    elif pub["type"] == "inproceedings":
        tags.append(("citation_conference_title", pub["venue"]))
    elif pub["type"] == "incollection":
        tags.append(("citation_inbook_title", pub["venue"]))
    if pub.get("volume"):
        tags.append(("citation_volume", pub["volume"]))
    if pub.get("number"):
        tags.append(("citation_issue", pub["number"]))
    pages = pub.get("pages", "")
    if re.fullmatch(r"\d+-\d+", pages):
        first, last = pages.split("-")
        tags += [("citation_firstpage", first), ("citation_lastpage", last)]
    if pub.get("publisher"):
        tags.append(("citation_publisher", pub["publisher"]))
    if pub.get("doi"):
        tags.append(("citation_doi", pub["doi"]))
    if pub.get("arxiv"):
        tags.append(("citation_arxiv_id", pub["arxiv"]))
    pdf = pub.get("links", {}).get("pdf") or (f'https://arxiv.org/pdf/{pub["arxiv"]}' if pub.get("arxiv") else "")
    if pdf:
        tags.append(("citation_pdf_url", pdf))
    tags.append(("citation_abstract_html_url", f'{site["url"]}/{pub["id"]}/'))
    return "\n".join(f'<meta name="{name}" content="{esc(value)}">' for name, value in tags)


# ── Paper pages ────────────────────────────────────────────────────────────

def og_image_for(pub: dict, site: dict) -> str:
    card = ROOT / "assets" / "og" / f'{pub["id"]}.png'
    if card.is_file():
        return f'{site["url"]}/assets/og/{pub["id"]}.png'
    return f'{site["url"]}/images/profile-compressed.jpg'


def render_figure(fig: dict, index: int) -> str:
    if fig.get("svg"):
        media = (ROOT / fig["svg"]).read_text(encoding="utf-8").strip()
        missing = ""
    elif not fig["src"].startswith("http"):
        # A copy saved in the repository (scripts/fetch_figures.py).
        media = f'<img src="/{esc(fig["src"].lstrip("/"))}" alt="{esc(fig.get("alt", ""))}" loading="lazy" decoding="async">'
        missing = ""
    else:
        media = (f'<img src="{esc(fig["src"])}" alt="{esc(fig.get("alt", ""))}" loading="lazy" '
                 f'decoding="async" referrerpolicy="no-referrer">')
        missing = ('\n    <p class="figure__missing">This figure is hosted with the paper and could not be '
                   'loaded here. It is available in the paper linked above.</p>')
    return f"""<figure class="figure" data-figure id="fig-{index}">
  <div class="figure__plate">
    {media}
    <button class="figure__zoom" type="button" data-zoom aria-label="Enlarge figure {index}" hidden>{icon("expand")}</button>{missing}
  </div>
  <figcaption>{esc(fig["caption"])}</figcaption>
</figure>"""


def render_paper(pub: dict, pubs: list[dict], topics: dict, site: dict) -> str:
    page = pub["page"]
    me = site["person"]["name"]
    base = site["url"]
    canonical = f'{base}/{pub["id"]}/'

    # Title: the lead phrase keeps the accent the original pages gave it.
    title = pub["title"]
    lead = pub.get("title_lead", "")
    if lead and title.startswith(lead):
        title_html = f"<span>{esc(lead)}</span>{esc(title[len(lead):])}"
    else:
        title_html = esc(title)

    authors = "".join(
        ('<li class="me">' if name == me else "<li>") + esc(name) + "</li>" for name in pub["authors"]
    )
    affil = f'\n      <p class="paper-affil">{esc(pub["affiliations"])}</p>' if pub.get("affiliations") else ""

    actions = []
    for position, (label, href) in enumerate(resource_links(pub)):
        text = {"PDF": "Paper (PDF)", "Publisher": "Publisher version"}.get(label, label)
        cls = "button button--primary" if position == 0 else "button"
        actions.append(f'<a class="{cls}" href="{esc(href)}"{ext_attrs(href)}>{icon(LINK_ICON[label])}{text}</a>')
    cite_cls = "button" if actions else "button button--primary"
    actions.append(f'<a class="{cite_cls}" href="#cite">{icon("quote")}Cite</a>')

    tag = status_tag(pub)
    # Venue and year, said once; the status has its own tag beside it.
    eyebrow = pub["venue_short"] if str(pub["year"]) in pub["venue_short"] else f'{pub["venue_short"]} · {pub["year"]}'
    figures = "\n".join(render_figure(fig, i) for i, fig in enumerate(page.get("figures", []), 1))
    figures_section = f'\n      <section aria-label="Figures">\n{indent(figures, 8)}\n      </section>' if figures else ""

    abstract_heading = page.get("abstract_heading", "Abstract")
    abstract = "\n".join(f'        <p class="abstract">{esc(p)}</p>' for p in page["abstract"])
    notes = "\n".join(f'        <p class="note">{esc(html.unescape(n))}</p>' for n in page.get("notes", []))
    notes = "\n" + notes if notes else ""

    toc = [("abstract", abstract_heading)]
    results_section = ""
    if page.get("highlights"):
        tiles = "\n".join(
            f'          <li><span class="stat__v">{esc(h["value"])}</span><span class="stat__k">{esc(h["label"])}</span></li>'
            for h in page["highlights"]
        )
        toc.append(("results", "Reported results"))
        results_section = f"""
      <section id="results" aria-labelledby="results-h">
        <h2 id="results-h">Reported results</h2>
        <ul class="stats">
{tiles}
        </ul>
        <p class="stats__note">Figures as stated in the abstract.</p>
      </section>"""
    method_section = ""
    if page.get("method"):
        layout = " steps--list" if page.get("method_layout") == "steps" else ""
        cards = "\n".join(
            f'          <li><h3>{esc(c["title"])}</h3><p>{esc(c["text"])}</p></li>' for c in page["method"]
        )
        heading = page.get("method_heading", "Method")
        toc.append(("method", heading))
        method_section = f"""
      <section id="method" aria-labelledby="method-h">
        <h2 id="method-h">{esc(heading)}</h2>
        <ol class="steps{layout}">
{cards}
        </ol>
      </section>"""

    resources_section = ""
    if page.get("resources"):
        rows = []
        for res in page["resources"]:
            value = esc(res["text"])
            if res.get("url"):
                value = f'<a href="{esc(res["url"])}"{ext_attrs(res["url"])}>{value}</a>'
            rows.append(f'          <div><dt>{esc(res["label"])}</dt><dd>{value}</dd></div>')
        toc.append(("resources", "Resources"))
        resources_section = f"""
      <section id="resources" aria-labelledby="resources-h">
        <h2 id="resources-h">Resources</h2>
        <dl class="kv">
{chr(10).join(rows)}
        </dl>
      </section>"""

    toc.append(("cite", "Cite"))
    related = [p for p in pubs if p["topic"] == pub["topic"] and p["id"] != pub["id"]][:4]
    related_section = ""
    if related:
        toc.append(("related", "Related"))
        items = "\n".join(f"          <li>\n{indent(pub_entry(p, me, heading='h3', summary=False), 12)}\n          </li>" for p in related)
        topic = topics[pub["topic"]]
        related_section = f"""
      <section id="related" aria-labelledby="related-h">
        <h2 id="related-h">Related publications</h2>
        <p class="muted">More from the research thread <a href="/publications.html?topic={esc(topic["id"])}">{esc(topic["name"])}</a>.</p>
        <ul class="related stack">
{items}
        </ul>
      </section>"""

    # Step through the papers in library order (newest first).
    paged = [p for p in pubs if p.get("page")]
    position = paged.index(pub)
    newer = paged[position - 1] if position > 0 else None
    older = paged[position + 1] if position + 1 < len(paged) else None
    pager_links = []
    if newer:
        pager_links.append(f'<a class="pager__link" rel="prev" href="/{esc(newer["id"])}/"><span class="pager__dir">Newer</span>'
                           f'<span class="pager__title">{esc(newer["title"])}</span></a>')
    else:
        pager_links.append("<span></span>")
    if older:
        pager_links.append(f'<a class="pager__link pager__link--next" rel="next" href="/{esc(older["id"])}/"><span class="pager__dir">Older</span>'
                           f'<span class="pager__title">{esc(older["title"])}</span></a>')
    pager = f"""
      <nav class="pager" aria-label="Neighbouring publications">
        {"".join(pager_links)}
      </nav>"""

    facts = [("Venue", venue_html(pub)), ("Year", str(pub["year"])), ("Type", TYPE_LABEL[pub["type"]])]
    if STATUS_LABEL.get(pub["status"]):
        facts.append(("Status", STATUS_LABEL[pub["status"]]))
    topic = topics[pub["topic"]]
    facts.append(("Research thread", f'<a href="/publications.html?topic={esc(topic["id"])}">{esc(topic["name"])}</a>'))
    if pub.get("doi"):
        facts.append(("DOI", f'<a href="https://doi.org/{esc(pub["doi"])}" target="_blank" rel="noopener noreferrer">{esc(pub["doi"])}</a>'))
    if pub.get("arxiv"):
        facts.append(("arXiv", f'<a href="https://arxiv.org/abs/{esc(pub["arxiv"])}" target="_blank" rel="noopener noreferrer">{esc(pub["arxiv"])}</a>'))
    facts_html = "\n".join(f"          <div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts)
    toc_html = "\n".join(f'          <li><a href="#{anchor}">{esc(label)}</a></li>' for anchor, label in toc)

    body = f"""<main id="main">
  <header class="paper-hero">
    <div class="wrap">
      <nav aria-label="Breadcrumb">
        <ol class="crumbs">
          <li><a href="/">Home</a></li>
          <li><a href="/publications.html">Publications</a></li>
          <li aria-current="page">{esc(pub["venue_short"])}</li>
        </ol>
      </nav>
      <p class="paper-hero__venue"><span class="eyebrow">{esc(eyebrow)}</span>{tag}</p>
      <h1 class="paper-hero__title">{title_html}</h1>
      <ul class="paper-byline" aria-label="Authors">{authors}</ul>{affil}
      <p class="paper-hero__brief"><span class="paper-hero__brief-k">In brief</span>{esc(pub["summary"])}</p>
      <p class="paper-actions">{"".join(actions)}</p>
    </div>
  </header>
  <div class="wrap paper-layout">
    <div class="paper-main">{figures_section}
      <section id="abstract" aria-labelledby="abstract-h">
        <h2 id="abstract-h">{esc(abstract_heading)}</h2>
{abstract}{notes}
      </section>{results_section}{method_section}{resources_section}
      <section id="cite" aria-labelledby="cite-h">
        <h2 id="cite-h">Cite this work</h2>
        <div class="bibtex" data-bibtex>
          <pre tabindex="0" aria-label="BibTeX entry">{esc(pub["bibtex"])}</pre>
          <p class="bibtex__actions">
            <button class="button button--sm button--primary" type="button" data-bibtex-copy hidden>{icon("copy")}Copy BibTeX</button>
            <button class="button button--sm" type="button" data-bibtex-download hidden>{icon("download")}Download .bib</button>
            <button class="button button--sm" type="button" data-cite="{esc(pub["id"])}" hidden>{icon("quote")}APA, MLA, IEEE</button>
            <span class="bibtex__status" role="status" aria-live="polite" data-bibtex-status></span>
          </p>
        </div>
      </section>{related_section}{pager}
    </div>
    <aside class="paper-aside" aria-label="About this paper">
      <div>
        <h2 class="sub__title">At a glance</h2>
        <dl class="kv kv--stack">
{facts_html}
        </dl>
      </div>
      <nav class="aside-nav" aria-label="On this page">
        <h2 class="sub__title">On this page</h2>
        <ul>
{toc_html}
        </ul>
      </nav>
    </aside>
  </div>
</main>"""

    ld = scholarly_ld(pub, site)
    ld["@context"] = "https://schema.org"
    ld["mainEntityOfPage"] = canonical
    ld["isAccessibleForFree"] = True
    crumbs = breadcrumb_ld([("Home", f"{base}/"), ("Publications", f"{base}/publications.html"), (pub["title"], canonical)])
    has_card = (ROOT / "assets" / "og" / f'{pub["id"]}.png').is_file()
    card_size = ('<meta property="og:image:width" content="1200">\n'
                 '<meta property="og:image:height" content="630">\n') if has_card else ""
    head_extra = card_size + "\n".join([
        scholar_meta(pub, site),
        f'<meta property="article:author" content="{esc(base)}/">',
        json_ld(ld),
        json_ld(crumbs),
        data_island([pub] + related, topics),
    ])
    return page_shell(
        title=f'{pub["title"]} | {me}',
        og_title=pub["title"],
        description=page["description"],
        canonical=canonical,
        og_type="article",
        og_image=og_image_for(pub, site),
        og_image_alt=f'{pub["title"]} — {pub["venue_short"]}',
        head_extra=head_extra,
        body=body,
        site=site,
        pubs=pubs,
        current="publications",
        robots="index, follow, max-snippet:-1, max-image-preview:large",
    )


# ── Publication library ────────────────────────────────────────────────────

def render_library(pubs: list[dict], topic_list: list[dict], topics: dict, site: dict) -> str:
    me = site["person"]["name"]
    base = site["url"]
    years = sorted({p["year"] for p in pubs}, reverse=True)
    total = len(pubs)

    def chip(facet: str, value: str, label: str, count: int, pressed: bool = False) -> str:
        return (f'<button class="chip" type="button" data-facet="{facet}" data-value="{esc(value)}" '
                f'aria-pressed="{"true" if pressed else "false"}">{esc(label)}<span class="chip__n">{count}</span></button>')

    type_chips = [chip("type", "all", "All", total, True)]
    for key, label in TYPE_CHIP.items():
        count = sum(1 for p in pubs if p["type"] == key)
        if count:
            type_chips.append(chip("type", key, label, count))
    topic_chips = [chip("topic", "all", "All", total, True)]
    for topic in topic_list:
        count = sum(1 for p in pubs if p["topic"] == topic["id"])
        if count:
            topic_chips.append(chip("topic", topic["id"], topic["name"], count))

    groups = []
    for year in years:
        entries = "\n".join(
            f'          <li data-pub="{esc(p["id"])}" data-type="{p["type"]}" data-topic="{esc(p["topic"])}">\n'
            f'{indent(pub_entry(p, me, heading="h3"), 12)}\n          </li>'
            for p in pubs if p["year"] == year
        )
        groups.append(f"""      <section class="lib-year" data-year="{year}" aria-labelledby="y{year}">
        <h2 class="lib-year__label" id="y{year}">{year}</h2>
        <ol class="lib-year__list">
{entries}
        </ol>
      </section>""")

    counts = {key: sum(1 for p in pubs if p["type"] == key) for key in TYPE_CHIP}
    parts = []
    if counts["article"]:
        parts.append(f'{counts["article"]} journal article{"s" if counts["article"] != 1 else ""}')
    if counts["inproceedings"]:
        parts.append(f'{counts["inproceedings"]} conference paper{"s" if counts["inproceedings"] != 1 else ""}')
    if counts["incollection"]:
        parts.append(f'{counts["incollection"]} book chapter{"s" if counts["incollection"] != 1 else ""}')
    if counts["preprint"]:
        parts.append(f'{counts["preprint"]} preprint{"s" if counts["preprint"] != 1 else ""}')
    breakdown = ", ".join(parts[:-1]) + " and " + parts[-1] if len(parts) > 1 else parts[0]
    profile_links = "".join(
        f'<a href="{esc(p["url"])}" rel="me noopener" target="_blank">{esc(p["label"])}{icon("external")}</a>'
        for p in site["profiles"] if p["label"] in ("Google Scholar", "ORCID", "DBLP", "IEEE Xplore")
    )

    body = f"""<main id="main">
  <header class="page-hero">
    <div class="wrap">
      <nav aria-label="Breadcrumb">
        <ol class="crumbs"><li><a href="/">Home</a></li><li aria-current="page">Publications</li></ol>
      </nav>
      <h1 class="page-hero__title">Publications</h1>
      <p class="page-hero__lede">{total} publications from {min(years)} to {max(years)}: {breakdown}, on accessible navigation, wildfire and environmental AI, biomedical image analysis, and efficient learning.</p>
      <p class="page-hero__meta">{profile_links}<a href="/assets/publications.bib" download>{icon("download")}Download all as BibTeX</a></p>
    </div>
  </header>
  <pub-library>
    <div class="wrap">
      <div class="lib-toolbar" data-toolbar hidden>
        <div class="lib-toolbar__row">
          <div class="search" role="search">
            {icon("search")}
            <label class="visually-hidden" for="lib-search">Search publications</label>
            <input id="lib-search" type="search" placeholder="Search title, author, venue or keyword" autocomplete="off" spellcheck="false">
            <kbd aria-hidden="true">/</kbd>
          </div>
          <p class="lib-count" role="status" aria-live="polite" data-count></p>
        </div>
        <div class="lib-toolbar__row">
          <div class="chips" role="group" aria-label="Filter by publication type"><span class="chips__label" aria-hidden="true">Type</span>{"".join(type_chips)}</div>
        </div>
        <div class="lib-toolbar__row">
          <div class="chips" role="group" aria-label="Filter by research thread"><span class="chips__label" aria-hidden="true">Thread</span>{"".join(topic_chips)}</div>
        </div>
      </div>
{chr(10).join(groups)}
      <div class="lib-empty" data-empty hidden>
        <p>No publications match those filters.</p>
        <button class="button" type="button" data-reset>Clear filters</button>
      </div>
      <p class="lib-foot">Citation counts are on <a href="https://scholar.google.com/citations?user=B17tai4AAAAJ" rel="me noopener" target="_blank">Google Scholar</a>.</p>
    </div>
  </pub-library>
</main>"""

    items = []
    for position, pub in enumerate(pubs, 1):
        work = scholarly_ld(pub, site, with_abstract=False)
        items.append({"@type": "ListItem", "position": position, "item": work})
    collection = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": f"{base}/publications.html#page",
        "url": f"{base}/publications.html",
        "name": f'Publications of {me}',
        "about": person_ref(site),
        "isPartOf": {"@id": f"{base}/#website"},
        "mainEntity": {"@type": "ItemList", "numberOfItems": total, "itemListOrder": "https://schema.org/ItemListOrderDescending", "itemListElement": items},
    }
    crumbs = breadcrumb_ld([("Home", f"{base}/"), ("Publications", f"{base}/publications.html")])
    return page_shell(
        title=f"Publications | {me}",
        description=(f"{total} peer-reviewed papers and preprints by {me} on accessible indoor navigation, "
                     "wildfire vision-language models, medical image segmentation, and knowledge distillation, "
                     "with abstracts, links and BibTeX."),
        canonical=f"{base}/publications.html",
        og_type="website",
        og_image=(f"{base}/assets/og/publications.png" if (ROOT / "assets/og/publications.png").is_file()
                  else f"{base}/images/profile-compressed.jpg"),
        head_extra="\n".join([json_ld(collection), json_ld(crumbs), data_island(pubs, topics)]),
        body=body,
        site=site,
        pubs=pubs,
        current="publications",
    )


# ── Homepage regions ───────────────────────────────────────────────────────

def render_selected(pubs: list[dict], site: dict) -> str:
    me = site["person"]["name"]
    rows = "\n".join(
        f'<li data-reveal>\n  <p class="pub__year">{p["year"]}</p>\n{indent(pub_entry(p, me, heading="h3", summary=False), 2)}\n</li>'
        for p in pubs if p.get("selected")
    )
    return f'<ol class="pubs-selected">\n{rows}\n</ol>'


def render_threads(pubs: list[dict], topic_list: list[dict]) -> str:
    """Research threads as lanes over a shared year axis; one mark per paper.

    Position carries identity (the lane) and time (the column). A bar shows the
    years a thread was active, the fill of a mark says peer-reviewed or
    preprint, and each lane has its own hue and icon as redundant cues.
    """
    first, last = min(p["year"] for p in pubs), max(p["year"] for p in pubs)
    years = list(range(first, last + 1))

    lanes = []
    for topic in topic_list:
        papers = [p for p in pubs if p["topic"] == topic["id"]]
        if not papers:
            continue
        cells = []
        for column, year in enumerate(years, 1):
            dots = []
            for p in [x for x in papers if x["year"] == year]:
                kind = TYPE_LABEL[p["type"]] + (", under review" if p["status"] == "under-review" else "")
                meta = f'{p["venue_short"]} · {kind}'
                classes = "dot" + (" dot--open" if p["type"] == "preprint" else "") + (" dot--live" if year == last else "")
                dots.append(
                    f'<a class="{classes}" href="{esc(pub_url(p))}" '
                    f'data-title="{esc(p["title"])}" data-meta="{esc(meta)}" '
                    f'aria-label="{esc(p["title"])}. {esc(meta)}."></a>'
                )
            cells.append(f'<span class="thread__cell" style="grid-column:{column}">{"".join(dots)}</span>')
        lo, hi = min(p["year"] for p in papers), max(p["year"] for p in papers)
        span = str(lo) if lo == hi else f"{lo}–{hi}"
        bar = ""
        if hi > lo:
            start, end = lo - first + 1, hi - first + 2
            bar = f'<span class="thread__span" style="grid-column:{start}/{end};--k:{end - start}"></span>'
        count = len(papers)
        lanes.append(f"""  <div class="thread thread--{esc(topic["id"])}" role="listitem">
    <div class="thread__info">
      <span class="thread__icon">{icon("t-" + topic["icon"])}</span>
      <div>
        <h4 class="thread__name">{esc(topic["name"])}</h4>
        <p class="thread__sum">{esc(topic["summary"])}</p>
        <p class="thread__n"><a href="/publications.html?topic={esc(topic["id"])}">{count} paper{"s" if count != 1 else ""}</a> · {span}</p>
      </div>
    </div>
    <div class="thread__track">{bar}{"".join(cells)}</div>
  </div>""")

    # Every year is labelled on wide screens; every third on a phone.
    labels = "".join(
        f'<span{"" if (year - first) % 3 == 0 or year == last else " data-minor"}>{year}</span>' for year in years
    )
    legend_dot = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor"/></svg>'
    legend_ring = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    legend_bar = '<svg viewBox="0 0 22 12" aria-hidden="true"><rect x="1" y="3.500" width="20" height="5" rx="2.500" fill="currentColor" opacity="0.35"/></svg>'
    return f"""<div class="threads" data-threads data-reveal style="--n:{len(years)}">
  <div class="threads__head">
    <h3 class="threads__title">Research threads, {first}–{last}</h3>
    <p class="threads__legend"><span>{legend_dot}Peer-reviewed</span><span>{legend_ring}Preprint</span><span class="threads__legend-bar">{legend_bar}Active years</span></p>
  </div>
  <div role="list">
{chr(10).join(lanes)}
  </div>
  <div class="threads__axis" aria-hidden="true"><span></span><div class="threads__years">{labels}</div></div>
  <p class="threads__note">One mark per paper, in the year it appeared. Select a mark to open the paper; the same {len(pubs)} papers are in the <a href="/publications.html">publication library</a>.</p>
</div>"""


def render_toolkit(site: dict) -> str:
    """The tools the work is built with, as a slowly moving row of logo tiles.

    The second copy of the list exists only to make the loop seamless and is
    hidden from assistive technology. With reduced motion the row is static.
    """
    items = [(item["name"], item["icon"], group["group"]) for group in site["toolkit"] for item in group["items"]]

    def track(duplicate: bool) -> str:
        rows = "".join(
            f'<li class="tool"><span class="tool__icon"><svg aria-hidden="true" focusable="false">'
            f'<use href="/assets/icons/tech.svg#{esc(slug)}"/></svg></span>'
            f'<span class="tool__text"><span class="tool__name">{esc(name)}</span>'
            f'<span class="tool__group">{esc(group)}</span></span></li>'
            for name, slug, group in items
        )
        hidden = ' aria-hidden="true"' if duplicate else ""
        return f'<ul class="marquee__track"{hidden}>{rows}</ul>'

    return f"""<div class="wrap toolkit__head">
  <h2 class="toolkit__title" id="toolkit-title">Toolkit</h2>
  <p class="toolkit__lede">Languages, frameworks and platforms the work is built with.</p>
  <button class="icon-btn toolkit__toggle" type="button" data-marquee-toggle aria-pressed="false" aria-label="Pause the moving list" hidden>
    {icon("pause", "icon--pause")}{icon("play", "icon--play")}
  </button>
</div>
<div class="marquee" data-marquee>
  {track(False)}
  {track(True)}
</div>"""


def render_home_ld(pubs: list[dict], site: dict, profile: dict) -> str:
    """Selected publications as an ItemList, plus person facts from profile.json.

    The Person node reuses the @id of the hand-written graph in index.html, so
    search engines merge the two descriptions into one entity.
    """
    base = site["url"]
    schools = []
    for degree in profile["education"]:
        name = degree["org"].split(",")[0]
        if name not in [s["name"] for s in schools]:
            schools.append({"@type": "CollegeOrUniversity", "name": name})
    person = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": f"{base}/#person",
        "alumniOf": schools,
        "memberOf": [{"@type": "Organization", "name": m.split(" (")[0].replace(" Graduate Student Member", "").replace(" Member", "")}
                     for m in profile.get("memberships", [])],
        "award": [f'{a["title"]}, {a["org"]} ({a["when"]})' for a in profile["awards"]],
        "knowsLanguage": [lang.split(" (")[0] for lang in profile.get("languages", [])],
        "hasOccupation": {"@type": "Occupation", "name": "Graduate research assistant",
                          "occupationalCategory": "Computer and information research scientists"},
        "seeks": site["person"].get("availability", ""),
    }
    person = {k: v for k, v in person.items() if v}
    selected = [p for p in pubs if p.get("selected")]
    items = [
        {"@type": "ListItem", "position": index, "name": p["title"],
         "url": f'{base}/{p["id"]}/' if p.get("page") else p.get("external_page", "")}
        for index, p in enumerate(selected, 1)
    ]
    return json_ld(person) + "\n" + json_ld({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": f"{base}/#selected-publications",
        "name": f'Selected publications of {site["person"]["name"]}',
        "numberOfItems": len(items),
        "itemListElement": items,
    })


def render_llms(pubs: list[dict], site: dict) -> str:
    """Publication list for llms.txt: one line per paper, newest first."""
    base = site["url"]
    lines = []
    for p in pubs:
        url = f'{base}/{p["id"]}/' if p.get("page") else p.get("external_page", "")
        where = p["venue_short"] if str(p["year"]) in p["venue_short"] else f'{p["venue_short"]}, {p["year"]}'
        lines.append(f'- [{p["title"]}]({url}): {where}. {p["summary"]}')
    return "\n".join(lines)


def news_sort_key(date: str) -> tuple:
    parts = [int(x) for x in date.split("-")]
    # A bare year sorts as the end of that year, a bare month as its last day.
    return (parts[0], parts[1] if len(parts) > 1 else 13, parts[2] if len(parts) > 2 else 32)


def render_news(pubs: list[dict], news: dict, visible: int = 6) -> str:
    items = [dict(item) for item in news["items"]]
    latest = max(p["year"] for p in pubs)
    for pub in pubs:
        if pub["year"] >= latest - 1:
            where = pub["venue_short"]
            if pub["status"] == "accepted":
                text = f"Paper accepted at {where}"
            elif pub["type"] == "preprint":
                text = "New preprint on arXiv" if pub.get("arxiv") else "New preprint"
            else:
                text = f"Paper at {where}"
            items.append({"date": str(pub["year"]), "kind": "Publication", "text": text,
                          "title": pub["title"], "url": pub_url(pub)})
    items.sort(key=lambda item: news_sort_key(item["date"]), reverse=True)

    rows = []
    for index, item in enumerate(items):
        older = " data-older" if index >= visible else ""
        if item.get("title"):
            what = f'{esc(item["text"])}: <a href="{esc(item["url"])}">{esc(item["title"])}</a>'
        elif item.get("url"):
            what = f'<a href="{esc(item["url"])}">{esc(item["text"])}</a>'
        else:
            what = esc(item["text"])
        rows.append(
            f'  <li class="news__item"{older}>\n'
            f'    <time class="news__when" datetime="{esc(item["date"])}">{esc(human_date(item["date"]))}</time>\n'
            f'    <p class="news__what">{what}<span class="pill news__kind">{esc(item["kind"])}</span></p>\n'
            f'  </li>'
        )
    more = ""
    if len(items) > visible:
        more = (f'\n<p class="news__more"><button class="button button--sm" type="button" data-news-more hidden>'
                f'<span data-label>Show earlier updates</span></button></p>')
    return f'<ol class="news" data-news>\n{chr(10).join(rows)}\n</ol>{more}'


def render_availability(site: dict) -> str:
    """One line under the role: when the Ph.D. ends and what is welcome."""
    text = site["person"].get("availability")
    return f'<p class="intro__status"><span class="status-dot" aria-hidden="true"></span>{esc(text)}</p>' if text else ""


def render_facts(pubs: list[dict], profile: dict) -> str:
    """Headline counts, derived from the data rather than typed."""
    first, last = min(p["year"] for p in pubs), max(p["year"] for p in pubs)
    reviewed = len(profile["reviewing"])
    courses = len(profile["teaching"]["courses"])
    peer = sum(1 for p in pubs if p["type"] != "preprint")
    facts = [
        (str(len(pubs)), f"publications, {first}–{last}", "/publications.html"),
        (str(peer), "peer-reviewed papers and chapters", "/publications.html"),
        (str(reviewed), "journals reviewed for", "#service"),
        (str(courses), "UMBC courses supported as TA", "#teaching"),
    ]
    rows = "\n".join(
        f'  <li><a href="{href}"><span class="facts__v">{value}</span><span class="facts__k">{label}</span></a></li>'
        for value, label, href in facts
    )
    return f'<ul class="facts">\n{rows}\n</ul>'


def render_contact(site: dict, heading: str = "h3") -> str:
    """Contact details and the message form — one definition for both pages."""
    person = site["person"]
    wanted = ("LinkedIn", "GitHub", "Google Scholar", "ORCID", "Hugging Face", "ResearchGate", "DBLP", "X")
    by_label = {p["label"]: p for p in site["profiles"]}
    profiles = "\n".join(
        f'      <li><a href="{esc(by_label[label]["url"])}" target="_blank" rel="me noopener noreferrer">'
        f'{esc(label)}{icon("external")}</a></li>'
        for label in wanted if label in by_label
    )

    def copy(value: str, label: str) -> str:
        return (f'<button class="copy-btn" type="button" data-copy="{esc(value)}" data-copy-label="{esc(label)}" hidden>'
                f'<span data-copy-text>Copy</span></button>')

    return f"""<div class="contact">
  <div>
    <{heading} class="panel__title">Reach me directly</{heading}>
    <dl class="contact__list">
      <div>
        <dt>Email</dt>
        <dd><a href="mailto:{esc(person["email"])}">{esc(person["email"])}</a>{copy(person["email"], "Email address")}</dd>
      </div>
      <div>
        <dt>University</dt>
        <dd><a href="mailto:{esc(person["emailUniversity"])}">{esc(person["emailUniversity"])}</a>{copy(person["emailUniversity"], "University email address")}</dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>{esc(person["location"])}</dd>
      </div>
      <div>
        <dt>Lab</dt>
        <dd>{esc(person["lab"])}, {esc(person["affiliationShort"])} Computer Science</dd>
      </div>
    </dl>
    <ul class="intro__profiles" aria-label="Profiles">
{profiles}
    </ul>
  </div>
  <form class="form panel" action="https://formspree.io/f/xzdkodzv" method="POST" data-contact-form data-owner-email="{esc(person["email"])}" aria-labelledby="contact-form-title">
    <{heading} class="panel__title" id="contact-form-title">Send a message</{heading}>
    <input type="hidden" name="_subject" value="New website contact message">
    <input type="hidden" name="_replyto" value="">
    <p class="form__hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></p>
    <div class="form__row">
      <div class="field">
        <label for="contact-name">Name</label>
        <input type="text" id="contact-name" name="name" required autocomplete="name">
      </div>
      <div class="field">
        <label for="contact-email">Email</label>
        <input type="email" id="contact-email" name="email" required autocomplete="email">
      </div>
    </div>
    <div class="field">
      <label for="contact-subject">Subject</label>
      <input type="text" id="contact-subject" name="subject" required>
    </div>
    <div class="field">
      <label for="contact-message">Message</label>
      <textarea id="contact-message" name="message" rows="6" required></textarea>
    </div>
    <p><button class="button button--primary" type="submit"><span data-label>Send message</span>{icon("arrow")}</button></p>
    <p class="form__status" role="status" aria-live="polite" data-form-status></p>
  </form>
</div>"""


# ── Profile: experience, education, teaching, honours (data/profile.json) ──

LOGOS = {
    "umbc": '<img class="cv__logo cv__logo--plate" src="/images/affiliations/umbc-wordmark.svg" alt="" width="128" height="30" loading="lazy">',
    "itu": '<img class="cv__logo cv__logo--tall cv__logo--plate" src="/images/affiliations/itu-emblem.webp" alt="" width="126" height="176" loading="lazy">',
}


def when_html(entry: dict) -> str:
    """Date range with machine-readable start and end."""
    text = entry["when"]
    start, _, end = text.partition(" – ")
    current = "<b>Current</b>" if entry.get("current") else ""
    start_html = f'<time datetime="{esc(entry["start"])}">{esc(start)}</time>' if entry.get("start") else esc(start)
    end_html = f'<time datetime="{esc(entry["end"])}">{esc(end)}</time>' if entry.get("end") else esc(end)
    return f'<p class="cv__when">{current}{start_html} – {end_html}</p>'


def render_experience(profile: dict, heading: str = "h3") -> str:
    rows = []
    for job in profile["experience"]:
        blocks = []
        for block in job["blocks"]:
            if block.get("project"):
                blocks.append(f'      <p class="cv__project"><strong>Project:</strong> {esc(block["project"])}</p>')
            # notes may carry a link, so they are trusted HTML from the data file
            notes = "".join(f"<li>{note}</li>" for note in block["notes"])
            blocks.append(f'      <ul class="cv__notes">{notes}</ul>')
        rows.append(f"""  <li data-reveal>
    {when_html(job)}
    <div>
      <{heading} class="cv__title">{esc(job["org"])}</{heading}>
      <p class="cv__role">{esc(job["role"])}</p>
      <p class="cv__meta">{esc(job["location"])}</p>
{chr(10).join(blocks)}
    </div>
  </li>""")
    return f'<ol class="cv" aria-label="Research roles, newest first">\n{chr(10).join(rows)}\n</ol>'


def render_education(profile: dict, heading: str = "h3", logos: bool = True) -> str:
    rows = []
    for degree in profile["education"]:
        logo = f'\n      {LOGOS[degree["logo"]]}' if logos and degree.get("logo") in LOGOS else ""
        details = "".join(f"<li>{esc(line)}</li>" for line in degree.get("details", []))
        details = f'\n      <ul class="cv__notes">{details}</ul>' if details else ""
        gpa = f'\n      <p class="cv__meta">GPA: {esc(degree["gpa"])}</p>' if degree.get("gpa") else ""
        rows.append(f"""  <li data-reveal>
    {when_html(degree)}
    <div>{logo}
      <{heading} class="cv__title">{esc(degree["degree"])}</{heading}>
      <p class="cv__role">{esc(degree["org"])}</p>{gpa}{details}
    </div>
  </li>""")
    return f'<ol class="cv" aria-label="Degrees, newest first">\n{chr(10).join(rows)}\n</ol>'


def courses_html(profile: dict) -> str:
    return "\n".join(
        f'    <li data-count="course"><span class="rows__code">{esc(c["code"])}</span>'
        f'<span class="rows__main">{esc(c["name"])}</span><span class="rows__side">{esc(c["terms"])}</span></li>'
        for c in profile["teaching"]["courses"]
    )


def journals_html(profile: dict) -> str:
    return "\n".join(
        f'    <li data-count="journal"><span class="rows__main">{esc(j["journal"])} <small>{esc(j["publisher"])}</small></span>'
        f'<span class="rows__side">{esc(j["when"])}</span></li>'
        for j in profile["reviewing"]
    )


def render_teaching(profile: dict) -> str:
    """Homepage: teaching on the left, reviewing and mentoring on the right."""
    teaching = profile["teaching"]
    notes = "".join(f"<li>{esc(n)}</li>" for n in teaching["notes"])
    mentoring = "".join(f'<li><strong>{esc(m["lead"])}</strong> {esc(m["text"])}</li>' for m in profile["mentoring"])
    return f"""<div class="split">
  <div class="panel" data-reveal>
    <h3 class="panel__title">{esc(teaching["role"])}</h3>
    <p class="panel__lede">{esc(teaching["org"])} · {esc(teaching["when"])}</p>
    <ul class="rows rows--courses" aria-label="Courses supported as TA">
{courses_html(profile)}
    </ul>
    <ul class="ticks mt-5">{notes}</ul>
  </div>
  <div class="stack stack--5">
    <div class="panel" id="service" data-reveal>
      <h3 class="panel__title">Journal reviewer</h3>
      <ul class="rows" aria-label="Journals reviewed for">
{journals_html(profile)}
      </ul>
    </div>
    <div class="panel" data-reveal>
      <h3 class="panel__title">Mentoring</h3>
      <ul class="ticks mt-4">{mentoring}</ul>
    </div>
  </div>
</div>"""


def talk_item(talk: dict) -> str:
    link = f' <a href="{esc(talk["url"])}">{esc(talk["kind"])} (PDF)</a>' if talk.get("url") else f' {esc(talk["kind"])}.'
    return (f'<li><span class="cvpub__authors">{esc(talk["authors"])}.</span> <span class="cvpub__title">{esc(talk["title"])}.</span> '
            f'<span class="cvpub__venue">{esc(talk["where"])}.</span>{link}</li>')


def render_talks(profile: dict) -> str:
    """Homepage: talks and posters, under the news list."""
    rows = "\n".join(
        f'  <li class="talk"><span class="pill">{esc(t["kind"])}</span>'
        f'<span class="talk__title">{esc(t["title"])}</span>'
        f'<span class="talk__where">{esc(t["where"])}</span>'
        + (f'<a class="pub__link" href="{esc(t["url"])}">{icon("slides")}{esc(t["kind"])}</a>' if t.get("url") else "")
        + "</li>"
        for t in profile["presentations"]
    )
    return f'<h3 class="talks__title">Talks and posters</h3>\n<ul class="talks">\n{rows}\n</ul>'


def render_awards(profile: dict, heading: str = "h3") -> str:
    cards = "\n".join(
        f"""  <li class="honor" data-reveal>
    <p class="honor__when"><time datetime="{esc(a["date"])}">{esc(a["when"])}</time></p>
    <{heading} class="honor__title">{esc(a["title"])}</{heading}>
    <p class="honor__org">{esc(a["org"])}</p>
    <p class="honor__desc">{esc(a["desc"])}</p>
  </li>"""
        for a in profile["awards"]
    )
    certificates = "".join(f"<li>{esc(c)}</li>" for c in profile["certificates"])
    return f"""<ul class="honors">
{cards}
</ul>
<div class="panel mt-6" data-reveal>
  <{heading} class="panel__title">Highlighted certificates</{heading}>
  <ul class="ticks ticks--row mt-4">{certificates}</ul>
</div>"""


def cv_publication(pub: dict, me: str) -> str:
    title = f'<a href="{esc(pub_url(pub))}">{esc(pub["title"])}</a>'
    note = " (under review)" if pub["status"] == "under-review" else ""
    return (f'<li><span class="cvpub__authors">{authors_inline(pub, me)}.</span> '
            f'<span class="cvpub__title">{title}.</span> '
            f'<span class="cvpub__venue">{venue_html(pub)}{note}.</span></li>')


def render_cv(profile: dict, pubs: list[dict], topics: dict, site: dict) -> str:
    person = site["person"]
    me = person["name"]
    base = site["url"]

    groups = [
        ("Journal articles and book chapters", [p for p in pubs if p["type"] in ("article", "incollection")]),
        ("Conference and workshop papers", [p for p in pubs if p["type"] == "inproceedings"]),
        ("Preprints", [p for p in pubs if p["type"] == "preprint"]),
    ]
    publications = "\n".join(
        f'        <h3 class="cv-sub">{esc(label)}</h3>\n        <ol class="cvpubs">\n'
        + "\n".join("          " + cv_publication(p, me) for p in items) + "\n        </ol>"
        for label, items in groups if items
    )
    presentations = "\n".join("          " + talk_item(t) for t in profile["presentations"])
    teaching = profile["teaching"]
    teaching_notes = "".join(f"<li>{esc(n)}</li>" for n in teaching["notes"])
    awards = "\n".join(
        f'          <li><span class="rows__main"><strong>{esc(a["title"])}</strong> <small>{esc(a["org"])}</small></span>'
        f'<span class="rows__side"><time datetime="{esc(a["date"])}">{esc(a["when"])}</time></span></li>'
        for a in profile["awards"]
    )
    certificates = "".join(f"<li>{esc(c)}</li>" for c in profile["certificates"] + profile.get("certificates_cv_only", []))
    plain = lambda items: "".join(f"<li>{esc(item)}</li>" for item in items)  # noqa: E731
    skills = "\n".join(
        f'          <div><dt>{esc(group["group"])}</dt><dd>{" · ".join(esc(item["name"]) for item in group["items"])}</dd></div>'
        for group in site["toolkit"]
    )
    links = " · ".join(
        f'<a href="{esc(p["url"])}" rel="me noopener">{esc(p["label"])}</a>'
        for p in site["profiles"] if p.get("primary")
    )
    sections = [("summary", "Summary"), ("education", "Education"), ("experience", "Research experience"),
                ("publications", "Publications"), ("presentations", "Talks and posters"), ("teaching", "Teaching"),
                ("awards", "Honors and awards"), ("service", "Service and memberships"),
                ("skills", "Technical skills"), ("languages", "Languages")]
    toc = "\n".join(f'        <li><a href="#{anchor}">{esc(label)}</a></li>' for anchor, label in sections)

    body = f"""<main id="main">
  <header class="page-hero">
    <div class="wrap">
      <nav aria-label="Breadcrumb">
        <ol class="crumbs"><li><a href="/">Home</a></li><li aria-current="page">Curriculum vitae</li></ol>
      </nav>
      <p class="eyebrow">Curriculum vitae</p>
      <h1 class="page-hero__title">{esc(me)}</h1>
      <p class="page-hero__lede">{esc(person["role"])}, {esc(person["affiliation"])} · {esc(person["lab"])}</p>
      {render_availability(site)}
      <p class="cv-contact"><a href="mailto:{esc(person["emailUniversity"])}">{esc(person["emailUniversity"])}</a> · <a href="mailto:{esc(person["email"])}">{esc(person["email"])}</a> · {esc(person["location"])}</p>
      <p class="cv-contact">{links}</p>
      <p class="paper-actions">
        <a class="button button--primary" href="{esc(person["cv"])}">{icon("download")}Download PDF</a>
        <button class="button" type="button" data-print hidden>{icon("file")}Print this page</button>
      </p>
    </div>
  </header>
  <div class="wrap cv-layout">
    <nav class="aside-nav cv-nav" aria-label="Sections">
      <h2 class="sub__title">Sections</h2>
      <ul class="mt-4">
{toc}
      </ul>
    </nav>
    <div class="cv-main">
      <section id="summary" aria-labelledby="summary-h">
        <h2 id="summary-h">Summary</h2>
        <p class="prose">{esc(profile["summary"])}</p>
      </section>
      <section id="education" aria-labelledby="education-h">
        <h2 id="education-h">Education</h2>
{indent(render_education(profile, heading="h3", logos=False), 8)}
      </section>
      <section id="experience" aria-labelledby="experience-h">
        <h2 id="experience-h">Research experience</h2>
{indent(render_experience(profile, heading="h3"), 8)}
      </section>
      <section id="publications" aria-labelledby="publications-h">
        <h2 id="publications-h">Publications</h2>
{publications}
        <p class="muted mt-4">Abstracts, figures and BibTeX are in the <a href="/publications.html">publication library</a>.</p>
      </section>
      <section id="presentations" aria-labelledby="presentations-h">
        <h2 id="presentations-h">Talks and posters</h2>
        <ol class="cvpubs">
{presentations}
        </ol>
      </section>
      <section id="teaching" aria-labelledby="teaching-h">
        <h2 id="teaching-h">Teaching</h2>
        <p><strong>{esc(teaching["role"])}</strong>, {esc(teaching["org"])} · {esc(teaching["when"])}</p>
        <ul class="rows rows--courses" aria-label="Courses supported as TA">
{indent(courses_html(profile), 6)}
        </ul>
        <ul class="ticks mt-5">{teaching_notes}</ul>
      </section>
      <section id="awards" aria-labelledby="awards-h">
        <h2 id="awards-h">Honors and awards</h2>
        <ul class="rows">
{awards}
        </ul>
        <h3 class="cv-sub">Certificates</h3>
        <ul class="ticks">{certificates}</ul>
      </section>
      <section id="service" aria-labelledby="service-h">
        <h2 id="service-h">Service and memberships</h2>
        <h3 class="cv-sub">Journal reviewer</h3>
        <ul class="rows" aria-label="Journals reviewed for">
{indent(journals_html(profile), 6)}
        </ul>
        <h3 class="cv-sub">Memberships</h3>
        <ul class="ticks">{plain(profile["memberships"])}</ul>
        <h3 class="cv-sub">Leadership</h3>
        <ul class="ticks">{plain(profile["leadership"])}</ul>
      </section>
      <section id="skills" aria-labelledby="skills-h">
        <h2 id="skills-h">Technical skills</h2>
        <dl class="interests">
{skills}
        </dl>
      </section>
      <section id="languages" aria-labelledby="languages-h">
        <h2 id="languages-h">Languages</h2>
        <p>{" · ".join(esc(item) for item in profile["languages"])}</p>
      </section>
    </div>
  </div>
</main>"""

    page_ld = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": f"{base}/cv.html#page",
        "url": f"{base}/cv.html",
        "name": f"Curriculum vitae of {me}",
        "dateModified": site["updated"],
        "mainEntity": person_ref(site),
        "isPartOf": {"@id": f"{base}/#website"},
    }
    crumbs = breadcrumb_ld([("Home", f"{base}/"), ("Curriculum vitae", f"{base}/cv.html")])
    card = ROOT / "assets" / "og" / "home.png"
    return page_shell(
        title=f"Curriculum vitae | {me}",
        description=(f"Curriculum vitae of {me}, {person['role']} at {person['affiliationShort']}: education, research "
                     "experience, publications, teaching, honors and service."),
        canonical=f"{base}/cv.html",
        og_type="profile",
        og_image=f"{base}/assets/og/home.png" if card.is_file() else f"{base}/images/profile-compressed.jpg",
        head_extra="\n".join([json_ld(page_ld), json_ld(crumbs)]),
        body=body,
        site=site,
        pubs=pubs,
        current="cv",
    )


# ── Files with injected regions ────────────────────────────────────────────

REGION = re.compile(r"(?P<indent>[ \t]*)<!-- build:(?P<name>[\w-]+) -->.*?<!-- /build:(?P=name) -->", re.S)


def inject(source: str, regions: dict[str, str], path: str) -> str:
    seen = set()

    def replace(match: re.Match) -> str:
        name = match.group("name")
        if name not in regions:
            raise SystemExit(f"{path}: unknown build region '{name}'")
        seen.add(name)
        pad = match.group("indent")
        block = indent(regions[name], len(pad))
        return f"{pad}<!-- build:{name} -->\n{block}\n{pad}<!-- /build:{name} -->"

    result = REGION.sub(replace, source)
    if not seen:
        raise SystemExit(f"{path}: no build regions found")
    return result


# ── Sitemap, BibTeX ────────────────────────────────────────────────────────

def render_sitemap(pubs: list[dict], site: dict, existing: str) -> str:
    base = site["url"]
    generated = [(entry["loc"], entry["changefreq"], entry["priority"]) for entry in site["sitemap"]]
    for pub in pubs:
        if pub.get("page"):
            generated.append((f'/{pub["id"]}/', "yearly", "0.8"))
    owned = {base + loc for loc, _, _ in generated}

    blocks = [
        f"    <url>\n        <loc>{base}{loc}</loc>\n        <lastmod>{site['updated']}</lastmod>\n"
        f"        <changefreq>{freq}</changefreq>\n        <priority>{priority}</priority>\n    </url>"
        for loc, freq, priority in generated
    ]
    # Everything this script does not own (Projects pages, standalone apps,
    # files) is carried over byte for byte.
    for block in re.findall(r"[ \t]*<url>.*?</url>", existing, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block).group(1).strip()
        if loc not in owned:
            blocks.append(block.rstrip())
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(blocks) + "\n</urlset>\n")


def rfc822(date: str) -> str:
    """RSS date for a full YYYY-MM-DD, else empty (a guessed day is not a date)."""
    import datetime
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return ""
    return datetime.datetime.strptime(date, "%Y-%m-%d").strftime("%a, %d %b %Y 00:00:00 +0000")


def render_feed(pubs: list[dict], news: dict, site: dict) -> str:
    """RSS 2.0: every publication, then the hand-written news items."""
    base = site["url"]
    me = site["person"]["name"]
    items = []
    for pub in pubs:
        link = f'{base}/{pub["id"]}/' if pub.get("page") else pub.get("external_page", "")
        items.append(
            "  <item>\n"
            f"    <title>{esc(pub['title'])}</title>\n"
            f"    <link>{esc(link)}</link>\n"
            f"    <guid isPermaLink=\"true\">{esc(link)}</guid>\n"
            f"    <category>{esc(TYPE_LABEL[pub['type']])}</category>\n"
            f"    <description>{esc(pub['venue_short'])}, {pub['year']}. {esc(pub['summary'])}</description>\n"
            "  </item>"
        )
    for item in news["items"]:
        link = base + item["url"] if item.get("url", "").startswith("/") else f"{base}/#news"
        date = rfc822(item["date"])
        items.append(
            "  <item>\n"
            f"    <title>{esc(item['text'])}</title>\n"
            f"    <link>{esc(link)}</link>\n"
            f"    <guid isPermaLink=\"false\">news-{esc(item['date'])}-{esc(re.sub(r'[^a-z0-9]+', '-', item['text'].lower()).strip('-'))}</guid>\n"
            f"    <category>{esc(item['kind'])}</category>\n"
            + (f"    <pubDate>{date}</pubDate>\n" if date else "")
            + "  </item>"
        )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n'
            f"  <title>{esc(me)}: publications and news</title>\n"
            f"  <link>{base}/</link>\n"
            f'  <atom:link href="{base}/feed.xml" rel="self" type="application/rss+xml"/>\n'
            f"  <description>New papers and research updates from {esc(me)}, {esc(site['person']['affiliationShort'])}.</description>\n"
            "  <language>en</language>\n"
            f"  <lastBuildDate>{rfc822(site['updated'])}</lastBuildDate>\n"
            + "\n".join(items) + "\n</channel>\n</rss>\n")


def render_accessibility(site: dict, pubs: list[dict]) -> str:
    person = site["person"]
    base = site["url"]
    body = f"""<main id="main">
  <header class="page-hero">
    <div class="wrap">
      <nav aria-label="Breadcrumb">
        <ol class="crumbs"><li><a href="/">Home</a></li><li aria-current="page">Accessibility</li></ol>
      </nav>
      <h1 class="page-hero__title">Accessibility</h1>
      <p class="page-hero__lede">My research is about access for blind and low-vision people, so this site tries to hold itself to the same standard. This page says what it does, how it was checked, and where it still falls short.</p>
    </div>
  </header>
  <div class="wrap wrap--read sec">
    <div class="article">
      <h2>Target</h2>
      <p>The pages aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
      <h2>What the site does</h2>
      <ul>
        <li>Body text is set in Atkinson Hyperlegible, a typeface designed by the Braille Institute for low-vision readers.</li>
        <li>Text keeps a contrast ratio of at least 4.5:1, and form controls at least 3:1, in both the light and the dark theme.</li>
        <li>Every page can be used with a keyboard alone. A skip link leads to the main content, focus is always visible, and dialogs trap and return focus.</li>
        <li>Each page has one main heading, labelled landmarks, and alternative text or a text description for figures and charts.</li>
        <li>Animation stops when the operating system asks for reduced motion, and the moving toolkit row has a pause button.</li>
        <li>Everything is readable without JavaScript; interactive extras appear only when they work.</li>
        <li>The colour theme follows the system setting until you choose one with the button in the header.</li>
      </ul>
      <h2>How it was checked</h2>
      <ul>
        <li>Automated checks with axe-core on representative pages, in both themes, at desktop and phone widths, with no violations.</li>
        <li>A browser test that loads every page at two widths and exercises the menu, theme switch, search, citation dialog, figure zoom and forms with the keyboard.</li>
        <li>Contrast computed directly from the colour tokens of the design system.</li>
      </ul>
      <h2>Known limitations</h2>
      <ul>
        <li>Some paper figures are hosted on arXiv. When they cannot load, a short note takes their place, and the full figure is in the paper.</li>
        <li>Redrawn diagrams have a short description rather than a full text equivalent of every element.</li>
        <li>The site has not yet been tested end to end with a screen reader by a blind user.</li>
      </ul>
      <h2>Tell me about a problem</h2>
      <p>If something on this site is hard to use, please email <a href="mailto:{esc(person["email"])}">{esc(person["email"])}</a>. I read every message and will fix what I can.</p>
      <p class="muted">Last reviewed {esc(human_date(site["updated"]))}.</p>
    </div>
  </div>
</main>"""
    crumbs = breadcrumb_ld([("Home", f"{base}/"), ("Accessibility", f"{base}/accessibility.html")])
    return page_shell(
        title=f"Accessibility | {person['name']}",
        description="How this site supports keyboard, screen-reader and low-vision use, how it was checked, and how to report a problem.",
        canonical=f"{base}/accessibility.html",
        og_type="website",
        og_image=f"{base}/assets/og/home.png",
        head_extra=json_ld(crumbs),
        body=body,
        site=site,
        pubs=pubs,
        current=None,
    )


def render_bib(pubs: list[dict], site: dict) -> str:
    header = (f"% Publications of {site['person']['name']}\n"
              f"% Generated from data/publications.json — {site['url']}/publications.html\n\n")
    return header + "\n\n".join(pub["bibtex"].strip() for pub in pubs) + "\n"


# ── Main ───────────────────────────────────────────────────────────────────

def build() -> dict[str, str]:
    data = read_json("data/publications.json")
    site = read_json("data/site.json")
    news = read_json("data/news.json")
    profile = read_json("data/profile.json")
    topic_list = data["topics"]
    topics = {topic["id"]: topic for topic in topic_list}
    # Newest first; within a year the hand-curated order of the file is kept.
    pubs = sorted(data["publications"], key=lambda p: -p["year"])

    outputs: dict[str, str] = {}
    for pub in pubs:
        if pub.get("page"):
            outputs[f'{pub["id"]}/index.html'] = render_paper(pub, pubs, topics, site)
    outputs["publications.html"] = render_library(pubs, topic_list, topics, site)
    outputs["cv.html"] = render_cv(profile, pubs, topics, site)
    outputs["assets/publications.bib"] = render_bib(pubs, site)
    outputs["feed.xml"] = render_feed(pubs, news, site)
    outputs["accessibility.html"] = render_accessibility(site, pubs)
    outputs["sitemap.xml"] = render_sitemap(pubs, site, (ROOT / "sitemap.xml").read_text(encoding="utf-8"))

    selected = [p for p in pubs if p.get("selected")]
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    shared = {"assets": head_assets(), "footer": render_footer(site, pubs)}
    pages = {
        "index.html": dict(shared, header=render_header(site, home=True),
                           facts=render_facts(pubs, profile),
                           threads=render_threads(pubs, topic_list),
                           toolkit=render_toolkit(site),
                           availability=render_availability(site),
                           talks=render_talks(profile),
                           experience=render_experience(profile),
                           education=render_education(profile),
                           teaching=render_teaching(profile),
                           awards=render_awards(profile),
                           contact=render_contact(site, heading="h3"),
                           **{"selected-publications": render_selected(pubs, site),
                              "news": render_news(pubs, news),
                              "pub-data": data_island(selected, topics),
                              "structured-data": render_home_ld(pubs, site, profile)}),
        "contact.html": dict(shared, header=render_header(site, current="contact"),
                             contact=render_contact(site, heading="h2")),
        "blog.html": dict(shared, header=render_header(site, current="blog")),
        "blog/multi-task-learning/index.html": dict(shared, header=render_header(site, current="blog")),
        "404.html": dict(shared, header=render_header(site)),
        "llms.txt": {"publications": render_llms(pubs, site)},
    }
    for path, regions in pages.items():
        source = index_html if path == "index.html" else (ROOT / path).read_text(encoding="utf-8")
        outputs[path] = inject(source, regions, path)
    return outputs


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale = []
    for relative, content in build().items():
        target = ROOT / relative
        current = target.read_text(encoding="utf-8") if target.is_file() else None
        if current == content:
            continue
        if check:
            stale.append(relative)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            print(f"wrote {relative}")
    if check and stale:
        print("stale generated files (run: python scripts/build_site.py):")
        for relative in stale:
            print(f"  {relative}")
        return 1
    print("build: up to date" if check else "build: done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
