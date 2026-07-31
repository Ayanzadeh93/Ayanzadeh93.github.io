// Shared helpers used by main.js and blog.js.
// Exposed as window.SiteUtils so pages can keep loading plain scripts.

(function (global) {
    'use strict';

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function isValidEmail(value) {
        return EMAIL_PATTERN.test(String(value).trim());
    }

    // Storage --------------------------------------------------------------
    function readStoredValue(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStoredValue(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function removeStoredValue(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    }

    function readStoredJSON(key, fallback) {
        const raw = readStoredValue(key);
        if (raw === null) return fallback;

        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function writeStoredJSON(key, value) {
        return writeStoredValue(key, JSON.stringify(value));
    }

    // Screen reader announcements -----------------------------------------
    function getLiveRegion(priority) {
        const id = priority === 'assertive' ? 'sr-alerts' : 'sr-status';
        let region = document.getElementById(id);

        if (!region) {
            region = document.createElement('div');
            region.id = id;
            region.className = 'sr-only';
            region.setAttribute('aria-live', priority === 'assertive' ? 'assertive' : 'polite');
            region.setAttribute('aria-atomic', 'true');
            document.body.appendChild(region);
        }

        return region;
    }

    function announce(message, priority = 'polite') {
        const region = getLiveRegion(priority);
        region.textContent = '';

        // Re-setting the text after a tick makes repeated messages announce again.
        setTimeout(() => {
            region.textContent = message;
        }, 100);

        setTimeout(() => {
            region.textContent = '';
        }, 3000);
    }

    // Clipboard ------------------------------------------------------------
    function copyWithTextarea(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (error) {
            copied = false;
        }

        document.body.removeChild(textArea);
        return copied;
    }

    // Resolves to true when the text reached the clipboard, using the async
    // Clipboard API when available and a hidden textarea otherwise.
    function copyText(text) {
        if (navigator.clipboard && global.isSecureContext) {
            return navigator.clipboard.writeText(text)
                .then(() => true)
                .catch(() => copyWithTextarea(text));
        }

        return Promise.resolve(copyWithTextarea(text));
    }

    // Buttons --------------------------------------------------------------
    // Puts a button into a busy state and returns a restore() callback.
    function setButtonBusy(button, busyHTML) {
        if (!button) return () => {};

        const originalHTML = button.innerHTML;
        button.innerHTML = busyHTML;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');

        return function restore() {
            button.innerHTML = originalHTML;
            button.disabled = false;
            button.setAttribute('aria-busy', 'false');
        };
    }

    // Swaps a button's content for a confirmation, then restores it.
    function flashButtonContent(button, temporaryHTML, duration = 2000) {
        if (!button) return;

        const originalHTML = button.innerHTML;
        button.innerHTML = temporaryHTML;
        setTimeout(() => {
            button.innerHTML = originalHTML;
        }, duration);
    }

    // Field errors ---------------------------------------------------------
    function removeFieldError(field) {
        const errorElement = field.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    function showFieldError(field, message) {
        removeFieldError(field);

        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.setAttribute('role', 'alert');
        errorElement.textContent = message;
        field.parentNode.appendChild(errorElement);
    }

    // Observers ------------------------------------------------------------
    // Adds `animate-in` to elements matching `selectors` as they scroll in.
    // Returns the observer (or null when IntersectionObserver is missing).
    function observeReveal(selectors, options = {}) {
        if (!('IntersectionObserver' in global)) return null;

        const { onReveal, ...observerOptions } = options;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                entry.target.classList.add('animate-in');
                if (typeof onReveal === 'function') {
                    onReveal(entry.target);
                }
            });
        }, observerOptions);

        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        selectorList.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => observer.observe(element));
        });

        return observer;
    }

    // Swaps in `data-src` images and marks them loaded.
    function loadDeferredImages(root = document) {
        root.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.addEventListener('load', () => img.classList.add('loaded'));
        });
    }

    // Overlay --------------------------------------------------------------
    function setLoadingOverlay(isActive) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.toggle('active', isActive);
    }

    // Messages -------------------------------------------------------------
    // Creates a transient alert node and removes it after `duration` ms.
    function createDismissibleMessage(className, message, duration = 5000, onDismiss) {
        const messageElement = document.createElement('div');
        messageElement.className = className;
        messageElement.textContent = message;
        messageElement.setAttribute('role', 'alert');

        setTimeout(() => {
            if (typeof onDismiss === 'function') {
                onDismiss(messageElement);
            } else {
                messageElement.remove();
            }
        }, duration);

        return messageElement;
    }

    global.SiteUtils = {
        EMAIL_PATTERN,
        isValidEmail,
        readStoredValue,
        writeStoredValue,
        removeStoredValue,
        readStoredJSON,
        writeStoredJSON,
        announce,
        copyText,
        setButtonBusy,
        flashButtonContent,
        showFieldError,
        removeFieldError,
        observeReveal,
        loadDeferredImages,
        setLoadingOverlay,
        createDismissibleMessage
    };
})(window);
