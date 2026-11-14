# Aydin Ayanzadeh — personal academic site

Source for <https://www.ayanzadeh.com>: the site of Aydin Ayanzadeh, Ph.D. student in Computer Science at
the University of Maryland, Baltimore County.

Static HTML, CSS and vanilla JavaScript, served as committed files by GitHub Pages. There is no framework
and nothing to compile at deploy time. A small Python script generates the pages that would otherwise
repeat the same bibliography by hand.

## What is where

```
├── index.html                  Homepage (hand-written, with generated regions)
├── publications.html           Publication library            ← generated
├── cv.html                     Web curriculum vitae           ← generated
├── <paper-id>/index.html       One page per publication       ← generated
├── contact.html, blog.html, blog/<slug>/, 404.html         hand-written, generated header/footer
├── accessibility.html, feed.xml                              ← generated
├── data/
│   ├── publications.json       Every publication — the single source of truth
│   ├── news.json               Hand-written news items
│   ├── profile.json            Education, experience, teaching, service, honours
│   ├── site.json               Name, links, navigation, "last updated" date
│   └── projects.json           Projects hub data (separate system, see below)
├── assets/
│   ├── figures/                Redrawn SVG figures inlined into paper pages
│   ├── og/                     1200×630 social preview cards, one per paper
│   ├── publications.bib        All BibTeX entries              ← generated
│   └── slides/
├── css/site.css                Design system for everything except Projects
├── js/
│   ├── theme-init.js           Applies the saved colour scheme before first paint
│   ├── site.js                 Menu, theme toggle, scroll spy, forms, figure zoom…
│   ├── components/             <pub-library>, <cite-dialog>, entry point index.js
│   └── lib/                    Pure helpers: citations, search, dom, pub-data
├── fonts/                      Self-hosted Newsreader and Atkinson Hyperlegible
├── scripts/
│   ├── build_site.py           The generator (no dependencies)
│   ├── fetch_figures.py        Saves hot-linked paper figures into assets/figures/
│   ├── check_profiles.py       Compares the publication list with DBLP and ORCID
│   └── make_social_cards.js    Optional: renders assets/og/*.png with Playwright
├── tests/
│   ├── validate_publications.py  Data schema + internal link check (CI)
│   ├── validate_content.py       Projects data + route contracts (CI)
│   └── smoke.js                  Optional browser smoke test (Playwright)
└── sitemap.xml                 In-scope URLs regenerated; Projects entries kept as written
```

### The Projects section is a separate system

`projects/`, `css/style.css`, `css/refresh.css`, `css/project.css`, `css/projects-data.css`, `js/main.js`,
`js/project-detail.js`, `js/projects-index.js`, `js/lib/project-data.js` and `data/projects.json` belong to
the Projects pages. Nothing in `css/site.css`, `js/site.js` or `scripts/build_site.py` reads or changes
them. The homepage still loads the legacy stylesheets and `main.js` for one reason: its *Research Projects*
and *Selected Projects* sections are rendered exactly as before. Every rule in `css/site.css` is scoped to
`.ds` / `.ds-root` or to class names that do not exist in the legacy sheets, so the two systems cannot
affect each other.

## Everyday tasks

Run the site locally (ES modules do not load from `file://`):

```bash
python3 -m http.server 8765      # then open http://localhost:8765
```

### Add or edit a publication

1. Edit `data/publications.json`. Copy an existing entry; the fields are:

   | Field | Notes |
   |-------|-------|
   | `id` | URL slug. With a `page` block the paper page is `/<id>/`. Keep it stable. |
   | `title`, `title_lead` | `title_lead` is the opening phrase shown in the accent colour; it must be the start of `title`. |
   | `authors` | Display names in order, diacritics included. |
   | `type` | `article`, `inproceedings`, `incollection` or `preprint`. |
   | `status` | `published`, `accepted`, `under-review` or `preprint`. |
   | `venue`, `venue_short`, `venue_line` | Container title for citations, the short label, and the full human-readable line. |
   | `volume`, `number`, `pages`, `publisher`, `doi`, `arxiv` | Optional. Verify a DOI at `https://doi.org/<doi>` before adding it. |
   | `topic` | One of the ids under `topics` — the research thread it belongs to. |
   | `selected` | `true` to feature it on the homepage. |
   | `summary` | One sentence, shown in lists and used for search. |
   | `links` | Optional `pdf`, `publisher`, `code`, `slides`, `book`. Only real links: nothing is rendered for a missing one. |
   | `bibtex` | The curated entry, used verbatim everywhere. |
   | `page` | Paper-page content: `description`, `abstract` (paragraphs), optional `figures`, `notes`, `method`, `resources`. Omit it and set `external_page` for a paper hosted elsewhere. |

