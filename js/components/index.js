/**
 * Entry point for the site's custom elements.
 *
 * Loaded as <script type="module">, which is deferred by default and ignored
 * by browsers without module support — so the enhanced widgets simply do not
 * appear on those, and the underlying HTML is still complete and readable.
 */

import './cite-dialog.js';
import './pub-explorer.js';

// Lets CSS style only what is actually enhanced (see css/components.css).
document.documentElement.classList.add('components-enabled');
