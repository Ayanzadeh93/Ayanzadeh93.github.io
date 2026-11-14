# Project skills

Agent skills that Claude Code (and other Agent Skills tools) load for this repository.

| Skill | Source | Used for |
|---|---|---|
| `extract-design-md` | [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) `plugins/stitch-design/skills/extract-design-md` | Writing `DESIGN.md` from `css/site.css` and the page markup |
| `taste-design` | same repository, `plugins/stitch-utilities/skills/taste-design` | Auditing pages against its list of generic-design patterns |
| `site-md` | same repository, `plugins/stitch-utilities/skills/site-md` | A `.stitch/SITE.md` project brief, if Google Stitch is connected later |

Copied from commit `0337446dadde6f8c94210444e2aa9d546126480f` under the Apache License 2.0 (`LICENSE-stitch-skills`).
The only change: the `name` of extract-design-md was `stitch::extract-design-md`;
Claude Code skill names are kebab-case, so it is `extract-design-md` here.

The other Stitch skills (generate-design, manage-design-system, upload-to-stitch,
code-to-design, design-md, stitch-loop, and the React, React Native, shadcn and
Remotion build skills) need the Stitch MCP server and a Google account, or target
frameworks this site does not use, so they are not installed. To use them, set up
Stitch MCP (https://stitch.withgoogle.com/docs/mcp/setup/) and install with
`npx plugins add google-labs-code/stitch-skills --scope project --target claude-code`.

The site's own conventions are in `.cursor/skills/website-frontend-backend/`.
