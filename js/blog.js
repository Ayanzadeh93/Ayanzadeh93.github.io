// Blog listing and article behaviour: browsing, newsletter, sharing, code copy

document.addEventListener('DOMContentLoaded', function () {
    // The listing and article pages share this file, so isolate each module.
    [
        ['post browsing', initPostBrowsing],
        ['post animations', initPostAnimations],
        ['newsletter form', initNewsletterForm],
        ['social sharing', initSocialSharing],
        ['table of contents', initTableOfContents]
    ].forEach(([name, fn]) => {
        try {
            fn();
        } catch (error) {
            console.error(`Failed to initialize ${name}:`, error);
        }
    });

    hideLoadingOverlay();
});

/* ========================================
   POST BROWSING — SEARCH + CATEGORY FILTER
   Search text and the active category are
   applied together so the two never fight.
   ======================================== */

function initPostBrowsing() {
    const grid = document.querySelector('.blog-grid');
    if (!grid) return;

    const posts = Array.from(grid.querySelectorAll('.blog-post'));
    if (!posts.length) return;

    const searchInput = document.querySelector('.search-input');
    const clearButton = document.querySelector('.search-clear');
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
    const resultsMessage = document.querySelector('.search-results');
    const emptyState = document.querySelector('.blog-empty-state');
    const resetButton = document.querySelector('.blog-reset-btn');

    // Index each post once so filtering never re-reads the DOM
    const index = posts.map(post => {
        const parts = ['.post-title', '.post-excerpt', '.post-category', '.post-tags']
            .map(selector => {
                const node = post.querySelector(selector);
                return node ? node.textContent : '';
            });

        return {
            element: post,
            category: post.dataset.category || 'all',
            haystack: parts.join(' ').toLowerCase().replace(/\s+/g, ' ')
        };
    });

    let query = '';
    let activeFilter = 'all';

    function apply() {
        const needle = query.toLowerCase();
        let visible = 0;

        index.forEach(entry => {
            const matchesFilter = activeFilter === 'all' || entry.category === activeFilter;
            const matchesQuery = !needle || entry.haystack.includes(needle);
            const show = matchesFilter && matchesQuery;

            entry.element.hidden = !show;
            if (show) visible += 1;
        });

        if (resultsMessage) {
            if (query || activeFilter !== 'all') {
                resultsMessage.textContent = `Showing ${visible} of ${index.length} posts`;
                resultsMessage.hidden = false;
            } else {
                resultsMessage.hidden = true;
            }
        }

        if (emptyState) {
            emptyState.hidden = visible !== 0;
        }

        if (clearButton) {
            clearButton.hidden = !query;
        }
    }

    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', function () {
            const value = this.value.trim();
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                query = value;
                apply();
            }, 200);
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            query = '';
            apply();
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            activeFilter = this.dataset.filter || 'all';

            filterButtons.forEach(other => {
                const isActive = other === this;
                other.classList.toggle('active', isActive);
                other.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });

            apply();

            if (window.announceToScreenReader) {
                const label = activeFilter === 'all' ? 'all categories' : this.textContent.trim();
                window.announceToScreenReader(`Filtered posts by ${label}`);
            }
        });
    });

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            query = '';
            activeFilter = 'all';

            if (searchInput) searchInput.value = '';
            filterButtons.forEach(button => {
                const isAll = button.dataset.filter === 'all';
                button.classList.toggle('active', isAll);
                button.setAttribute('aria-pressed', isAll ? 'true' : 'false');
            });

            apply();
            if (searchInput) searchInput.focus();
        });
    }

    apply();
}

function initPostAnimations() {
    const posts = document.querySelectorAll('.blog-post');
    if (!posts.length) return;

    if (!('IntersectionObserver' in window)) {
        posts.forEach(post => post.classList.add('animate-in'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    posts.forEach(post => observer.observe(post));
}

/* ========================================
   TABLE OF CONTENTS
   Highlights the section currently in view
   ======================================== */

function initTableOfContents() {
    const links = Array.from(document.querySelectorAll('.toc-nav a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sections = links
        .map(link => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            links.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
            });
        });
    }, { rootMargin: '-20% 0px -70% 0px' });

    sections.forEach(section => observer.observe(section));
}

/* ========================================
   NEWSLETTER
   ======================================== */

