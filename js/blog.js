// Enhanced Blog JavaScript with Performance and Accessibility

// main.js is always loaded first on blog pages; keep local fallbacks so blog.js
// still degrades gracefully if it is used on its own.
function blogReportError(context, error) {
    if (typeof window.siteReportError === 'function') {
        window.siteReportError(context, error);
        return;
    }

    console.error(`[blog] ${context}:`, error);
}

function blogSafeInvoke(context, fn) {
    try {
        return fn();
    } catch (error) {
        blogReportError(context, error);
        return undefined;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const initializers = [
        initBlogFeatures,
        initNewsletterForm,
        initLoadMorePosts,
        initPostSearch,
        initAccessibilityFeatures
    ];

    try {
        initializers.forEach(initializer => blogSafeInvoke(initializer.name, initializer));
    } finally {
        hideLoadingOverlay();
    }
});

function initBlogFeatures() {
    [
        calculateReadingTimes,
        initPostAnimations,
        initSocialSharing,
        initPostFiltering
    ].forEach(initializer => blogSafeInvoke(initializer.name, initializer));
}

function calculateReadingTimes() {
    const posts = document.querySelectorAll('.blog-post, .featured-post');

    posts.forEach(post => {
        const content = post.querySelector('.post-content, .post-excerpt');
        if (content) {
            const wordCount = content.textContent.split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // Average reading speed

            const timeElement = post.querySelector('.reading-time');
            if (timeElement) {
                timeElement.textContent = `${readingTime} min read`;
                timeElement.setAttribute('title', `Estimated reading time: ${readingTime} minutes`);
            }
        }
    });
}

function initPostAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');

                // Lazy load images if any
                const images = entry.target.querySelectorAll('img[data-src]');
                images.forEach(img => {
                    const source = img.dataset.src;
                    img.removeAttribute('data-src');

                    if (!source) {
                        blogReportError('Lazy image has no data-src', img);
                        return;
                    }

                    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
                    img.addEventListener('error', () => {
                        img.classList.add('load-failed');
                        blogReportError(`Lazy image failed to load: ${source}`, null);
                    }, { once: true });

                    img.src = source;
                });
            }
        });
    }, observerOptions);

    // Observe blog posts
    document.querySelectorAll('.blog-post, .featured-post').forEach(post => {
        observer.observe(post);
    });
}

function initNewsletterForm() {
    const newsletterForm = document.getElementById('newsletterForm');
    if (!newsletterForm) return;

    const emailInput = newsletterForm.querySelector('input[type="email"]');
    if (!emailInput) {
        blogReportError('Newsletter form is missing its email input; subscription disabled', newsletterForm);
        return;
    }

    // Email validation
    emailInput.addEventListener('input', function () {
        validateEmail(this);
    });

    emailInput.addEventListener('blur', function () {
        validateEmail(this);
    });

    newsletterForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (validateEmail(emailInput)) {
            submitNewsletter(this);
        } else {
            showFormError(newsletterForm, 'Please enter a valid email address.');
            emailInput.focus();
        }
    });
}

function validateEmail(emailInput) {
    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Remove previous validation states
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
    const originalText = submitButton.innerHTML;

    // Show loading state
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Subscribing...';
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');

    // Simulate subscription (replace with actual API call)
    setTimeout(() => {
        submitButton.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Subscribed!';
        submitButton.classList.add('success');

        showFormSuccess(form, 'Thank you for subscribing! Check your email for confirmation.');

        // Reset form after delay
        setTimeout(() => {
            form.reset();
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            submitButton.classList.remove('success');
            submitButton.setAttribute('aria-busy', 'false');
        }, 3000);

        // Announce to screen readers
        if (window.announceToScreenReader) {
            window.announceToScreenReader('Successfully subscribed to newsletter');
        }
    }, 2000);
}

function initLoadMorePosts() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;

    let currentPage = 1;
    const postsPerPage = 6;

    loadMoreBtn.addEventListener('click', function () {
        loadMorePosts(this);
    });
}

function loadMorePosts(button) {
    const originalText = button.innerHTML;

    // Show loading state
    button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading...';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    const restoreButton = () => {
        button.innerHTML = originalText;
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
    };

    // Simulate loading more posts
    setTimeout(() => {
        // Always restore the button, otherwise a failure leaves it stuck in the
        // disabled "Loading..." state with aria-busy set.
        try {
            const blogGrid = document.querySelector('.blog-grid');
            if (!blogGrid) {
                throw new Error('Blog grid container not found');
            }

            const newPosts = generateMorePosts(3); // Generate 3 more posts

            newPosts.forEach(post => {
                blogGrid.appendChild(post);
            });

            // Update screen reader announcement
            if (window.announceToScreenReader) {
                window.announceToScreenReader('3 more posts loaded');
            }

            // Hide button if no more posts (simulate)
            if (Math.random() < 0.3) { // 30% chance to hide button
                button.style.display = 'none';
                const endMessage = document.createElement('p');
                endMessage.textContent = 'No more posts to load.';
                endMessage.className = 'end-message';
                endMessage.setAttribute('role', 'status');
                if (button.parentNode) {
                    button.parentNode.appendChild(endMessage);
                }
            }
        } catch (error) {
            blogReportError('Could not load more posts', error);
            showLoadMoreError(button);
        } finally {
            restoreButton();
        }
    }, 1500);
}

