#!/usr/bin/env python3
"""Insert JSON-LD (+ optional breadcrumb nav) into portfolio pages."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.ayanzadeh.com"
PERSON_ID = f"{SITE}/#person"
WEBSITE_ID = f"{SITE}/#website"


def dumps(obj: dict) -> str:
    return json.dumps(obj, indent=4, ensure_ascii=False)


def script(obj: dict) -> str:
    return (
        '\n    <script type="application/ld+json">\n'
        + dumps(obj)
        + "\n    </script>\n"
    )


def breadcrumbs(items: list[tuple[str, str]]) -> dict:
    els = []
    for i, (name, url) in enumerate(items, 1):
        els.append(
            {
                "@type": "ListItem",
                "position": i,
                "name": name,
                "item": url,
            }
        )
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": els}


def person_ref() -> dict:
    return {"@id": PERSON_ID}


def software(name: str, url: str, description: str, extra: dict | None = None) -> dict:
    data = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": name,
        "url": url,
        "description": description,
        "author": person_ref(),
        "creator": person_ref(),
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web",
    }
    if extra:
        data.update(extra)
    return data


def webapp(name: str, url: str, description: str) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": name,
        "url": url,
        "description": description,
        "author": person_ref(),
        "applicationCategory": "ReferenceApplication",
        "operatingSystem": "Web",
        "isAccessibleForFree": True,
    }


def crumb_html(items: list[tuple[str, str]]) -> str:
    parts = ['    <nav class="schema-breadcrumbs" aria-label="Breadcrumb">', "        <ol>"]
    last = len(items) - 1
    for i, (name, url) in enumerate(items):
        if i == last:
            parts.append(f'            <li aria-current="page">{name}</li>')
        else:
            parts.append(f'            <li><a href="{url}">{name}</a></li>')
    parts += ["        </ol>", "    </nav>"]
    return "\n".join(parts) + "\n"


def insert_before_head_end(html: str, block: str) -> str:
    # drop previous injected block
    html = re.sub(
        r"\n?    <!-- seo-schema -->.*?    <!-- /seo-schema -->\n?",
        "\n",
        html,
        flags=re.S,
    )
    injection = "    <!-- seo-schema -->" + block + "    <!-- /seo-schema -->\n"
    if re.search(r"</head>", html, flags=re.I):
        return re.sub(r"</head>", injection + "</head>", html, count=1, flags=re.I)
    return html + injection


def insert_breadcrumb_nav(html: str, items: list[tuple[str, str]]) -> str:
    html = re.sub(
        r"\n?    <nav class=\"schema-breadcrumbs\"[\s\S]*?</nav>\n",
        "\n",
        html,
        count=1,
    )
    nav = crumb_html(items)
    # after opening body or after project-nav if present
    if "class=\"project-nav\"" in html:
        return re.sub(
            r"(</nav>\s*\n\s*<main )",
            r"</nav>\n" + nav + "    <main ",
            html,
            count=1,
        )
    return re.sub(r"(<body[^>]*>)", r"\1\n" + nav, html, count=1)


def patch_homepage(html: str) -> str:
    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Person",
                "@id": PERSON_ID,
                "name": "Aydin Ayanzadeh",
                "givenName": "Aydin",
                "familyName": "Ayanzadeh",
                "url": f"{SITE}/",
                "image": f"{SITE}/images/profile-compressed.jpg",
                "jobTitle": "Ph.D. Student in Computer Science",
                "email": "a.ayanzadeh@gmail.com",
                "affiliation": {
                    "@type": "CollegeOrUniversity",
                    "name": "University of Maryland, Baltimore County",
                    "url": "https://umbc.edu/",
                },
                "sameAs": [
                    "https://github.com/Ayanzadeh93",
                    "https://linkedin.com/in/ayanzadeh93",
                    "https://scholar.google.com/citations?user=ayanzadeh93",
                    "https://x.com/aydin_ayanzadeh",
                ],
            },
            {
                "@type": "WebSite",
                "@id": WEBSITE_ID,
                "name": "Aydin Ayanzadeh",
                "url": f"{SITE}/",
                "inLanguage": "en",
                "publisher": {"@id": PERSON_ID},
                "author": {"@id": PERSON_ID},
            },
        ],
    }
    # Keep existing Person/WebSite scripts; add graph as the canonical linked version.
    return insert_before_head_end(html, script(graph))


PROJECTS = {
    "projects/indoor-navigation.html": {
        "name": "FloorPlan2Guide",
        "desc": "LLM-based indoor navigation that uses GPT-4 Vision and floor plans to assist people who are blind or have low vision.",
        "type": "software",
        "extra": {"applicationCategory": "AccessibilityApplication"},
    },
    "projects/wildfire-vlm.html": {
        "name": "WildfireVLM",
        "desc": "Vision-language model for early wildfire detection and risk assessment from satellite imagery.",
        "type": "software",
    },
    "projects/knowledge-distillation.html": {
        "name": "PURSUhInT",
        "desc": "Hint-based knowledge distillation framework for compressing deep models with limited accuracy loss.",
        "type": "software",
    },
    "projects/medical-segmentation.html": {
        "name": "Medical Image Segmentation",
        "desc": "Multi-task deep learning platform for medical image analysis on imbalanced datasets.",
        "type": "software",
    },
    "projects/vision-language-medical.html": {
        "name": "Vision-Language Medical Models",
        "desc": "CLIP-based architecture for medical imaging, zero-shot classification, and report generation.",
        "type": "software",
    },
    "projects/graph-autoencoder.html": {
        "name": "Graph Autoencoder Framework",
        "desc": "Graph neural network autoencoder with residual connections for representation learning.",
        "type": "software",
    },
    "projects/ml-data-pipeline.html": {
        "name": "ML Data Pipeline System",
        "desc": "Scalable data processing pipeline for preprocessing and feature engineering.",
        "type": "software",
    },
    "projects/claude-code-encyclopedia.html": {
        "name": "Claude Code Encyclopedia",
        "desc": "Searchable reference for Claude Code and OpenAI Codex CLI commands, flags, and config paths.",
        "type": "webapp",
    },
    "apps/claude-code-encyclopedia.html": {
        "name": "Claude Code Encyclopedia",
        "desc": "Searchable reference for Claude Code and OpenAI Codex CLI commands, flags, and config paths.",
        "type": "webapp",
    },
}


def patch_project(path: str, html: str, spec: dict) -> str:
    url = f"{SITE}/{path}"
    if spec["type"] == "webapp":
        primary = webapp(spec["name"], url, spec["desc"])
    else:
        primary = software(spec["name"], url, spec["desc"], spec.get("extra"))
    items = [
        ("Home", f"{SITE}/"),
        ("Projects", f"{SITE}/#projects"),
        (spec["name"], url),
    ]
    block = script(primary) + script(breadcrumbs(items))
    html = insert_before_head_end(html, block)
    html = insert_breadcrumb_nav(html, items)
    return html


def patch_blog(html: str) -> str:
    blog = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "Aydin Ayanzadeh Research Blog",
        "url": f"{SITE}/blog.html",
        "description": "Research notes on computer vision, medical imaging, and multimodal AI.",
        "author": person_ref(),
        "publisher": person_ref(),
        "inLanguage": "en",
    }
    items = [("Home", f"{SITE}/"), ("Blog", f"{SITE}/blog.html")]
    html = insert_before_head_end(html, script(blog) + script(breadcrumbs(items)))
    html = insert_breadcrumb_nav(html, items)
    return html


def main() -> None:
    changed = []
    home = ROOT / "index.html"
    home.write_text(patch_homepage(home.read_text(encoding="utf-8")), encoding="utf-8")
    changed.append("index.html")

    blog = ROOT / "blog.html"
    if blog.exists():
        blog.write_text(patch_blog(blog.read_text(encoding="utf-8")), encoding="utf-8")
        changed.append("blog.html")

    for rel, spec in PROJECTS.items():
        p = ROOT / rel
        if not p.exists():
            print("missing", rel)
            continue
        p.write_text(patch_project(rel, p.read_text(encoding="utf-8"), spec), encoding="utf-8")
        changed.append(rel)

    print("updated", len(changed))
    for c in changed:
        print(" ", c)


if __name__ == "__main__":
    main()