function initNewsletterForm() {
    const newsletterForm = document.getElementById('newsletterForm');
    if (!newsletterForm) return;

    const emailInput = newsletterForm.querySelector('input[type="email"]');
    if (!emailInput) return;

    emailInput.addEventListener('blur', () => validateEmail(emailInput));

    newsletterForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (validateEmail(emailInput)) {
            submitNewsletter(this);
        } else {
            emailInput.focus();
        }
    });
}

function validateEmail(emailInput) {
    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    emailInput.classList.remove('error', 'valid');
    removeFieldError(emailInput);

    if (!email) {
        showFieldError(emailInput, 'Email is required.');
        emailInput.classList.add('error');
        return false;
    }

    if (!emailRegex.test(email)) {
        showFieldError(emailInput, 'Please enter a valid email address.');
        emailInput.classList.add('error');
        return false;
    }

    emailInput.classList.add('valid');
    return true;
}

function submitNewsletter(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const originalText = submitButton.innerHTML;

    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Subscribing...';
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');

    function finish(message, type, announcement) {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        submitButton.setAttribute('aria-busy', 'false');

        showFormMessage(form, message, type);

        if (window.announceToScreenReader) {
            window.announceToScreenReader(announcement);
        }
    }

    fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
    }).then(response => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        form.reset();
        finish(
            'Thank you for subscribing! Please confirm via the email you receive.',
            'success',
            'Successfully subscribed to the newsletter'
        );
    }).catch(() => {
        finish(
            'Subscription could not be sent right now. Please email a.ayanzadeh@gmail.com instead.',
            'error',
            'Subscription failed, please use email instead'
        );
    });
}

/* ========================================
   SHARING
   ======================================== */

function initSocialSharing() {
    const shareButtons = document.querySelectorAll('.share-btn[data-platform]');

    shareButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();

            const platform = this.dataset.platform;
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);

            let shareUrl;

            switch (platform) {
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
                    break;
                case 'linkedin':
                    shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
                    break;
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                    break;
                case 'email':
                    shareUrl = `mailto:?subject=${title}&body=${url}`;
                    break;
                case 'copy':
                    copyLink();
                    return;
            }

            if (shareUrl) {
                window.open(shareUrl, 'share', 'width=600,height=400,noopener,noreferrer');
            }
        });
    });
}

/* ========================================
   FORM FEEDBACK HELPERS
   ======================================== */

// showFieldError, removeFieldError, and hideLoadingOverlay come from main.js,
// which every blog page loads first.

function showFormMessage(form, message, type) {
    form.querySelectorAll('.form-message').forEach(msg => msg.remove());

    const messageElement = document.createElement('div');
    messageElement.className = `form-message ${type}-message`;
    messageElement.textContent = message;
    messageElement.setAttribute('role', type === 'error' ? 'alert' : 'status');

    form.insertBefore(messageElement, form.firstChild);

    setTimeout(() => messageElement.remove(), 8000);
}

/* ========================================
   CLIPBOARD HELPERS
   ======================================== */

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();

        const copied = document.execCommand('copy');
        document.body.removeChild(textArea);

        return copied ? resolve() : reject(new Error('Copy command was rejected'));
    });
}

function flashButton(button, html, duration) {
    const original = button.innerHTML;
    button.innerHTML = html;
    setTimeout(() => {
        button.innerHTML = original;
    }, duration || 2000);
}

window.copyCode = function (button) {
    const container = button.closest('.code-block');
    const codeBlock = container ? container.querySelector('code') : null;
    if (!codeBlock) return;

    copyText(codeBlock.textContent)
        .then(() => flashButton(button, '<i class="fas fa-check" aria-hidden="true"></i> Copied!'))
        .catch(() => flashButton(button, '<i class="fas fa-xmark" aria-hidden="true"></i> Press Ctrl+C'));
};

window.copyLink = function () {
    const copyBtn = document.querySelector('.share-btn.copy');

    copyText(window.location.href).then(() => {
        if (copyBtn) {
            flashButton(copyBtn, '<i class="fas fa-check" aria-hidden="true"></i>');
        }
    }).catch(() => {
        if (copyBtn) {
            flashButton(copyBtn, '<i class="fas fa-xmark" aria-hidden="true"></i>');
        }
    });
};
