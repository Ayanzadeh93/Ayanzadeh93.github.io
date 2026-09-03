/**
 * `<cite-dialog>` — export a publication (or a whole reference list) in the
 * formats an academic workflow needs.
 *
 * Built on the native `<dialog>` element, so modality, focus trapping, the
 * Escape key and `::backdrop` come from the platform instead of hand-rolled
 * key handlers. Styles live in a constructable stylesheet adopted by the shadow
 * root, which keeps the widget isolated from the 6k-line global stylesheet
 * while still inheriting the site's design tokens through `var()`.
 */

import { CITATION_FORMATS, formatCollection, getCitationFormat } from '../lib/citations.js';
import { adoptStyles, announce, copyText, downloadText, el, icon, mirrorAccessibilityFlags } from '../lib/dom.js';

const FORMAT_STORAGE_KEY = 'preferredCitationFormat';

const STYLES = `
    :host {
        --cite-radius: 16px;
        --cite-surface: var(--background-white, #fff);
        --cite-border: var(--border-color, #e2e8f0);
        --cite-text: var(--text-dark, #0f172a);
        --cite-muted: var(--text-light, #64748b);
        --cite-accent: var(--primary-color, #2563eb);
        --cite-accent-soft: color-mix(in srgb, var(--cite-accent) 12%, transparent);
        font-family: inherit;
    }

    dialog {
        width: min(680px, calc(100vw - 2rem));
        max-height: min(80vh, 720px);
        padding: 0;
        border: 1px solid var(--cite-border);
        border-radius: var(--cite-radius);
        background: var(--cite-surface);
        color: var(--cite-text);
        box-shadow: 0 24px 60px -12px rgb(15 23 42 / 35%);
        overflow: hidden;
    }

    dialog::backdrop {
        background: rgb(15 23 42 / 55%);
        backdrop-filter: blur(3px);
    }

    /* Fade + lift on open, including the backdrop, via discrete transitions. */
    dialog,
    dialog::backdrop {
        transition: opacity 220ms ease, translate 220ms ease, overlay 220ms allow-discrete, display 220ms allow-discrete;
        opacity: 0;
    }

    dialog[open],
    dialog[open]::backdrop { opacity: 1; }
    dialog { translate: 0 8px; }
    dialog[open] { translate: 0 0; }

    @starting-style {
        dialog[open],
        dialog[open]::backdrop { opacity: 0; }
        dialog[open] { translate: 0 8px; }
    }

    .layout {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        max-height: inherit;
    }

    header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        padding: 20px 22px 14px;
        border-bottom: 1px solid var(--cite-border);
    }

    h2 {
        margin: 0 0 4px;
        font-size: 1.05rem;
        font-weight: 600;
        letter-spacing: -0.01em;
    }

    .subject {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.45;
        color: var(--cite-muted);
        text-wrap: pretty;
    }

    .close {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        color: var(--cite-muted);
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease;
    }

    .close:hover { background: var(--cite-accent-soft); color: var(--cite-accent); }

    [role="tablist"] {
        display: flex;
        gap: 4px;
        padding: 12px 22px 0;
        overflow-x: auto;
        scrollbar-width: none;
    }

    [role="tablist"]::-webkit-scrollbar { display: none; }

    [role="tab"] {
        flex: 0 0 auto;
        padding: 8px 14px;
        border: 0;
        border-bottom: 2px solid transparent;
        background: none;
        color: var(--cite-muted);
        font: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: color 160ms ease, border-color 160ms ease;
    }

    [role="tab"]:hover { color: var(--cite-text); }

    [role="tab"][aria-selected="true"] {
        color: var(--cite-accent);
        border-bottom-color: var(--cite-accent);
    }

    .panel { padding: 16px 22px; overflow: auto; }

    pre {
        margin: 0;
        padding: 16px;
        border: 1px solid var(--cite-border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--cite-accent) 4%, var(--cite-surface));
        color: var(--cite-text);
        font-family: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
        font-size: 0.82rem;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        tab-size: 2;
    }

    pre.prose {
        font-family: inherit;
        font-size: 0.9rem;
        line-height: 1.7;
    }

    footer {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 14px 22px 20px;
        border-top: 1px solid var(--cite-border);
    }

    button.action {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 16px;
        border: 1px solid var(--cite-border);
        border-radius: 10px;
        background: var(--cite-surface);
        color: var(--cite-text);
        font: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    button.action:hover { border-color: var(--cite-accent); color: var(--cite-accent); }

    button.action.primary {
        border-color: transparent;
        background: var(--cite-accent);
        color: #fff;
    }

    button.action.primary:hover { background: var(--primary-dark, #1d4ed8); color: #fff; }
    button.action.is-done { border-color: #16a34a; color: #16a34a; background: color-mix(in srgb, #16a34a 10%, transparent); }
    button.action.primary.is-done { background: #16a34a; color: #fff; }

    :focus-visible { outline: 2px solid var(--cite-accent); outline-offset: 2px; }

    :host(.large-text) { font-size: 1.1rem; }
    :host(.dyslexia-font) dialog { font-family: "Comic Sans MS", "OpenDyslexic", cursive; }
    :host(.high-contrast) dialog { border-width: 2px; border-color: currentColor; }
    :host(.high-contrast) pre { border-width: 2px; }

    @media (prefers-reduced-motion: reduce) {
        dialog, dialog::backdrop { transition-duration: 1ms; }
    }

    :host(.reduce-motion) dialog,
    :host(.reduce-motion) dialog::backdrop { transition-duration: 1ms; }
`;

