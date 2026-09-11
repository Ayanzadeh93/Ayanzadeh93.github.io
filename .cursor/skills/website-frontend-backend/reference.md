# Reference — Page Templates & Checklists

## CSP Meta Tag (copy as-is unless adding origins)

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://formspree.io; form-action 'self' https://formspree.io; frame-src 'none'; manifest-src 'self'">
```

## Project Page Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- CSP, meta, canonical, styles: ../css/style.css + ../css/project.css -->
</head>
<body class="project-page">
    <nav class="project-nav">
        <div class="container">
            <a href="../index.html" class="back-link">
                <i class="fas fa-arrow-left"></i>
                <span>Back to Portfolio</span>
            </a>
            <div class="nav-links">
                <a href="../index.html#projects">All Projects</a>
                <a href="../index.html#contact">Contact</a>
            </div>
        </div>
    </nav>
    <main class="project-main">
        <section class="project-hero">...</section>
        <!-- Additional sections: overview, methods, results, links -->
    </main>
    <script src="../js/main.js"></script>
</body>
</html>
```

## New Project Page Checklist

```
- [ ] File: projects/<slug>.html
- [ ] Title: "<Project Name> | Aydin Ayanzadeh"
- [ ] Meta description (1–2 sentences)
- [ ] Canonical: https://www.ayanzadeh.com/projects/<slug>.html
- [ ] Hero: badges, h1, tagline, meta items (author, institution, dates)
- [ ] Action links (paper, code, demo) with rel="noopener noreferrer" on external targets
- [ ] Card on index.html#projects with matching link
- [ ] sitemap.xml entry with lastmod
```

## Blog Post Checklist

```
- [ ] Listing entry in blog.html (title, excerpt, date, tags, reading time placeholder)
- [ ] Full content in blog-post.html or dedicated post file
- [ ] css/blog.css classes used (.blog-post, .featured-post, .post-meta)
- [ ] blog.js handles search/filter if tagged
- [ ] OG/Twitter image set
- [ ] sitemap updated
```

## Contact Form Fields

Required pattern in `index.html`:

```html
<form action="https://formspree.io/f/xzdkodzv" method="POST" id="contactForm">
    <input type="hidden" name="_replyto" value="">
    <!-- name, email, subject, message fields -->
    <button type="submit">Send Message</button>
</form>
```

Validation and AJAX submit are handled by `initFormValidation()` → `submitForm()` in `main.js`. Do not remove the `id="contactForm"` hook.

## CSS Token Quick Reference

| Token | Purpose |
|-------|---------|
| `--primary-color` | Links, accents, buttons |
| `--text-dark/medium/light` | Body text hierarchy |
| `--background-white/light/alt` | Section backgrounds |
| `--shadow-sm/md/lg` | Card elevation |
| `--transition` | Default animation (0.3s) |
| `--max-width` | Content container (1200px) |
| `--nav-height` | Fixed nav offset (70px) |

Dark overrides: `:root[data-theme="dark"]` and `[data-theme="dark"] .component` blocks in `style.css`.

## Sitemap Entry Template

```xml
<url>
    <loc>https://www.ayanzadeh.com/projects/new-project.html</loc>
    <lastmod>YYYY-MM-DD</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
</url>
```

## Deployment Quick Reference

| Host | Trigger | Custom domain |
|------|---------|---------------|
| GitHub Pages | Push to `main` | `CNAME` file + DNS A/CNAME records |
| Netlify | Connect repo | Domain settings + Squarespace DNS |

Post-deploy: test HTTPS, contact form, and image paths on production URL.

## Publication Card Template

Cards live inside `<pub-explorer>` in `index.html`. The visible text stays
human-readable; the `data-*` attributes carry the structured form that
`<pub-explorer>` reads for search, faceting and citation export. There is no
JavaScript copy of this data — the markup is the only source.

```html
<div class="publication-item"
     data-type="article"            <!-- article | inproceedings | incollection | preprint -->
     data-year="2023"
     data-venue="Expert Systems with Applications"   <!-- clean container title, no vol/pages -->
     data-volume="213"
     data-number=""                 <!-- issue, omit when absent -->
     data-pages="119040"            <!-- a range (33-57) or a bare article number -->
     data-publisher="Academic Press"
     data-doi="10.1016/j.eswa.2022.119040"
     data-arxiv="2512.12177"
     data-status="Accepted">        <!-- only for in-press work -->
    <div class="publication-badge">Featured</div>
    <h4>Paper title, plain text only — the search highlighter rebuilds this node</h4>
    <p class="authors">First Author, <strong>Aydin Ayanzadeh</strong>, and Last Author</p>
    <p class="publication-venue">Expert Systems with Applications, vol. 213, 119040, 2023</p>
    <div class="publication-links">
        <a href="https://doi.org/…" target="_blank" rel="noopener noreferrer" class="pub-link">
            <i class="fas fa-external-link-alt"></i> View Paper</a>
        <button type="button" class="pub-link" data-cite hidden>
            <i class="fas fa-quote-left" aria-hidden="true"></i> Cite</button>
    </div>
</div>
```

