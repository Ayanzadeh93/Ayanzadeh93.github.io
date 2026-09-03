/**
 * Small DOM and platform helpers shared by the site's Web Components.
 * Each helper degrades gracefully when a newer API is unavailable.
 */

export function debounce(callback, wait = 180) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), wait);
    };
}

export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || document.body.classList.contains('reduce-motion');
}

/**
 * Run `update` inside a View Transition so filtering and sorting cross-fade
 * instead of snapping. Falls back to a plain call where the API is missing or
 * the visitor asked for reduced motion.
 */
export function withViewTransition(update) {
    if (!document.startViewTransition || prefersReducedMotion()) {
        update();
        return;
    }

    document.startViewTransition(update);
}

/** Copy `text`, falling back to a hidden textarea on insecure origins. */
export async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Permission denied or a non-focused document — try the fallback.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.append(textarea);
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }

    textarea.remove();
    return copied;
}

/** Trigger a client-side file download from an in-memory string. */
export function downloadText(filename, text, mime = 'text/plain') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();

    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Announce `message` through the site-wide polite live region. */
export function announce(message) {
    const region = document.getElementById('sr-status');
    if (!region) return;

    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 60);
}

/** Body classes set by the site's accessibility menu that components must honour. */
const ACCESSIBILITY_FLAGS = ['high-contrast', 'large-text', 'dyslexia-font', 'reduce-motion', 'enhanced-focus'];

/**
 * Mirror the accessibility menu's body classes onto `host`.
 *
 * Descendant selectors such as `body.large-text .card` cannot cross a shadow
 * boundary, so shadow-DOM components copy the flags onto their own host and
 * style against `:host(.large-text)` instead.
 */
export function mirrorAccessibilityFlags(host) {
    const sync = () => {
        for (const flag of ACCESSIBILITY_FLAGS) {
            host.classList.toggle(flag, document.body.classList.contains(flag));
        }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return observer;
}

/** Apply `css` to a shadow root, preferring constructable stylesheets. */
export function adoptStyles(shadowRoot, css) {
    if ('adoptedStyleSheets' in Document.prototype && 'replaceSync' in CSSStyleSheet.prototype) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
        return;
    }

    const style = document.createElement('style');
    style.textContent = css;
    shadowRoot.prepend(style);
}

/**
 * Build an element in one call.
 * `children` accepts nodes or strings; strings become text nodes, so nothing
 * here can inject markup.
 */
export function el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);

    for (const [name, value] of Object.entries(attributes)) {
        if (value === false || value === null || value === undefined) continue;
        if (name === 'class') node.className = value;
        else if (name === 'text') node.textContent = value;
        else if (name === 'dataset') Object.assign(node.dataset, value);
        else if (name.startsWith('on') && typeof value === 'function') {
            node.addEventListener(name.slice(2).toLowerCase(), value);
        } else node.setAttribute(name, value === true ? '' : value);
    }

    node.append(...[children].flat().filter((child) => child !== null && child !== undefined));
    return node;
}

/**
 * Inline SVG icon. Font Awesome is loaded lazily via `media="print"`, which
 * makes icon glyphs pop in late; inline paths render with the first frame and
 * work inside a shadow root where the Font Awesome classes do not reach.
 */
const ICON_PATHS = {
    search: 'M10 2a8 8 0 105.29 14.03l4.84 4.84a1 1 0 001.42-1.42l-4.84-4.84A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z',
    quote: 'M7.5 5A4.5 4.5 0 003 9.5c0 2.2 1.6 4 3.7 4.4-.2 1.6-1.3 2.7-2.6 3.1a.75.75 0 00.4 1.4c3-.7 5.5-3.3 5.5-7.4V9.5A4.5 4.5 0 007.5 5zm10 0A4.5 4.5 0 0013 9.5c0 2.2 1.6 4 3.7 4.4-.2 1.6-1.3 2.7-2.6 3.1a.75.75 0 00.4 1.4c3-.7 5.5-3.3 5.5-7.4V9.5A4.5 4.5 0 0017.5 5z',
    external: 'M14 3a1 1 0 000 2h3.59l-8.3 8.29a1 1 0 001.42 1.42L19 6.41V10a1 1 0 002 0V4a1 1 0 00-1-1h-6zM5 5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5a1 1 0 10-2 0v5H5V7h5a1 1 0 000-2H5z',
    code: 'M9.4 4.6a1 1 0 00-1.8-.9l-5 9a1 1 0 000 1l5 9a1 1 0 001.8-1L4.9 13.2 9.4 5.1zm5.2-.9a1 1 0 00-1.8 1l4.4 8-4.4 8a1 1 0 001.8 1l5-9a1 1 0 000-1l-5-8z',
    doi: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 016.32 3.1c-.9.5-2 .9-3.2 1.2A13 13 0 0012 4zm-1.6.3A11 11 0 0113 8.7a20 20 0 01-6 0 11 11 0 013.4-4.4zM5.7 7.1c1 .5 2.1.9 3.4 1.2A13 13 0 0012 4a8 8 0 00-6.3 3.1zM4.3 9a19 19 0 004.3 1.6 22 22 0 000 2.8A19 19 0 004.3 15a8 8 0 010-6zm1.4 7.9A8 8 0 0012 20a13 13 0 01-2.9-4.3c-1.3.3-2.4.7-3.4 1.2zM12 20a8 8 0 006.3-3.1c-1-.5-2.1-.9-3.2-1.2A13 13 0 0112 20zm7.7-5a19 19 0 00-4.3-1.6 22 22 0 000-2.8A19 19 0 0019.7 9a8 8 0 010 6zm-8.7-1.6a20 20 0 010-2.8 22 22 0 013 0 20 20 0 010 2.8 22 22 0 01-3 0z',
    download: 'M12 3a1 1 0 011 1v9.59l3.3-3.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 111.4-1.42l3.3 3.3V4a1 1 0 011-1zM4 18a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1z',
    copy: 'M9 2a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6.41A2 2 0 0018.41 5L16 2.59A2 2 0 0014.59 2H9zm0 2h5v3a1 1 0 001 1h3v6H9V4zM5 7a1 1 0 011 1v11h9a1 1 0 010 2H6a2 2 0 01-2-2V8a1 1 0 011-1z',
    check: 'M20.3 5.7a1 1 0 010 1.4l-10 10a1 1 0 01-1.4 0l-5-5a1 1 0 011.4-1.4l4.3 4.29 9.3-9.3a1 1 0 011.4 0z',
    close: 'M6.7 5.3a1 1 0 00-1.4 1.4l5.29 5.3-5.3 5.3a1 1 0 101.42 1.4l5.29-5.29 5.3 5.3a1 1 0 001.4-1.42L13.41 12l5.3-5.3a1 1 0 00-1.42-1.4L12 10.59l-5.3-5.3z',
    reset: 'M12 4a8 8 0 106.93 4 1 1 0 10-1.73 1A6 6 0 1112 6v2.5a.5.5 0 00.8.4l4-3a.5.5 0 000-.8l-4-3a.5.5 0 00-.8.4V4z',
};

export function icon(name, { size = 16, className = 'pub-icon' } = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('class', className);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.external);
    svg.append(path);

    return svg;
}
