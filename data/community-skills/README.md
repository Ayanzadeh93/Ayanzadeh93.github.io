# Community skills index

This directory contains 4,500 source-linked community skill records, stored as 45 batches of 100. The original 500 first-party prompt entries remain in `data/skills-bank.json` and retain their existing IDs and MIT license.

The index was crawled on 2026-11-04 from two public discovery sources:

- [skymined/awesome-claude-codex-skills](https://github.com/skymined/awesome-claude-codex-skills) supplied candidate links. Each included entry links to its original `SKILL.md`. Included repositories were checked through GitHub license metadata and were reported as MIT or Apache-2.0.
- [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) supplied additional candidates. That repository says original non-code content is CC BY 4.0 unless a more specific upstream notice applies. The catalog includes names, topics and source links from this collection, uses a site-authored generic description, and links to its [content license](https://github.com/sickn33/agentic-awesome-skills/blob/main/LICENSE-CONTENT) and [source exceptions](https://github.com/sickn33/agentic-awesome-skills/blob/main/docs/sources/sources.md).

The crawler fetched 6,245 candidate files and validated their `SKILL.md` frontmatter. It retained 4,500 entries after format checks, source-level license filtering for the first collection, exact name/description deduplication, topic-balanced selection, and exclusion of candidates the second index labeled offensive. The second index's labels are selection metadata only; this catalog has not independently reviewed the skill instructions.

The website does not copy or execute any imported file. Community cards can load the complete upstream `SKILL.md` on demand in an in-page plain-text reader, and link to the source and available license details. The original repository remains the source of truth; review each source and license before reuse. See `manifest.json` for counts and the selection policy.
