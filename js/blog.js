// Enhanced Blog JavaScript with Performance and Accessibility
// Shared helpers live in js/utils.js (window.SiteUtils).

document.addEventListener('DOMContentLoaded', function () {
    initBlogFeatures();
    initNewsletterForm();
    initLoadMorePosts();
    initPostSearch();
    initBlogAccessibilityFeatures();
    SiteUtils.setLoadingOverlay(false);
});

function initBlogFeatures() {
    // Initialize reading time calculation
    calculateReadingTimes();

    // Initialize post animations
    initPostAnimations();

    // Initialize social sharing
    initSocialSharing();

    // Initialize post filtering
    initPostFiltering();
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
    SiteUtils.observeReveal('.blog-post, .featured-post', {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
        onReveal: (post) => SiteUtils.loadDeferredImages(post)
    });
}

function initNewsletterForm() {
    const newsletterForm = document.getElementById('newsletterForm');
    if (!newsletterForm) return;

    const emailInput = newsletterForm.querySelector('input[type="email"]');
    const submitButton = newsletterForm.querySelector('button[type="submit"]');

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

    // Remove previous validation states
    emailInput.classList.remove('error', 'valid');
    SiteUtils.removeFieldError(emailInput);

    if (!email) {
        SiteUtils.showFieldError(emailInput, 'Email is required.');
        emailInput.classList.add('error');
        return false;
    }

    if (!SiteUtils.isValidEmail(email)) {
        SiteUtils.showFieldError(emailInput, 'Please enter a valid email address.');
        emailInput.classList.add('error');
        return false;
    }

    emailInput.classList.add('valid');
    return true;
}

function submitNewsletter(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = SiteUtils.setButtonBusy(
        submitButton,
        '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Subscribing...'
    );

    // Simulate subscription (replace with actual API call)
    setTimeout(() => {
        submitButton.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Subscribed!';
        submitButton.classList.add('success');

        showFormSuccess(form, 'Thank you for subscribing! Check your email for confirmation.');

        // Reset form after delay
        setTimeout(() => {
            form.reset();
            submitButton.classList.remove('success');
            restoreButton();
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
    const restoreButton = SiteUtils.setButtonBusy(
        button,
        '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading...'
    );

    // Simulate loading more posts
    setTimeout(() => {
        const blogGrid = document.querySelector('.blog-grid');
        const newPosts = generateMorePosts(3); // Generate 3 more posts

        newPosts.forEach(post => {
            blogGrid.appendChild(post);
        });

        restoreButton();

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
            button.parentNode.appendChild(endMessage);
        }
    }, 1500);
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

function performSearch(query) {
    const posts = document.querySelectorAll('.blog-post');
    let visibleCount = 0;

    posts.forEach(post => {
        const title = post.querySelector('.post-title').textContent.toLowerCase();
        const excerpt = post.querySelector('.post-excerpt').textContent.toLowerCase();
        const category = post.querySelector('.post-category').textContent.toLowerCase();

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
        resultsElement = document.createElement('div');
        resultsElement.className = 'search-results';
        resultsElement.setAttribute('role', 'status');
        resultsElement.setAttribute('aria-live', 'polite');

        const blogGrid = document.querySelector('.blog-grid');
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
        const category = post.querySelector('.post-category').textContent.toLowerCase();
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

function initBlogAccessibilityFeatures() {
    // Improve heading structure
    improveHeadingStructure();

    // Add ARIA labels where needed
    addAriaLabels();
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

function showFormError(form, message) {
    showFormMessage(form, message, 'error');
}

function showFormSuccess(form, message) {
    showFormMessage(form, message, 'success');
}

function showFormMessage(form, message, type) {
    // Remove existing messages
    form.querySelectorAll('.form-message').forEach(msg => msg.remove());

    const messageElement = SiteUtils.createDismissibleMessage(`form-message ${type}-message`, message);
    form.insertBefore(messageElement, form.firstChild);
}

// Error handling
window.addEventListener('error', function (e) {
    console.error('Blog JavaScript error:', e.error);
});

window.addEventListener('unhandledrejection', function (e) {
    console.error('Unhandled promise rejection in blog:', e.reason);
});

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

// Copy code block functionality
window.copyCode = function (button) {
    const codeBlock = button.closest('.code-block')?.querySelector('code');
    if (!codeBlock) return;

    SiteUtils.copyText(codeBlock.textContent).then(copied => {
        if (copied) {
            SiteUtils.flashButtonContent(button, '<i class="fas fa-check" aria-hidden="true"></i> Copied!');
        }
    });
};

// Copy page link functionality
window.copyLink = function () {
    SiteUtils.copyText(window.location.href).then(copied => {
        if (copied) {
            SiteUtils.flashButtonContent(
                document.querySelector('.share-btn.copy'),
                '<i class="fas fa-check" aria-hidden="true"></i>'
            );
        }
    });
};