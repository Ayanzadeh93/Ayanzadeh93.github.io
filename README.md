# Aydin Ayanzadeh - Personal Website

This is the personal website of Aydin Ayanzadeh, Ph.D. Student in Computer Science at the University of Maryland, Baltimore County.

## Features

- **Professional Design**: Clean, modern, and academic-focused layout
- **Responsive**: Fully responsive design that works on all devices
- **Smooth Navigation**: Sticky navigation bar with smooth scrolling
- **Interactive Elements**: Hover effects, animations on scroll, and mobile-friendly menu
- **Publication Explorer**: Ranked search across titles, authors and venues, filter chips by
  publication type, and re-sorting by year or relevance — with the full list still present in
  the HTML for readers and crawlers without JavaScript
- **Citation Export**: Every paper exports as BibTeX, APA 7, MLA 9 or IEEE, with a one-click
  copy and a `.bib` download
- **Dark Mode**: Manual toggle that remembers the choice, following the system preference until
  one is made
- **Comprehensive Sections**: 
  - About Me
  - Education Timeline
  - Research & Teaching Experience
  - Publications
  - Technical Skills
  - Awards & Honors
  - Contact Information

## Technologies Used

No framework, no bundler, no build step — the browser runs these files exactly as
they are committed. Modern platform APIs do the work a library would otherwise:

- HTML5
- CSS3 — custom properties for theming, container queries, `:has()`, `color-scheme`
- Vanilla JavaScript (ES2022) — classic scripts for site-wide behaviour
- Web Components — `<pub-explorer>` and `<cite-dialog>`, as native custom elements
- ES modules — loaded directly, no bundling
- Native `<dialog>` — modal focus trap, Escape handling and backdrop from the platform
- View Transitions API — cross-fades on theme switch and publication re-sort, feature-detected
- Font Awesome Icons
- Google Fonts (Inter)

## Structure

```
├── index.html              # Main portfolio
├── blog.html               # Blog listing
├── blog-post.html          # Blog article template
├── css/
│   ├── style.css           # Global styles + design tokens + dark theme
│   ├── components.css      # Custom-element styles
│   ├── project.css         # Project detail pages
│   └── blog.css            # Blog pages
├── js/
│   ├── main.js             # Site-wide interactivity
│   ├── blog.js             # Blog-only features
│   ├── lib/                # Pure helpers, no DOM side effects
│   │   ├── dom.js          #   node builder, debounce, view transitions, clipboard
│   │   ├── citations.js    #   BibTeX / APA / MLA / IEEE formatters
│   │   └── search.js       #   ranked, diacritic-folded matching
│   └── components/         # Custom elements
│       ├── index.js        #   module entry, registers the elements
│       ├── pub-explorer.js #   <pub-explorer>
│       └── cite-dialog.js  #   <cite-dialog>
├── projects/               # One page per project
├── images/                 # Image assets
├── sitemap.xml / robots.txt
└── manifest.json           # PWA manifest
```

## Architecture Notes

**Progressive enhancement.** Every publication ships in `index.html`. The
components reorganise and enrich that markup; they never supply it. With
JavaScript disabled the page still reads completely and indexes normally — the
search toolbar simply is not there, and the JS-only Cite buttons stay hidden.

**Publication metadata lives in the markup.** Each `.publication-item` carries
`data-type`, `data-year`, `data-venue`, `data-doi` and friends. `<pub-explorer>`
reads them at upgrade time, so there is no second copy of the bibliography to
keep in sync.

## Setup

1. Clone the repository
2. **Add your profile photo**: Save your professional photo as `images/profile-compressed.jpg` (the image should be square and high quality for best results)
3. Serve the folder over HTTP — for example `npx http-server . -p 8080` — and open
   `http://localhost:8080`. ES modules are blocked under `file://`, so opening
   `index.html` directly leaves the publication explorer unbuilt.
4. No build process required — it's a static website

## Customization

To customize the website:
- Edit `index.html` to update content
- Modify CSS variables in `style.css` to change colors and styling
- Update contact information and social links

### Adding a publication

Copy an existing `.publication-item` inside `<pub-explorer>` and fill in its
`data-*` attributes — type, year, venue, and any DOI or arXiv id. The explorer
picks it up automatically: the facet counts, the search index and all four
citation formats are derived from that markup. Verify a DOI at
`https://doi.org/<doi>` before adding it.

## License

© 2024 Aydin Ayanzadeh. All rights reserved.