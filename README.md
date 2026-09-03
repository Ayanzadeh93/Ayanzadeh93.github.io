# Aydin Ayanzadeh - Personal Website

This is the personal website of Aydin Ayanzadeh, Ph.D. Student in Computer Science at the University of Maryland, Baltimore County.

## Features

- **Professional Design**: Clean, modern, and academic-focused layout
- **Responsive**: Fully responsive design that works on all devices
- **Smooth Navigation**: Sticky navigation bar with smooth scrolling
- **Interactive Elements**: Hover effects, animations on scroll, and mobile-friendly menu
- **Publications explorer**: Search, filter and cite every paper without leaving the page
- **Comprehensive Sections**: 
  - About Me
  - Education Timeline
  - Research & Teaching Experience
  - Publications
  - Technical Skills
  - Awards & Honors
  - Contact Information

## Technologies Used

- HTML5
- CSS3 (design tokens, container queries, `:has()`, `color-mix()`, `@property`)
- Vanilla JavaScript, plus native Web Components written as ES modules
- Font Awesome Icons
- Google Fonts (Inter)

No bundler, no framework, no install step: the browser loads the source files as
written.

## Structure

```
├── index.html          # Main HTML file
├── css/
│   ├── style.css       # Global styles and design tokens
│   ├── components.css  # Styles for the Web Components
│   ├── project.css     # Project detail pages
│   └── blog.css        # Blog pages
├── js/
│   ├── main.js         # Site-wide interactivity
│   ├── blog.js         # Blog-only behaviour
│   ├── lib/            # Framework-free helpers (citations, search, DOM)
│   └── components/     # Custom elements (<pub-explorer>, <cite-dialog>)
├── projects/           # One page per project
└── images/             # Image assets
```

## Publications explorer

The publications section is a custom element, `<pub-explorer>`, that enhances
the markup already in the page instead of rendering the list itself. Each entry
stays in the HTML with `data-*` metadata and schema.org microdata, so the full
list is crawlable, findable with Ctrl+F, and readable with JavaScript disabled.

On top of that list the component adds:

- Ranked search across titles, co-authors and venues, diacritic-insensitive so
  "toreyin" finds "Töreyin". Press `/` anywhere to jump to it.
- Filters by publication type, research area and year, plus four sort orders.
- A metrics strip and a clickable publications-per-year chart.
- Per-paper citation export in BibTeX, RIS, APA 7, IEEE and MLA 9, and a
  one-click export of the whole filtered list, via `<cite-dialog>`.
- Shareable state: the active filters are reflected in the URL query string.

### Adding a publication

Copy an existing `<article class="publication-item" data-pub …>` block in
`index.html` and update it. The component reads these attributes:

| Attribute | Purpose |
|-----------|---------|
| `data-key` | BibTeX citation key |
| `data-year` | Publication year (drives sorting and the chart) |
| `data-type` | `journal`, `conference`, `chapter` or `preprint` |
| `data-topics` | Space-separated research-area slugs |
| `data-journal` / `data-booktitle` | Container name for citation export |
| `data-volume`, `data-number`, `data-pages`, `data-publisher` | Optional citation fields |
| `data-doi`, `data-arxiv`, `data-primary-class`, `data-url` | Identifiers and links |

Titles, authors and the rendered venue are read from the marked-up elements
(`data-pub-title`, `data-pub-authors`, `data-pub-venue`), so there is no second
copy of that text to keep in sync. Research-area slugs are defined in
`RESEARCH_AREAS` in `js/components/pub-explorer.js`.

## Setup

1. Clone the repository
2. **Add your profile photo**: Save your professional photo as `images/profile-compressed.jpg` (the image should be square and high quality for best results)
3. Open `index.html` in a web browser
4. No build process required - it's a static website

## Customization

To customize the website:
- Edit `index.html` to update content
- Modify CSS variables in `style.css` to change colors and styling
- Update contact information and social links

## License

© 2024 Aydin Ayanzadeh. All rights reserved.