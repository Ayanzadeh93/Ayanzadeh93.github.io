#!/usr/bin/env python3
"""Generate the public AI Skills Bank catalog at /skills/.

The catalog is a static page so every skill is indexable and works without
JavaScript. Data comes from data/skills-bank.json, a vendored copy of
skills.json from Ayanzadeh93/Claude-Skills-Bank.

Usage:
    python scripts/build_skills_catalog.py
    python scripts/build_skills_catalog.py --check
    python scripts/build_skills_catalog.py --source path/to/skills.json
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "skills-bank.json"
CATALOG_DIR = ROOT / "skills"
CATALOG_HTML = CATALOG_DIR / "index.html"
CATALOG_JSON = CATALOG_DIR / "skills.json"

SITE = "https://www.ayanzadeh.com"
PAGE_URL = f"{SITE}/skills/"
REPO = "https://github.com/Ayanzadeh93/Claude-Skills-Bank"
LICENSE_URL = "https://opensource.org/licenses/MIT"

CATEGORY_SLUGS = {
    "AS": "accessibility",
    "CS": "coding",
    "CR": "creativity",
    "DS": "data",
    "ES": "education",
    "GS": "general",
    "OS": "operations",
    "PS": "product",
    "RS": "research",
    "WS": "writing",
}

CATEGORY_BLURBS = {
    "AS": "Alt text, accessibility audits, screen-reader testing, scene description and multimodal reasoning.",
    "CS": "Implementation, refactoring, testing, code review, debugging and security passes.",
    "CR": "Brainstorming, naming, concept development, constraints and structured creative exploration.",
    "DS": "Exploratory analysis, statistics, data quality, experiment design and quantitative reasoning.",
    "ES": "Lesson design, explanations at the right level, assessment writing and study support.",
    "GS": "Planning, reasoning, requirement clarification, decision hygiene and meta-workflows.",
    "OS": "Daily planning, meeting prep, documentation, risk tracking and repeatable operations.",
    "PS": "Product specs, user stories, UX review, positioning and business analysis.",
    "RS": "Literature search, paper reading, synthesis, evidence mapping and research planning.",
    "WS": "Drafting, structure, editing, tone, argumentation and publication-ready prose.",
}

ICON_SEARCH = (
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/>'
    '<path d="m20 20-3.2-3.2"/></svg>'
)
ICON_STAR = (
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linejoin="round" aria-hidden="true">'
    '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8Z"/></svg>'
)
ICON_GITHUB = (
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    '<path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.6 4.5 18.6 4.8 18.6 4.8c.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.8 5.5-5.4 5.8.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"/></svg>'
)
ICON_ARROW = (
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M7 17 17 7M8 7h9v9"/></svg>'
)
ICON_SUN = (
    '<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/>'
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2'
    'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
)
ICON_MOON = (
    '<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>'
)


def normalize_category(prefix: str) -> str:
    return CATEGORY_SLUGS.get(prefix, prefix.lower())


def validate(payload: dict) -> None:
    if payload.get("schemaVersion") != 1:
        raise SystemExit("skills-bank.json schemaVersion must be 1")
    skills = payload.get("skills")
    categories = payload.get("categories")
    if not isinstance(skills, list) or not isinstance(categories, list):
        raise SystemExit("skills-bank.json must contain skills and categories")
    if payload.get("total") != len(skills):
        raise SystemExit(f"total is {payload.get('total')} but there are {len(skills)} skills")
    if len(skills) != 500:
        raise SystemExit(f"expected 500 skills, found {len(skills)}")
    if len(categories) != 10:
        raise SystemExit(f"expected 10 categories, found {len(categories)}")

    ids = [skill["id"] for skill in skills]
    if len(ids) != len(set(ids)):
        raise SystemExit("skill ids must be unique")
    for skill in skills:
        if not re.fullmatch(r"[A-Z]{2}-\d{3}", skill["id"]):
            raise SystemExit(f"malformed skill id: {skill['id']}")
        for field in ("name", "description", "category", "file"):
            if not str(skill.get(field, "")).strip():
                raise SystemExit(f"{skill['id']} is missing {field}")
        if skill["category"] not in {category["name"] for category in categories}:
            raise SystemExit(f"{skill['id']} has unknown category {skill['category']}")

    for category in categories:
        count = sum(1 for skill in skills if skill["category"] == category["name"])
        if count != category["count"]:
            raise SystemExit(f"{category['name']} says {category['count']} skills but has {count}")
        if category["prefix"] not in CATEGORY_SLUGS:
            raise SystemExit(f"unknown category prefix {category['prefix']}")


def build_chips(categories: list[dict], total: int) -> str:
    parts = [
        f'<button type="button" class="chip" data-cat="all" aria-pressed="true">'
        f'<span>All</span><b>{total}</b></button>'
    ]
    for category in categories:
        prefix = category["prefix"]
        parts.append(
            f'<button type="button" class="chip" data-cat="{normalize_category(prefix)}" aria-pressed="false">'
            f'<span>{html.escape(category["name"])}</span><b>{category["count"]}</b></button>'
        )
    return "\n        ".join(parts)


def build_sections(categories: list[dict], skills: list[dict]) -> str:
    sections: list[str] = []
    for index, category in enumerate(categories, start=1):
        prefix = category["prefix"]
        slug = normalize_category(prefix)
        category_skills = [skill for skill in skills if skill["category"] == category["name"]]
        cards: list[str] = []
        for skill in category_skills:
            sid = html.escape(skill["id"], quote=True)
            name = html.escape(skill["name"])
            description = html.escape(skill["description"])
            cards.append(
                f'''<article class="skill" id="{sid}">
<div class="skill-top"><a class="skill-id" href="#{sid}">{sid}</a><button type="button" class="copy" data-id="{sid}" aria-label="Copy {sid}"><span>Copy</span></button></div>
<h3>{name}</h3>
<p>{description}</p>
</article>'''
            )
        file_url = f"{REPO}/blob/main/{category['file']}"
        sections.append(
            f'''<section class="cat" id="category-{slug}" data-cat="{slug}" aria-labelledby="cat-{slug}-title">
        <div class="cat-head">
          <span class="cat-num" aria-hidden="true">{index:02d}</span>
          <span class="cat-prefix" aria-hidden="true">{prefix}</span>
          <h2 id="cat-{slug}-title">{html.escape(category["name"])}</h2>
          <span class="cat-count">{category["count"]} skills</span>
          <a class="cat-link" href="{file_url}" target="_blank" rel="noopener">Markdown {ICON_ARROW}</a>
        </div>
        <p class="cat-desc">{html.escape(CATEGORY_BLURBS.get(prefix, ""))}</p>
        <div class="grid">
        {"".join(cards)}
        </div>
      </section>'''
        )
    return "\n\n      ".join(sections)


def build_structured_data(payload: dict) -> tuple[str, str, str]:
    skills = sorted(payload["skills"], key=lambda skill: skill["id"])
    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "AI Skills Bank",
        "description": payload["description"],
        "numberOfItems": len(skills),
        "itemListOrder": "https://schema.org/ItemListOrderAscending",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": position,
                "name": f"{skill['id']} \u2014 {skill['name']}",
                "url": f"{PAGE_URL}#{skill['id']}",
            }
            for position, skill in enumerate(skills, start=1)
        ],
    }
    collection = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "AI Skills Bank \u2014 500 reusable AI skills",
        "url": PAGE_URL,
        "description": payload["description"],
        "isPartOf": {"@type": "WebSite", "name": "Aydin Ayanzadeh", "url": f"{SITE}/"},
        "about": {
            "@type": "SoftwareSourceCode",
            "name": "AI Skills Bank",
            "codeRepository": REPO,
            "license": LICENSE_URL,
            "programmingLanguage": "Markdown",
        },
        "author": {
            "@type": "Person",
            "@id": f"{SITE}/#person",
            "name": "Aydin Ayanzadeh",
            "url": f"{SITE}/",
        },
        "mainEntity": {"@id": f"{PAGE_URL}#skill-list"},
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "AI Skills Bank", "item": PAGE_URL},
        ],
    }
    item_list["@id"] = f"{PAGE_URL}#skill-list"
    return (
        json.dumps(item_list, ensure_ascii=False, separators=(",", ":")),
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        json.dumps(breadcrumb, ensure_ascii=False, separators=(",", ":")),
    )


PAGE = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="__DESCRIPTION__">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; form-action 'none'; frame-src 'none'; manifest-src 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>__TITLE__</title>
<link rel="canonical" href="__URL__">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="alternate" type="application/json" href="skills.json" title="AI Skills Bank JSON index">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&display=swap" rel="stylesheet">

<meta property="og:type" content="website">
<meta property="og:url" content="__URL__">
<meta property="og:title" content="__OG_TITLE__">
<meta property="og:description" content="__DESCRIPTION__">
<meta property="og:image" content="https://www.ayanzadeh.com/images/profile-compressed.jpg">
<meta property="og:site_name" content="Aydin Ayanzadeh">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="__URL__">
<meta name="twitter:title" content="__OG_TITLE__">
<meta name="twitter:description" content="__DESCRIPTION__">
<meta name="twitter:image" content="https://www.ayanzadeh.com/images/profile-compressed.jpg">
<meta name="twitter:creator" content="@ayanzadeh93">
<meta name="twitter:site" content="@ayanzadeh93">

<script>
/* Apply the saved (or system) theme before first paint. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (error) { /* storage unavailable */ }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = saved ? saved === 'dark' : prefersDark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
</script>

<script type="application/ld+json">
__ITEMLIST__
</script>
<script type="application/ld+json">
__COLLECTION__
</script>
<script type="application/ld+json">
__BREADCRUMB__
</script>

<style>
:root {
  --bg: #f6f8fb;
  --surface: #ffffff;
  --surface-2: #f1f5f9;
  --text: #0f172a;
  --body: #334155;
  --muted: #5b6b82;
  --line: #e2e8f0;
  --line-strong: #cbd5e1;
  --accent: #2563eb;
  --accent-2: #0891b2;
  --accent-soft: #eff6ff;
  --accent-line: #bfdbfe;
  --ok: #047857;
  --ok-bg: #ecfdf5;
  --ok-line: #a7f3d0;
  --shadow: 0 1px 2px rgba(15, 23, 42, .05), 0 12px 28px -18px rgba(15, 23, 42, .25);
  --radius: 14px;
  --max: 1180px;
  --head: 64px;
  --font-sans: "Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  color-scheme: light;
}
:root[data-theme="dark"] {
  --bg: #0b1220;
  --surface: #111b2e;
  --surface-2: #16223a;
  --text: #e9eef7;
  --body: #b3c0d6;
  --muted: #93a4bd;
  --line: #233149;
  --line-strong: #33445f;
  --accent: #60a5fa;
  --accent-2: #22d3ee;
  --accent-soft: rgba(96, 165, 250, .12);
  --accent-line: rgba(96, 165, 250, .32);
  --ok: #6ee7b7;
  --ok-bg: rgba(16, 185, 129, .12);
  --ok-line: rgba(110, 231, 183, .35);
  --shadow: 0 1px 2px rgba(0, 0, 0, .35), 0 18px 38px -20px rgba(0, 0, 0, .7);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: calc(var(--head) + 118px); }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body {
  margin: 0;
  background: var(--bg);
  color: var(--body);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent); text-decoration-thickness: .08em; text-underline-offset: .18em; }
a:hover { color: var(--accent-2); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
::selection { background: var(--accent-soft); color: var(--text); }
h1, h2, h3 { color: var(--text); }
[hidden] { display: none !important; }
.skip-link {
  position: absolute; left: 12px; top: -80px; z-index: 100;
  background: var(--text); color: var(--bg); padding: 10px 14px; border-radius: 8px;
  font-weight: 700; text-decoration: none; transition: top .15s ease;
}
.skip-link:focus { top: 12px; color: var(--bg); }
.sr-only {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
/* Header */
.site-head {
  position: sticky; top: 0; z-index: 60;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.head-in {
  max-width: var(--max); margin: 0 auto; height: var(--head);
  padding: 0 22px; display: flex; align-items: center; gap: 16px;
}
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); min-width: 0; }
.brand-mark {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 auto;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
  color: #fff; font-family: var(--font-mono); font-size: 12px; font-weight: 700;
  letter-spacing: -.04em; box-shadow: 0 6px 14px -8px rgba(37, 99, 235, .9);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.brand-text b { font-size: 15px; letter-spacing: -.01em; white-space: nowrap; }
.brand-text small { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.head-nav { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.head-nav a {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px;
  border-radius: 8px; color: var(--body); text-decoration: none;
  font-size: 14px; font-weight: 700; white-space: nowrap;
}
.head-nav a:hover { background: var(--surface-2); color: var(--text); }
.icon-btn {
  width: 38px; height: 38px; display: grid; place-items: center;
  border: 1px solid transparent; border-radius: 9px; background: transparent;
  color: var(--body); cursor: pointer; font: inherit;
}
.icon-btn:hover { background: var(--surface-2); border-color: var(--line); color: var(--text); }
.icon-sun { display: none; }
:root[data-theme="dark"] .icon-sun { display: block; }
:root[data-theme="dark"] .icon-moon { display: none; }
.gh-btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px;
  border-radius: 9px; background: var(--text); color: var(--bg) !important;
  font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap;
}
.gh-btn:hover { background: var(--accent); color: #fff !important; }

/* Hero */
.hero {
  position: relative; overflow: hidden;
  border-bottom: 1px solid var(--line);
  background:
    radial-gradient(820px 380px at 12% -20%, rgba(37, 99, 235, .16), transparent 62%),
    radial-gradient(720px 360px at 92% -10%, rgba(8, 145, 178, .14), transparent 58%),
    var(--surface);
}
:root[data-theme="dark"] .hero {
  background:
    radial-gradient(820px 380px at 12% -20%, rgba(37, 99, 235, .22), transparent 62%),
    radial-gradient(720px 360px at 92% -10%, rgba(8, 145, 178, .16), transparent 58%),
    var(--surface);
}
.hero-in { max-width: var(--max); margin: 0 auto; padding: 56px 22px 42px; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 10px; border: 1px solid var(--accent-line); border-radius: 999px;
  background: var(--accent-soft); color: var(--accent);
  font-size: 11.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
}
.eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
h1 {
  font-family: var(--font-serif); font-weight: 600;
  font-size: clamp(40px, 6.4vw, 68px); line-height: 1.02;
  letter-spacing: -.028em; margin: 18px 0 16px; max-width: 14ch;
}
h1 .accent { color: var(--accent); font-style: italic; }
.lead { max-width: 780px; margin: 0; font-size: clamp(17px, 2vw, 19px); line-height: 1.6; color: var(--body); }
.lead strong { color: var(--text); }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 26px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 10px 18px; border-radius: 10px;
  font-size: 14.5px; font-weight: 700; text-decoration: none; border: 1px solid transparent;
  transition: transform .12s ease, background .15s ease, border-color .15s ease;
}
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: var(--accent); color: #fff !important; box-shadow: 0 8px 18px -12px rgba(37, 99, 235, .9); }
.btn-primary:hover { background: #1d4ed8; }
.btn-ghost { background: var(--surface); border-color: var(--line-strong); color: var(--text) !important; }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent) !important; }
.link-plain { font-size: 14px; font-weight: 700; padding: 10px 6px; text-decoration: none; }
.link-plain:hover { text-decoration: underline; }

.stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  margin: 36px 0 0; border: 1px solid var(--line); border-radius: 16px;
  background: var(--surface); box-shadow: var(--shadow); overflow: hidden;
}
.stat { padding: 16px 20px 15px; border-right: 1px solid var(--line); }
.stat:last-child { border-right: 0; }
.stat b { display: block; font-family: var(--font-serif); font-size: 28px; line-height: 1.1; color: var(--text); font-variant-numeric: tabular-nums; }
.stat span { display: block; margin-top: 3px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }

.how {
  max-width: var(--max); margin: 0 auto; padding: 0 22px 42px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.step { display: flex; gap: 12px; padding: 16px 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.step-num {
  flex: 0 0 auto; width: 26px; height: 26px; border-radius: 8px;
  display: grid; place-items: center; background: var(--accent-soft); color: var(--accent);
  font-family: var(--font-mono); font-size: 12px; font-weight: 700;
}
.step b { display: block; color: var(--text); font-size: 14px; }
.step p { margin: 2px 0 0; font-size: 13.5px; line-height: 1.45; color: var(--muted); }
.step code { font-family: var(--font-mono); font-size: 12px; background: var(--surface-2); padding: 1px 4px; border-radius: 4px; }

/* Toolbar */
.toolbar {
  position: sticky; top: var(--head); z-index: 50;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.toolbar-in {
  max-width: var(--max); margin: 0 auto; padding: 11px 22px 10px;
  display: grid; grid-template-columns: minmax(240px, 1fr) auto; gap: 9px 14px; align-items: center;
}
.search { position: relative; display: flex; align-items: center; }
.search > svg { position: absolute; left: 13px; color: var(--muted); pointer-events: none; }
.search input {
  width: 100%; height: 44px; padding: 0 52px 0 40px;
  border: 1px solid var(--line-strong); border-radius: 10px;
  background: var(--surface); color: var(--text);
  font: inherit; font-size: 15px;
}
.search input::placeholder { color: var(--muted); }
.search input:focus { border-color: var(--accent); outline: 3px solid var(--accent-soft); outline-offset: 0; }
.search kbd {
  position: absolute; right: 10px; display: grid; place-items: center;
  min-width: 22px; height: 22px; padding: 0 5px;
  border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px;
  background: var(--surface-2); color: var(--muted);
  font-family: var(--font-mono); font-size: 11px;
}
.result-count {
  justify-self: end; white-space: nowrap; color: var(--muted);
  font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.chips { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; overflow-x: auto; padding: 2px 0 3px; scrollbar-width: thin; }
.chip {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface); color: var(--body); cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 700; white-space: nowrap;
}
.chip b { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.chip:hover { border-color: var(--accent-line); color: var(--text); }
.chip[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
.chip[aria-pressed="true"] b { color: color-mix(in srgb, var(--bg) 72%, transparent); }

/* Catalog */
.catalog { max-width: var(--max); margin: 0 auto; padding: 34px 22px 26px; }
.cat { margin: 0 0 44px; scroll-margin-top: calc(var(--head) + 118px); }
.cat-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding-bottom: 9px; border-bottom: 1px solid var(--line); }
.cat-num { font-family: var(--font-mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.cat-prefix {
  padding: 3px 6px; border-radius: 5px; background: var(--accent-soft);
  color: var(--accent); font-family: var(--font-mono); font-size: 11px; font-weight: 700;
}
.cat-head h2 { margin: 0; font-family: var(--font-serif); font-size: clamp(21px, 2.6vw, 26px); font-weight: 600; letter-spacing: -.015em; }
.cat-count { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.cat-link { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; }
.cat-desc { margin: 8px 0 16px; font-size: 13.5px; color: var(--muted); max-width: 820px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(292px, 1fr)); gap: 11px; }
.skill {
  position: relative; display: flex; flex-direction: column; gap: 6px;
  padding: 14px 15px 14px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 11px;
  scroll-margin-top: calc(var(--head) + 130px);
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.skill:hover { border-color: var(--accent-line); box-shadow: var(--shadow); transform: translateY(-1px); }
.skill:target, .skill.flash { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.skill-top { display: flex; align-items: center; gap: 8px; }
.skill-id {
  font-family: var(--font-mono); font-size: 11.5px; font-weight: 700;
  color: var(--accent); text-decoration: none; letter-spacing: .02em;
}
.skill-id:hover { text-decoration: underline; }
.copy {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 7px; border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface-2); color: var(--body);
  font: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
  transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.copy:hover { border-color: var(--accent-line); color: var(--accent); }
.copy.done { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok); }
.skill h3 { margin: 0; font-size: 15.5px; line-height: 1.32; letter-spacing: -.01em; }
.skill p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--body); }
.cat[hidden], .skill[hidden] { display: none; }

.empty {
  max-width: 560px; margin: 36px auto 60px; padding: 28px;
  text-align: center; background: var(--surface); border: 1px dashed var(--line-strong); border-radius: 14px;
}
.empty h2 { margin: 0 0 6px; font-family: var(--font-serif); font-size: 24px; }
.empty p { margin: 0 0 16px; color: var(--muted); }

/* Closing */
.about { max-width: var(--max); margin: 0 auto; padding: 8px 22px 56px; }
.about-in {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px; align-items: center;
  padding: 30px 32px; border: 1px solid var(--line); border-radius: 18px;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
  box-shadow: var(--shadow);
}
.about h2 { margin: 0 0 8px; font-family: var(--font-serif); font-size: clamp(26px, 3.4vw, 34px); font-weight: 600; letter-spacing: -.02em; }
.about p { margin: 0 0 10px; font-size: 15px; }
.about p:last-child { margin-bottom: 0; }
.about-actions { display: flex; flex-direction: column; gap: 9px; }
.about-actions .btn { width: 100%; }
.about-note { font-size: 12.5px; color: var(--muted); text-align: center; }

/* Footer */
.site-foot { border-top: 1px solid var(--line); background: var(--surface); }
.foot-in {
  max-width: var(--max); margin: 0 auto; padding: 24px 22px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px;
  font-size: 13px; color: var(--muted);
}
.foot-in nav { margin-left: auto; display: flex; flex-wrap: wrap; gap: 14px; }
.foot-in a { color: var(--body); text-decoration: none; font-weight: 700; }
.foot-in a:hover { color: var(--accent); text-decoration: underline; }

/* Toast */
.toast {
  position: fixed; left: 50%; bottom: 22px; z-index: 90;
  transform: translate(-50%, 14px); opacity: 0; pointer-events: none;
  padding: 10px 14px; border-radius: 9px;
  background: var(--text); color: var(--bg);
  font-size: 13px; font-weight: 700; box-shadow: var(--shadow);
  transition: opacity .18s ease, transform .18s ease;
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }

@media (max-width: 900px) {
  .head-nav .page-link { display: none; }
  .how { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(2) { border-right: 0; }
  .stat:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .about-in { grid-template-columns: 1fr; padding: 26px 24px; }
  .about-actions { flex-direction: row; flex-wrap: wrap; }
  .about-actions .btn { width: auto; flex: 1 1 180px; }
}
@media (max-width: 680px) {
  .head-in, .hero-in, .how, .toolbar-in, .catalog, .about, .foot-in { padding-left: 16px; padding-right: 16px; }
  .brand-text small { display: none; }
  .gh-btn span { display: none; }
  .gh-btn { padding: 9px; }
  .hero-in { padding-top: 38px; padding-bottom: 30px; }
  h1 { margin-top: 14px; }
  .actions .btn { flex: 1 1 150px; }
  .link-plain { flex: 1 1 100%; text-align: center; }
  .toolbar-in { grid-template-columns: 1fr; }
  .result-count { justify-self: start; }
  .search kbd { display: none; }
  .chips { flex-wrap: nowrap; }
  .cat-link { display: none; }
  .grid { grid-template-columns: 1fr; }
  .foot-in nav { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; scroll-behavior: auto !important; }
  .skill:hover, .btn:hover { transform: none; }
}
</style>
</head>
<body>
<a class="skip-link" href="#catalog">Skip to the skill catalog</a>

<header class="site-head">
  <div class="head-in">
    <a class="brand" href="__SITE__/" aria-label="Aydin Ayanzadeh — home">
      <span class="brand-mark" aria-hidden="true">&lt;/&gt;</span>
      <span class="brand-text"><b>AI Skills Bank</b><small>Aydin Ayanzadeh</small></span>
    </a>
    <nav class="head-nav" aria-label="Site">
      <a class="page-link" href="../projects/">Projects</a>
      <a class="page-link" href="../claude-code-encyclopedia/">Encyclopedia</a>
      <button type="button" class="icon-btn" id="theme-toggle" aria-label="Switch to dark theme">
        __ICON_SUN____ICON_MOON__
      </button>
      <a class="gh-btn" href="__REPO__" target="_blank" rel="noopener">__ICON_STAR__<span>Star</span></a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="hero" aria-labelledby="page-title">
    <div class="hero-in">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>Open source &middot; MIT &middot; No signup</p>
      <h1 id="page-title">500 AI skills, <span class="accent">ready to paste.</span></h1>
      <p class="lead">A curated bank of reusable roles and behaviors with <strong>stable IDs</strong>, built for Claude Code, Codex CLI, Gemini CLI, Kimi CLI, Aider and Cline. Find a skill by task or ID, copy one line, and keep the ID in your notes so the behavior stays reproducible.</p>
      <div class="actions">
        <a class="btn btn-primary" href="__REPO__" target="_blank" rel="noopener">__ICON_STAR__ Star on GitHub</a>
        <a class="btn btn-ghost" href="#how">How it works</a>
        <a class="link-plain" href="../projects/ai-skills-bank.html">Read the project writeup &rarr;</a>
      </div>
      <div class="stats" role="list" aria-label="Bank at a glance">
        <div class="stat" role="listitem"><b>500</b><span>Skills</span></div>
        <div class="stat" role="listitem"><b>10</b><span>Categories</span></div>
        <div class="stat" role="listitem"><b>6</b><span>CLI platforms</span></div>
        <div class="stat" role="listitem"><b>MIT</b><span>Self-hosted</span></div>
      </div>
    </div>
  </section>

  <section class="how" id="how" aria-label="How to use a skill">
    <div class="step"><span class="step-num" aria-hidden="true">1</span><div><b>Find the skill</b><p>Search by task, name or ID. Every card links to its own anchor, so <code>#CS-009</code> is shareable.</p></div></div>
    <div class="step"><span class="step-num" aria-hidden="true">2</span><div><b>Copy the line</b><p>Paste it into <code>CLAUDE.md</code>, <code>AGENTS.md</code>, <code>GEMINI.md</code> or any agent instruction field.</p></div></div>
    <div class="step"><span class="step-num" aria-hidden="true">3</span><div><b>Keep the ID</b><p>Reference <code>CS-009</code> in a spec, review or commit so people and agents route to the same behavior.</p></div></div>
  </section>

  <div class="toolbar">
    <div class="toolbar-in">
      <div class="search">
        __ICON_SEARCH__
        <input id="q" type="search" autocomplete="off" spellcheck="false" maxlength="120"
          placeholder="Search 500 skills by task, name or ID&hellip;" aria-label="Search skills">
        <kbd aria-hidden="true">/</kbd>
      </div>
      <p class="result-count" id="result-count" role="status" aria-live="polite">__TOTAL__ skills</p>
      <div class="chips" role="group" aria-label="Filter by category">
        __CHIPS__
      </div>
    </div>
  </div>

  <div class="catalog" id="catalog">
    __SECTIONS__

    <div class="empty" id="empty" hidden>
      <h2>No skill matches that.</h2>
      <p>Try a shorter phrase, an ID such as <code>CS-009</code>, or clear the filters.</p>
      <button type="button" class="btn btn-ghost" id="clear-filters">Clear filters</button>
    </div>
  </div>

  <section class="about" aria-labelledby="about-title">
    <div class="about-in">
      <div>
        <h2 id="about-title">One bank, every agent.</h2>
        <p>The bank groups 50 skills into each of ten categories: accessibility and multimodal work, coding and review, creativity, data and math, education, general reasoning, operations, product and UX, research and reading, and writing.</p>
        <p>Every entry has a stable ID, a human-readable name and a one-line description. The repository ships the same 500 skills as Markdown, plus configuration packs for six AI coding CLIs. MIT licensed, no account and no hosted service.</p>
      </div>
      <div class="about-actions">
        <a class="btn btn-primary" href="__REPO__" target="_blank" rel="noopener">__ICON_GITHUB__ View the repository</a>
        <a class="btn btn-ghost" href="skills.json" type="application/json">Download skills.json</a>
        <a class="btn btn-ghost" href="__REPO__/blob/main/README.md" target="_blank" rel="noopener">Read the README</a>
        <p class="about-note">Maintained by <a href="__SITE__/">Aydin Ayanzadeh</a></p>
      </div>
    </div>
  </section>
</main>

<footer class="site-foot">
  <div class="foot-in">
    <span>&copy; 2026 Aydin Ayanzadeh &middot; MIT-licensed skills</span>
    <nav aria-label="Footer">
      <a href="__SITE__/">Home</a>
      <a href="../projects/">Projects</a>
      <a href="../claude-code-encyclopedia/">Encyclopedia</a>
      <a href="__REPO__" target="_blank" rel="noopener">GitHub</a>
      <a href="../llms.txt">llms.txt</a>
    </nav>
  </div>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(function () {
  'use strict';
  var root = document.documentElement;
  var search = document.getElementById('q');
  var count = document.getElementById('result-count');
  var empty = document.getElementById('empty');
  var catalog = document.getElementById('catalog');
  var toast = document.getElementById('toast');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.skill'));
  var items = cards.map(function (card) {
    return { el: card, cat: card.closest('.cat').getAttribute('data-cat'), text: normalize(card.textContent) };
  });
  var total = cards.length;
  var state = { q: '', cat: 'all' };

  function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFKD')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-');
  }

  function buildUrl() {
    var url = new URL(window.location.href);
    if (state.q.trim()) { url.searchParams.set('q', state.q.trim()); } else { url.searchParams.delete('q'); }
    if (state.cat !== 'all') { url.searchParams.set('category', state.cat); } else { url.searchParams.delete('category'); }
    return url.pathname + url.search + url.hash;
  }

  function apply(updateUrl) {
    var terms = normalize(state.q.trim()).split(/\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (item) {
      var catOk = state.cat === 'all' || item.cat === state.cat;
      var queryOk = !terms.length || terms.every(function (term) { return item.text.indexOf(term) !== -1; });
      var visible = catOk && queryOk;
      item.el.hidden = !visible;
      if (visible) { shown += 1; }
    });
    sections.forEach(function (section) {
      section.hidden = !section.querySelector('.skill:not([hidden])');
    });
    count.textContent = shown === total ? total + ' skills' : shown + ' of ' + total + ' skills';
    empty.hidden = shown !== 0;
    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.getAttribute('data-cat') === state.cat ? 'true' : 'false');
    });
    if (updateUrl) { history.replaceState(null, '', buildUrl()); }
  }

  function setCategory(value) {
    state.cat = value || 'all';
    apply(true);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = catalog.getBoundingClientRect().top + window.pageYOffset - 128;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { setCategory(chip.getAttribute('data-cat')); });
  });

  search.addEventListener('input', function () {
    state.q = search.value;
    apply(true);
  });

  document.getElementById('clear-filters').addEventListener('click', function () {
    state.q = '';
    state.cat = 'all';
    search.value = '';
    apply(true);
    search.focus();
  });

  document.addEventListener('keydown', function (event) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      event.preventDefault();
      search.focus();
      search.select();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      state.q = '';
      apply(true);
      search.blur();
    }
  });

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
      document.body.removeChild(area);
      if (ok) { resolve(); } else { reject(new Error('copy failed')); }
    });
  }

  var toastTimer = null;
  function announce(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('.copy') : null;
    if (!button) { return; }
    var card = button.closest('.skill');
    var id = button.getAttribute('data-id') || '';
    var name = card && card.querySelector('h3') ? card.querySelector('h3').textContent : '';
    var description = card && card.querySelector('p') ? card.querySelector('p').textContent : '';
    var prompt = 'You are ' + id + ' \u2014 ' + name + '. ' + description;
    copyText(prompt).then(function () {
      var label = button.querySelector('span');
      button.classList.add('done');
      label.textContent = 'Copied';
      announce('Copied ' + id + ' prompt');
      setTimeout(function () {
        button.classList.remove('done');
        label.textContent = 'Copy';
      }, 1800);
    }).catch(function () {
      announce('Copy failed. Select the text and copy it manually.');
    });
  });

  var toggle = document.getElementById('theme-toggle');
  function themeLabel() {
    var dark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (error) { /* storage unavailable */ }
    themeLabel();
  });
  themeLabel();

  function focusHash() {
    var id = '';
    try { id = decodeURIComponent(window.location.hash.replace('#', '')); } catch (error) { id = ''; }
    if (!id) { return; }
    var card = document.getElementById(id);
    if (!card || !card.classList.contains('skill')) { return; }
    if (card.hidden) {
      state.cat = 'all';
      state.q = '';
      search.value = '';
      apply(true);
    }
    card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 2400);
    setTimeout(function () { card.scrollIntoView({ block: 'center' }); }, 30);
  }
  window.addEventListener('hashchange', focusHash);

  var params = new URLSearchParams(window.location.search);
  state.q = params.get('q') || '';
  state.cat = params.get('category') || 'all';
  var known = chips.some(function (chip) { return chip.getAttribute('data-cat') === state.cat; });
  if (!known) { state.cat = 'all'; }
  search.value = state.q;
  apply(false);
  focusHash();
})();
</script>
</body>
</html>
'''


def render(payload: dict) -> str:
    description = (
        "Browse 500 reusable AI skills for Claude Code, Codex CLI, Gemini CLI, Kimi CLI, "
        "Aider and Cline. Stable IDs, one-line descriptions and copy-ready prompts. "
        "MIT licensed, self-hosted, no signup."
    )
    item_list, collection, breadcrumb = build_structured_data(payload)
    page = PAGE
    replacements = {
        "__TITLE__": "AI Skills Bank \u2014 500 reusable AI skills | Aydin Ayanzadeh",
        "__OG_TITLE__": "AI Skills Bank \u2014 500 reusable AI skills",
        "__DESCRIPTION__": description,
        "__URL__": PAGE_URL,
        "__SITE__": SITE,
        "__REPO__": REPO,
        "__TOTAL__": str(payload["total"]),
        "__CHIPS__": build_chips(payload["categories"], payload["total"]),
        "__SECTIONS__": build_sections(payload["categories"], payload["skills"]),
        "__ITEMLIST__": item_list,
        "__COLLECTION__": collection,
        "__BREADCRUMB__": breadcrumb,
        "__ICON_SEARCH__": ICON_SEARCH,
        "__ICON_SUN__": ICON_SUN,
        "__ICON_MOON__": ICON_MOON,
        "__ICON_STAR__": ICON_STAR,
        "__ICON_GITHUB__": ICON_GITHUB,
    }
    for token, value in replacements.items():
        page = page.replace(token, value)
    if "__" in re.sub(r"https?://[^\s\"']+", "", page):
        leftovers = sorted(set(re.findall(r"__[A-Z_]+__", page)))
        if leftovers:
            raise SystemExit(f"unreplaced template tokens: {leftovers}")
    return page


def load_payload(source: Path) -> dict:
    if not source.is_file():
        raise SystemExit(f"skills data not found: {source}")
    with source.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    validate(payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE, help="path to the skills JSON index")
    parser.add_argument("--check", action="store_true", help="verify the generated files are current")
    args = parser.parse_args()

    payload = load_payload(args.source)
    page = render(payload)
    compact_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"

    if args.check:
        problems = []
        if not CATALOG_HTML.is_file() or CATALOG_HTML.read_text(encoding="utf-8") != page:
            problems.append(str(CATALOG_HTML.relative_to(ROOT)))
        if not CATALOG_JSON.is_file() or CATALOG_JSON.read_text(encoding="utf-8") != compact_json:
            problems.append(str(CATALOG_JSON.relative_to(ROOT)))
        if problems:
            print("skills catalog is stale: " + ", ".join(problems))
            print("run: python scripts/build_skills_catalog.py")
            return 1
        print("skills catalog: up to date")
        return 0

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    CATALOG_HTML.write_text(page, encoding="utf-8", newline="\n")
    CATALOG_JSON.write_text(compact_json, encoding="utf-8", newline="\n")
    print(f"wrote {CATALOG_HTML.relative_to(ROOT)} ({CATALOG_HTML.stat().st_size:,} bytes)")
    print(f"wrote {CATALOG_JSON.relative_to(ROOT)} ({CATALOG_JSON.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
