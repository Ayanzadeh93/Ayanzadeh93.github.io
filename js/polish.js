/* Polish layer: scroll progress, reveal-on-scroll, nav elevation,
   back-to-top, copy-email. Loaded with `defer`; no dependencies. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll progress bar ---------- */
  var progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);

  /* ---------- Nav elevation ---------- */
  var nav = document.querySelector(".top-navbar");

  /* ---------- Back to top ---------- */
  var backToTop = document.createElement("button");
  backToTop.className = "back-to-top";
  backToTop.type = "button";
  backToTop.setAttribute("aria-label", "Back to top");
  backToTop.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
  document.body.appendChild(backToTop);

  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var ratio = max > 0 ? doc.scrollTop / max : 0;
      progress.style.transform = "scaleX(" + ratio + ")";
      if (nav) nav.classList.toggle("nav-scrolled", doc.scrollTop > 8);
      backToTop.classList.toggle("visible", doc.scrollTop > 600);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = document.querySelectorAll(
    ".section, .metrics-grid .metric, .project-card, .news-card, .focus-card"
  );
  if (!reduceMotion && "IntersectionObserver" in window) {
    revealTargets.forEach(function (el, i) {
      el.classList.add("reveal");
      // Small stagger for items sharing a parent grid
      el.style.setProperty("--reveal-delay", (i % 4) * 60 + "ms");
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealTargets.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- Copy email chip next to the Email button ---------- */
  var emailLink = document.querySelector('.hero-links a[href^="mailto:"]');
  if (emailLink && window.navigator.clipboard) {
    var address = emailLink.getAttribute("href").replace("mailto:", "");
    var chip = document.createElement("button");
    chip.className = "copy-email-btn";
    chip.type = "button";
    chip.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i><span>Copy email</span>';
    chip.addEventListener("click", function () {
      window.navigator.clipboard.writeText(address).then(function () {
        chip.classList.add("copied");
        chip.querySelector("span").textContent = "Copied!";
        var status = document.getElementById("sr-status");
        if (status) status.textContent = "Email address copied to clipboard";
        window.setTimeout(function () {
          chip.classList.remove("copied");
          chip.querySelector("span").textContent = "Copy email";
        }, 2000);
      });
    });
    emailLink.insertAdjacentElement("afterend", chip);
  }
})();
