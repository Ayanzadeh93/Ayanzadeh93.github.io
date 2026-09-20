// jsdom does not implement IntersectionObserver, matchMedia or speechSynthesis,
// all of which the site scripts touch during initialization.
class MockIntersectionObserver {
    constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observed = [];
        MockIntersectionObserver.instances.push(this);
    }

    observe(element) {
        this.observed.push(element);
    }

    unobserve(element) {
        this.observed = this.observed.filter(item => item !== element);
    }

    disconnect() {
        this.observed = [];
    }

    // Test helper: pretend the given elements scrolled into view.
    trigger(elements, isIntersecting = true) {
        this.callback(
            (elements || this.observed).map(target => ({ target, isIntersecting })),
            this
        );
    }
}

MockIntersectionObserver.instances = [];

global.MockIntersectionObserver = MockIntersectionObserver;

beforeEach(() => {
    MockIntersectionObserver.instances.length = 0;
    window.IntersectionObserver = MockIntersectionObserver;
    global.IntersectionObserver = MockIntersectionObserver;

    window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn()
    }));

    window.scrollTo = jest.fn();
    window.requestAnimationFrame = callback => {
        callback(0);
        return 0;
    };

    delete window.navigationAnnouncementsEnabled;
    delete window.announceToScreenReader;
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.body.className = '';
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
    jest.restoreAllMocks();
});
