/**
 * Render one 1200×630 social preview card per publication.
 *
 *   python3 -m http.server 8765 &
 *   node scripts/make_social_cards.js      # needs Playwright (npm i -g playwright)
 *   python scripts/build_site.py           # picks the cards up as og:image
 *
 * Optional: scripts/build_site.py falls back to the portrait when a card is
 * missing, so a new paper works without this step. Re-run it after changing a
 * title, author list or venue. Cards are written to assets/og/<id>.png.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'publications.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const STATUS = { accepted: 'Accepted', 'under-submission': 'Under submission' };

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function card(pub) {
    const me = site.person.name;
    const shown = pub.authors.slice(0, 6);
    const authors = shown.map((name) => (name === me ? `<b>${esc(name)}</b>` : esc(name))).join(', ')
        + (pub.authors.length > shown.length ? `, +${pub.authors.length - shown.length} more` : '');
    const status = STATUS[pub.status] ? `<span class="status">${STATUS[pub.status]}</span>` : '';
    const venue = pub.venue_short.includes(String(pub.year)) ? pub.venue_short : `${pub.venue_short} · ${pub.year}`;
    const size = pub.title.length > 110 ? 46 : pub.title.length > 80 ? 52 : 60;
    return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${BASE}/css/site.css">
<style>
  html, body { margin: 0; }
  body { width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: space-between;
    box-sizing: border-box; padding: 64px 72px 56px; background: #fff;
    background-image: radial-gradient(900px 420px at 100% -10%, rgba(180, 83, 42, 0.12), transparent 70%),
      radial-gradient(760px 420px at -10% 110%, rgba(28, 79, 107, 0.14), transparent 70%);
    font-family: 'Atkinson Hyperlegible', sans-serif; color: #0f172a; }
  .venue { display: flex; align-items: center; gap: 18px; font-size: 24px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #96431f; }
  .status { padding: 4px 16px; border-radius: 999px; background: #e9f1f5; color: #143c52; font-size: 20px;
    letter-spacing: 0; text-transform: none; }
  h1 { margin: 28px 0 0; font-family: 'Newsreader', serif; font-weight: 600; font-size: ${size}px; line-height: 1.12;
    letter-spacing: -0.02em; text-wrap: balance; }
  .authors { margin-top: 26px; font-size: 27px; line-height: 1.4; color: #334155; }
  .authors b { color: #0f172a; }
  footer { display: flex; align-items: center; justify-content: space-between; padding-top: 24px;
    border-top: 2px solid #e0e6ed; font-size: 25px; color: #56657a; }
  .brand { display: flex; align-items: center; gap: 14px; font-family: 'Newsreader', serif; font-weight: 600;
    font-size: 30px; color: #0f172a; }
</style></head><body>
<div>
  <div class="venue"><span>${esc(venue)}</span>${status}</div>
  <h1>${esc(pub.title)}</h1>
  <p class="authors">${authors}</p>
</div>
<footer>
  <span class="brand"><svg width="40" height="40" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1c4f6b"/><path d="M9.5 23.5 16 8.5l6.5 15M12.2 18.5h7.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="7" r="2.6" fill="#b4532a"/></svg>${esc(me)}</span>
  <span>${esc(site.url.replace('https://', ''))}</span>
</footer>
</body></html>`;
}

(async () => {
    const out = path.join(ROOT, 'assets', 'og');
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const pub of data.publications) {
        if (!pub.page) continue;
        // Served from the site's own origin so the self-hosted fonts load
        // (fonts are CORS-gated; a blank-origin document would fall back).
        await page.route(`${BASE}/__card__`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: card(pub) }));
        await page.goto(`${BASE}/__card__`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const fonts = await page.evaluate(() => document.fonts.check("600 40px 'Newsreader'") && document.fonts.check("400 20px 'Atkinson Hyperlegible'"));
        if (!fonts) throw new Error('site fonts did not load; is the local server running at ' + BASE + '?');
        await page.unroute(`${BASE}/__card__`);
        const overflow = await page.evaluate(() => document.body.scrollHeight > 630);
        if (overflow) console.warn(`warning: ${pub.id} overflows the card`);
        await page.screenshot({ path: path.join(out, `${pub.id}.png`) });
        console.log(`wrote assets/og/${pub.id}.png`);
    }
    await browser.close();
})();
