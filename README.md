# Aydin Ayanzadeh - Personal Website

This is the personal website of Aydin Ayanzadeh, Ph.D. Student in Computer Science at the University of Maryland, Baltimore County.

## Features

- **Professional Design**: Clean, modern, and academic-focused layout
- **Responsive**: Fully responsive design that works on all devices
- **Smooth Navigation**: Sticky navigation bar with smooth scrolling
- **Interactive Elements**: Hover effects, animations on scroll, and mobile-friendly menu
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
- CSS3 (with CSS Variables for theming)
- Vanilla JavaScript
- Font Awesome Icons
- Google Fonts (Inter)

## Structure

```
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Main stylesheet
├── js/
│   └── main.js        # JavaScript for interactivity
├── images/            # Image assets (if any)
└── assets/            # Other assets
```

## Setup

1. Clone the repository
2. **Add your profile photo**: Save your professional photo as `images/profile-compressed.jpg` (the image should be square and high quality for best results)
3. Open `index.html` in a web browser
4. No build process required - it's a static website

## Testing

The site scripts (`js/main.js`, `js/blog.js`) are covered by Jest unit tests that run in a jsdom
environment. The site itself still needs no build step — the scripts export their functions only
when a CommonJS `module` object exists, which is never the case in the browser.

```bash
npm install       # one-time, installs the dev-only test toolchain
npm test          # run the unit tests
npm run test:coverage   # run them with a coverage report
```

## Customization

To customize the website:
- Edit `index.html` to update content
- Modify CSS variables in `style.css` to change colors and styling
- Update contact information and social links

## License

© 2024 Aydin Ayanzadeh. All rights reserved.