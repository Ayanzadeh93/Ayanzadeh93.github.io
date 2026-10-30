#!/usr/bin/env python3
"""Validate static portfolio data and lightweight route contracts."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def read_json(path: str):
    with (ROOT / path).open(encoding="utf-8") as handle:
        return json.load(handle)


def assert_true(condition: bool, message: str):
    if not condition:
        raise AssertionError(message)


def validate_projects():
    payload = read_json("data/projects.json")
    assert_true(payload.get("schemaVersion") == 1, "projects.json schemaVersion must be 1")
    projects = payload.get("projects")
    assert_true(isinstance(projects, list) and projects, "projects.json must contain projects")

    required = {"id", "title", "subtitle", "category", "status", "summary", "legacyPage", "links"}
    ids = [project.get("id") for project in projects]
    assert_true(all(ids), "every project needs a non-empty id")
    assert_true(len(ids) == len(set(ids)), "project ids must be unique")
    id_set = set(ids)

    for project in projects:
        missing = required - project.keys()
        assert_true(not missing, f"{project.get('id')} missing fields: {sorted(missing)}")
        assert_true(project["title"].strip(), f"{project['id']} needs a title")
        assert_true(project["summary"].strip(), f"{project['id']} needs a summary")
        assert_true((ROOT / "projects" / project["legacyPage"]).is_file(), f"legacy page missing for {project['id']}")

        for related in project.get("related", []):
            assert_true(related in id_set, f"{project['id']} references unknown related project {related}")
            assert_true(related != project["id"], f"{project['id']} cannot relate to itself")

        for link in project.get("links", []):
            assert_true(link.get("label") and link.get("href"), f"{project['id']} has an incomplete link")
            href = link["href"]
            parsed = urlparse(href)
            if parsed.scheme or href.startswith("#"):
                continue
            target = (ROOT / "projects" / parsed.path).resolve()
            assert_true(target.is_file(), f"{project['id']} local link target does not exist: {href}")


def validate_routes_and_size_budgets():
    required_files = [
        "projects/index.html",
        "projects/project.html",
        "apps/claude-code-catalog.html",
        "apps/claude-code-encyclopedia.html",
        "js/projects-index.js",
        "js/project-detail.js",
        "js/lib/project-data.js",
        "css/projects-data.css",
    ]
    for relative in required_files:
        assert_true((ROOT / relative).is_file(), f"missing route asset: {relative}")

    detail_js = (ROOT / "js/project-detail.js").read_text(encoding="utf-8")
    helper_js = (ROOT / "js/lib/project-data.js").read_text(encoding="utf-8")
    assert_true("getProjectById" in detail_js, "project detail route must use shared resolver")
    assert_true("project.html?id=" in helper_js, "shared route helper must build project detail URLs")

    # Old app URLs must keep redirecting into the standalone Pages app.
    for relative in ("apps/claude-code-encyclopedia.html", "apps/claude-code-catalog.html"):
        html = (ROOT / relative).read_text(encoding="utf-8")
        assert_true(
            "https://www.ayanzadeh.com/claude-code-encyclopedia/" in html,
            f"{relative} must redirect to the standalone encyclopedia",
        )

    budgets = {
        "projects/index.html": 30_000,
        "projects/project.html": 30_000,
        "apps/claude-code-catalog.html": 30_000,
        "apps/claude-code-encyclopedia.html": 30_000,
        "js/projects-index.js": 20_000,
        "js/project-detail.js": 20_000,
        "css/projects-data.css": 30_000,
    }
    for relative, limit in budgets.items():
        size = (ROOT / relative).stat().st_size
        assert_true(size <= limit, f"{relative} exceeds lightweight size budget: {size} > {limit}")


def validate_skills_bank():
    payload = read_json("data/skills-bank.json")
    assert_true(payload.get("schemaVersion") == 1, "skills-bank.json schemaVersion must be 1")

    skills = payload.get("skills")
    categories = payload.get("categories")
    assert_true(isinstance(skills, list) and skills, "skills-bank.json must contain skills")
    assert_true(isinstance(categories, list) and categories, "skills-bank.json must contain categories")
    assert_true(payload.get("total") == len(skills) == 500, "skills-bank.json must describe 500 skills")
    assert_true(len(categories) == 10, "skills-bank.json must describe 10 categories")

    ids = [skill.get("id") for skill in skills]
    assert_true(all(ids), "every skill needs a non-empty id")
    assert_true(len(ids) == len(set(ids)), "skill ids must be unique")
    assert_true(all(len(skill_id) == 6 for skill_id in ids), "skill ids must be six characters")
    assert_true(
        all(skill_id[2] == "-" and skill_id[3:].isdigit() for skill_id in ids),
        "skill ids must look like CS-009",
    )
    assert_true(
        all(skill_id.isascii() for skill_id in ids),
        "skill ids must be ASCII (a non-breaking hyphen once broke 1,028 ids)",
    )

    category_names = {category.get("name") for category in categories}
    prefixes = {category.get("prefix") for category in categories}
    assert_true(len(category_names) == 10, "category names must be unique")
    assert_true(len(prefixes) == 10, "category prefixes must be unique")

    for category in categories:
        assert_true(category.get("file", "").startswith("skills/"), f"{category.get('prefix')} needs a source file")
        count = sum(1 for skill in skills if skill.get("category") == category.get("name"))
        assert_true(count == category.get("count") == 50, f"{category.get('name')} must contain 50 skills")

    for skill in skills:
        assert_true(skill.get("category") in category_names, f"{skill['id']} has an unknown category")
        assert_true(skill["id"].startswith(
            next(category["prefix"] for category in categories if category["name"] == skill["category"])
        ), f"{skill['id']} does not match its category prefix")
        for field in ("name", "description", "file"):
            assert_true(str(skill.get(field, "")).strip(), f"{skill['id']} is missing {field}")

    catalog = (ROOT / "skills" / "index.html").read_text(encoding="utf-8")
    assert_true(catalog.count('<article class="skill"') == 500, "skills catalog must render 500 skill cards")
    assert_true("https://www.ayanzadeh.com/skills/" in catalog, "skills catalog needs its canonical URL")
    assert_true('"numberOfItems":500' in catalog, "skills catalog JSON-LD must list all 500 skills")
    for skill_id in ids:
        assert_true(f'id="{skill_id}"' in catalog, f"skills catalog is missing {skill_id}")
    for category in categories:
        slug = {
            "AS": "accessibility", "CS": "coding", "CR": "creativity", "DS": "data", "ES": "education",
            "GS": "general", "OS": "operations", "PS": "product", "RS": "research", "WS": "writing",
        }[category["prefix"]]
        assert_true(f'id="category-{slug}"' in catalog, f"skills catalog is missing the {category['name']} section")

    # The public JSON must be the same document as the vendored source.
    public_json = read_json("skills/skills.json")
    assert_true(public_json == payload, "skills/skills.json must match data/skills-bank.json")

    page = (ROOT / "projects" / "ai-skills-bank.html").read_text(encoding="utf-8")
    assert_true("https://github.com/Ayanzadeh93/Claude-Skills-Bank" in page, "project page must link the repository")
    assert_true("https://www.ayanzadeh.com/skills/" in page, "project page must link the catalog")
    assert_true("MIT" in page, "project page must state the license")

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for url in ("https://www.ayanzadeh.com/skills/", "https://www.ayanzadeh.com/projects/ai-skills-bank.html"):
        assert_true(url in sitemap, f"sitemap is missing {url}")

    llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
    assert_true("https://www.ayanzadeh.com/skills/" in llms, "llms.txt must mention the skills catalog")
    assert_true("skills.json" in llms, "llms.txt must mention the JSON index")


def main():
    validate_projects()
    validate_routes_and_size_budgets()
    validate_skills_bank()
    print("content validation: PASS")


if __name__ == "__main__":
    main()
