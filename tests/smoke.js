/**
 * Browser smoke test for the pages built on css/site.css.
 *
 * Optional, local check (CI runs the dependency-free Python validators):
 *
 *   python3 -m http.server 8765 &
 *   node tests/smoke.js             # needs Playwright (npm i -g playwright)
 *
 * It loads every in-scope page at phone and desktop widths, fails on console
 * errors, CSP violations, horizontal overflow or a missing <h1>, and drives the
 * interactive pieces: mobile menu, theme toggle, library search and facets,
 * cite dialog, BibTeX copy, figure zoom, research-thread readout, news toggle
 * and contact-form validation.
 */
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const data = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'publications.json'), 'utf8'));
const papers = data.publications.filter((p) => p.page).map((p) => `/${p.id}/`);
const pages = ['/', '/publications.html', '/cv.html', '/contact.html', '/blog.html', '/blog/multi-task-learning/', '/accessibility.html', '/404.html', ...papers];

let failures = 0;
const fail = (message) => { failures += 1; console.log(`  FAIL ${message}`); };
const ok = (condition, message) => { if (!condition) fail(message); };

let browser = null;


// Requests to other origins are not what is under test, and are not reachable
// from every machine: abort them and ignore the resulting network noise.
async function context(options) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', ...options });
    await ctx.route((url) => !url.href.startsWith(BASE), (route) => route.abort());
    return ctx;
}

