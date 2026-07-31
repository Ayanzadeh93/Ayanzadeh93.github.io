const loadBlog = () => {
    let blog;
    jest.isolateModules(() => {
        blog = require('../js/blog.js');
    });
    return blog;
};

const lastObserver = () => {
    const { instances } = global.MockIntersectionObserver;
    return instances[instances.length - 1];
};

describe('blog.js initialization', () => {
    describe('initBlogFeatures', () => {
        it('wires reading times, animations, sharing and filtering in one pass', () => {
            window.open = jest.fn();
            document.body.innerHTML = `
                <div class="blog-grid">
                    <article class="blog-post">
                        <div class="post-category">Research</div>
                        <div class="post-content">
                            <h3 class="post-title">Graphs</h3>
                            <p class="post-excerpt">${'word '.repeat(400).trim()}</p>
                            <span class="reading-time"></span>
                        </div>
                    </article>
                </div>
                <button class="filter-btn" data-filter="teaching">Teaching</button>
                <button class="share-btn" data-platform="facebook"></button>
            `;

            loadBlog().initBlogFeatures();

            expect(document.querySelector('.reading-time').textContent).toMatch(/^\d+ min read$/);
            expect(lastObserver().observed).toHaveLength(1);

            document.querySelector('.filter-btn').click();
            expect(document.querySelector('.blog-post').style.display).toBe('none');

            document.querySelector('.share-btn').click();
            expect(window.open.mock.calls[0][0]).toContain('facebook.com/sharer');
        });
    });

    describe('DOMContentLoaded bootstrap', () => {
        it('initializes the page and hides the loading overlay', () => {
            document.body.innerHTML = `
                <div id="loadingOverlay" class="active"></div>
                <div class="blog-grid">
                    <article class="blog-post">
                        <div class="post-category">Research</div>
                        <h2 class="post-title">Graphs</h2>
                        <p class="post-excerpt">Excerpt</p>
                        <span class="reading-time"></span>
                    </article>
                </div>
                <form id="newsletterForm">
                    <div class="field"><input type="email"></div>
                    <button type="submit">Subscribe</button>
                </form>
                <input class="search-input">
                <div class="load-more"><button id="loadMoreBtn">Load More</button></div>
                <button><i class="fas fa-search"></i></button>
            `;

            loadBlog();
            document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));

            expect(document.getElementById('loadingOverlay').classList.contains('active')).toBe(false);
            expect(document.querySelector('.reading-time').textContent).toBe('1 min read');
            expect(document.querySelector('button i').parentElement.getAttribute('aria-label')).toBe('Search');
        });
    });

    describe('initPostAnimations', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <article class="blog-post">
                    <img data-src="https://example.com/post.jpg" alt="">
                </article>
                <article class="featured-post"></article>
            `;
        });

        it('reveals posts and resolves their deferred images', () => {
            loadBlog().initPostAnimations();

            const post = document.querySelector('.blog-post');
            lastObserver().trigger([post]);

            const img = post.querySelector('img');
            expect(post.classList.contains('animate-in')).toBe(true);
            expect(img.src).toBe('https://example.com/post.jpg');
            expect(img.hasAttribute('data-src')).toBe(false);

            img.dispatchEvent(new Event('load'));
            expect(img.classList.contains('loaded')).toBe(true);
        });

        it('observes featured posts too and ignores non-intersecting entries', () => {
            loadBlog().initPostAnimations();

            expect(lastObserver().observed).toHaveLength(2);

            lastObserver().trigger([document.querySelector('.featured-post')], false);
            expect(document.querySelector('.featured-post').classList.contains('animate-in')).toBe(false);
        });
    });

    describe('initLoadMorePosts', () => {
        it('loads more posts on click and announces the result', () => {
            jest.useFakeTimers();
            jest.spyOn(Math, 'random').mockReturnValue(0.9);
            document.body.innerHTML = `
                <div class="blog-grid"></div>
                <div class="load-more"><button id="loadMoreBtn">Load More</button></div>
            `;
            window.announceToScreenReader = jest.fn();

            loadBlog().initLoadMorePosts();
            document.getElementById('loadMoreBtn').click();
            jest.advanceTimersByTime(1500);

            expect(document.querySelectorAll('.blog-grid .blog-post')).toHaveLength(3);
            expect(window.announceToScreenReader).toHaveBeenCalledWith('3 more posts loaded');
            jest.useRealTimers();
        });

        it('is a no-op when the page has no load more button', () => {
            expect(() => loadBlog().initLoadMorePosts()).not.toThrow();
        });
    });

    describe('search clear button', () => {
        it('empties the query, restores every post and refocuses the field', () => {
            jest.useFakeTimers();
            document.body.innerHTML = `
                <input class="search-input" value="graph">
                <button class="search-clear"></button>
                <div class="blog-grid">
                    <article class="blog-post">
                        <div class="post-category">Teaching</div>
                        <h3 class="post-title">Notes</h3>
                        <p class="post-excerpt">Lectures</p>
                    </article>
                </div>
            `;
            const blog = loadBlog();
            blog.initPostSearch();
            blog.performSearch('graph');
            expect(document.querySelector('.blog-post').style.display).toBe('none');

            document.querySelector('.search-clear').click();

            expect(document.querySelector('.search-input').value).toBe('');
            expect(document.querySelector('.blog-post').style.display).toBe('block');
            expect(document.activeElement).toBe(document.querySelector('.search-input'));
            jest.useRealTimers();
        });
    });

    describe('sharing targets', () => {
        beforeEach(() => {
            document.title = 'Blog Post';
            document.body.innerHTML = `
                <button class="share-btn" data-platform="facebook"></button>
                <button class="share-btn" data-platform="email"></button>
                <button class="share-btn" data-platform="mastodon"></button>
            `;
            window.open = jest.fn();
        });

        it('builds a facebook sharer url', () => {
            loadBlog().initSocialSharing();

            document.querySelector('[data-platform="facebook"]').click();

            expect(window.open.mock.calls[0][0])
                .toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`);
        });

        it('builds a mailto link with the page title as subject', () => {
            loadBlog().initSocialSharing();

            document.querySelector('[data-platform="email"]').click();

            expect(window.open.mock.calls[0][0]).toBe(
                `mailto:?subject=${encodeURIComponent('Blog Post')}&body=${encodeURIComponent(window.location.href)}`
            );
        });

        it('ignores unknown platforms', () => {
            loadBlog().initSocialSharing();

            document.querySelector('[data-platform="mastodon"]').click();

            expect(window.open).not.toHaveBeenCalled();
        });
    });

    describe('initAccessibilityFeatures', () => {
        it('labels icon-only controls and checks heading order', () => {
            document.body.innerHTML = `
                <h1>Blog</h1>
                <h3>Skipped</h3>
                <button><i class="fas fa-filter"></i></button>
            `;
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadBlog().initAccessibilityFeatures();

            expect(warn).toHaveBeenCalledWith('Heading level gap found: h1 to h3');
            expect(document.querySelector('button').getAttribute('aria-label')).toBe('Filter');
        });
    });

    describe('global error and performance hooks', () => {
        it('logs uncaught errors and rejected promises', () => {
            const error = jest.spyOn(console, 'error').mockImplementation(() => {});
            loadBlog();

            window.dispatchEvent(new ErrorEvent('error', { error: new Error('boom') }));
            const rejection = new Event('unhandledrejection');
            rejection.reason = 'nope';
            window.dispatchEvent(rejection);

            expect(error).toHaveBeenCalledWith('Blog JavaScript error:', expect.any(Error));
            expect(error).toHaveBeenCalledWith('Unhandled promise rejection in blog:', 'nope');
        });

        it('reports the navigation load time once the page has loaded', () => {
            jest.useFakeTimers();
            const log = jest.spyOn(console, 'log').mockImplementation(() => {});
            performance.getEntriesByType = jest.fn().mockReturnValue([{ loadEventEnd: 1234.6 }]);

            loadBlog();
            window.dispatchEvent(new Event('load'));
            jest.advanceTimersByTime(0);

            expect(log).toHaveBeenCalledWith('Blog page load time: 1235ms');
            jest.useRealTimers();
        });
    });

    describe('copyLink fallback', () => {
        it('uses a temporary textarea when the clipboard API rejects', async () => {
            document.body.innerHTML = '<button class="share-btn copy"></button>';
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
                configurable: true
            });
            document.execCommand = jest.fn().mockReturnValue(true);

            loadBlog();
            window.copyLink();
            await Promise.resolve();
            await Promise.resolve();

            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(document.querySelector('textarea')).toBeNull();
        });

        it('tolerates a missing copy button when the clipboard API resolves', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: jest.fn().mockResolvedValue(undefined) },
                configurable: true
            });

            loadBlog();
            window.copyLink();
            await Promise.resolve();

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
        });

        it('copyCode is a no-op when the block contains no code element', () => {
            document.body.innerHTML = '<div class="code-block"><button>Copy</button></div>';
            const writeText = jest.fn();
            Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

            loadBlog();
            window.copyCode(document.querySelector('button'));

            expect(writeText).not.toHaveBeenCalled();
        });
    });
});