class CiteDialog extends HTMLElement {
    #dialog;
    #titleEl;
    #subjectEl;
    #tablist;
    #output;
    #copyButton;
    #downloadButton;
    #copyResetTimer;

    /** @type {{ heading: string, subject: string, publications: object[], filename: string }|null} */
    #request = null;

    #formatId = CITATION_FORMATS[0].id;

    connectedCallback() {
        if (this.#dialog) return;

        const shadow = this.attachShadow({ mode: 'open' });
        adoptStyles(shadow, STYLES);
        mirrorAccessibilityFlags(this);

        this.#formatId = this.#readStoredFormat();
        shadow.append(this.#build());
    }

    #readStoredFormat() {
        try {
            const stored = localStorage.getItem(FORMAT_STORAGE_KEY);
            if (stored && CITATION_FORMATS.some((entry) => entry.id === stored)) return stored;
        } catch {
            // Private mode or blocked storage — fall through to the default.
        }
        return CITATION_FORMATS[0].id;
    }

    #storeFormat(id) {
        try {
            localStorage.setItem(FORMAT_STORAGE_KEY, id);
        } catch {
            // Preference is a nicety; ignore storage failures.
        }
    }

    #build() {
        this.#titleEl = el('h2', { id: 'cite-heading', text: 'Cite this publication' });
        this.#subjectEl = el('p', { class: 'subject' });

        const close = el('button', {
            type: 'button',
            class: 'close',
            'aria-label': 'Close citation dialog',
            onclick: () => this.close(),
        }, icon('close', { size: 18 }));

        this.#tablist = el('div', { role: 'tablist', 'aria-label': 'Citation format' });
        this.#tablist.addEventListener('keydown', (event) => this.#onTablistKeydown(event));

