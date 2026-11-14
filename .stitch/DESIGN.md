---
name: Aydin Ayanzadeh — Research Site
colors:
  background: '#ffffff'
  on-background: '#0f172a'
  surface: '#ffffff'
  surface-container-low: '#f5f7fa'
  surface-container: '#eef2f6'
  on-surface: '#0f172a'
  on-surface-variant: '#334155'
  muted: '#56657a'
  outline: '#c3cdd9'
  outline-variant: '#e0e6ed'
  control-outline: '#77869b'
  primary: '#1c4f6b'
  on-primary: '#ffffff'
  primary-strong: '#143c52'
  primary-container: '#e9f1f5'
  on-primary-container: '#143c52'
  accent: '#b4532a'
  accent-strong: '#96431f'
  accent-container: '#fbf0ea'
  focus: '#b4532a'
  highlight: '#fde9c8'
  error: '#b3261e'
  success-dot: '#1f9d6e'
  dark-background: '#0f1729'
  dark-surface: '#18223c'
  dark-surface-container-low: '#131d33'
  dark-on-surface: '#e9eef7'
  dark-on-surface-variant: '#c0cbdd'
  dark-muted: '#98a6bd'
  dark-outline-variant: '#26334f'
  dark-primary: '#86c5e2'
  dark-on-primary: '#0b1524'
  dark-accent: '#eb9a6f'
  dark-error: '#ffb4a9'
  thread-navigation: '#1f7fb0'
  thread-environment: '#d2622c'
  thread-biomedical: '#1f9d6e'
  thread-efficient: '#6f58c9'
  thread-foundations: '#b7791f'
typography:
  display-xl:
    fontFamily: Newsreader
    fontSize: clamp(2.5rem, 1.7rem + 3.6vw, 4.25rem)
    fontWeight: '600'
    lineHeight: '1.02'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Newsreader
    fontSize: clamp(1.75rem, 1.45rem + 1.3vw, 2.25rem)
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  title-md:
    fontFamily: Newsreader
    fontSize: 1.3rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.005em
  lead:
    fontFamily: Newsreader
    fontSize: clamp(1.3rem, 1.2rem + 0.45vw, 1.5rem)
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: '0'
  body-base:
    fontFamily: Atkinson Hyperlegible
    fontSize: 1.0625rem
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-strong:
    fontFamily: Atkinson Hyperlegible
    fontSize: 1.0625rem
    fontWeight: '700'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-caps:
    fontFamily: Atkinson Hyperlegible
    fontSize: 0.8125rem
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.1em
  mono:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
    fontSize: 0.85rem
    fontWeight: '400'
    lineHeight: '1.65'
    letterSpacing: '0'
rounded:
  sm: 6px
  DEFAULT: 10px
  lg: 16px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  section: clamp(3.5rem, 2.4rem + 4.5vw, 5rem)
  gutter: clamp(1.125rem, 4vw, 1.5rem)
  max-width: 1200px
  reading-width: 44rem
---

# Design System: Aydin Ayanzadeh — Research Site

Source of truth: `css/site.css` (tokens at the top of the file). This document
describes the intent behind those values; if the two ever disagree, the CSS wins
and this file should be updated. Written with the `extract-design-md` skill and
audited against the `taste-design` skill (see `.claude/skills/`).

## 1. Visual Theme & Atmosphere

A quiet, well-lit reading room for research. Pages open on near-white paper
with deep teal-navy ink and a single copper accent, the way a carefully set
journal page uses one colour for rules and folios. Display type is a warm
book serif with optical sizing; everything else is set in a typeface designed
for low-vision readers, which suits a body of work about accessible navigation.
Density is "balanced reading": generous section spacing, but lists of papers,
roles and courses are compact and ruled rather than spread across cards.

Motion is restrained and functional: content settles in once as it scrolls into
view, the research-thread chart pulses only on the current year's papers, and a
toolkit row drifts slowly (pausable). Everything holds still under reduced
motion. The dark theme is a deliberate second palette — deep navy surfaces,
lifted sky-blue links and a warmer copper — not an inversion; figures keep a
light plate so redrawn diagrams stay legible.

