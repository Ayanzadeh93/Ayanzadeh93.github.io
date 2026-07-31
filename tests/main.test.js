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

const setScrollY = value => {
    Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
};

describe('main.js', () => {
    describe('initThemeToggle', () => {
        beforeEach(() => {
            document.body.innerHTML = '<button id="theme-toggle"><i class="fas fa-moon"></i></button>';
        });

        it('follows the operating system preference when nothing is stored', () => {
            setMatchMedia(query => query === '(prefers-color-scheme: dark)');

            loadMain().initThemeToggle();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            expect(document.querySelector('#theme-toggle i').classList.contains('fa-sun')).toBe(true);
        });

        it('prefers a stored light theme over a dark system preference', () => {
            localStorage.setItem('theme', 'light');
            setMatchMedia(true);

            loadMain().initThemeToggle();

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
            expect(document.getElementById('theme-toggle').getAttribute('aria-pressed')).toBe('false');
        });

        it('toggles the theme on click and persists the choice', () => {
            loadMain().initThemeToggle();
            const button = document.getElementById('theme-toggle');

            button.click();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            expect(localStorage.getItem('theme')).toBe('dark');
            expect(button.getAttribute('aria-label')).toBe('Switch to light theme');

            button.click();

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
            expect(localStorage.getItem('theme')).toBe('light');
        });

        it('still applies a theme when localStorage throws', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });

            loadMain().initThemeToggle();
            document.getElementById('theme-toggle').click();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('is a no-op when the toggle button is missing', () => {
            document.body.innerHTML = '';

            expect(() => loadMain().initThemeToggle()).not.toThrow();
        });
    });

    describe('initNavbarScroll', () => {
        beforeEach(() => {
            document.body.innerHTML = '<nav class="top-navbar"></nav>';
        });

        it('adds the scrolled class past 50 pixels and removes it back at the top', () => {
            setScrollY(0);
            loadMain().initNavbarScroll();
            const navbar = document.querySelector('.top-navbar');

            expect(navbar.classList.contains('scrolled')).toBe(false);

            setScrollY(120);
            window.dispatchEvent(new Event('scroll'));
            expect(navbar.classList.contains('scrolled')).toBe(true);

            setScrollY(10);
            window.dispatchEvent(new Event('scroll'));
            expect(navbar.classList.contains('scrolled')).toBe(false);
        });

        it('applies the scrolled state immediately when the page loads scrolled down', () => {
            setScrollY(300);

            loadMain().initNavbarScroll();

            expect(document.querySelector('.top-navbar').classList.contains('scrolled')).toBe(true);
        });
    });

    describe('initMobileMenu', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <button class="mobile-menu-toggle"></button>
                <ul class="top-nav-menu">
                    <li><a class="top-nav-link" href="#about">About</a></li>
                </ul>
            `;
        });

        it('sets the initial collapsed aria state', () => {
            loadMain().initMobileMenu();

            expect(document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')).toBe('false');
        });

        it('opens and closes on toggle clicks, locking body scroll while open', () => {
            loadMain().initMobileMenu();
            const toggle = document.querySelector('.mobile-menu-toggle');
            const menu = document.querySelector('.top-nav-menu');

            toggle.click();
            expect(menu.classList.contains('active')).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
            expect(document.body.style.overflow).toBe('hidden');

            toggle.click();
            expect(menu.classList.contains('active')).toBe(false);
            expect(document.body.style.overflow).toBe('');
        });

        it('closes on Escape', () => {
            loadMain().initMobileMenu();
            const menu = document.querySelector('.top-nav-menu');
            document.querySelector('.mobile-menu-toggle').click();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

            expect(menu.classList.contains('active')).toBe(false);
        });

        it('closes when clicking outside the menu', () => {
            document.body.insertAdjacentHTML('beforeend', '<main id="outside"></main>');
            loadMain().initMobileMenu();
            document.querySelector('.mobile-menu-toggle').click();

            document.getElementById('outside').click();

            expect(document.querySelector('.top-nav-menu').classList.contains('active')).toBe(false);
        });

        it('closes shortly after a navigation link is followed', () => {
            jest.useFakeTimers();
            loadMain().initMobileMenu();
            document.querySelector('.mobile-menu-toggle').click();

            document.querySelector('.top-nav-link').click();
            jest.advanceTimersByTime(100);

            expect(document.querySelector('.top-nav-menu').classList.contains('active')).toBe(false);
            jest.useRealTimers();
        });
    });

    describe('initSmoothScrolling', () => {
        it('scrolls to the target section and marks its nav link active', () => {
            document.body.innerHTML = `
                <a class="top-nav-link" href="#about">About</a>
                <section id="about"></section>
            `;
            const target = document.getElementById('about');
            target.scrollIntoView = jest.fn();
            loadMain().initSmoothScrolling();

            const link = document.querySelector('.top-nav-link');
            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            link.dispatchEvent(event);

            expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
            expect(link.classList.contains('active')).toBe(true);
            expect(event.defaultPrevented).toBe(true);
        });

        it('leaves bare "#" links alone', () => {
            document.body.innerHTML = '<a href="#">Share</a>';
            loadMain().initSmoothScrolling();

            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            document.querySelector('a').dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
        });

        it('suppresses navigation for anchors with no matching target', () => {
            document.body.innerHTML = '<a href="#missing">Cite</a>';
            loadMain().initSmoothScrolling();

            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            document.querySelector('a').dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
        });
    });

    describe('validateField', () => {
        const field = (name, value, tag = 'input') =>
            `<div class="form-group"><${tag} name="${name}" value="${value}">${tag === 'textarea' ? value : ''}</${tag}></div>`;

        it.each([
            ['name', 'A', false, 'Name must be at least 2 characters long.'],
            ['name', 'Aydin', true, null],
            ['email', 'nope', false, 'Please enter a valid email address.'],
            ['email', 'a@b.co', true, null],
            ['message', 'too short', false, 'Message must be at least 10 characters long.'],
            ['message', 'a long enough message', true, null]
        ])('validates %s="%s"', (name, value, expected, errorText) => {
            document.body.innerHTML = field(name, value);
            const input = document.querySelector('[name]');
            input.value = value;

            expect(loadMain().validateField(input)).toBe(expected);
            expect(input.classList.contains('error')).toBe(!expected);
            const error = document.querySelector('.field-error');
            expect(error ? error.textContent : null).toBe(errorText);
        });

        it('accepts fields without a validation rule', () => {
            document.body.innerHTML = field('subject', 'anything');

            expect(loadMain().validateField(document.querySelector('[name]'))).toBe(true);
        });

        it('clears a previous error once the value becomes valid', () => {
            document.body.innerHTML = field('name', '');
            const input = document.querySelector('[name]');
            const main = loadMain();

            main.validateField(input);
            expect(document.querySelector('.field-error')).not.toBeNull();

            input.value = 'Aydin';
            main.validateField(input);
            expect(document.querySelector('.field-error')).toBeNull();
            expect(input.classList.contains('error')).toBe(false);
        });
    });

    describe('contact form submission', () => {
        const formMarkup = `
            <form id="contactForm" action="https://formspree.io/f/test">
                <div><input name="name" value="Aydin"></div>
                <div><input name="email" value="a@b.co"></div>
                <div><input type="hidden" name="_replyto" value=""></div>
                <div><textarea name="message">a long enough message</textarea></div>
                <div id="form-status"></div>
                <button type="submit">Send</button>
            </form>
        `;

        beforeEach(() => {
            document.body.innerHTML = formMarkup;
            document.querySelector('textarea').value = 'a long enough message';
        });

        it('blocks submission and reports the first validation failure', async () => {
            document.querySelector('[name="email"]').value = 'bad';
            const main = loadMain();
            global.fetch = jest.fn();
            main.initFormValidation();

            document.getElementById('contactForm').dispatchEvent(
                new Event('submit', { bubbles: true, cancelable: true })
            );

            expect(global.fetch).not.toHaveBeenCalled();
            expect(document.querySelector('#form-status').textContent).toBe('Please fix the errors before submitting.');
        });

        it('posts to the form action, syncs reply-to and reports success', async () => {
            global.fetch = jest.fn().mockResolvedValue({ ok: true });
            const main = loadMain();
            const form = document.getElementById('contactForm');

            main.submitForm(form);
            await Promise.resolve();
            await Promise.resolve();

            expect(global.fetch).toHaveBeenCalledWith('https://formspree.io/f/test', expect.objectContaining({
                method: 'POST',
                headers: { Accept: 'application/json' }
            }));
            expect(document.querySelector('[name="_replyto"]').value).toBe('a@b.co');
            expect(document.querySelector('#form-status').textContent).toContain('Thank you for your message');
            expect(document.querySelector('#form-status').classList.contains('success')).toBe(true);
            expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        });

        it('surfaces server side validation errors', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ errors: [{ message: 'Email is invalid' }] })
            });
            const main = loadMain();

            main.submitForm(document.getElementById('contactForm'));
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(document.querySelector('#form-status').textContent).toBe('Error: Email is invalid');
            expect(document.querySelector('#form-status').classList.contains('error')).toBe(true);
        });

        it('falls back to a generic message when the error body is unreadable', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.reject(new Error('not json'))
            });
            const main = loadMain();

            main.submitForm(document.getElementById('contactForm'));
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(document.querySelector('#form-status').textContent)
                .toBe('There was a problem sending your message. Please try again.');
        });

        it('recovers the button and shows contact details when the network fails', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
            jest.spyOn(console, 'error').mockImplementation(() => {});
            const main = loadMain();
            const form = document.getElementById('contactForm');

            main.submitForm(form);
            await new Promise(resolve => setTimeout(resolve, 0));

            const button = form.querySelector('button[type="submit"]');
            expect(button.disabled).toBe(false);
            expect(button.innerHTML).toBe('Send');
            expect(document.querySelector('#form-status').textContent).toContain('a.ayanzadeh@gmail.com');
        });
    });

    describe('showMessage', () => {
        beforeEach(() => {
            document.body.innerHTML = '<form id="contactForm"><div id="form-status"></div></form>';
        });

        it('keeps only the most recent message and auto-hides it', () => {
            jest.useFakeTimers();
            const main = loadMain();

            main.showErrorMessage('first');
            main.showSuccessMessage('second');

            const form = document.getElementById('contactForm');
            expect(form.querySelectorAll('.error-message, .success-message')).toHaveLength(1);
            expect(form.querySelector('.success-message').textContent).toBe('second');
            expect(document.getElementById('form-status').classList.contains('error')).toBe(false);

            jest.advanceTimersByTime(5300);
            expect(form.querySelector('.success-message')).toBeNull();

            jest.useRealTimers();
        });

        it('announces the message to screen readers when a live region exists', () => {
            const main = loadMain();
            window.announceToScreenReader = jest.fn();

            main.showErrorMessage('boom');

            expect(window.announceToScreenReader).toHaveBeenCalledWith('boom');
        });
    });

    describe('updateActiveNavLink', () => {
        it('moves the active class to the link matching the hash', () => {
            document.body.innerHTML = `
                <a class="top-nav-link active" href="#about"></a>
                <a class="top-nav-link" href="#research"></a>
            `;

            loadMain().updateActiveNavLink('#research');

            const links = document.querySelectorAll('.top-nav-link');
            expect(links[0].classList.contains('active')).toBe(false);
            expect(links[1].classList.contains('active')).toBe(true);
        });

        it('clears the active state when no link matches', () => {
            document.body.innerHTML = '<a class="top-nav-link active" href="#about"></a>';

            loadMain().updateActiveNavLink('#missing');

            expect(document.querySelector('.top-nav-link').classList.contains('active')).toBe(false);
        });
    });

    describe('loading indicators', () => {
        it('toggles the spinner and overlay active classes', () => {
            document.body.innerHTML = `
                <div class="loading-spinner"></div>
                <div id="loadingOverlay"></div>
            `;
            const main = loadMain();

            main.showLoadingSpinner();
            main.showLoadingOverlay();
            expect(document.querySelector('.loading-spinner').classList.contains('active')).toBe(true);
            expect(document.getElementById('loadingOverlay').classList.contains('active')).toBe(true);

            main.hideLoadingSpinner();
            main.hideLoadingOverlay();
            expect(document.querySelector('.loading-spinner').classList.contains('active')).toBe(false);
            expect(document.getElementById('loadingOverlay').classList.contains('active')).toBe(false);
        });

        it('is a no-op when the elements are absent', () => {
            const main = loadMain();

            expect(() => {
                main.showLoadingSpinner();
                main.hideLoadingSpinner();
                main.showLoadingOverlay();
                main.hideLoadingOverlay();
            }).not.toThrow();
        });
    });

    describe('updateLayoutForScreenSize', () => {
        const setWidth = width => {
            Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
        };

        beforeEach(() => {
            document.body.innerHTML = `
                <button class="mobile-menu-toggle active"></button>
                <ul class="top-nav-menu active"></ul>
            `;
            document.body.style.overflow = 'hidden';
        });

        it('closes an open mobile menu once the viewport is desktop sized', () => {
            setWidth(1200);

            loadMain().updateLayoutForScreenSize();

            expect(document.querySelector('.top-nav-menu').classList.contains('active')).toBe(false);
            expect(document.querySelector('.mobile-menu-toggle').classList.contains('active')).toBe(false);
            expect(document.body.style.overflow).toBe('');
        });

        it('leaves the menu open on mobile widths', () => {
            setWidth(480);

            loadMain().updateLayoutForScreenSize();

            expect(document.querySelector('.top-nav-menu').classList.contains('active')).toBe(true);
        });
    });

    describe('detectHighContrastMode', () => {
        it('flags the document when the user prefers high contrast', () => {
            setMatchMedia(query => query === '(prefers-contrast: high)');

            loadMain().detectHighContrastMode();

            expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
        });

        it('leaves the document untouched otherwise', () => {
            setMatchMedia(false);

            loadMain().detectHighContrastMode();

            expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
        });
    });

    describe('announceToScreenReader', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="sr-status"></div>
                <div id="sr-alerts"></div>
            `;
        });

        it('writes to the polite region and clears it afterwards', () => {
            jest.useFakeTimers();

            loadMain().announceToScreenReader('Section entered');

            jest.advanceTimersByTime(100);
            expect(document.getElementById('sr-status').textContent).toBe('Section entered');

            jest.advanceTimersByTime(3000);
            expect(document.getElementById('sr-status').textContent).toBe('');

            jest.useRealTimers();
        });

        it('routes assertive messages to the alerts region', () => {
            jest.useFakeTimers();

            loadMain().announceToScreenReader('Something failed', 'assertive');
            jest.advanceTimersByTime(100);

            expect(document.getElementById('sr-alerts').textContent).toBe('Something failed');
            expect(document.getElementById('sr-status').textContent).toBe('');

            jest.useRealTimers();
        });
    });

    describe('accessibility preferences', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="sr-status"></div>
                <div id="accessibility-menu">
                    <input type="checkbox" id="high-contrast-toggle">
                    <input type="checkbox" id="large-text-toggle">
                </div>
            `;
        });

        it('merges saved preferences instead of overwriting them', () => {
            const main = loadMain();

            main.saveAccessibilityPreference('highContrast', true);
            main.saveAccessibilityPreference('largeText', false);

            expect(JSON.parse(localStorage.getItem('accessibilityPreferences')))
                .toEqual({ highContrast: true, largeText: false });
        });

        it('warns but does not throw when storage is unavailable', () => {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadMain().saveAccessibilityPreference('highContrast', true);

            expect(warn).toHaveBeenCalled();
        });

        it('restores saved toggles and applies their effect on load', () => {
            localStorage.setItem('accessibilityPreferences', JSON.stringify({ highContrast: true, largeText: true }));
            const main = loadMain();
            document.getElementById('high-contrast-toggle')
                .addEventListener('change', () => document.body.classList.add('high-contrast'));

            main.loadAccessibilityPreferences();

            expect(document.getElementById('high-contrast-toggle').checked).toBe(true);
            expect(document.getElementById('large-text-toggle').checked).toBe(true);
            expect(document.body.classList.contains('high-contrast')).toBe(true);
        });

        it('warns on malformed stored preferences', () => {
            localStorage.setItem('accessibilityPreferences', '{not json');
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadMain().loadAccessibilityPreferences();

            expect(warn).toHaveBeenCalled();
        });

        it('unchecks every toggle and clears storage on reset', () => {
            localStorage.setItem('accessibilityPreferences', JSON.stringify({ highContrast: true }));
            document.getElementById('high-contrast-toggle').checked = true;

            loadMain().resetAccessibilitySettings();

            expect(document.getElementById('high-contrast-toggle').checked).toBe(false);
            expect(localStorage.getItem('accessibilityPreferences')).toBeNull();
        });
    });

    describe('getPageReaderText', () => {
        it('joins readable elements and terminates sentences', () => {
            document.body.innerHTML = `
                <main>
                    <h1>Aydin   Ayanzadeh</h1>
                    <p>Researcher.</p>
                    <li>Deep learning</li>
                    <span>ignored</span>
                </main>
            `;

            expect(loadMain().getPageReaderText()).toBe('Aydin Ayanzadeh. Researcher. Deep learning.');
        });

        it('truncates at the last sentence break for very long pages', () => {
            const sentence = `${'word '.repeat(20).trim()}. `;
            document.body.innerHTML = `<main><p>${sentence.repeat(700)}</p></main>`;

            const text = loadMain().getPageReaderText();

            expect(text.length).toBeLessThanOrEqual(12000);
            expect(text.endsWith('.')).toBe(true);
            expect(text.endsWith('...')).toBe(false);
        });

        it('appends an ellipsis when no late sentence break exists', () => {
            document.body.innerHTML = `<main><p>${'a'.repeat(20000)}</p></main>`;

            const text = loadMain().getPageReaderText();

            expect(text.endsWith('...')).toBe(true);
            expect(text.length).toBeLessThanOrEqual(12003);
        });

        it('returns an empty string when there is nothing readable', () => {
            document.body.innerHTML = '<main><span>ignored</span></main>';

            expect(loadMain().getPageReaderText()).toBe('');
        });
    });

    describe('page reader', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="sr-status"></div>
                <div id="sr-alerts"></div>
                <button id="start-reading-btn">Read this page aloud</button>
                <button id="stop-reading-btn" disabled>Stop reading</button>
                <main><p>Readable content.</p></main>
            `;
            window.speechSynthesis = {
                speak: jest.fn(),
                cancel: jest.fn(),
                speaking: false
            };
            window.SpeechSynthesisUtterance = function SpeechSynthesisUtteranceMock(text) {
                this.text = text;
            };
        });

        afterEach(() => {
            delete window.speechSynthesis;
            delete window.SpeechSynthesisUtterance;
            delete window.activeReaderUtterance;
        });

        it('speaks the page and swaps the button states', () => {
            loadMain().startPageReader();

            expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
            expect(window.speechSynthesis.speak.mock.calls[0][0].text).toBe('Readable content.');
            expect(document.getElementById('start-reading-btn').disabled).toBe(true);
            expect(document.getElementById('stop-reading-btn').disabled).toBe(false);
        });

        it('re-enables the start button after the utterance ends', () => {
            loadMain().startPageReader();

            window.speechSynthesis.speak.mock.calls[0][0].onend();

            expect(document.getElementById('start-reading-btn').disabled).toBe(false);
            expect(document.getElementById('stop-reading-btn').disabled).toBe(true);
        });

        it('resets the buttons and warns when speech fails', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            loadMain().startPageReader();

            window.speechSynthesis.speak.mock.calls[0][0].onerror({ error: 'synthesis-failed' });

            expect(warn).toHaveBeenCalled();
            expect(document.getElementById('start-reading-btn').disabled).toBe(false);
        });

        it('does nothing but announce when there is no readable content', () => {
            document.querySelector('main').remove();
            document.body.insertAdjacentHTML('beforeend', '<main></main>');

            loadMain().startPageReader();

            expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
        });

        it('cancels an in-flight utterance when stopped', () => {
            const main = loadMain();
            main.startPageReader();
            window.speechSynthesis.speaking = true;

            main.stopPageReader();

            expect(window.speechSynthesis.cancel).toHaveBeenCalled();
            expect(window.activeReaderUtterance).toBeNull();
            expect(document.getElementById('stop-reading-btn').disabled).toBe(true);
        });
    });

    describe('citation clipboard', () => {
        const citation = 'Ayanzadeh, A. (2024).';

        const setClipboard = writeText => {
            Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        };

        const setSecureContext = value => {
            Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
        };

        it('uses the clipboard API in a secure context and notifies on success', async () => {
            jest.useFakeTimers();
            const writeText = jest.fn().mockResolvedValue(undefined);
            setClipboard(writeText);
            setSecureContext(true);

            loadMain().copyToClipboard(citation);
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith(citation);
            jest.advanceTimersByTime(10);
            const notification = document.querySelector('.citation-notification');
            expect(notification.textContent).toContain('Citation copied to clipboard!');
            expect(notification.classList.contains('show')).toBe(true);

            jest.useRealTimers();
        });

        it('falls back to execCommand outside a secure context', () => {
            setSecureContext(false);
            document.execCommand = jest.fn().mockReturnValue(true);

            loadMain().copyToClipboard(citation);

            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(document.querySelector('textarea')).toBeNull();
            expect(document.querySelector('.citation-notification').textContent)
                .toContain('Citation copied to clipboard!');
        });

        it('reports an error notification when the fallback copy fails', () => {
            document.execCommand = jest.fn().mockReturnValue(false);

            loadMain().fallbackCopyTextToClipboard(citation);

            const notification = document.querySelector('.citation-notification');
            expect(notification.className).toContain('error');
            expect(notification.textContent).toContain('Failed to copy citation');
        });

        it('reports an error notification when execCommand throws', () => {
            document.execCommand = jest.fn().mockImplementation(() => {
                throw new Error('unsupported');
            });

            loadMain().fallbackCopyTextToClipboard(citation);

            expect(document.querySelector('.citation-notification').className).toContain('error');
        });

        it('keeps a single notification on screen and removes it after three seconds', () => {
            jest.useFakeTimers();
            const main = loadMain();

            main.showCitationNotification('first');
            main.showCitationNotification('second');

            expect(document.querySelectorAll('.citation-notification')).toHaveLength(1);

            jest.advanceTimersByTime(3300);
            expect(document.querySelector('.citation-notification')).toBeNull();

            jest.useRealTimers();
        });
    });
});
