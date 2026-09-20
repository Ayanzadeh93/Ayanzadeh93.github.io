/**
 * dom.js — small, dependency-free DOM helpers shared by the custom elements.
 *
 * Everything here builds real nodes instead of HTML strings. That keeps user
 * input out of any parser and means the site never needs to widen its CSP.
 */

/**
 * Create an element with attributes and children in one call.
 *
 * Attribute keys are applied as follows:
 *   - `class`, `id`, `type`, ... : set as attributes
 *   - `dataset`                  : merged into element.dataset
 *   - `on<Event>`                : added as an event listener (onClick -> 'click')
 *   - anything else              : setAttribute, so ARIA works without special cases
 *
 * Children may be nodes, strings (inserted as text), or nested arrays. null and
 * undefined are skipped so callers can write `cond && el(...)` inline.
 *
 * @param {string} tag
 * @param {Object<string, any>} [attrs]
 * @param {...(Node|string|number|null|undefined|Array)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'dataset') {
            Object.assign(node.dataset, value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(node.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) {
            node.setAttribute(key, '');
        } else {
            node.setAttribute(key, String(value));
        }
    }

    appendChildren(node, children);
    return node;
}

/** Append a possibly nested list of nodes/strings to a parent. */
export function appendChildren(parent, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        parent.append(child instanceof Node ? child : String(child));
    }
}

/** Remove every child of a node without touching innerHTML. */
export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Escape text for the rare case a string genuinely has to be interpolated.
 * Mirrors the global `escapeHtml` in main.js so both scripts agree.
 */
export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Trailing-edge debounce; used to keep keystroke handlers off the hot path. */
export function debounce(fn, wait = 150) {
    let timer = null;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/** True when the visitor has asked the OS to reduce motion. */
export function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Run a DOM mutation inside a View Transition when the browser supports it,
 * so list re-ordering cross-fades instead of snapping. Falls back to calling
 * the function directly — the result is identical, just without the animation.
 *
 * @param {() => void} mutate
 * @param {string} [name] optional transition class for scoped styling
 */
export function withViewTransition(mutate, name) {
    if (!document.startViewTransition || prefersReducedMotion()) {
        mutate();
        return Promise.resolve();
    }

    if (name) document.documentElement.dataset.viewTransition = name;

    const transition = document.startViewTransition(mutate);
    return transition.finished
        .catch(() => { /* a superseded transition is not an error */ })
        .finally(() => {
            if (name) delete document.documentElement.dataset.viewTransition;
        });
}

/**
 * Copy text to the clipboard, falling back to a hidden textarea on browsers
 * or contexts where the async Clipboard API is unavailable (e.g. plain http).
 *
 * @returns {Promise<boolean>} whether the copy succeeded
 */
export async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Permission denied or a non-focused document: fall through.
        }
    }

    const textarea = el('textarea', {
        'aria-hidden': 'true',
        style: { position: 'fixed', top: '-9999px', left: '-9999px', opacity: '0' }
    });
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (error) {
        copied = false;
    }

    textarea.remove();
    return copied;
}
