/**
 * <cite-dialog> — a citation exporter built on the native <dialog> element.
 *
 * One instance lives on the page; publication cards open it with a record.
 * Using showModal() rather than a hand-rolled overlay means the focus trap,
 * Escape-to-close, inertness of the page behind, and the ::backdrop all come
 * from the platform instead of from code we would have to maintain.
 *
 * Usage:
 *   document.querySelector('cite-dialog').open(record);
 */

import { el, copyText } from '../lib/dom.js';
import { CITATION_FORMATS, formatCitation, bibKey, canonicalUrl } from '../lib/citations.js';

const STORAGE_KEY = 'cite-format';

export class CiteDialog extends HTMLElement {
    #dialog = null;
    #record = null;
    #activeFormat = CITATION_FORMATS[0].id;
    #output = null;
    #tabs = new Map();
    #status = null;
    #titleEl = null;
    #copyButton = null;
    #downloadButton = null;
    #sourceLink = null;

    connectedCallback() {
        if (this.#dialog) return;

        // Remember the reader's preferred style between papers and visits.
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && CITATION_FORMATS.some((entry) => entry.id === saved)) {
                this.#activeFormat = saved;
            }
        } catch (error) { /* storage unavailable; the default is fine */ }

        this.#build();
    }

    #build() {
        this.#titleEl = el('h2', { class: 'cite-dialog__title', id: 'cite-dialog-title' }, 'Cite this publication');

        const tabList = el('div', {
            class: 'cite-dialog__tabs',
            role: 'tablist',
            'aria-label': 'Citation format'
        });

        for (const entry of CITATION_FORMATS) {
            const tab = el('button', {
                type: 'button',
                class: 'cite-dialog__tab',
                role: 'tab',
                id: `cite-tab-${entry.id}`,
                'aria-controls': 'cite-dialog-output',
                'aria-selected': String(entry.id === this.#activeFormat),
                tabindex: entry.id === this.#activeFormat ? '0' : '-1',
                dataset: { format: entry.id },
                onClick: () => this.#selectFormat(entry.id),
                onKeydown: (event) => this.#onTabKeydown(event, entry.id)
            }, entry.label);

            this.#tabs.set(entry.id, tab);
            tabList.append(tab);
        }

        this.#output = el('pre', {
            class: 'cite-dialog__output',
            id: 'cite-dialog-output',
            role: 'tabpanel',
            tabindex: '0',
            'aria-labelledby': `cite-tab-${this.#activeFormat}`
        });

        this.#copyButton = el('button', {
            type: 'button',
            class: 'cite-dialog__action cite-dialog__action--primary',
            onClick: () => this.#copy()
        }, el('i', { class: 'fas fa-copy', 'aria-hidden': 'true' }), ' Copy');

        this.#downloadButton = el('button', {
            type: 'button',
            class: 'cite-dialog__action',
            onClick: () => this.#downloadBib()
        }, el('i', { class: 'fas fa-download', 'aria-hidden': 'true' }), ' Download .bib');

        this.#sourceLink = el('a', {
            class: 'cite-dialog__action',
            target: '_blank',
            rel: 'noopener noreferrer',
            hidden: true
        }, el('i', { class: 'fas fa-external-link-alt', 'aria-hidden': 'true' }), ' View source');

        this.#status = el('p', {
            class: 'cite-dialog__status',
            role: 'status',
            'aria-live': 'polite'
        });

        const closeButton = el('button', {
            type: 'button',
            class: 'cite-dialog__close',
            'aria-label': 'Close citation dialog',
            onClick: () => this.close()
        }, el('i', { class: 'fas fa-times', 'aria-hidden': 'true' }));

        this.#dialog = el('dialog', {
            class: 'cite-dialog',
            'aria-labelledby': 'cite-dialog-title'
        },
            el('div', { class: 'cite-dialog__header' }, this.#titleEl, closeButton),
            tabList,
            this.#output,
            el('div', { class: 'cite-dialog__actions' },
                this.#copyButton, this.#downloadButton, this.#sourceLink),
            this.#status
        );

        // Clicking the backdrop closes: the dialog box itself covers the
        // element's own box, so a click landing on <dialog> is outside it.
        this.#dialog.addEventListener('click', (event) => {
            if (event.target === this.#dialog) this.close();
        });

        this.#dialog.addEventListener('close', () => {
            this.#status.textContent = '';
        });

        this.append(this.#dialog);
    }

    /** Roving tabindex so arrow keys move between formats, per WAI-ARIA. */
    #onTabKeydown(event, formatId) {
        const ids = CITATION_FORMATS.map((entry) => entry.id);
        const current = ids.indexOf(formatId);
        let next = null;

        if (event.key === 'ArrowRight') next = (current + 1) % ids.length;
        else if (event.key === 'ArrowLeft') next = (current - 1 + ids.length) % ids.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = ids.length - 1;
        else return;

        event.preventDefault();
        this.#selectFormat(ids[next]);
        this.#tabs.get(ids[next]).focus();
    }

    #selectFormat(formatId) {
        this.#activeFormat = formatId;

        for (const [id, tab] of this.#tabs) {
            const selected = id === formatId;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }

        this.#output.setAttribute('aria-labelledby', `cite-tab-${formatId}`);
        this.#render();

        try {
            localStorage.setItem(STORAGE_KEY, formatId);
        } catch (error) { /* non-fatal */ }
    }

    #render() {
        if (!this.#record) return;

        const entry = CITATION_FORMATS.find((item) => item.id === this.#activeFormat);
        this.#output.classList.toggle('cite-dialog__output--mono', Boolean(entry && entry.mono));
        this.#output.textContent = formatCitation(this.#record, this.#activeFormat);
        this.#downloadButton.hidden = this.#activeFormat !== 'bibtex';
    }

    /**
     * Open the dialog for one publication record.
     * @param {Object} record see js/lib/citations.js for the shape
     */
    open(record) {
        if (!this.#dialog) this.#build();

        this.#record = record;
        this.#titleEl.textContent = record.title || 'Cite this publication';

        const source = canonicalUrl(record);
        this.#sourceLink.hidden = !source;
        if (source) this.#sourceLink.href = source;

        this.#status.textContent = '';
        this.#render();

        if (typeof this.#dialog.showModal === 'function') {
            this.#dialog.showModal();
        } else {
            // Very old browsers: degrade to an always-visible panel rather
            // than trapping the reader with no way to see the citation.
            this.#dialog.setAttribute('open', '');
        }

        this.#tabs.get(this.#activeFormat).focus();
    }

    close() {
        if (!this.#dialog) return;
        if (typeof this.#dialog.close === 'function') this.#dialog.close();
        else this.#dialog.removeAttribute('open');
    }

    async #copy() {
        const text = this.#output.textContent;
        const label = CITATION_FORMATS.find((entry) => entry.id === this.#activeFormat).label;
        const copied = await copyText(text);

        // #status is role="status" aria-live="polite", so setting its text is
        // the announcement; a second live region would say everything twice.
        this.#status.textContent = copied
            ? `${label} citation copied to clipboard.`
            : 'Copy failed — select the text above and copy manually.';
        this.#status.classList.toggle('cite-dialog__status--error', !copied);
    }

    /**
     * Offer the BibTeX entry as a .bib file. Object URLs are same-origin blobs,
     * so this needs no CSP change and no network round trip.
     */
    #downloadBib() {
        const blob = new Blob([formatCitation(this.#record, 'bibtex')], {
            type: 'application/x-bibtex;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);

        const link = el('a', { href: url, download: `${bibKey(this.#record)}.bib` });
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
        this.#status.textContent = 'BibTeX file downloaded.';
        this.#status.classList.remove('cite-dialog__status--error');
    }
}

if (!customElements.get('cite-dialog')) {
    customElements.define('cite-dialog', CiteDialog);
}
