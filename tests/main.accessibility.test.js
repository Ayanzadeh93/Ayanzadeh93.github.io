const loadMain = () => {
    let main;
    jest.isolateModules(() => {
        main = require('../js/main.js');
    });
    return main;
};

const setMatchMedia = matches => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: typeof matches === 'function' ? matches(query) : matches,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn()
    }));
};

const lastObserver = () => {
    const { instances } = global.MockIntersectionObserver;
    return instances[instances.length - 1];
};

describe('main.js reveal and media behaviour', () => {
    describe('initIntersectionObserver', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <a class="top-nav-link" href="#research"></a>
                <section id="research"><div class="experience-card"></div></section>
                <div class="project-card"></div>
            `;
        });

        it('reveals observed elements and syncs the active nav link', () => {
            loadMain().initIntersectionObserver();

            const observer = lastObserver();
            expect(observer.observed).toHaveLength(3);

            observer.trigger([document.getElementById('research')]);

            expect(document.getElementById('research').classList.contains('animate-in')).toBe(true);
            expect(document.querySelector('.top-nav-link').classList.contains('active')).toBe(true);
        });

        it('ignores elements leaving the viewport', () => {
            loadMain().initIntersectionObserver();

            lastObserver().trigger([document.querySelector('.project-card')], false);

            expect(document.querySelector('.project-card').classList.contains('animate-in')).toBe(false);
        });

        it('reveals everything through the fallback timer when nothing animated', () => {
            jest.useFakeTimers();
            loadMain().initIntersectionObserver();

            jest.advanceTimersByTime(2000);

            expect(document.querySelector('.experience-card').classList.contains('animate-in')).toBe(true);
            expect(document.querySelector('.project-card').classList.contains('animate-in')).toBe(true);
            jest.useRealTimers();
        });

        it('skips the fallback when the observer already revealed content', () => {
            jest.useFakeTimers();
            loadMain().initIntersectionObserver();
            lastObserver().trigger([document.querySelector('.experience-card')]);

            jest.advanceTimersByTime(2000);

            expect(document.querySelector('.project-card').classList.contains('animate-in')).toBe(false);
            jest.useRealTimers();
        });

        it('does nothing when IntersectionObserver is unavailable', () => {
            delete window.IntersectionObserver;
            delete global.IntersectionObserver;

            loadMain().initIntersectionObserver();

            expect(document.querySelector('.experience-card').classList.contains('animate-in')).toBe(false);
        });
    });

    describe('initLazyLoading', () => {
        it('marks natively lazy images as loaded once they finish loading', () => {
            if (!('loading' in HTMLImageElement.prototype)) {
                Object.defineProperty(HTMLImageElement.prototype, 'loading', {
                    value: 'eager',
                    configurable: true,
                    writable: true
                });
            }
            document.body.innerHTML = '<img loading="lazy" src="a.jpg">';

            loadMain().initLazyLoading();
            document.querySelector('img').dispatchEvent(new Event('load'));

            expect(document.querySelector('img').classList.contains('loaded')).toBe(true);
        });

        it('swaps data-src into src when native lazy loading is unsupported', () => {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'loading');
            delete HTMLImageElement.prototype.loading;
            document.body.innerHTML = '<img data-src="https://example.com/a.jpg">';

            loadMain().initLazyLoading();
            const img = document.querySelector('img');
            lastObserver().trigger([img]);

            expect(img.src).toBe('https://example.com/a.jpg');
            expect(img.classList.contains('loaded')).toBe(true);
            expect(lastObserver().observed).toHaveLength(0);

            if (descriptor) {
                Object.defineProperty(HTMLImageElement.prototype, 'loading', descriptor);
            }
        });
    });

    describe('initHeroParallax', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div class="hero"><div class="ai-background"></div></div>';
            Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
        });

        it('translates the hero background while scrolling within the first viewport', () => {
            Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });

            loadMain().initHeroParallax();
            window.dispatchEvent(new Event('scroll'));

            expect(document.querySelector('.ai-background').style.transform).toBe('translateY(50px)');
        });

        it('stops translating once scrolled past the viewport height', () => {
            Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true, writable: true });

            loadMain().initHeroParallax();
            window.dispatchEvent(new Event('scroll'));

            expect(document.querySelector('.ai-background').style.transform).toBe('');
        });

        it('is disabled when the user prefers reduced motion', () => {
            setMatchMedia(query => query === '(prefers-reduced-motion: reduce)');
            Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });

            loadMain().initHeroParallax();
            window.dispatchEvent(new Event('scroll'));

            expect(document.querySelector('.ai-background').style.transform).toBe('');
        });
    });

    describe('initAriaLiveRegions', () => {
        it('publishes a polite live region and clears announcements', () => {
            jest.useFakeTimers();

            loadMain().initAriaLiveRegions();
            window.announceToScreenReader('Saved');

            const region = document.querySelector('.sr-only[aria-live="polite"]');
            expect(region.getAttribute('aria-atomic')).toBe('true');
            expect(region.textContent).toBe('Saved');

            jest.advanceTimersByTime(1000);
            expect(region.textContent).toBe('');
            jest.useRealTimers();
        });
    });
});

describe('main.js accessibility toolbar', () => {
    const initToolbar = () => {
        const main = loadMain();
        main.initializeAccessibilityFeatures();
        return main;
    };

    describe('ensureAccessibilityStructure', () => {
        it('injects the toolbar, menu, reading guide and live regions', () => {
            loadMain().ensureAccessibilityStructure();

            expect(document.getElementById('accessibility-menu-toggle')).not.toBeNull();
            expect(document.getElementById('accessibility-menu')).not.toBeNull();
            expect(document.getElementById('reading-guide')).not.toBeNull();
            expect(document.getElementById('sr-status').getAttribute('aria-live')).toBe('polite');
            expect(document.getElementById('sr-alerts').getAttribute('aria-live')).toBe('assertive');
            expect(window.navigationAnnouncementsEnabled).toBe(true);
        });

        it('does not duplicate structure that already exists', () => {
            const main = loadMain();

            main.ensureAccessibilityStructure();
            main.ensureAccessibilityStructure();

            expect(document.querySelectorAll('#accessibility-menu')).toHaveLength(1);
            expect(document.querySelectorAll('#reading-guide')).toHaveLength(1);
        });
    });

    describe('menu open/close', () => {
        it('opens on the toolbar button and focuses the first option', () => {
            initToolbar();

            document.getElementById('accessibility-menu-toggle').click();

            const menu = document.getElementById('accessibility-menu');
            expect(menu.classList.contains('active')).toBe(true);
            expect(menu.getAttribute('aria-hidden')).toBe('false');
            expect(document.getElementById('accessibility-menu-toggle').getAttribute('aria-expanded')).toBe('true');
            expect(document.activeElement.id).toBe('high-contrast-toggle');
        });

        it('closes on a second click and returns focus to the toolbar button', () => {
            initToolbar();
            const toggle = document.getElementById('accessibility-menu-toggle');

            toggle.click();
            toggle.click();

            expect(document.getElementById('accessibility-menu').classList.contains('active')).toBe(false);
            expect(document.activeElement).toBe(toggle);
        });

        it('closes with the close button, Escape and a backdrop click', () => {
            initToolbar();
            const menu = document.getElementById('accessibility-menu');
            const toggle = document.getElementById('accessibility-menu-toggle');

            toggle.click();
            menu.querySelector('.accessibility-close').click();
            expect(menu.classList.contains('active')).toBe(false);

            toggle.click();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(menu.classList.contains('active')).toBe(false);

            toggle.click();
            menu.click();
            expect(menu.classList.contains('active')).toBe(false);
        });

        it('toggles the toolbar with the Alt+A shortcut', () => {
            initToolbar();
            document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', altKey: true, bubbles: true }));
            expect(document.body.classList.contains('accessibility-active')).toBe(true);
            expect(document.getElementById('accessibility-menu').classList.contains('active')).toBe(true);

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', altKey: true, bubbles: true }));
            expect(document.body.classList.contains('accessibility-active')).toBe(false);
            expect(document.getElementById('accessibility-menu').classList.contains('active')).toBe(false);
        });
    });

    describe('display toggles', () => {
        it.each([
            ['high-contrast-toggle', 'high-contrast', 'highContrast'],
            ['large-text-toggle', 'large-text', 'largeText'],
            ['focus-highlight-toggle', 'enhanced-focus', 'enhancedFocus'],
            ['reduce-motion-toggle', 'reduce-motion', 'reducedMotion'],
            ['keyboard-nav-toggle', 'enhanced-keyboard', 'enhancedKeyboard'],
            ['dyslexia-font-toggle', 'dyslexia-font', 'dyslexiaFont']
        ])('%s applies the %s body class and persists it', (toggleId, bodyClass, preferenceKey) => {
            initToolbar();
            const toggle = document.getElementById(toggleId);

            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
            expect(document.body.classList.contains(bodyClass)).toBe(true);
            expect(JSON.parse(localStorage.getItem('accessibilityPreferences'))[preferenceKey]).toBe(true);

            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
            expect(document.body.classList.contains(bodyClass)).toBe(false);
            expect(JSON.parse(localStorage.getItem('accessibilityPreferences'))[preferenceKey]).toBe(false);
        });

        it('navigation announcements toggle flips the global flag', () => {
            initToolbar();
            const toggle = document.getElementById('nav-announcements-toggle');

            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));

            expect(window.navigationAnnouncementsEnabled).toBe(false);
            expect(JSON.parse(localStorage.getItem('accessibilityPreferences')).navigationAnnouncements).toBe(false);
        });
    });

    describe('reading guide', () => {
        it('follows the pointer only while enabled', () => {
            initToolbar();
            const toggle = document.getElementById('reading-guide-toggle');
            const guide = document.getElementById('reading-guide');

            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
            expect(guide.classList.contains('active')).toBe(true);
            expect(guide.getAttribute('aria-hidden')).toBe('false');

            document.dispatchEvent(new MouseEvent('mousemove', { clientY: 300, bubbles: true }));
            expect(guide.style.top).toBe('299px');

            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
            document.dispatchEvent(new MouseEvent('mousemove', { clientY: 500, bubbles: true }));
            expect(guide.style.top).toBe('299px');
            expect(guide.classList.contains('active')).toBe(false);
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <a class="top-nav-link" href="#a">A</a>
                <a class="top-nav-link" href="#b">B</a>
                <a class="top-nav-link" href="#c">C</a>
            `;
        });

        const press = (element, key) => {
            element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        };

        it('wraps arrow key focus across nav links when enhanced keyboard mode is on', () => {
            initToolbar();
            document.body.classList.add('enhanced-keyboard');
            const links = document.querySelectorAll('.top-nav-link');

            press(links[0], 'ArrowRight');
            expect(document.activeElement).toBe(links[1]);

            press(links[1], 'ArrowDown');
            expect(document.activeElement).toBe(links[2]);

            press(links[2], 'ArrowRight');
            expect(document.activeElement).toBe(links[0]);

            press(links[0], 'ArrowLeft');
            expect(document.activeElement).toBe(links[2]);

            press(links[2], 'Home');
            expect(document.activeElement).toBe(links[0]);

            press(links[0], 'End');
            expect(document.activeElement).toBe(links[2]);
        });

        it('leaves arrow keys to the browser when enhanced keyboard mode is off', () => {
            initToolbar();
            const links = document.querySelectorAll('.top-nav-link');
            links[0].focus();

            press(links[0], 'ArrowRight');

            expect(document.activeElement).toBe(links[0]);
        });

        it('announces the focused nav link when announcements are enabled', () => {
            jest.useFakeTimers();
            initToolbar();
            window.navigationAnnouncementsEnabled = true;

            document.querySelectorAll('.top-nav-link')[1].dispatchEvent(new Event('focus'));
            jest.advanceTimersByTime(100);

            expect(document.getElementById('sr-status').textContent).toBe('Focused on B');
            jest.useRealTimers();
        });

        it('adds a temporary focus glow to form controls', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('beforeend', '<input id="email-field">');
            initToolbar();

            const input = document.getElementById('email-field');
            input.dispatchEvent(new Event('focus'));
            expect(input.classList.contains('focus-glow')).toBe(true);

            jest.advanceTimersByTime(600);
            expect(input.classList.contains('focus-glow')).toBe(false);
            jest.useRealTimers();
        });
    });

    describe('initializeScreenReaderSupport', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="sr-status"></div>
                <section id="research"><h2>Research</h2></section>
                <section id="teaching-notes" aria-label="Teaching"></section>
            `;
        });

        it('announces the heading of a section entering the viewport', () => {
            jest.useFakeTimers();
            loadMain().initializeScreenReaderSupport();
            window.navigationAnnouncementsEnabled = true;

            lastObserver().trigger([document.getElementById('research')]);
            jest.advanceTimersByTime(100);

            expect(document.getElementById('sr-status').textContent).toBe('Entering Research section');
            jest.useRealTimers();
        });

        it('falls back to the aria-label when a section has no heading', () => {
            jest.useFakeTimers();
            loadMain().initializeScreenReaderSupport();
            window.navigationAnnouncementsEnabled = true;

            lastObserver().trigger([document.getElementById('teaching-notes')]);
            jest.advanceTimersByTime(100);

            expect(document.getElementById('sr-status').textContent).toBe('Entering Teaching section');
            jest.useRealTimers();
        });

        it('stays silent while announcements are disabled', () => {
            jest.useFakeTimers();
            loadMain().initializeScreenReaderSupport();
            window.navigationAnnouncementsEnabled = false;

            lastObserver().trigger([document.getElementById('research')]);
            jest.advanceTimersByTime(100);

            expect(document.getElementById('sr-status').textContent).toBe('');
            jest.useRealTimers();
        });
    });

    describe('initializePageReader', () => {
        it('disables the reader controls when speech synthesis is missing', () => {
            const speech = window.speechSynthesis;
            delete window.speechSynthesis;
            document.body.innerHTML = `
                <button id="start-reading-btn">Read this page aloud</button>
                <button id="stop-reading-btn">Stop reading</button>
            `;

            loadMain().initializePageReader();

            expect(document.getElementById('start-reading-btn').disabled).toBe(true);
            expect(document.getElementById('stop-reading-btn').disabled).toBe(true);
            expect(document.getElementById('start-reading-btn').textContent)
                .toBe('Reader not supported in this browser');

            if (speech) window.speechSynthesis = speech;
        });

        it('enables only the start button when speech synthesis is available', () => {
            window.speechSynthesis = { speak: jest.fn(), cancel: jest.fn(), speaking: false };
            document.body.innerHTML = `
                <button id="start-reading-btn">Read this page aloud</button>
                <button id="stop-reading-btn">Stop reading</button>
            `;

            loadMain().initializePageReader();

            expect(document.getElementById('start-reading-btn').disabled).toBe(false);
            expect(document.getElementById('stop-reading-btn').disabled).toBe(true);
            delete window.speechSynthesis;
        });
    });

    describe('reset', () => {
        it('clears every toggle, body class and stored preference', () => {
            window.speechSynthesis = { speak: jest.fn(), cancel: jest.fn(), speaking: false };
            const main = initToolbar();
            const highContrast = document.getElementById('high-contrast-toggle');
            highContrast.checked = true;
            highContrast.dispatchEvent(new Event('change'));

            document.getElementById('accessibility-menu').querySelector('.accessibility-reset').click();

            expect(highContrast.checked).toBe(false);
            expect(document.body.classList.contains('high-contrast')).toBe(false);
            expect(localStorage.getItem('accessibilityPreferences')).toBeNull();
            expect(main).toBeDefined();
            delete window.speechSynthesis;
        });
    });
});

describe('main.js info modal', () => {
    it('renders the privacy modal and traps focus inside it', () => {
        loadMain();

        window.showPrivacyInfo();

        const modal = document.getElementById('customModal');
        expect(modal.querySelector('#modalTitle').textContent).toBe('Privacy Information');
        expect(modal.querySelector('#modalContent').textContent).toContain('no tracking cookies');

        const buttons = modal.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        expect(document.activeElement).toBe(first);

        const tabBack = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        modal.dispatchEvent(tabBack);
        expect(document.activeElement).toBe(last);

        const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        modal.dispatchEvent(tabForward);
        expect(document.activeElement).toBe(first);
    });

    it('renders the accessibility modal and closes on Escape', () => {
        loadMain();

        window.showAccessibilityInfo();
        expect(document.getElementById('customModal').querySelector('#modalTitle').textContent)
            .toBe('Accessibility Information');

        document.getElementById('customModal')
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(document.getElementById('customModal')).toBeNull();
    });

    it('replaces an already open modal instead of stacking them', () => {
        const main = loadMain();

        main.showCustomModal('First', 'one');
        main.showCustomModal('Second', 'two');

        expect(document.querySelectorAll('.custom-modal')).toHaveLength(1);
        expect(document.querySelector('#modalTitle').textContent).toBe('Second');

        window.closeCustomModal();
        expect(document.querySelector('.custom-modal')).toBeNull();
    });
});