Field notes:

| Attribute | Notes |
|-----------|-------|
| `data-type` | Drives the facet chips and the BibTeX entry type. |
| `data-venue` | Container title only. The rendered `.publication-venue` line stays as prose. |
| `data-pages` | A value with a dash is a page range; a bare number is treated as an article number (`Art. no.` / `Article`). |
| `data-doi` / `data-arxiv` | Used for the canonical link, in that order, then the first `.pub-link[href^="http"]`. |
| `data-status` | Becomes a BibTeX `note` and an "(Accepted)" suffix in the prose styles. |

Title and author names are parsed from the DOM, so `<h4>` must stay plain text —
the search highlighter replaces its children with text nodes and `<mark>`.

## Component Map

| Element | File | What it does |
|---------|------|--------------|
| `<pub-explorer>` | `js/components/pub-explorer.js` | Wraps `.publications-list`; adds ranked search, type facets, sort, and `/` focus shortcut. |
| `<cite-dialog>` | `js/components/cite-dialog.js` | One per page; native `<dialog>` exporting BibTeX / APA 7 / MLA 9 / IEEE plus a `.bib` download. |

Supporting modules, all pure and side-effect free:

| Module | Exports |
|--------|---------|
| `js/lib/dom.js` | `el`, `appendChildren`, `clear`, `escapeHtml`, `debounce`, `prefersReducedMotion`, `withViewTransition`, `copyText` |
| `js/lib/citations.js` | `parseAuthors`, `splitName`, `bibKey`, `canonicalUrl`, `formatBibTeX/APA/MLA/IEEE`, `formatCitation`, `CITATION_FORMATS` |
| `js/lib/search.js` | `normalize`, `tokenize`, `scoreRecord`, `filterRecords`, `matchRanges`, `buildHaystack` |

Search semantics: tokens are AND-ed (every token must match somewhere), matching
is diacritic-folded (`Toreyin` finds `Töreyin`), and field weights are
title 10 / authors 6 / venue 4 / tags 3 / year 2.

## Adding a Custom Element

1. Write the module in `js/components/`, keeping any reusable logic in `js/lib/`.
2. Guard registration: `if (!customElements.get('x-y')) customElements.define(…)`.
3. Import it from `js/components/index.js` — pages load only that entry.
4. Style it in `css/components.css` using the tokens from `style.css`.
5. Enhance markup that is already in the page. If the element renders content
   that is not in the HTML, the no-JS and crawler view loses it.
6. Ship JS-only controls as `hidden` in the markup and unhide them on upgrade.

## CLI Catalog Entry Template

Records live in `data/claude-code/catalog.json`. The encyclopedia at
`apps/claude-code-encyclopedia.html` ingests the **GitHub** family from that
file and renders it with the same UI as Claude Code and Codex. Adding a `gh`
command is a data edit; the renderer never needs to change. Older
`apps/claude-code-catalog.html` URLs redirect into the encyclopedia.

```json
{
  "id": "ghpr-gh-pr-merge",
  "section": "ghpr",
  "name": "gh pr merge",
  "type": "Pull request",
  "description": "One sentence, present tense, saying what the command does.",
  "aliases": [],
  "examples": [
    { "command": "gh pr merge 42 --squash --delete-branch", "label": "squash" }
  ],
  "introducedVersion": null,
  "tags": ["pull request", "merge", "squash"],
  "note": "The caveat a reader would otherwise learn the hard way, or null."
}
```

| Field | Rule |
|-------|------|
| `id` | `<section>-<slugified name>`, unique across the file. Also the deep-link anchor, so keep it stable. |
| `section` | Must exist in `sections`; that section's `family` must exist in `families`. |
| `name` | Rendered in monospace as the card heading. Unique within its section. |
| `description` | One sentence. The card summary, and a mid-weight search field. |
| `examples` | Each needs `command` and `label`. The label captions the code block — name the surface (`shell`, `json`, `settings.json`, `enterprise`). |
| `tags` | At least one. Searchable, and the first six render as chips. |
| `note` | Use it for the caveat, not for restating the description. `null` when there isn't one. |

Search in the live encyclopedia is name-first and token AND-ed. The legacy
catalog renderer in `js/claude-code-catalog.js` (still imported so CI can check
shared modules) used weights name 12, aliases 8, description 5, tags 4,
examples 3, type 2. Tokens are AND-ed and diacritic-folded by `js/lib/search.js`.

Two rendering modes, chosen by whether a query is active:

- **No query** — entries are grouped under section headings in the catalog's
  authored order, so the page reads as a document.
- **With a query** — a flat list in relevance order. Grouping here would re-sort
  the results and bury the best match under whichever section sorts first.

### Adding a family

1. Append to `families` with `id`, `label`, `blurb` and `source`.
2. Add its sections to `sections`, each carrying that `family` id.
3. Add entries. The validator rejects an empty family or an empty section, so a
   new family must ship with content.
4. Run `python tests/validate_content.py`.