2. Regenerate and check:

   ```bash
   python scripts/build_site.py              # writes the pages, library, .bib and sitemap
   python tests/validate_publications.py     # schema, identifiers, every internal link
   ```

3. Optional: `node scripts/make_social_cards.js` (with the local server running) to draw the paper's
   social preview card, then run the build again.

The library, the homepage's *Selected publications*, the research-threads chart, the news list, the
paper page with its Google Scholar tags and `ScholarlyArticle` JSON-LD, `assets/publications.bib` and
`sitemap.xml` all follow from that one edit. A paper from the last two calendar years also appears under
*News* automatically.

### Housekeeping scripts

- `python scripts/fetch_figures.py` saves the paper figures still loaded from arxiv.org into `assets/figures/` and points the data at the copies. Check each paper's licence before committing them.
- `python scripts/check_profiles.py` lists papers that DBLP or ORCID know about and the site does not, and the reverse.

### Other content

- **News**: add an item to `data/news.json`, rebuild.
- **Education, experience, teaching, reviewing, awards, memberships**: `data/profile.json`, rebuild. The homepage sections and `cv.html` both follow.
- **Profile links, navigation, contact details, toolkit**: `data/site.json`, rebuild. Bump `updated` when content changes; it drives the footer date and the sitemap.
- **Homepage text** (research statement, interests, the floor-plan illustration): edit `index.html` directly, outside the `<!-- build:… -->` regions.
- **Toolkit logos**: `assets/icons/tech.svg` (Simple Icons, CC0); add a symbol and reference its id from `data/site.json`.
- **CV**: the web CV is generated; replace `Aydin_Ayanzadeh_CV__final.pdf` for the PDF.

Never edit inside a `<!-- build:NAME -->` … `<!-- /build:NAME -->` region, a paper page,
`publications.html` or `cv.html` by hand: the next build overwrites it, and CI fails when generated files are stale
(`python scripts/build_site.py --check`).

## Design system

`.stitch/DESIGN.md` describes the design system in words: palette with roles, type hierarchy, components, layout and the patterns the site avoids. It was written with the `extract-design-md` skill and audited with `taste-design`, both from [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) and installed in `.claude/skills/` (see the README there).

`css/site.css` holds the tokens (colour, type, spacing), light and dark themes, and every component. The
typefaces are Newsreader for titles and long-form reading and Atkinson Hyperlegible, a face designed for
low-vision readers, for everything else; both are self-hosted. Icons are a small inline SVG sprite.

Principles the code holds to:

- **Progressive enhancement.** All content is in the HTML. Search, filters, the cite dialog and copy
  buttons ship `hidden` and are revealed by the script that powers them, so there is never a control
  that does nothing.
- **No inline scripts.** Pages that use only `site.css` run under `script-src 'self'`.
- **Accessibility.** One `<h1>` per page, labelled landmarks, visible focus, `prefers-reduced-motion`
  respected, AA contrast in both themes, and 3:1 boundaries on form controls.
- **Honest metadata.** Buttons appear only for resources that exist. Remote figures that fail to load
  degrade to a note instead of a broken image.

## Tests

| Command | What it covers |
|---------|----------------|
| `python tests/validate_publications.py` | Data schema, DOI/arXiv/BibTeX shape, local files, every internal link and anchor on in-scope pages |
| `python tests/validate_publications.py --self-test` | Proves each validation rule can fail |
| `python scripts/build_site.py --check` | Generated files match the data |
| `python tests/validate_content.py` | Projects data and route contracts |
| `python tests/check_budgets.py` | Byte budgets for pages, styles, scripts, fonts and images |
| `node tests/smoke.js` | Optional, needs Playwright: loads all in-scope pages at two widths, fails on console errors or overflow, and drives the interactive features |

The first five run in GitHub Actions on every pull request and push to `main`.

## Deployment

Push to `main`; GitHub Pages serves the repository root. See `DEPLOYMENT.md` for the custom domain.

## License

© 2026 Aydin Ayanzadeh. All rights reserved.
