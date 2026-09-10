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


def validate_cli_catalog():
    """Schema 2 adds families; every section belongs to one and every entry to a section."""
    payload = read_json("data/claude-code/catalog.json")
    assert_true(payload.get("schemaVersion") == 2, "CLI catalog schemaVersion must be 2")

    families = payload.get("families", [])
    sections = payload.get("sections", [])
    entries = payload.get("entries", [])

    family_ids = [family.get("id") for family in families]
    section_ids = [section.get("id") for section in sections]
    entry_ids = [entry.get("id") for entry in entries]

    assert_true(family_ids and len(family_ids) == len(set(family_ids)), "family ids must be unique")
    assert_true(section_ids and len(section_ids) == len(set(section_ids)), "section ids must be unique")
    assert_true(entry_ids and len(entry_ids) == len(set(entry_ids)), "entry ids must be unique")

    family_set = set(family_ids)
    section_set = set(section_ids)

    for family in families:
        assert_true(family.get("label", "").strip(), f"family {family.get('id')} needs a label")
        assert_true(family.get("blurb", "").strip(), f"family {family.get('id')} needs a blurb")

    section_families = {}
    section_labels = {}
    for section in sections:
        assert_true(section.get("label", "").strip(), f"section {section.get('id')} needs a label")
        assert_true(
            section.get("family") in family_set,
            f"section {section.get('id')} references unknown family {section.get('family')}",
        )
        section_families[section["id"]] = section["family"]
        section_labels[section["id"]] = section["label"]

    # Every family must actually be populated, or a tab renders an empty view.
    populated = {section_families[entry["section"]] for entry in entries if entry.get("section") in section_families}
    for family_id in family_set:
        assert_true(family_id in populated, f"family {family_id} has no entries")

    used_sections = {entry.get("section") for entry in entries}
    for section_id in section_set:
        assert_true(section_id in used_sections, f"section {section_id} has no entries")

    required = {"id", "section", "name", "type", "description", "aliases", "examples", "introducedVersion", "tags", "note"}
    names_by_section = {}
    for entry in entries:
        entry_id = entry.get("id")
        missing = required - entry.keys()
        assert_true(not missing, f"entry {entry_id} missing fields: {sorted(missing)}")
        assert_true(entry["section"] in section_set, f"entry {entry_id} references unknown section")
        assert_true(entry["name"].strip(), f"entry {entry_id} needs a name")
        assert_true(entry["description"].strip(), f"entry {entry_id} needs a description")
        assert_true(isinstance(entry["aliases"], list), f"entry {entry_id} aliases must be a list")
        assert_true(isinstance(entry["tags"], list) and entry["tags"], f"entry {entry_id} needs at least one tag")

        assert_true(isinstance(entry["examples"], list), f"entry {entry_id} examples must be a list")
        for example in entry["examples"]:
            assert_true(
                example.get("command", "").strip() and example.get("label", "").strip(),
                f"entry {entry_id} has an example missing a command or label",
            )

        # A duplicate name inside one section means two records the reader
        # cannot tell apart in the rendered list.
        key = (entry["section"], entry["name"])
        assert_true(key not in names_by_section, f"duplicate name {entry['name']} in section {entry['section']}")
        names_by_section[key] = entry_id

        # The card shows the section label and the type side by side, so a type
        # that merely repeats its section wastes the badge.
        section_label = section_labels[entry["section"]]
        assert_true(
            entry["type"].strip().lower() != section_label.strip().lower(),
            f"entry {entry_id} type '{entry['type']}' just repeats its section label",
        )


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

    # The catalog renderer must keep reusing the shared modules rather than
    # growing its own copy of node building and search scoring.
    catalog_js = (ROOT / "js/claude-code-catalog.js").read_text(encoding="utf-8")
    assert_true("./lib/dom.js" in catalog_js, "catalog renderer must reuse js/lib/dom.js")
    assert_true("./lib/search.js" in catalog_js, "catalog renderer must reuse js/lib/search.js")

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
    validate_cli_catalog()
    validate_routes_and_size_budgets()
    print("content validation: PASS")


if __name__ == "__main__":
    main()
