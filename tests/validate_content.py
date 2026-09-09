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


def validate_claude_catalog():
    payload = read_json("data/claude-code/catalog.json")
    assert_true(payload.get("schemaVersion") == 1, "Claude catalog schemaVersion must be 1")

    sections = payload.get("sections", [])
    entries = payload.get("entries", [])
    section_ids = [section.get("id") for section in sections]
    entry_ids = [entry.get("id") for entry in entries]

    assert_true(section_ids and len(section_ids) == len(set(section_ids)), "Claude section ids must be unique")
    assert_true(entry_ids and len(entry_ids) == len(set(entry_ids)), "Claude entry ids must be unique")
    section_set = set(section_ids)

    required = {"id", "section", "name", "type", "description", "aliases", "examples", "introducedVersion", "tags", "note"}
    for entry in entries:
        missing = required - entry.keys()
        assert_true(not missing, f"Claude entry {entry.get('id')} missing fields: {sorted(missing)}")
        assert_true(entry["section"] in section_set, f"Claude entry {entry['id']} references unknown section")
        assert_true(entry["name"].strip(), f"Claude entry {entry['id']} needs a name")
        assert_true(entry["description"].strip(), f"Claude entry {entry['id']} needs a description")


def validate_routes_and_size_budgets():
    required_files = [
        "projects/index.html",
        "projects/project.html",
        "apps/claude-code-catalog.html",
        "js/projects-index.js",
        "js/project-detail.js",
        "js/lib/project-data.js",
        "js/claude-code-catalog.js",
        "css/projects-data.css",
    ]
    for relative in required_files:
        assert_true((ROOT / relative).is_file(), f"missing route asset: {relative}")

    detail_js = (ROOT / "js/project-detail.js").read_text(encoding="utf-8")
    helper_js = (ROOT / "js/lib/project-data.js").read_text(encoding="utf-8")
    assert_true("getProjectById" in detail_js, "project detail route must use shared resolver")
    assert_true("project.html?id=" in helper_js, "shared route helper must build project detail URLs")

    budgets = {
        "projects/index.html": 30_000,
        "projects/project.html": 30_000,
        "apps/claude-code-catalog.html": 30_000,
        "js/projects-index.js": 20_000,
        "js/project-detail.js": 20_000,
        "js/claude-code-catalog.js": 20_000,
        "css/projects-data.css": 30_000,
    }
    for relative, limit in budgets.items():
        size = (ROOT / relative).stat().st_size
        assert_true(size <= limit, f"{relative} exceeds lightweight size budget: {size} > {limit}")


def main():
    validate_projects()
    validate_claude_catalog()
    validate_routes_and_size_budgets()
    print("content validation: PASS")


if __name__ == "__main__":
    main()
