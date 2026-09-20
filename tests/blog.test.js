const loadBlog = () => {
    let blog;
    jest.isolateModules(() => {
        blog = require('../js/blog.js');
    });
    return blog;
};

const postMarkup = (title, excerpt, category) => `
    <article class="blog-post">
        <div class="post-category">${category}</div>
        <div class="post-content">
            <h3 class="post-title">${title}</h3>
            <p class="post-excerpt">${excerpt}</p>
            <span class="reading-time"></span>
        </div>
    </article>
`;

describe('blog.js', () => {
    describe('calculateReadingTimes', () => {
        it('renders a reading time rounded up from a 200 words per minute pace', () => {
            document.body.innerHTML = `
                <article class="blog-post">
                    <p class="post-excerpt">${'word '.repeat(250).trim()}</p>
                    <span class="reading-time"></span>
                </article>
            `;

            loadBlog().calculateReadingTimes();

            const timeElement = document.querySelector('.reading-time');
            expect(timeElement.textContent).toBe('2 min read');
            expect(timeElement.getAttribute('title')).toBe('Estimated reading time: 2 minutes');
        });

        it('leaves posts without a reading-time element untouched', () => {
            document.body.innerHTML = '<article class="blog-post"><p class="post-excerpt">short</p></article>';

            expect(() => loadBlog().calculateReadingTimes()).not.toThrow();
        });
    });

    describe('validateEmail', () => {
        const setupInput = value => {
            document.body.innerHTML = `<div class="field"><input type="email" value="${value}"></div>`;
            return document.querySelector('input');
        };

        it('rejects an empty value with a required message', () => {
            const input = setupInput('');

            expect(loadBlog().validateEmail(input)).toBe(false);
            expect(input.classList.contains('error')).toBe(true);
            expect(document.querySelector('.field-error').textContent).toBe('Email is required.');
        });

        it('rejects a malformed address', () => {
            const input = setupInput('not-an-email');

            expect(loadBlog().validateEmail(input)).toBe(false);
            expect(document.querySelector('.field-error').textContent).toBe('Please enter a valid email address.');
        });

        it('accepts a well formed address and clears previous errors', () => {
            const input = setupInput('someone@example.com');
            const blog = loadBlog();

            blog.showFieldError(input, 'stale error');
            expect(blog.validateEmail(input)).toBe(true);
            expect(input.classList.contains('valid')).toBe(true);
            expect(input.classList.contains('error')).toBe(false);
            expect(document.querySelector('.field-error')).toBeNull();
        });

        it('trims surrounding whitespace before validating', () => {
            const input = setupInput('  someone@example.com  ');

            expect(loadBlog().validateEmail(input)).toBe(true);
        });
    });

    describe('initNewsletterForm', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <form id="newsletterForm">
                    <div class="field"><input type="email" value=""></div>
                    <button type="submit">Subscribe</button>
                </form>
            `;
        });

        it('blocks submission and reports an error for an invalid address', () => {
            const blog = loadBlog();
            blog.initNewsletterForm();

            const form = document.getElementById('newsletterForm');
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

            expect(form.querySelector('.form-message').textContent).toBe('Please enter a valid email address.');
            expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        });

        it('subscribes, then restores the button after the confirmation delay', () => {
            jest.useFakeTimers();
            const blog = loadBlog();
            blog.initNewsletterForm();

            const form = document.getElementById('newsletterForm');
            const button = form.querySelector('button[type="submit"]');
            const input = form.querySelector('input');
            input.value = 'someone@example.com';

            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            expect(button.disabled).toBe(true);
            expect(button.getAttribute('aria-busy')).toBe('true');

            jest.advanceTimersByTime(2000);
            expect(button.classList.contains('success')).toBe(true);
            expect(form.querySelector('.form-message').textContent).toContain('Thank you for subscribing');

            jest.advanceTimersByTime(3000);
            expect(button.disabled).toBe(false);
            expect(button.innerHTML).toBe('Subscribe');
            expect(button.getAttribute('aria-busy')).toBe('false');

            jest.useRealTimers();
        });
    });

    describe('performSearch', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="blog-grid">
                    ${postMarkup('Graph Neural Networks', 'A study of graphs', 'Research')}
                    ${postMarkup('Teaching Notes', 'Lecture summaries', 'Teaching')}
                </div>
            `;
        });

        it('matches on title, excerpt or category and reports the count', () => {
            const blog = loadBlog();

            blog.performSearch('graph');

            const posts = document.querySelectorAll('.blog-post');
            expect(posts[0].style.display).toBe('block');
            expect(posts[1].style.display).toBe('none');
            expect(document.querySelector('.search-results').textContent).toBe('Found 1 post for "graph"');
        });

        it('is case insensitive and pluralizes the result count', () => {
            const blog = loadBlog();

            blog.performSearch('S');

            expect(document.querySelector('.search-results').textContent).toBe('Found 2 posts for "S"');
        });

        it('shows every post and hides the counter for an empty query', () => {
            const blog = loadBlog();

            blog.performSearch('graph');
            blog.performSearch('');

            document.querySelectorAll('.blog-post').forEach(post => {
                expect(post.style.display).toBe('block');
            });
            expect(document.querySelector('.search-results').style.display).toBe('none');
        });

        it('reuses the existing results element instead of appending duplicates', () => {
            const blog = loadBlog();

            blog.performSearch('graph');
            blog.performSearch('teaching');

            expect(document.querySelectorAll('.search-results')).toHaveLength(1);
        });

        it('debounces input events from the search box', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('afterbegin', '<input class="search-input">');
            const blog = loadBlog();
            blog.initPostSearch();

            const searchInput = document.querySelector('.search-input');
            searchInput.value = 'graph';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.value = 'teaching';
            searchInput.dispatchEvent(new Event('input'));

            expect(document.querySelector('.search-results')).toBeNull();

            jest.advanceTimersByTime(300);
            expect(document.querySelector('.search-results').textContent).toBe('Found 1 post for "teaching"');

            jest.useRealTimers();
        });
    });

    describe('filterPosts', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="blog-grid">
                    ${postMarkup('Graph Neural Networks', 'A study of graphs', 'Research')}
                    ${postMarkup('Teaching Notes', 'Lecture summaries', 'Teaching')}
                </div>
            `;
        });

        it('keeps only posts in the requested category', () => {
            loadBlog().filterPosts('teaching');

            const posts = document.querySelectorAll('.blog-post');
            expect(posts[0].style.display).toBe('none');
            expect(posts[1].style.display).toBe('block');
        });

        it('shows everything for the "all" filter', () => {
            const blog = loadBlog();

            blog.filterPosts('teaching');
            blog.filterPosts('all');

            document.querySelectorAll('.blog-post').forEach(post => {
                expect(post.style.display).toBe('block');
            });
        });

        it('moves the active class to the clicked filter button', () => {
            document.body.insertAdjacentHTML('afterbegin', `
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="teaching">Teaching</button>
            `);
            const blog = loadBlog();
            blog.initPostFiltering();

            const buttons = document.querySelectorAll('.filter-btn');
            buttons[1].click();

            expect(buttons[0].classList.contains('active')).toBe(false);
            expect(buttons[1].classList.contains('active')).toBe(true);
            expect(document.querySelectorAll('.blog-post')[0].style.display).toBe('none');
        });
    });

    describe('generateMorePosts', () => {
        it('builds the requested number of blog post articles', () => {
            const posts = loadBlog().generateMorePosts(3);

            expect(posts).toHaveLength(3);
            posts.forEach(post => {
                expect(post.tagName).toBe('ARTICLE');
                expect(post.className).toBe('blog-post');
                expect(post.querySelector('.post-title a').textContent).not.toBe('');
                expect(post.querySelector('.reading-time').textContent).toBe('5 min read');
            });
        });
    });

    describe('loadMorePosts', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            document.body.innerHTML = `
                <div class="blog-grid"></div>
                <div class="load-more"><button id="loadMoreBtn">Load More</button></div>
            `;
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('appends three posts and restores the button', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.9);
            const button = document.getElementById('loadMoreBtn');

            loadBlog().loadMorePosts(button);
            expect(button.disabled).toBe(true);

            jest.advanceTimersByTime(1500);

            expect(document.querySelectorAll('.blog-grid .blog-post')).toHaveLength(3);
            expect(button.disabled).toBe(false);
            expect(button.innerHTML).toBe('Load More');
            expect(button.style.display).not.toBe('none');
        });

        it('hides the button and shows an end message when no posts remain', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.1);
            const button = document.getElementById('loadMoreBtn');

            loadBlog().loadMorePosts(button);
            jest.advanceTimersByTime(1500);

            expect(button.style.display).toBe('none');
            expect(document.querySelector('.end-message').textContent).toBe('No more posts to load.');
        });
    });

    describe('initSocialSharing', () => {
        beforeEach(() => {
            document.title = 'Blog Post';
            document.body.innerHTML = `
                <button class="share-btn" data-platform="twitter"></button>
                <button class="share-btn" data-platform="linkedin"></button>
                <button class="share-btn copy" data-platform="copy"></button>
            `;
        });

        it('opens a share window with the encoded page url and title', () => {
            window.open = jest.fn();
            loadBlog().initSocialSharing();

            document.querySelector('[data-platform="twitter"]').click();

            expect(window.open).toHaveBeenCalledWith(
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Blog Post')}`,
                'share',
                'width=600,height=400'
            );
        });

        it('uses the linkedin sharing endpoint for linkedin', () => {
            window.open = jest.fn();
            loadBlog().initSocialSharing();

            document.querySelector('[data-platform="linkedin"]').click();

            expect(window.open.mock.calls[0][0]).toContain('linkedin.com/sharing/share-offsite');
        });

        it('copies the link instead of opening a window for the copy button', () => {
            window.open = jest.fn();
            loadBlog().initSocialSharing();
            window.copyLink = jest.fn();

            document.querySelector('[data-platform="copy"]').click();

            expect(window.open).not.toHaveBeenCalled();
            expect(window.copyLink).toHaveBeenCalled();
        });
    });

    describe('copyCode and copyLink', () => {
        it('confirms the copy and restores the label after two seconds', async () => {
            jest.useFakeTimers();
            document.body.innerHTML = `
                <div class="code-block">
                    <button onclick="copyCode(this)">Copy</button>
                    <code>print("hi")</code>
                </div>
            `;
            const writeText = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

            loadBlog();
            const button = document.querySelector('.code-block button');
            window.copyCode(button);
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith('print("hi")');
            expect(button.innerHTML).toContain('Copied!');

            jest.advanceTimersByTime(2000);
            expect(button.innerHTML).toContain('Copy');

            jest.useRealTimers();
        });

        it('falls back to execCommand when the clipboard API rejects', async () => {
            document.body.innerHTML = `
                <div class="code-block">
                    <button>Copy</button>
                    <code>fallback</code>
                </div>
            `;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
                configurable: true
            });
            document.execCommand = jest.fn().mockReturnValue(true);

            loadBlog();
            window.copyCode(document.querySelector('.code-block button'));
            await Promise.resolve();
            await Promise.resolve();

            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(document.querySelector('textarea')).toBeNull();
        });

        it('copyLink swaps the copy button icon while the url is copied', async () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<button class="share-btn copy"><i class="fas fa-link"></i></button>';
            const writeText = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

            loadBlog();
            window.copyLink();
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith(window.location.href);
            expect(document.querySelector('.share-btn.copy').innerHTML).toContain('fa-check');

            jest.advanceTimersByTime(2000);
            expect(document.querySelector('.share-btn.copy').innerHTML).toContain('fa-link');

            jest.useRealTimers();
        });
    });

    describe('accessibility helpers', () => {
        it('adds aria labels derived from icon classes', () => {
            document.body.innerHTML = `
                <button><i class="fas fa-search"></i></button>
                <button><i class="fas fa-share"></i></button>
                <button><i class="fas fa-filter"></i></button>
                <button><i class="fas fa-star"></i></button>
                <button>Read more</button>
            `;

            loadBlog().addAriaLabels();

            const labels = Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('aria-label'));
            expect(labels).toEqual(['Search', 'Share', 'Filter', 'Interactive element', null]);
        });

        it('warns when the heading hierarchy skips a level', () => {
            document.body.innerHTML = '<h1>Title</h1><h4>Skipped</h4>';
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadBlog().improveHeadingStructure();

            expect(warn).toHaveBeenCalledWith('Heading level gap found: h1 to h4');
        });

        it('does not warn for a well ordered hierarchy', () => {
            document.body.innerHTML = '<h1>Title</h1><h2>Section</h2><h3>Sub</h3>';
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadBlog().improveHeadingStructure();

            expect(warn).not.toHaveBeenCalled();
        });
    });

    describe('form messages', () => {
        it('replaces earlier messages and self-removes after five seconds', () => {
            jest.useFakeTimers();
            document.body.innerHTML = '<form id="newsletterForm"></form>';
            const form = document.getElementById('newsletterForm');
            const blog = loadBlog();

            blog.showFormError(form, 'first');
            blog.showFormSuccess(form, 'second');

            const messages = form.querySelectorAll('.form-message');
            expect(messages).toHaveLength(1);
            expect(messages[0].className).toBe('form-message success-message');
            expect(messages[0].getAttribute('role')).toBe('alert');

            jest.advanceTimersByTime(5000);
            expect(form.querySelector('.form-message')).toBeNull();

            jest.useRealTimers();
        });
    });

    describe('hideLoadingOverlay', () => {
        it('removes the active class when the overlay exists', () => {
            document.body.innerHTML = '<div id="loadingOverlay" class="active"></div>';

            loadBlog().hideLoadingOverlay();

            expect(document.getElementById('loadingOverlay').classList.contains('active')).toBe(false);
        });

        it('is a no-op without an overlay', () => {
            expect(() => loadBlog().hideLoadingOverlay()).not.toThrow();
        });
    });
});
