#!/usr/bin/env python3
"""Generate the data-backed parts of ayanzadeh.com.

Sources (edit these):
    data/publications.json   every publication: metadata, links, paper-page content
    data/news.json           hand-written news items
    data/site.json           profile facts, navigation, profile links
    assets/figures/*.svg     redrawn figures inlined into paper pages

Outputs (do not edit by hand — rerun this script):
    <id>/index.html          one page per publication that has a "page" block
    publications.html        the publication library
    assets/publications.bib  every curated BibTeX entry
    sitemap.xml              in-scope URLs (Projects entries are kept verbatim)
    regions marked <!-- build:NAME --> … <!-- /build:NAME --> inside
    index.html, contact.html, blog.html, blog-post.html and 404.html

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
      <a class="button button--sm button--cv" href="{esc(site["person"]["cv"])}">{icon("file")}<span>CV</span></a>
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
        f'          <li><a href="{esc(item["href"])}">{esc(item["label"])}</a></li>' for item in site["nav"]
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
    if pub.get("links", {}).get("pdf"):
        tags.append(("citation_pdf_url", pub["links"]["pdf"]))
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
      <p class="paper-actions">{"".join(actions)}</p>
    </div>
  </header>
  <div class="wrap paper-layout">
    <div class="paper-main">{figures_section}
      <section id="abstract" aria-labelledby="abstract-h">
        <h2 id="abstract-h">{esc(abstract_heading)}</h2>
{abstract}{notes}
      </section>{method_section}{resources_section}
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
      </section>{related_section}
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
        og_image=f"{base}/images/profile-compressed.jpg",
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
        f'<li>\n  <p class="pub__year">{p["year"]}</p>\n{indent(pub_entry(p, me, heading="h3"), 2)}\n</li>'
        for p in pubs if p.get("selected")
    )
    return f'<ol class="pubs-selected">\n{rows}\n</ol>'


def render_threads(pubs: list[dict], topic_list: list[dict]) -> str:
    """Research threads as lanes over a shared year axis; one mark per paper.

    Position carries identity (the lane) and time (the column); the fill carries
    one extra bit — peer-reviewed or preprint — so a single hue is enough.
    """
    first, last = min(p["year"] for p in pubs), max(p["year"] for p in pubs)
    years = list(range(first, last + 1))

    lanes = []
    for topic in topic_list:
        papers = [p for p in pubs if p["topic"] == topic["id"]]
        if not papers:
            continue
        cells = []
        for year in years:
            dots = []
            for p in [x for x in papers if x["year"] == year]:
                open_mark = p["type"] == "preprint"
                kind = TYPE_LABEL[p["type"]] + (f', {STATUS_LABEL[p["status"]].lower()}' if p["status"] in STATUS_LABEL else "")
                meta = f'{p["venue_short"]} · {kind}'
                dots.append(
                    f'<a class="dot{" dot--open" if open_mark else ""}" href="{esc(pub_url(p))}" '
                    f'data-title="{esc(p["title"])}" data-meta="{esc(meta)}" '
                    f'aria-label="{esc(p["title"])}. {esc(meta)}."></a>'
                )
            cells.append(f'<span class="thread__cell">{"".join(dots)}</span>')
        lo, hi = min(p["year"] for p in papers), max(p["year"] for p in papers)
        span = str(lo) if lo == hi else f"{lo}–{hi}"
        count = len(papers)
        lanes.append(f"""  <div class="thread" role="listitem">
    <div>
      <h4 class="thread__name">{esc(topic["name"])}</h4>
      <p class="thread__sum">{esc(topic["summary"])}</p>
      <p class="thread__n"><a href="/publications.html?topic={esc(topic["id"])}">{count} paper{"s" if count != 1 else ""}</a> · {span}</p>
    </div>
    <div class="thread__track">{"".join(cells)}</div>
  </div>""")

    # Label every third year so the axis stays legible on a phone.
    labels = "".join(
        f'<span{"" if (year - first) % 3 == 0 or year == last else " data-minor"}>{year}</span>' for year in years
    )
    if (last - first) % 3 == 1:  # avoid two adjacent labels colliding at the right edge
        labels = labels.replace(f"<span>{last - 1}</span>", f"<span data-minor>{last - 1}</span>")
    legend_dot = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--c-brand)"/></svg>'
    legend_ring = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--c-brand)" stroke-width="2"/></svg>'
    return f"""<div class="threads" data-threads>
  <div class="threads__head">
    <h3 class="threads__title">Research threads, {first}–{last}</h3>
    <p class="threads__legend"><span>{legend_dot}Peer-reviewed paper</span><span>{legend_ring}Preprint</span></p>
  </div>
  <div role="list">
{chr(10).join(lanes)}
  </div>
  <div class="threads__axis" aria-hidden="true"><span></span><div class="threads__years">{labels}</div></div>
  <p class="threads__readout" data-threads-readout>Each mark is one paper, placed in the year it appeared. Select a mark to open its page; the same {len(pubs)} papers are listed in the <a href="/publications.html">publication library</a>.</p>
</div>"""


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


def render_facts(pubs: list[dict], index_html: str) -> str:
    """Headline counts, derived from the data and the page's own markup."""
    first, last = min(p["year"] for p in pubs), max(p["year"] for p in pubs)
    reviewed = len(re.findall(r'data-count="journal"', index_html))
    courses = len(re.findall(r'data-count="course"', index_html))
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


def render_bib(pubs: list[dict], site: dict) -> str:
    header = (f"% Publications of {site['person']['name']}\n"
              f"% Generated from data/publications.json — {site['url']}/publications.html\n\n")
    return header + "\n\n".join(pub["bibtex"].strip() for pub in pubs) + "\n"


# ── Main ───────────────────────────────────────────────────────────────────

def build() -> dict[str, str]:
    data = read_json("data/publications.json")
    site = read_json("data/site.json")
    news = read_json("data/news.json")
    topic_list = data["topics"]
    topics = {topic["id"]: topic for topic in topic_list}
    # Newest first; within a year the hand-curated order of the file is kept.
    pubs = sorted(data["publications"], key=lambda p: -p["year"])

    outputs: dict[str, str] = {}
    for pub in pubs:
        if pub.get("page"):
            outputs[f'{pub["id"]}/index.html'] = render_paper(pub, pubs, topics, site)
    outputs["publications.html"] = render_library(pubs, topic_list, topics, site)
    outputs["assets/publications.bib"] = render_bib(pubs, site)
    outputs["sitemap.xml"] = render_sitemap(pubs, site, (ROOT / "sitemap.xml").read_text(encoding="utf-8"))

    selected = [p for p in pubs if p.get("selected")]
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    shared = {"assets": head_assets(), "footer": render_footer(site, pubs)}
    pages = {
        "index.html": dict(shared, header=render_header(site, home=True),
                           facts=render_facts(pubs, index_html),
                           threads=render_threads(pubs, topic_list),
                           contact=render_contact(site, heading="h3"),
                           **{"selected-publications": render_selected(pubs, site),
                              "news": render_news(pubs, news),
                              "pub-data": data_island(selected, topics)}),
        "contact.html": dict(shared, header=render_header(site, current="contact"),
                             contact=render_contact(site, heading="h2")),
        "blog.html": dict(shared, header=render_header(site, current="blog")),
        "blog-post.html": dict(shared, header=render_header(site, current="blog")),
        "404.html": dict(shared, header=render_header(site)),
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
