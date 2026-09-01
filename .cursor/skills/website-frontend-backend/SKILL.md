---
name: website-frontend-backend
description: Builds and maintains the ayanzadeh.com static portfolio site — HTML/CSS/vanilla JS frontend, Formspree forms, SEO, accessibility, and GitHub Pages/Netlify deployment. Use when editing pages, styles, scripts, contact forms, project/blog pages, or deployment for this website.
---

# Website Frontend & Backend

Static academic portfolio. No build step, no framework, no bundler.

## Architecture

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | HTML5, CSS3, vanilla JS | `index.html`, `css/`, `js/` |
| Backend (forms) | Formspree | Contact + newsletter forms |
| Hosting | GitHub Pages / Netlify | `CNAME`, `DEPLOYMENT.md` |
| Assets | Optimized images, SVG favicon | `images/` |

```
├── index.html              # Main portfolio
├── blog.html / blog-post.html
├── css/style.css           # Global styles + theme tokens
├── css/project.css         # Project detail pages
├── css/blog.css            # Blog pages
├── js/main.js              # Site-wide interactivity
├── js/blog.js              # Blog-only features
├── projects/*.html         # One page per project
├── sitemap.xml / robots.txt
└── manifest.json           # PWA manifest
```

## Core Principles

1. **Match existing patterns** — Copy structure from the nearest sibling page before inventing new markup or JS.
2. **Minimal diff** — This is a content site; avoid refactors unrelated to the task.
3. **No build tooling** — Do not add npm, webpack, or a framework unless explicitly requested.
4. **Security first** — Preserve CSP meta tags; escape user-generated HTML with `escapeHtml()` before DOM insertion.
5. **Accessibility** — Use semantic HTML, ARIA labels, keyboard support, and screen-reader announcements.

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
- Use existing utility classes (`.container`, `.section`, `.badge`, card patterns) before writing new ones.

### JavaScript

- Init pattern: `document.addEventListener('DOMContentLoaded', …)` calling `init*` functions.
- Feature detection before observers: check `'IntersectionObserver' in window`.
- Passive scroll listeners: `{ passive: true }`.
- Export shared helpers on `window` only when multiple scripts need them (e.g. `escapeHtml`).
- New site-wide behavior → `main.js`. Blog-only → `blog.js`.

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
2. Theme logic stays in `initThemeToggle()` in `main.js`.
3. Test light + dark mode and mobile menu.

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
- [ ] Relative asset paths correct for page depth (root vs projects/)
- [ ] Dark theme still readable on changed sections
- [ ] Mobile nav and smooth scroll unaffected
- [ ] sitemap.xml updated if URLs added/changed
- [ ] No secrets or API keys in committed files
- [ ] Images compressed; no multi-MB assets
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
