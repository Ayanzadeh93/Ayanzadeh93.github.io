/* Reveal-on-scroll for the homepage's Projects cards. Loaded with `defer`; no
   dependencies.

   This file used to also inject a scroll-progress bar, a back-to-top button, a
   nav shadow and a copy-email chip for the old hero. Those belonged to markup
   that no longer exists (and the back-to-top button was permanently visible
   under prefers-reduced-motion), so only the card reveal remains. Its
   behaviour is unchanged: css/polish.css still styles `.reveal`. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Reveal on scroll ---------- */
  /* Whole `.section` wrappers are intentionally excluded: main.js already
     drives card-level `.animate-in`, and hiding an entire section would leave
     it at opacity:0 until a second observer fired. */
  var revealTargets = document.querySelectorAll(
    ".metrics-grid .metric, .project-card, .news-card, .focus-card"
  );
  if (!reduceMotion && "IntersectionObserver" in window) {
    revealTargets.forEach(function (el, i) {
      el.classList.add("reveal");
      // Small stagger for items sharing a parent grid. The +3 keeps each
      // project card on the delay it had when eleven other tiles preceded it.
      el.style.setProperty("--reveal-delay", ((i + 3) % 4) * 60 + "ms");
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "80px 0px 80px 0px", threshold: 0.01 }
    );
    revealTargets.forEach(function (el) {
      observer.observe(el);
    });

    window.setTimeout(function () {
      document.querySelectorAll(".reveal:not(.reveal-visible)").forEach(function (el) {
        el.classList.add("reveal-visible");
      });
    }, 2000);
  }
})();