function showLoadMoreError(button) {
    const container = button.parentNode;
    if (!container) return;

    let errorMessage = container.querySelector('.load-more-error');
    if (!errorMessage) {
        errorMessage = document.createElement('p');
        errorMessage.className = 'load-more-error error-message';
        errorMessage.setAttribute('role', 'alert');
        container.appendChild(errorMessage);
    }

    errorMessage.textContent = 'Could not load more posts. Please try again.';

    if (window.announceToScreenReader) {
        window.announceToScreenReader('Could not load more posts');
    }
}

function generateMorePosts(count) {
    const posts = [];
    const sampleTitles = [
        'Advanced Techniques in Medical Image Segmentation',
        'Multi-Modal Learning for Computer Vision Applications',
        'Recent Advances in Graph Neural Networks',
        'Deep Learning for Time Series Analysis',
        'Explainable AI in Medical Imaging',
        'Transfer Learning Strategies for Small Datasets'
    ];

    for (let i = 0; i < count; i++) {
        const post = document.createElement('article');
        post.className = 'blog-post';
        post.setAttribute('role', 'article');

        const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
        const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

        post.innerHTML = `
            <div class="post-image">
                <img src="https://via.placeholder.com/400x250/1a73e8/ffffff?text=Research+Image" alt="${randomTitle}" loading="lazy">
                <div class="post-category">Research</div>
            </div>
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-date">${randomDate}</span>
                    <span class="reading-time">5 min read</span>
                </div>
                <h3 class="post-title">
                    <a href="#" aria-label="Read full article: ${randomTitle}">${randomTitle}</a>
                </h3>
                <p class="post-excerpt">Exploring innovative approaches and methodologies in this exciting area of research. This post discusses recent developments and future directions.</p>
                <a href="#" class="read-more" aria-label="Read more about ${randomTitle}">Read More <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </div>
        `;

        posts.push(post);
    }

    return posts;
}

function initPostSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;

    let searchTimeout;

    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(this.value.trim());
        }, 300); // Debounce search
    });

    // Clear search
    const clearButton = document.querySelector('.search-clear');
    if (clearButton) {
        clearButton.addEventListener('click', function () {
            searchInput.value = '';
            performSearch('');
            searchInput.focus();
        });
    }
}

// Posts do not always contain every sub-element, so read text defensively
// rather than throwing and aborting the whole search or filter pass.
function getPostText(post, selector) {
    const element = post.querySelector(selector);
    return element ? element.textContent.trim().toLowerCase() : '';
}

function performSearch(query) {
    const posts = document.querySelectorAll('.blog-post');
    let visibleCount = 0;

    posts.forEach(post => {
        const title = getPostText(post, '.post-title');
        const excerpt = getPostText(post, '.post-excerpt');
        const category = getPostText(post, '.post-category');

        const isVisible = !query ||
            title.includes(query.toLowerCase()) ||
            excerpt.includes(query.toLowerCase()) ||
            category.includes(query.toLowerCase());

        post.style.display = isVisible ? 'block' : 'none';
        if (isVisible) visibleCount++;
    });

    // Update search results count
    updateSearchResults(query, visibleCount);
}

function updateSearchResults(query, count) {
    let resultsElement = document.querySelector('.search-results');

    if (!resultsElement) {
        const blogGrid = document.querySelector('.blog-grid');
        if (!blogGrid || !blogGrid.parentNode) {
            blogReportError('Cannot show search results: blog grid container not found', null);
            return;
        }

        resultsElement = document.createElement('div');
        resultsElement.className = 'search-results';
        resultsElement.setAttribute('role', 'status');
        resultsElement.setAttribute('aria-live', 'polite');

        blogGrid.parentNode.insertBefore(resultsElement, blogGrid);
    }

    if (query) {
        resultsElement.textContent = `Found ${count} post${count !== 1 ? 's' : ''} for "${query}"`;
        resultsElement.style.display = 'block';
    } else {
        resultsElement.style.display = 'none';
    }
}

function initPostFiltering() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const filter = this.dataset.filter;

            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Filter posts
            filterPosts(filter);

            // Announce filter change
            if (window.announceToScreenReader) {
                window.announceToScreenReader(`Filtered posts by ${filter === 'all' ? 'all categories' : filter}`);
            }
        });
    });
}

function filterPosts(filter) {
    const posts = document.querySelectorAll('.blog-post');

    posts.forEach(post => {
        const category = getPostText(post, '.post-category');
        const isVisible = filter === 'all' || category === filter.toLowerCase();

        post.style.display = isVisible ? 'block' : 'none';
    });
}

