---
name: website-frontend-backend
description: Builds and maintains the ayanzadeh.com static portfolio site — HTML/CSS/vanilla JS frontend, Formspree forms, SEO, accessibility, and GitHub Pages/Netlify deployment. Use when editing pages, styles, scripts, contact forms, project/blog pages, or deployment for this website.
---

# Website Frontend & Backend

Static academic portfolio. No build step, no framework, no bundler — but modern
platform features (ES modules, Web Components, container queries, View
Transitions) are fair game, because the browser runs the source files as written.

## Architecture

| Layer | Technology | Location |
|-------|------------|----------|
| Pages | HTML5 | `index.html`, `blog*.html`, `projects/` |
| Styles | CSS3 with design tokens | `css/` |
| Site-wide behaviour | Classic vanilla JS | `js/main.js`, `js/blog.js` |
| Interactive widgets | Custom elements, ES modules | `js/components/`, `js/lib/` |
| Backend (forms) | Formspree | Contact + newsletter forms |
| Hosting | GitHub Pages / Netlify | `CNAME`, `DEPLOYMENT.md` |
| Assets | Optimized images, SVG favicon | `images/` |

```
├── index.html              # Main portfolio
├── blog.html / blog-post.html
├── css/style.css           # Global styles + theme tokens
├── css/components.css      # Custom-element styles (unlayered on purpose)
├── css/project.css         # Project detail pages
├── css/blog.css            # Blog pages
├── js/main.js              # Site-wide interactivity (classic script)
├── js/blog.js              # Blog-only features (classic script)
├── js/lib/                 # Pure helpers: dom.js, citations.js, search.js
├── js/components/          # <pub-explorer>, <cite-dialog>, index.js entry
├── projects/*.html         # One page per project
├── sitemap.xml / robots.txt
└── manifest.json           # PWA manifest
```

## Core Principles

1. **Match existing patterns** — Copy structure from the nearest sibling page before inventing new markup or JS.
2. **Minimal diff** — This is a content site; avoid refactors unrelated to the task.
3. **No build tooling** — Do not add npm, webpack, or a framework unless explicitly requested. Native modules and custom elements are fine; anything needing a compile step is not. jQuery and similar compatibility shims are a step backwards here — the platform APIs they wrapped are now the shorter path.
4. **Progressive enhancement** — Content ships in the HTML. JavaScript may reorganise or enrich it, never be the only way to read it. Never ship a control that does nothing without JS.
5. **Security first** — Preserve CSP meta tags; build DOM nodes instead of HTML strings, or escape with `escapeHtml()` before insertion.
6. **Accessibility** — Semantic HTML, ARIA labels, keyboard support, screen-reader announcements, and DOM order that matches visual order.

## Frontend Conventions

### HTML head (every page)

Include on all new pages:

- `<meta charset>`, viewport, referrer policy
- **CSP** (copy verbatim from an existing page — update only if adding a new external origin)
- Title, description, canonical URL
- Open Graph + Twitter meta tags
- Favicon: `favicon.svg`
- Fonts: Inter via Google Fonts; Font Awesome 6 with SRI + `media="print" onload` pattern

Root pages use relative paths (`css/style.css`). Subpages under `projects/` use `../css/style.css`.

### CSS

- **Design tokens** live in `:root` in `css/style.css` — change colors/spacing there, not inline.
- **Dark theme**: `data-theme="dark"` on `<html>`; toggle handled in `main.js`.
- **Page-specific styles**: add to `project.css` or `blog.css`, not `style.css`, unless the change is global.
- **Component styles**: `components.css`, deliberately unlayered so it shares the cascade origin with `style.css`.
- Use existing utility classes (`.container`, `.section`, `.badge`, card patterns) before writing new ones.
- `style.css` has a universal reset that zeroes every margin. It also hits UA defaults you may be relying on — a modal `<dialog>` needs `margin: auto` restored explicitly, or it pins to the top-left.

### JavaScript

- Init pattern: `document.addEventListener('DOMContentLoaded', …)` calling `init*` functions.
- Feature detection before observers: check `'IntersectionObserver' in window`.
- Passive scroll listeners: `{ passive: true }`.
- Export shared helpers on `window` only when multiple scripts need them (e.g. `escapeHtml`).
- New site-wide behavior → `main.js`. Blog-only → `blog.js`. A self-contained interactive widget → a custom element in `js/components/`.
- Prefer one live region per message. An element with `role="status" aria-live="polite"` announces on its own — adding a second region makes screen readers say everything twice.
- A View Transition defers its callback by a frame or two. Every reader-visible change belonging to one update must happen **inside** the callback, or the count text will announce a state the DOM has not reached yet.

```javascript
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
```

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

1. Use `blog.html` for listing; `blog-post.html` for individual posts.
2. Styles in `css/blog.css`; logic in `js/blog.js`.
3. Update sitemap if URL changes.

### Change global navigation or theme

1. Edit shared nav markup in each affected HTML file (no templating engine).
2. Theme logic stays in `initThemeToggle()` in `main.js`; it swaps inside a View Transition when the browser supports one.
3. Keep `color-scheme` in step with `data-theme` in `style.css`, or native controls (`<select>` popups, search clear buttons, scrollbars) stay light on a dark page.
4. Test light + dark mode and mobile menu.

### Add or edit a publication

1. Add the card to the `.publications-list` inside `<pub-explorer>` in `index.html`.
2. Give it the structured `data-*` attributes — see the checklist in [reference.md](reference.md). `<pub-explorer>` reads them; nothing is duplicated into JavaScript.
3. Ship the Cite control as `<button type="button" class="pub-link" data-cite hidden>`. The component unhides it, so no-JS readers never see a dead button.
4. Verify DOIs before adding them (`https://doi.org/<doi>` or the Crossref API). A wrong identifier in a citation is worse than a missing one.

### Add a custom element

1. Module in `js/components/`, pure helpers in `js/lib/`, styles in `css/components.css`.
2. Register it from `js/components/index.js`; the page loads that one entry as `<script type="module">`.
3. Enhance markup that already exists in the light DOM. Do not render content the HTML does not already carry.

### Optimize images

- Profile/hero: compress before commit (target < 300 KB for photos).
- Use descriptive filenames; prefer `.jpg` for photos, `.svg` for icons.
- Add `loading="lazy"` and explicit `width`/`height` where possible.

## SEO & Deployment

- Update `sitemap.xml` `<lastmod>` when adding/removing pages.
- Canonical URLs use `https://ayanzadeh93.github.io/` (or production domain if CNAME active).
- Deploy: push to `main` → GitHub Pages auto-deploys. See `DEPLOYMENT.md` for Netlify/custom domain.
- Verify contact form in Formspree dashboard after deploy.

## Pre-merge Checklist

```
- [ ] CSP present and correct on all touched HTML files
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
