// Applies the saved (or system) theme before first paint to avoid a light-mode flash.
// Loaded as a small blocking script in <head> on every page.
(function () {
    try {
        var saved = localStorage.getItem('theme');
        var dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } catch (e) { /* keep default theme */ }
})();