        for (const entry of CITATION_FORMATS) {
            this.#tablist.append(el('button', {
                type: 'button',
                role: 'tab',
                id: `cite-tab-${entry.id}`,
                'aria-controls': 'cite-panel',
                'aria-selected': 'false',
                tabindex: '-1',
                dataset: { format: entry.id },
                text: entry.label,
                onclick: () => this.#selectFormat(entry.id),
            }));
        }

        this.#output = el('pre', { tabindex: '0' });

        this.#copyButton = el('button', {
            type: 'button',
            class: 'action primary',
            onclick: () => this.#copy(),
        }, [icon('copy'), el('span', { text: 'Copy' })]);

        this.#downloadButton = el('button', {
            type: 'button',
            class: 'action',
            onclick: () => this.#download(),
        }, [icon('download'), el('span', { text: 'Download' })]);

        this.#dialog = el('dialog', { 'aria-labelledby': 'cite-heading' }, el('div', { class: 'layout' }, [
            el('header', {}, [el('div', {}, [this.#titleEl, this.#subjectEl]), close]),
            this.#tablist,
            el('div', {
                class: 'panel',
                id: 'cite-panel',
                role: 'tabpanel',
                tabindex: '0',
            }, this.#output),
            el('footer', {}, [this.#copyButton, this.#downloadButton]),
        ]));

        // Clicking the backdrop (i.e. the dialog element itself) dismisses.
        this.#dialog.addEventListener('click', (event) => {
            if (event.target === this.#dialog) this.close();
        });

        this.#dialog.addEventListener('close', () => {
            this.dispatchEvent(new CustomEvent('cite-dialog-close', { bubbles: true }));
        });

        return this.#dialog;
    }

    /**
     * Show the dialog.
     *
     * @param {object} request
     * @param {object[]} request.publications one or more publication records
     * @param {string} [request.heading]
     * @param {string} [request.subject] secondary line under the heading
     * @param {string} [request.filename] download name without extension
     */
    open(request) {
        if (!this.#dialog) this.connectedCallback();

        this.#request = {
            heading: request.publications.length > 1 ? 'Export reference list' : 'Cite this publication',
            subject: '',
            filename: 'citation',
            ...request,
        };

        this.#titleEl.textContent = this.#request.heading;
        this.#subjectEl.textContent = this.#request.subject;
        this.#subjectEl.hidden = !this.#request.subject;

        this.#selectFormat(this.#formatId, { store: false });

        if (typeof this.#dialog.showModal === 'function') this.#dialog.showModal();
        else this.#dialog.setAttribute('open', '');

        this.#tablist.querySelector('[aria-selected="true"]')?.focus();
    }

    close() {
        if (typeof this.#dialog?.close === 'function') this.#dialog.close();
        else this.#dialog?.removeAttribute('open');
    }

    #selectFormat(id, { store = true } = {}) {
        this.#formatId = id;
        if (store) this.#storeFormat(id);

        for (const tab of this.#tablist.querySelectorAll('[role="tab"]')) {
            const selected = tab.dataset.format === id;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }

        const entry = getCitationFormat(id);
        this.#output.classList.toggle('prose', !entry.mono);
        this.#output.setAttribute('aria-label', `${entry.label} citation`);
        this.#output.textContent = this.#currentText();

        const label = this.#downloadButton.querySelector('span');
        label.textContent = `Download .${entry.extension}`;

        this.#resetButtonStates();
    }

    #onTablistKeydown(event) {
        const tabs = [...this.#tablist.querySelectorAll('[role="tab"]')];
        const current = tabs.findIndex((tab) => tab.dataset.format === this.#formatId);

        const moves = {
            ArrowRight: current + 1,
            ArrowLeft: current - 1,
            Home: 0,
            End: tabs.length - 1,
        };

        if (!(event.key in moves)) return;

        event.preventDefault();
        const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
        this.#selectFormat(next.dataset.format);
        next.focus();
    }

    #currentText() {
        if (!this.#request) return '';
        return formatCollection(this.#request.publications, this.#formatId);
    }

    async #copy() {
        const copied = await copyText(this.#currentText());
        const label = this.#copyButton.querySelector('span');

        this.#copyButton.classList.toggle('is-done', copied);
        label.textContent = copied ? 'Copied' : 'Press Ctrl+C';
        this.#copyButton.replaceChild(icon(copied ? 'check' : 'copy'), this.#copyButton.firstElementChild);

        announce(copied ? 'Citation copied to clipboard' : 'Copy failed — select the text and press Control C');

        if (!copied) this.#output.focus();

        clearTimeout(this.#copyResetTimer);
        this.#copyResetTimer = setTimeout(() => this.#resetButtonStates(), 2200);
    }

    #download() {
        const entry = getCitationFormat(this.#formatId);
        const name = `${this.#request?.filename || 'citation'}.${entry.extension}`;

        downloadText(name, this.#currentText(), entry.mime);
        announce(`Downloading ${name}`);
    }

    #resetButtonStates() {
        clearTimeout(this.#copyResetTimer);
        this.#copyButton.classList.remove('is-done');
        this.#copyButton.querySelector('span').textContent = 'Copy';
        this.#copyButton.replaceChild(icon('copy'), this.#copyButton.firstElementChild);
    }
}

customElements.define('cite-dialog', CiteDialog);

/** Lazily create the single dialog instance the page shares. */
export function getCiteDialog() {
    let dialog = document.querySelector('cite-dialog');

    if (!dialog) {
        dialog = document.createElement('cite-dialog');
        document.body.append(dialog);
    }

    return dialog;
}
