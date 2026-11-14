/**
 * site.js — behaviour shared by every page that uses css/site.css.
 *
 * Classic deferred script, no dependencies. Each feature is a small function
 * that looks for its own hook (a data-* attribute) and does nothing when the
 * hook is absent, so one file serves the homepage, the publication library,
 * paper pages, the blog and the contact page.
 *
 * Nothing here touches the legacy class names main.js owns, so both scripts
 * can run on the homepage without stepping on each other.
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function run(name, fn) {
        try { fn(); } catch (error) { console.error('site.js: ' + name + ' failed', error); }
    }

    /** One polite live region for the whole page, created on first use. */
    var liveRegion = null;
    function announce(message) {
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.className = 'visually-hidden';
            liveRegion.setAttribute('role', 'status');
            liveRegion.setAttribute('aria-live', 'polite');
            document.body.appendChild(liveRegion);
        }
        liveRegion.textContent = '';
        window.setTimeout(function () { liveRegion.textContent = message; }, 40);
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
        }
        return Promise.resolve(legacyCopy(text));
    }

    function legacyCopy(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('aria-hidden', 'true');
        area.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
        area.remove();
        return ok;
    }

    /* ── In-page links on the homepage ────────────────────────────────────── */
    /* The legacy main.js (kept for the Projects sections) cancels every
       in-page link and smooth-scrolls instead, which drops the URL hash and
       ignores reduced-motion. For links inside this design system, take the
       click first and do what the browser would: scroll, update the URL, and
       move focus for the skip link. Pages without main.js are left native. */
    function initHashLinks() {
        if (!root.classList.contains('js-enabled')) return;
        document.addEventListener('click', function (event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
            if (!link || !link.closest('.ds')) return;
            var id = link.getAttribute('href').slice(1);
            var target = id ? document.getElementById(id) : null;
            if (!target) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            // Land the section just under the sticky header. (scrollIntoView
            // double-counts the legacy scroll-padding on this page.)
            var header = document.querySelector('[data-site-header]');
            var offset = (header ? header.offsetHeight : 0) + 8;
            var top = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
            try { window.history.pushState(null, '', '#' + id); } catch (error) { /* sandboxed */ }

            if (link.classList.contains('skip-link')) {
                if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }
            var toggle = document.querySelector('[data-nav-toggle][aria-expanded="true"]');
            if (toggle && link.closest('#site-nav')) toggle.click();
        }, true);
    }

    /* ── Skip link: always move focus, whatever else handles the click ────── */
    function initSkipLink() {
        var link = document.querySelector('.skip-link');
        if (!link) return;
        link.addEventListener('click', function () {
            var target = document.getElementById(link.getAttribute('href').slice(1));
            if (!target) return;
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            window.setTimeout(function () { target.focus({ preventScroll: false }); }, 0);
        });
    }

    /* ── Header: hairline + shadow once the page has scrolled ─────────────── */
    function initHeader() {
        var header = document.querySelector('[data-site-header]');
        if (!header) return;
        var ticking = false;
        function update() {
            header.toggleAttribute('data-stuck', window.scrollY > 4);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* ── Mobile navigation: a disclosure, not a modal ─────────────────────── */
    function initNav() {
        var toggle = document.querySelector('[data-nav-toggle]');
        var nav = document.getElementById('site-nav');
        if (!toggle || !nav) return;

        function setOpen(open) {
            toggle.setAttribute('aria-expanded', String(open));
            nav.toggleAttribute('data-open', open);
        }

        toggle.addEventListener('click', function () {
            setOpen(toggle.getAttribute('aria-expanded') !== 'true');
        });
        nav.addEventListener('click', function (event) {
            if (event.target.closest('a')) setOpen(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
                setOpen(false);
                toggle.focus();
            }
        });
        document.addEventListener('click', function (event) {
            if (toggle.getAttribute('aria-expanded') !== 'true') return;
            if (!event.target.closest('[data-site-header]')) setOpen(false);
        });
        window.matchMedia('(min-width: 1041px)').addEventListener('change', function (event) {
            if (event.matches) setOpen(false);
        });
    }

    /* ── Theme toggle ─────────────────────────────────────────────────────── */
    function initTheme() {
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        if (!buttons.length) return;

        function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

        function reflect() {
            var dark = current() === 'dark';
            buttons.forEach(function (button) {
                button.setAttribute('aria-pressed', String(dark));
                button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
            });
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', dark ? '#0f1729' : '#1c4f6b');
        }

        function apply(theme) {
            var swap = function () { root.setAttribute('data-theme', theme); reflect(); };
            if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(swap);
            else swap();
        }

        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                var next = current() === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem('theme', next); } catch (error) { /* non-fatal */ }
                apply(next);
                announce(next === 'dark' ? 'Dark theme on' : 'Light theme on');
            });
        });

        // Follow the operating system until the reader makes a choice.
        var system = window.matchMedia('(prefers-color-scheme: dark)');
        system.addEventListener('change', function (event) {
            var saved = null;
            try { saved = localStorage.getItem('theme'); } catch (error) { /* ignore */ }
            if (!saved) apply(event.matches ? 'dark' : 'light');
        });

        reflect();
    }

    /* ── Scroll spy: mark the nav link of the section in view ─────────────── */
    function initScrollSpy() {
        if (!('IntersectionObserver' in window)) return;
        var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav__link[data-spy]'));
        if (!links.length) return;

        var byId = {};
        links.forEach(function (link) { byId[link.getAttribute('data-spy')] = link; });

        var sections = [];
        document.querySelectorAll('[data-spy-section]').forEach(function (section) {
            if (byId[section.getAttribute('data-spy-section')]) sections.push(section);
        });
        if (!sections.length) return;

        var visible = new Map();
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) visible.set(entry.target, entry.intersectionRatio);
                else visible.delete(entry.target);
            });
            // The first visible section in document order wins.
            var active = null;
            for (var i = 0; i < sections.length; i += 1) {
                if (visible.has(sections[i])) { active = sections[i]; break; }
            }
            links.forEach(function (link) { link.removeAttribute('aria-current'); });
            if (active) byId[active.getAttribute('data-spy-section')].setAttribute('aria-current', 'true');
        }, { rootMargin: '-35% 0px -55% 0px' });

        sections.forEach(function (section) { observer.observe(section); });
    }

    /* ── Reveal on scroll (opt-in via data-reveal; never gates content) ───── */
    function initReveal() {
        var targets = document.querySelectorAll('[data-reveal]');
        if (!targets.length) return;
        function show(el) { el.setAttribute('data-revealed', ''); }

        if (!('IntersectionObserver' in window) || reduceMotion.matches) {
            targets.forEach(show);
            return;
        }
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { show(entry.target); observer.unobserve(entry.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        targets.forEach(function (el) { observer.observe(el); });
        // Belt and braces: nothing stays hidden if the observer never fires.
        window.setTimeout(function () { targets.forEach(show); }, 2500);
    }

    /* ── Copy buttons: <button data-copy="text" data-copy-label="Email"> ──── */
    function initCopy() {
        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-copy]');
            if (!button) return;
            var label = button.getAttribute('data-copy-label') || 'Text';
            copyText(button.getAttribute('data-copy')).then(function (ok) {
                var text = button.querySelector('[data-copy-text]');
                var original = text ? text.textContent : '';
                if (ok) {
                    button.setAttribute('data-copied', '');
                    if (text) text.textContent = 'Copied';
                    announce(label + ' copied to clipboard');
                    window.setTimeout(function () {
                        button.removeAttribute('data-copied');
                        if (text) text.textContent = original;
                    }, 2000);
                } else {
                    announce('Copy failed. Select the text and copy it manually.');
                }
            });
        });
        document.querySelectorAll('[data-copy][hidden]').forEach(function (button) { button.hidden = false; });
    }

    /* ── BibTeX block on paper pages: copy + download ─────────────────────── */
    function initBibtex() {
        document.querySelectorAll('[data-bibtex]').forEach(function (block) {
            var source = block.querySelector('pre');
            var status = block.querySelector('[data-bibtex-status]');
            var copy = block.querySelector('[data-bibtex-copy]');
            var download = block.querySelector('[data-bibtex-download]');
            if (!source) return;

            function say(message) { if (status) status.textContent = message; }

            if (copy) {
                copy.hidden = false;
                copy.addEventListener('click', function () {
                    copyText(source.textContent).then(function (ok) {
                        say(ok ? 'BibTeX copied to clipboard.' : 'Copy failed. Select the entry and copy it manually.');
                    });
                });
            }
            if (download) {
                download.hidden = false;
                download.addEventListener('click', function () {
                    var key = (source.textContent.match(/^@\w+\{([^,\s]+)/) || [])[1] || 'citation';
                    var blob = new Blob([source.textContent + '\n'], { type: 'application/x-bibtex;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.download = key + '.bib';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                    say('BibTeX file downloaded.');
                });
            }
        });
    }

    /* ── Figures: graceful failure for remote images, and a zoom dialog ───── */
    function initFigures() {
        var figures = document.querySelectorAll('[data-figure]');
        if (!figures.length) return;

        figures.forEach(function (figure) {
            var image = figure.querySelector('.figure__plate > img');
            if (!image) return;
            function broken() { figure.setAttribute('data-broken', ''); }
            image.addEventListener('error', broken);
            if (image.complete && image.naturalWidth === 0) broken();
        });

        var dialog = null;
        var plate = null;
        var caption = null;

        function build() {
            dialog = document.createElement('dialog');
            dialog.className = 'zoom-dialog';
            dialog.setAttribute('aria-label', 'Enlarged figure');

            var bar = document.createElement('div');
            bar.className = 'zoom-dialog__bar';
            caption = document.createElement('p');
            caption.className = 'zoom-dialog__cap';
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'button button--sm';
            close.textContent = 'Close';
            close.addEventListener('click', function () { dialog.close(); });
            bar.appendChild(caption);
            bar.appendChild(close);

            plate = document.createElement('div');
            plate.className = 'zoom-dialog__plate';

            dialog.appendChild(bar);
            dialog.appendChild(plate);
            dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });

            var host = document.querySelector('.ds') || document.body;
            host.appendChild(dialog);
        }

        figures.forEach(function (figure) {
            var button = figure.querySelector('[data-zoom]');
            var media = figure.querySelector('.figure__plate > svg, .figure__plate > img');
            if (!button || !media || typeof HTMLDialogElement === 'undefined') return;
            button.hidden = false;
            button.addEventListener('click', function () {
                if (!dialog) build();
                while (plate.firstChild) plate.removeChild(plate.firstChild);
                var copy = media.cloneNode(true);
                copy.removeAttribute('loading');
                plate.appendChild(copy);
                var cap = figure.querySelector('figcaption');
                caption.textContent = cap ? cap.textContent : '';
                dialog.showModal();
            });
        });
    }

    /* ── Research threads: one tooltip for hover and keyboard focus ───────── */
    function initThreads() {
        var chart = document.querySelector('[data-threads]');
        if (!chart) return;

        var tip = document.createElement('div');
        tip.className = 'threads__tip';
        tip.setAttribute('role', 'presentation');
        tip.hidden = true;
        chart.appendChild(tip);
        var active = null;

        function show(dot) {
            if (active) active.removeAttribute('data-active');
            active = dot;
            dot.setAttribute('data-active', '');

            while (tip.firstChild) tip.removeChild(tip.firstChild);
            var title = document.createElement('strong');
            title.textContent = dot.getAttribute('data-title');
            tip.appendChild(title);
            tip.appendChild(document.createTextNode(dot.getAttribute('data-meta')));
            tip.hidden = false;

            // Centre the card over the mark, kept inside the chart; flip below
            // when there is no room above.
            var box = chart.getBoundingClientRect();
            var mark = dot.getBoundingClientRect();
            var half = tip.offsetWidth / 2;
            var x = mark.left + mark.width / 2 - box.left;
            x = Math.max(half + 8, Math.min(box.width - half - 8, x));
            var above = mark.top - box.top > tip.offsetHeight + 24;
            tip.toggleAttribute('data-below', !above);
            tip.style.left = x + 'px';
            tip.style.top = (above ? mark.top - box.top : mark.bottom - box.top) + 'px';
        }
        function hide() {
            if (active) active.removeAttribute('data-active');
            active = null;
            tip.hidden = true;
        }

        chart.querySelectorAll('.dot').forEach(function (dot) {
            dot.addEventListener('pointerenter', function () { show(dot); });
            dot.addEventListener('pointerleave', hide);
            dot.addEventListener('focus', function () { show(dot); });
            dot.addEventListener('blur', hide);
        });
    }

    /* ── Print button (the CV page) ───────────────────────────────────────── */
    function initPrint() {
        document.querySelectorAll('[data-print]').forEach(function (button) {
            if (typeof window.print !== 'function') return;
            button.hidden = false;
            button.addEventListener('click', function () { window.print(); });
        });
    }

    /* ── Toolkit marquee: a visible way to stop anything that moves ───────── */
    function initMarquee() {
        var marquee = document.querySelector('[data-marquee]');
        var toggle = document.querySelector('[data-marquee-toggle]');
        if (!marquee || !toggle) return;
        toggle.hidden = false;
        toggle.addEventListener('click', function () {
            var paused = !marquee.hasAttribute('data-paused');
            marquee.toggleAttribute('data-paused', paused);
            toggle.setAttribute('aria-pressed', String(paused));
            toggle.setAttribute('aria-label', paused ? 'Resume the moving list' : 'Pause the moving list');
        });
    }

    /* ── News: older items collapse behind one button ─────────────────────── */
    function initNews() {
        document.querySelectorAll('[data-news]').forEach(function (list) {
            var button = document.querySelector('[data-news-more]');
            if (!button || !list.querySelector('[data-older]')) return;
            list.setAttribute('data-collapsed', '');
            button.hidden = false;
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', function () {
                var open = list.hasAttribute('data-collapsed');
                list.toggleAttribute('data-collapsed', !open);
                button.setAttribute('aria-expanded', String(open));
                button.querySelector('[data-label]').textContent = open ? 'Show fewer updates' : 'Show earlier updates';
            });
        });
    }

    /* ── Generic chip filter: [data-filter-group] controls [data-filter-item] */
    function initFilters() {
        document.querySelectorAll('[data-filter-group]').forEach(function (group) {
            var scope = document.getElementById(group.getAttribute('data-filter-group'));
            if (!scope) return;
            var chips = group.querySelectorAll('[data-filter]');
            var status = document.querySelector('[data-filter-status="' + scope.id + '"]');
            group.hidden = false;

            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    var value = chip.getAttribute('data-filter');
                    var shown = 0;
                    chips.forEach(function (other) { other.setAttribute('aria-pressed', String(other === chip)); });
                    scope.querySelectorAll('[data-filter-item]').forEach(function (item) {
                        var match = value === 'all' || item.getAttribute('data-filter-item').split(' ').indexOf(value) !== -1;
                        item.hidden = !match;
                        if (match) shown += 1;
                    });
                    var noun = group.getAttribute('data-filter-noun') || 'post';
                    if (status) status.textContent = shown + ' ' + noun + (shown === 1 ? '' : 's');
                });
            });
        });
    }

    /* ── Contact form: inline validation, fetch submit, honest status ─────── */
    function initContactForm() {
        document.querySelectorAll('form[data-contact-form]').forEach(function (form) {
            var status = form.querySelector('[data-form-status]');
            var submit = form.querySelector('button[type="submit"]');
            var fallbackEmail = form.getAttribute('data-owner-email') || '';
            form.setAttribute('novalidate', '');

            var rules = {
                name: function (v) { return v.length >= 2 ? '' : 'Please enter your name.'; },
                email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Please enter a valid email address.'; },
                subject: function (v) { return v.length >= 2 ? '' : 'Please add a subject.'; },
                message: function (v) { return v.length >= 10 ? '' : 'Please write at least 10 characters.'; }
            };

            function setError(field, message) {
                var holder = field.closest('.field');
                var note = holder.querySelector('.field__error');
                if (message) {
                    if (!note) {
                        note = document.createElement('p');
                        note.className = 'field__error';
                        note.id = field.id + '-error';
                        holder.appendChild(note);
                    }
                    note.textContent = message;
                    field.setAttribute('aria-invalid', 'true');
                    field.setAttribute('aria-describedby', note.id);
                } else {
                    if (note) note.remove();
                    field.removeAttribute('aria-invalid');
                    field.removeAttribute('aria-describedby');
                }
            }

            function validate(field) {
                var rule = rules[field.name];
                if (!rule) return true;
                var message = rule(field.value.trim());
                setError(field, message);
                return !message;
            }

            function say(message, state) {
                if (!status) return;
                status.textContent = message;
                if (state) status.setAttribute('data-state', state);
                else status.removeAttribute('data-state');
            }

            var fields = Array.prototype.slice.call(form.querySelectorAll('input[name], textarea[name]'))
                .filter(function (field) { return rules[field.name]; });

            fields.forEach(function (field) {
                field.addEventListener('blur', function () { validate(field); });
                field.addEventListener('input', function () {
                    if (field.hasAttribute('aria-invalid')) validate(field);
                });
            });

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var invalid = fields.filter(function (field) { return !validate(field); });
                if (invalid.length) {
                    say('Please fix the highlighted fields.', 'error');
                    invalid[0].focus();
                    return;
                }

                var reply = form.querySelector('input[name="_replyto"]');
                var email = form.querySelector('input[name="email"]');
                if (reply && email) reply.value = email.value.trim();

                var label = submit.querySelector('[data-label]');
                var original = label.textContent;
                submit.disabled = true;
                label.textContent = 'Sending…';
                say('', null);

                function done() { submit.disabled = false; label.textContent = original; }
                var failure = 'The message could not be sent.' + (fallbackEmail ? ' Please email ' + fallbackEmail + ' directly.' : '');

                fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
                    .then(function (response) {
                        done();
                        if (response.ok) {
                            form.reset();
                            say('Thank you — your message was sent. I will reply by email.', 'ok');
                        } else {
                            say(failure, 'error');
                        }
                    })
                    .catch(function () { done(); say(failure, 'error'); });
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        run('hash links', initHashLinks);
        run('skip link', initSkipLink);
        run('header', initHeader);
        run('nav', initNav);
        run('theme', initTheme);
        run('scroll spy', initScrollSpy);
        run('reveal', initReveal);
        run('copy', initCopy);
        run('bibtex', initBibtex);
        run('figures', initFigures);
        run('threads', initThreads);
        run('marquee', initMarquee);
        run('print', initPrint);
        run('news', initNews);
        run('filters', initFilters);
        run('contact form', initContactForm);
    });
})();