## 2. Color Palette & Roles

### Primary Foundation
- **Paper White** (#ffffff) — page and card background.
- **Mist** (#f5f7fa) — tinted section bands that separate homepage sections.
- **Fog** (#eef2f6) — hover wash on quiet controls, sunk surfaces.
- **Hairline** (#e0e6ed) — rules between list rows, card borders.
- **Rule** (#c3cdd9) — stronger dividers and quiet button outlines.

### Accent & Interactive
- **Deep Teal-Navy** (#1c4f6b) — links, primary buttons, selected chips, data
  marks. The one "brand" colour; hover deepens to **Harbour** (#143c52).
- **Copper** (#b4532a) — the single accent: section-title rules, eyebrows,
  the current-page underline in the header, focus rings, the portrait frame.
  Text-sized copper uses **Burnt Copper** (#96431f) for contrast.
- **Teal Tint** (#e9f1f5) / **Copper Tint** (#fbf0ea) — pill backgrounds for
  status ("Under review") and the availability line.
- **Control Slate** (#77869b) — 3:1 outline for inputs, search and chips.

### Typography & Text Hierarchy
- **Ink** (#0f172a) — titles and primary text.
- **Graphite** (#334155) — body copy, author lists, summaries.
- **Slate** (#56657a) — metadata, dates, captions (5.3:1 or better on every surface).

### Functional States
- **Error** (#b3261e; dark #ffb4a9) — form field errors, with text, never colour alone.
- **Highlight** (#fde9c8) — search-match marks in the publication library.
- **Live Green** (#1f9d6e) — the small pulsing dot on the availability line.
- **Research-thread hues** — Navigation #1f7fb0, Environment #d2622c,
  Biomedical #1f9d6e, Efficient learning #6f58c9, Foundations #b7791f.
  Categorical colours for the threads chart only, validated for colour-vision
  separation between adjacent lanes; each also has an icon and a label.

Dark theme equivalents: background #0f1729, cards #18223c, text #e9eef7 /
#c0cbdd / #98a6bd, links #86c5e2, accent #eb9a6f.

## 3. Typography Rules

### Hierarchy & Weights
- **Display — Newsreader** (variable, optical sizing, weights 400–700): the
  name on the homepage (up to 68px, weight 600, tight −0.03em tracking),
  section titles (28–36px), paper and project titles (20–48px). Hierarchy comes
  from size and weight together; nothing is set in all caps at display size.
- **Lead — Newsreader 400** for the research statement, abstracts and "In brief"
  lines: book-like, 1.45–1.7 leading.
- **Body — Atkinson Hyperlegible** 17px, weight 400 with 700 for emphasis,
  1.6 leading, reading measure capped near 44rem (≈70 characters).
- **Labels — Atkinson Hyperlegible 700**, 13px, uppercase, 0.1em tracking:
  eyebrows ("CURRENT", "IN BRIEF", "AT A GLANCE"), sub-section labels.
- **Mono — system monospace** for BibTeX, course codes and code samples.
- Numbers in columns use tabular figures; headline numbers use lining figures.

### Spacing Principles
4px base unit; component padding 16–24px; list rows 12–24px apart with a
hairline between; sections 56–80px apart depending on viewport.

## 4. Component Stylings

### Buttons
Pill-shaped (fully rounded), 44px tall. Primary: Deep Teal-Navy fill, white
text. Secondary: white with a Rule outline that turns teal on hover. A 1px
press-down on click; no glows, no gradients. Small buttons (36px) are used in
dense rows on pointer devices and grow to 44px on touch screens.

### Cards & Publication Entries
Cards are used sparingly, only where an item is a separate object: the research
threads chart, the contact form, teaching panels, figures and result tiles
(16px corners, hairline border, whisper shadow). Everything list-like —
publications, experience, education, honours, news, talks — is a ruled list
with the date in a left column. A publication entry is: serif title link,
authors (the site owner in bold), venue in italics with small type pills,
a one-line summary, then a row of outlined pill links (Paper page, PDF,
Publisher, arXiv, Code, Cite).

### Navigation
Sticky translucent header (64px) with a blurred backdrop; a hairline appears
once the page scrolls. Current section is marked with a copper underline. Below
1040px the links collapse into a disclosure menu; Escape closes it and returns
focus. The CV button and a sun/moon theme toggle stay visible at every width.

### Inputs & Forms
Labels above fields, 10px corners, 3:1 Control Slate outline, teal focus border
plus a copper focus ring. Errors appear below the field in text, and focus moves
to the first invalid field.

### Domain-Specific Components
- **Research threads chart**: one lane per research thread, one mark per paper
  placed by year; filled marks are peer-reviewed, open rings are preprints; a
  tinted bar shows each thread's active years; hover or focus shows a tooltip.
- **Timeline** (experience, education): a 2px spine with a node per role; the
  current role's node is copper and pulses gently.
- **Paper page**: breadcrumb, venue eyebrow, two-tone title (lead phrase in
  teal), author line, "In brief" line, action buttons; then figure, abstract,
  reported-result tiles, method steps, resources, BibTeX with copy/download,
  related papers and newer/older links, with an "At a glance" sidebar.
- **Portrait**: photo inside four copper corner brackets with a small
  monospace label, like a detection box — the one playful nod to the field.

## 5. Layout Principles

### Grid & Structure
Max content width 1200px with a 18–24px gutter; long-form text capped at
44rem. Homepage sections alternate white and Mist bands with centred serif
headings and a short copper rule. The introduction is a left-aligned split:
text column and portrait. Paper and CV pages use a main column with a sticky
sidebar.

### Whitespace Strategy
Air between sections, density within them. Lists are compact and ruled so a
committee member can scan 17 papers or six roles quickly.

### Alignment & Visual Balance
Left-aligned text everywhere except section headings. Dates sit in a fixed left
column so entries line up down the page.

### Responsive Behavior & Touch
All multi-column layouts collapse to one column on phones; no horizontal scroll
at 390px. Touch screens get 44px targets for every control. Reduced-motion
users see no animation, and the page is complete without JavaScript.

## 6. Design System Notes for Stitch Generation

### Language to Use
"A calm academic research site: near-white paper, deep teal-navy ink, one
copper accent. Serif headings in Newsreader, body in Atkinson Hyperlegible.
Ruled lists instead of card grids, dates in a left column, generous section
spacing, restrained motion."

### Color References
Deep Teal-Navy (#1c4f6b) for links and primary actions; Copper (#b4532a) only
for rules, labels and focus; Ink (#0f172a) text on Paper White (#ffffff); Mist
(#f5f7fa) for alternating section bands; Hairline (#e0e6ed) between rows.

### Component Prompts
- "A publication list entry: year in a grey serif numeral on the left; on the
  right a serif title link, an author line with one name in bold, an italic
  venue with small grey pills for type, a single-sentence summary, and a row of
  small outlined pill buttons for Paper page, PDF, arXiv, Code and Cite."
- "A research experience timeline: date range right-aligned in a narrow left
  column, a thin vertical spine with round nodes, organisation name as a serif
  heading, role and location in small grey text, and short bullet notes."
- "A dark-theme paper page header: deep navy background, a small uppercase
  copper venue label, a large serif title whose first phrase is light sky blue,
  authors in a row, and pill buttons for Paper (PDF), arXiv and Cite."

### Incremental Iteration
Keep one accent. Prefer a ruled list to a card grid. Never add metrics the
data does not contain. Check both themes and a 390px-wide phone after every
change.

## 7. Anti-Patterns (from the taste-design audit)

- No three-equal-cards rows for lists of achievements (honours are a dated list).
- No gradient or glowing text, no neon, no purple-blue AI gradients.
- No filler UI copy ("scroll to explore"), no bouncing chevrons.
- No emoji.
- No invented numbers: every result tile is copied from a paper's abstract and
  the validator rejects one that is not there.
- No generic placeholder people, logos or lorem ipsum.
- No pure black text or backgrounds (print styles excepted).
- Unlike the taste-design defaults, this site does not use perpetual
  micro-animation or asymmetric "creative" layouts: an academic audience reads
  for content, and restraint is part of the identity.
