---
name: website-frontend-backend
description: Builds and maintains the ayanzadeh.com static portfolio site — HTML/CSS/vanilla JS frontend, Formspree forms, SEO, accessibility, and GitHub Pages/Netlify deployment. Use when editing pages, styles, scripts, contact forms, project/blog pages, or deployment for this website.
---

# Website Frontend & Backend

Static academic portfolio. No framework and no bundler; the browser runs the
source files as written. One dependency-free Python script,
`scripts/build_site.py`, generates the publication pages from JSON, and its
output is committed, so deployment is still "push the files".

The site is two systems that must not touch each other:

- **Everything except Projects** — `css/site.css`, `js/site.js`,
  `js/components/`, `data/publications.json`, `scripts/build_site.py`.
- **Projects** — `projects/`, `css/style.css`, `css/refresh.css`,
  `css/project.css`, `css/projects-data.css`, `js/main.js`,
  `js/project*.js`, `js/lib/project-data.js`, `data/projects.json`.

The homepage loads both, because its *Research Projects* and *Selected
Projects* sections are rendered by the Projects system. Do not restyle those
two sections from `site.css`, and do not add global element selectors to
`site.css`: every rule there is scoped to `.ds`, `.ds-root` or a class name
that does not exist in the legacy sheets.

## Architecture

| Layer | Technology | Location |
|-------|------------|----------|
| Pages | HTML5 | `index.html`, `publications.html`, `<paper-id>/index.html`, `contact.html`, `blog*.html`, `404.html`, `projects/` |
| Design system | CSS custom properties, light + dark | `css/site.css` |
| Projects styles | Legacy stylesheets | `css/style.css`, `css/refresh.css`, `css/project*.css`, `css/polish.css` |
| Behaviour | Classic vanilla JS | `js/theme-init.js`, `js/site.js` (Projects: `js/main.js`) |
| Interactive widgets | Custom elements, ES modules | `js/components/`, `js/lib/` |
| Content data | JSON | `data/publications.json`, `data/news.json`, `data/site.json`, `data/projects.json` |
| Generator | Python 3, no dependencies | `scripts/build_site.py` |
| Backend (forms) | Formspree | Contact + newsletter forms |
| Hosting | GitHub Pages | `CNAME`, `DEPLOYMENT.md` |

```
├── index.html                  # Homepage; generated regions marked <!-- build:NAME -->
├── publications.html           # GENERATED library
├── <paper-id>/index.html       # GENERATED paper pages
├── contact.html / blog.html / blog-post.html / 404.html
├── css/site.css                # Design system (tokens, components, both themes)
├── js/site.js                  # Shared behaviour for pages on site.css
├── js/components/              # <pub-library>, <cite-dialog>, index.js entry
├── js/lib/                     # citations.js, search.js, dom.js, pub-data.js
├── data/                       # publications.json, news.json, site.json, projects.json
├── assets/figures/             # SVG figures inlined into paper pages
├── assets/og/                  # Social preview cards (scripts/make_social_cards.js)
├── fonts/                      # Self-hosted woff2
├── scripts/build_site.py       # Generator; --check for CI
├── tests/                      # validate_publications.py, validate_content.py, smoke.js
├── projects/                   # Projects pages (separate system)
└── sitemap.xml                 # Generated for in-scope URLs; Projects entries carried over
```

## Data-Backed Pages

Three areas render from JSON rather than hand-written markup. For these, **content
changes are data edits and must never require touching rendering code**:

