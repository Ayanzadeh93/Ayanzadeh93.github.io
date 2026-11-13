/**
 * Entry point for the site's custom elements.
 *
 * Loaded as <script type="module">, which is deferred by default and ignored
 * by browsers without module support — so the enhanced widgets simply do not
 * appear on those, and the underlying HTML is still complete and readable.
 */

import './cite-dialog.js';
import './pub-library.js';
import { publicationRecords } from '../lib/pub-data.js';

/**
 * Cite buttons ship as <button data-cite="<publication id>" hidden>, so a
 * reader without JavaScript never sees a control that does nothing. Reveal
 * each one whose record is on the page and wire it to the shared dialog.
 */
function bindCiteButtons() {
    const records = publicationRecords();

    for (const button of document.querySelectorAll('[data-cite]')) {
        const record = records[button.dataset.cite];
        if (!record) continue;

        button.hidden = false;
        // A dozen buttons all called "Cite" are indistinguishable in a screen
        // reader's element list; name each one by its paper.
        button.setAttribute('aria-label', `Cite: ${record.title}`);
        button.addEventListener('click', () => {
            const dialog = document.querySelector('cite-dialog');
            if (dialog && typeof dialog.open === 'function') dialog.open(record);
        });
    }
}

bindCiteButtons();

// Lets CSS style only what is actually enhanced.
document.documentElement.classList.add('components-enabled');
