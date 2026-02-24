# AGENTS.md

## Cursor Cloud specific instructions

This is a **zero-dependency static website** (HTML, CSS, vanilla JS). No package manager, build system, or backend.

### Running the dev server

```bash
python3 -m http.server 8000 --directory /workspace
```

Then open `http://localhost:8000/` in Chrome.

### Lint / validation

There is no formal linter configured. For basic checks:

- **JS syntax**: `node -e "new Function(require('fs').readFileSync('js/main.js','utf8'))"` (repeat for `js/blog.js`)
- **HTML structure**: verify each `.html` file has `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` tags
- **CSS balance**: verify brace counts match in `css/*.css` files

### Key structure

| Path | Purpose |
|---|---|
| `index.html` | Main portfolio (single-page with anchor sections) |
| `blog.html`, `blog-post.html` | Blog listing and post template |
| `projects/*.html` | Individual research project detail pages |
| `css/style.css` | Main stylesheet (~110 KB) |
| `css/blog.css`, `css/project.css` | Blog and project page styles |
| `js/main.js` | Homepage interactivity (nav, scroll, animations) |
| `js/blog.js` | Blog page interactivity |

### Notes

- External CDN dependencies (Google Fonts, Font Awesome) require internet access; the site degrades gracefully without them.
- The contact form submits to Formspree (external SaaS); form submission testing requires a Formspree account.
- No automated test suite exists. Manual browser testing is the primary validation method.