function initSocialSharing() {
    const shareButtons = document.querySelectorAll('.share-btn');

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
                window.open(shareUrl, 'share', 'width=600,height=400');
            }
        });
    });
}

function initAccessibilityFeatures() {
    [improveHeadingStructure, addAriaLabels].forEach(
        initializer => blogSafeInvoke(initializer.name, initializer)
    );
}


function improveHeadingStructure() {
    // Ensure proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let currentLevel = 1;

    headings.forEach(heading => {
        const level = parseInt(heading.tagName.charAt(1));

        if (level > currentLevel + 1) {
            console.warn(`Heading level gap found: h${currentLevel} to h${level}`);
        }

        currentLevel = level;
    });
}

function addAriaLabels() {
    // Add aria-labels to interactive elements without descriptive text
    const interactiveElements = document.querySelectorAll('button:not([aria-label]), a:not([aria-label])');

    interactiveElements.forEach(element => {
        if (!element.textContent.trim() && !element.getAttribute('aria-label')) {
            const icon = element.querySelector('i');
            if (icon) {
                const iconClass = icon.className;
                let label = 'Interactive element';

                if (iconClass.includes('search')) label = 'Search';
                else if (iconClass.includes('share')) label = 'Share';
                else if (iconClass.includes('filter')) label = 'Filter';

                element.setAttribute('aria-label', label);
            }
        }
    });
}

// Utility functions
function showFieldError(field, message) {
    removeFieldError(field);

    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');

    field.parentNode.appendChild(errorElement);
}

function removeFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function showFormError(form, message) {
    showFormMessage(form, message, 'error');
}

function showFormSuccess(form, message) {
    showFormMessage(form, message, 'success');
}

function showFormMessage(form, message, type) {
    // Remove existing messages
    const existingMessages = form.querySelectorAll('.form-message');
    existingMessages.forEach(msg => msg.remove());

    const messageElement = document.createElement('div');
    messageElement.className = `form-message ${type}-message`;
    messageElement.textContent = message;
    messageElement.setAttribute('role', 'alert');

    form.insertBefore(messageElement, form.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 5000);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Error handling. main.js already installs these handlers, so only register
// them when blog.js runs without it to avoid duplicate reports.
if (typeof window.siteReportError !== 'function') {
    window.addEventListener('error', function (e) {
        blogReportError(`Uncaught error at ${e.filename || 'unknown'}:${e.lineno || 0}`, e.error || e.message);
    });

    window.addEventListener('unhandledrejection', function (e) {
        blogReportError('Unhandled promise rejection', e.reason);
    });
}

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', function () {
        setTimeout(() => {
            const entries = performance.getEntriesByType('navigation');
            if (entries.length > 0) {
                const loadTime = Math.round(entries[0].loadEventEnd);
                console.log(`Blog page load time: ${loadTime}ms`);
            }
        }, 0);
    });
}

// Legacy clipboard path; returns whether the copy actually succeeded instead of
// assuming it did.
function legacyCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (!successful) {
            blogReportError('execCommand("copy") reported failure', null);
        }
        return successful;
    } catch (error) {
        blogReportError('Fallback clipboard copy failed', error);
        return false;
    } finally {
        textArea.remove();
    }
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(error => {
            blogReportError('Clipboard API copy failed, using fallback', error);
            return legacyCopyToClipboard(text);
        });
    }

    return Promise.resolve(legacyCopyToClipboard(text));
}

function flashButtonState(button, html, resetHtml) {
    button.innerHTML = html;
    setTimeout(() => {
        button.innerHTML = resetHtml;
    }, 2000);
}

// Copy code block functionality
window.copyCode = function (button) {
    const codeBlockContainer = button.closest('.code-block');
    const codeBlock = codeBlockContainer ? codeBlockContainer.querySelector('code') : null;
    if (!codeBlock) {
        blogReportError('Copy button is not attached to a code block', button);
        return;
    }

    const resetHtml = '<i class="fas fa-copy" aria-hidden="true"></i> Copy';

    copyText(codeBlock.textContent).then(successful => {
        flashButtonState(
            button,
            successful
                ? '<i class="fas fa-check" aria-hidden="true"></i> Copied!'
                : '<i class="fas fa-exclamation-circle" aria-hidden="true"></i> Copy failed',
            resetHtml
        );

        if (window.announceToScreenReader) {
            window.announceToScreenReader(successful ? 'Code copied to clipboard' : 'Could not copy code');
        }
    });
};

// Copy page link functionality
window.copyLink = function () {
    copyText(window.location.href).then(successful => {
        const copyBtn = document.querySelector('.share-btn.copy');
        if (copyBtn) {
            flashButtonState(
                copyBtn,
                successful
                    ? '<i class="fas fa-check" aria-hidden="true"></i>'
                    : '<i class="fas fa-exclamation-circle" aria-hidden="true"></i>',
                copyBtn.innerHTML
            );
        }

        if (window.announceToScreenReader) {
            window.announceToScreenReader(successful ? 'Link copied to clipboard' : 'Could not copy link');
        }
    });
};