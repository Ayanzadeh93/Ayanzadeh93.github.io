/* Runs synchronously in <head>, before first paint: applies the saved (or
   system) colour scheme so a dark-mode reader never sees a white flash, and
   marks the document as scripted so CSS can hide nothing without JS.
   Kept as a file rather than inline so the page's CSP needs no 'unsafe-inline'
   for scripts. Shares the `theme` storage key with the Projects pages. */
(function () {
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (error) { /* storage unavailable */ }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = saved === 'dark' || (saved !== 'light' && prefersDark);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.classList.add('js');
})();