function watch(page, label) {
    page.on('pageerror', (error) => fail(`${label}: page error: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (/ERR_FAILED|ERR_TUNNEL|net::ERR_/.test(text)) return;
        fail(`${label}: console error: ${text}`);
    });
}

async function main() {
    browser = await chromium.launch();

    console.log('pages');
    for (const [width, height, name] of [[390, 844, 'phone'], [1440, 900, 'desktop']]) {
        const ctx = await context({ viewport: { width, height } });
        for (const route of pages) {
            const page = await ctx.newPage();
            const label = `${name} ${route}`;
            watch(page, label);
            const response = await page.goto(BASE + route, { waitUntil: 'load' });
            ok(response && response.status() === 200, `${label}: HTTP ${response && response.status()}`);
            await page.waitForTimeout(250);
            const facts = await page.evaluate(() => ({
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                h1: document.querySelectorAll('h1').length,
                title: document.title,
                canonical: !!document.querySelector('link[rel="canonical"]'),
                main: !!document.getElementById('main'),
                unlabeled: Array.from(document.querySelectorAll('.ds a, .ds button, a.ds, button.ds'))
                    .filter((el) => !(el.textContent.trim() || el.getAttribute('aria-label') || el.querySelector('img[alt]'))).length,
            }));
            ok(facts.overflow <= 0, `${label}: horizontal overflow of ${facts.overflow}px`);
            ok(facts.h1 === 1, `${label}: expected one <h1>, found ${facts.h1}`);
            ok(facts.title.length > 10, `${label}: missing <title>`);
            ok(facts.canonical, `${label}: missing canonical link`);
            ok(facts.main, `${label}: missing #main landmark target`);
            ok(facts.unlabeled === 0, `${label}: ${facts.unlabeled} link(s)/button(s) without an accessible name`);
            await page.close();
        }
        await ctx.close();
    }

    console.log('interactions');
    {
        // Mobile menu is a disclosure: opens, closes on Escape, returns focus.
        const ctx = await context({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        watch(page, 'menu');
        await page.goto(`${BASE}/publications.html`);
        const toggle = page.locator('[data-nav-toggle]');
        ok(await page.locator('#site-nav').isHidden(), 'menu: nav should start closed on a phone');
        await toggle.click();
        ok(await page.locator('#site-nav').isVisible(), 'menu: nav should open');
        ok((await toggle.getAttribute('aria-expanded')) === 'true', 'menu: aria-expanded should be true');
        await page.keyboard.press('Escape');
        ok(await page.locator('#site-nav').isHidden(), 'menu: Escape should close it');
        ok(await toggle.evaluate((el) => el === document.activeElement), 'menu: focus should return to the toggle');
        await ctx.close();
    }
    {
        const ctx = await context({ viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        watch(page, 'desktop');

        // Theme toggle persists.
        await page.goto(`${BASE}/publications.html`);
        await page.locator('[data-theme-toggle]').click();
        ok((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme: toggle should switch to dark');
        await page.reload();
        ok((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme: choice should survive a reload');
        await page.locator('[data-theme-toggle]').click();

        // Library: search, facets, shareable URL, empty state.
        const total = data.publications.length;
        const visible = () => page.locator('[data-pub]:visible').count();
        ok((await visible()) === total, `library: expected ${total} entries`);
        await page.fill('#lib-search', 'toreyin');
        await page.waitForTimeout(250);
        const byAuthor = await visible();
        ok(byAuthor > 0 && byAuthor < total, `library: diacritic-folded author search matched ${byAuthor}`);
        ok(page.url().includes('q=toreyin'), 'library: query should be reflected in the URL');
        await page.fill('#lib-search', '');
        await page.waitForTimeout(250);
        await page.locator('[data-facet="topic"][data-value="navigation"]').click();
        const nav = data.publications.filter((p) => p.topic === 'navigation').length;
        ok((await visible()) === nav, `library: navigation thread should show ${nav}`);
        ok(page.url().includes('topic=navigation'), 'library: facet should be reflected in the URL');
        await page.reload();
        ok((await visible()) === nav, 'library: a filtered URL should restore the view');
        await page.fill('#lib-search', 'zzzz-no-match');
        await page.waitForTimeout(250);
        ok(await page.locator('[data-empty]').isVisible(), 'library: empty state should appear');
        await page.locator('[data-reset]').click();
        ok((await visible()) === total, 'library: reset should restore every entry');

        // Cite dialog.
        await page.locator('[data-cite]').first().click();
        const dialog = page.locator('dialog.cite-dialog');
        ok(await dialog.isVisible(), 'cite: dialog should open');
        ok((await dialog.locator('pre').textContent()).trim().startsWith('@'), 'cite: BibTeX should be shown first');
        await dialog.locator('[data-format="apa"]').click();
        ok(/\(\d{4}\)/.test(await dialog.locator('pre').textContent()), 'cite: APA output should contain the year');
        await page.keyboard.press('Escape');
        ok(await dialog.isHidden(), 'cite: Escape should close the dialog');

        // Paper page: BibTeX copy and figure zoom.
        await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto(`${BASE}/iiswc-2026-workload/`);
        await page.locator('[data-bibtex-copy]').click();
        await page.waitForFunction(() => document.querySelector('[data-bibtex-status]').textContent !== '', null, { timeout: 3000 }).catch(() => {});
        ok((await page.locator('[data-bibtex-status]').textContent()).includes('copied'), 'paper: copy should confirm');
        await page.locator('[data-zoom]').first().click({ force: true });
        ok(await page.locator('dialog.zoom-dialog').isVisible(), 'paper: figure zoom should open');
        await page.keyboard.press('Escape');

        // Homepage: thread readout, news toggle, form validation.
        await page.goto(`${BASE}/`);
        await page.locator('.site-nav__link[data-spy="experience"]').click();
        await page.waitForTimeout(400);
        ok(page.url().endsWith('#experience'), 'home: nav link should put the section in the URL');
        ok(await page.evaluate(() => Math.abs(document.getElementById('experience').getBoundingClientRect().top) < 140), 'home: nav link should scroll to the section');
        await page.goto(`${BASE}/`);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'main'), 'home: skip link should move focus to main');
        const dot = page.locator('.dot').first();
        await dot.focus();
        ok(await page.locator('.threads__tip strong').isVisible(), 'home: focusing a mark should show its tooltip');
        // This context asks for reduced motion: the toolkit row must hold still.
        ok(await page.locator('[data-marquee-toggle]').isHidden(), 'home: no pause control is needed when nothing moves');
        ok(await page.evaluate(() => getComputedStyle(document.querySelector('.marquee__track')).animationName === 'none'), 'home: the toolkit row must not move under reduced motion');
        const more = page.locator('[data-news-more]');
        const before = await page.locator('.news__item:visible').count();
        await more.click();
        ok((await page.locator('.news__item:visible').count()) > before, 'home: news toggle should reveal older items');
        await page.locator('form[data-contact-form] button[type="submit"]').click();
        ok((await page.locator('.field__error').count()) >= 3, 'home: empty form should show field errors');
        ok(await page.locator('#contact-name').evaluate((el) => el === document.activeElement), 'home: focus should move to the first invalid field');
        await ctx.close();
    }

    {
        // With motion allowed, anything that moves can be paused.
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
        await ctx.route((url) => !url.href.startsWith(BASE), (route) => route.abort());
        const page = await ctx.newPage();
        watch(page, 'motion');
        await page.goto(`${BASE}/`);
        await page.locator('[data-marquee-toggle]').click();
        ok((await page.locator('[data-marquee][data-paused]').count()) === 1, 'home: the toolkit row should pause on request');
        ok(await page.evaluate(() => getComputedStyle(document.querySelector('.marquee__track')).animationPlayState === 'paused'), 'home: paused means paused');
        await ctx.close();
    }

    await browser.close();
    console.log(failures ? `\n${failures} failure(s)` : '\nsmoke test: PASS');
    process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
