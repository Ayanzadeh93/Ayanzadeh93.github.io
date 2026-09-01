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
- [ ] Canonical: https://ayanzadeh93.github.io/projects/<slug>.html
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
    <loc>https://ayanzadeh93.github.io/projects/new-project.html</loc>
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