| Data file | Rendered by | Covers |
|-----------|-------------|--------|
| `data/publications.json`, `data/news.json`, `data/site.json`, `data/profile.json` | `scripts/build_site.py` (build time) | Publication library, paper pages, `cv.html`, homepage selected publications / research threads / toolkit / news / experience / education / teaching / awards / headline counts, header, footer, contact block, `assets/publications.bib`, `sitemap.xml`, the publication list in `llms.txt` |
| `data/projects.json` | `js/projects-index.js`, `js/project-detail.js` | The projects index and detail routes |
| GitHub CLI catalog (standalone) | [`Ayanzadeh93/claude-code-encyclopedia`](https://github.com/Ayanzadeh93/claude-code-encyclopedia) | GitHub CLI entries live with the encyclopedia app. `apps/claude-code-*.html` in this repo are redirects. |

`.github/workflows/content-validation.yml` runs three checks on every push and
pull request. **Run them before committing a data change** — it is faster than
a CI round trip:

```bash
python scripts/build_site.py              # regenerate after editing data/
python scripts/build_site.py --check      # CI: fails if generated files are stale
python tests/validate_publications.py     # publication schema + every internal link
python tests/validate_content.py          # Projects data + route contracts
```

**Never hand-edit generated output**: `publications.html`, `cv.html`, any
`<paper-id>/index.html`, or the inside of a `<!-- build:NAME -->` region. The
next build overwrites it and the `--check` step fails.

When you add a validation rule, check it actually fails on bad input. A rule
that cannot fail is worse than no rule, because it reads like coverage.

## Core Principles

1. **Match existing patterns** — Copy structure from the nearest sibling page before inventing new markup or JS.
2. **Minimal diff** — This is a content site; avoid refactors unrelated to the task.
3. **No build tooling beyond `scripts/build_site.py`** — Do not add npm, webpack, or a framework unless explicitly requested. Native modules and custom elements are fine; anything needing a compile step at deploy time is not. jQuery and similar compatibility shims are a step backwards here — the platform APIs they wrapped are now the shorter path.
4. **Progressive enhancement** — Content ships in the HTML. JavaScript may reorganise or enrich it, never be the only way to read it. Never ship a control that does nothing without JS.
5. **Security first** — Preserve CSP meta tags; pages on `site.css` run under `script-src 'self'`, so no inline scripts or `on*=` handlers. Build DOM nodes instead of HTML strings.
7. **Nothing invented** — No placeholder links, "coming soon" buttons, fabricated metrics, or unverified identifiers. A resource that does not exist is simply not rendered.
6. **Accessibility** — Semantic HTML, ARIA labels, keyboard support, screen-reader announcements, and DOM order that matches visual order.

## Frontend Conventions

### HTML head (every page on `site.css`)

Generated pages get their head from `page_shell()` in `scripts/build_site.py`.
For a hand-written page, copy `contact.html`:

- `<html lang="en" class="ds-root" data-theme="light">` and `<body class="ds">`
- CSP meta (copy verbatim — update only if adding a new external origin)
- Title, description, canonical URL, Open Graph + Twitter tags
- `<!-- build:assets -->` region: font preloads, `/css/site.css`, `/js/theme-init.js`
- `<!-- build:header -->` and `<!-- build:footer -->` regions, then register the page in `build()` in `scripts/build_site.py`
- Root-relative paths (`/css/site.css`) everywhere, so pages work at any depth

### CSS

- **Design tokens** live in `:root` in `css/site.css` (`--c-*` colour, `--f-*` fonts, `--t-*` type scale, `--s-*` space). Change colours there, not inline.
- **Dark theme**: `data-theme="dark"` on `<html>`, set before paint by `js/theme-init.js`; the toggle is `[data-theme-toggle]` in `site.js`. The storage key `theme` is shared with the Projects pages.
- **Scope**: every selector starts from `.ds`, `.ds-root` or a class defined in `site.css`. Before adding a class, check it is not already used in `css/style.css` — `btn`, `tag` and `award` are taken there, which is why this file uses `button`, `pill` and `honor`.
- Use the existing components (`.wrap`, `.sec`, `.button`, `.chip`, `.pill`, `.pub`, `.panel`, `.cv`, `.rows`, `.kv`) before writing new ones.
- `site.css` zeroes margins inside `.ds-root`, matching the legacy reset, so components set their own spacing. A modal `<dialog>` needs `margin: auto` restored (already done for `.ds dialog`).
- Text must stay at 4.5:1 and control boundaries at 3:1 in both themes (`--c-control` exists for inputs and chips).

### JavaScript

- `js/site.js` is one deferred classic script: each feature is an `init*` function that looks for a `data-*` hook and returns when the hook is absent.
- JS-only controls ship with the `hidden` attribute and are revealed by the code that wires them.
- Feature detection before observers: check `'IntersectionObserver' in window`.
- Passive scroll listeners: `{ passive: true }`.
- A self-contained interactive widget → a custom element in `js/components/`, registered from `index.js`.
- Prefer one live region per message. An element with `role="status" aria-live="polite"` announces on its own — adding a second region makes screen readers say everything twice.
- Projects-only behaviour stays in `js/main.js`; do not add to it for pages on `site.css`.

## Backend / Integrations

This site has **no server-side code**. "Backend" means external services:

### Contact form (Formspree)

- Form action: `https://formspree.io/f/<form-id>`
- Submission via `fetch()` in `submitForm()` — do not switch to plain POST navigation.
- Hidden `_replyto` field synced from email input before submit.
- CSP must allow `connect-src` and `form-action` for `https://formspree.io`.
- On failure, fall back message references direct email.

### Adding a new external service

1. Add the origin to the CSP meta tag on **every HTML page** (there are 10+).
2. Update `DEPLOYMENT.md` if deployment steps change.
3. Prefer client-side-only integrations; avoid secrets in frontend code.

## Common Workflows

Copy checklists from [reference.md](reference.md) when executing these tasks.

### Add a project page

1. Copy `projects/medical-segmentation.html` as template.
2. Update hero, badges, meta, canonical, and content sections.
3. Link from `index.html` projects section.
4. Add URL to `sitemap.xml` with current `<lastmod>`.

### Add or edit blog content

1. `blog.html` is the listing (`.posts`); `blog-post.html` is the one published post (`.article`).
2. A list entry links to a post only when that post exists; otherwise it is marked "Summary only".
3. New post page: copy `blog-post.html`, register it in `build()` in `scripts/build_site.py`, and add it to `sitemap` in `data/site.json`.

### Change global navigation or theme

1. Navigation and profile links live in `data/site.json`; the header and footer are generated into every page on `site.css`. Rebuild after editing. Keep the Projects entry.
2. Projects pages carry their own navigation markup and are edited separately.
3. Theme logic is `initTheme()` in `site.js`; it swaps inside a View Transition when the browser supports one.
4. Test light + dark mode and the mobile menu (`node tests/smoke.js` covers both).

### Add or edit a publication

1. Edit the entry in `data/publications.json` (field list in [reference.md](reference.md)).
2. `python scripts/build_site.py` — regenerates the paper page, the library, the homepage regions, `assets/publications.bib` and `sitemap.xml`.
3. `python tests/validate_publications.py`.
4. Verify DOIs before adding them (`https://doi.org/<doi>` or the Crossref API). A wrong identifier in a citation is worse than a missing one.
5. Optional: `node scripts/make_social_cards.js` for the paper's social card, then build again.

### Add a CLI catalog entry

GitHub CLI records live in the standalone encyclopedia repo, not this one.

1. Add the record to [`Ayanzadeh93/claude-code-encyclopedia`](https://github.com/Ayanzadeh93/claude-code-encyclopedia) `data/catalog.json`.
2. Required fields: `id`, `section`, `name`, `type`, `description`, `aliases`,
   `examples`, `introducedVersion`, `tags`, `note`. Ids are `<section>-<slug>`.
3. Run `python3 tests/validate_catalog.py` in that repo.

### Add a custom element

1. Module in `js/components/`, pure helpers in `js/lib/`, styles in `css/site.css`.
2. Register it from `js/components/index.js`; the page loads that one entry as `<script type="module">`.
3. Enhance markup that already exists in the light DOM. Do not render content the HTML does not already carry.

### Optimize images

- Profile/hero: compress before commit (target < 300 KB for photos).
- Use descriptive filenames; prefer `.jpg` for photos, `.svg` for icons.
- Add `loading="lazy"` and explicit `width`/`height` where possible.

## SEO & Deployment

- `sitemap.xml` is generated: in-scope entries come from `data/site.json` and `data/publications.json` with `updated` as `<lastmod>`; Projects entries are carried over as written and are still edited by hand.
- Paper pages carry Highwire `citation_*` tags (Google Scholar), `ScholarlyArticle`/`Chapter` JSON-LD and a per-paper `og:image` — all generated.
- Canonical URLs use `https://www.ayanzadeh.com/` (or production domain if CNAME active).
- Deploy: push to `main` → GitHub Pages auto-deploys. See `DEPLOYMENT.md` for Netlify/custom domain.
- Verify contact form in Formspree dashboard after deploy.

## Pre-merge Checklist

```
- [ ] CSP present and correct on all touched HTML files
- [ ] `python scripts/build_site.py --check` and `python tests/validate_publications.py` pass
- [ ] Projects pages and the homepage Projects sections untouched (`git diff --stat main -- projects css/style.css css/refresh.css css/project.css css/projects-data.css js/main.js`)
- [ ] Page still readable and complete with JavaScript disabled
- [ ] Relative asset paths correct for page depth (root vs projects/)
- [ ] Dark theme still readable on changed sections
- [ ] Mobile nav and smooth scroll unaffected
- [ ] sitemap.xml updated if URLs added/changed
- [ ] No secrets or API keys in committed files
- [ ] Images compressed; no multi-MB assets
- [ ] Custom elements: keyboard path works (Tab, Escape, arrow keys where used)
- [ ] Any DOI or external identifier resolves before it ships
```

## When User Requests a Real Backend

Only add server code if explicitly asked. Recommend in order:

1. **Formspree / static forms** — already in use; extend for new forms.
2. **Serverless functions** — Netlify/Vercel edge functions for lightweight APIs.
3. **Full backend** — separate repo/service; keep this repo static and call APIs via `fetch` with CSP updates.

Do not introduce a backend framework into this repo without explicit approval.

## Additional Resources

- Page templates and field-by-field checklists: [reference.md](reference.md)
- Deployment and DNS: [DEPLOYMENT.md](../../DEPLOYMENT.md)
