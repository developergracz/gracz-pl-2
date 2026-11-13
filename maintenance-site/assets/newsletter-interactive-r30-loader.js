(() => {
  "use strict";
  // The newsletter sits below the first screen. Its additional stylesheet must
  // not compete with the hero LCP image, fonts and critical homepage CSS.
  if (!document.body.classList.contains("homepage-premium-max")) return;

  let loaded = false;
  const loadNewsletterStyles = () => {
    if (loaded || document.querySelector("link[data-newsletter-fullmax-home]")) return;
    loaded = true;
    const premium = document.createElement("link");
    premium.rel = "stylesheet";
    premium.href = "/assets/newsletter-home-fullmax-r1.css?v=20261113-mobile-reflow-r1";
    premium.setAttribute("data-newsletter-fullmax-home", "");
    document.head.appendChild(premium);
  };

  const newsletter = document.getElementById("newsletter-home");
  // Progressive enhancement: the newsletter keeps its appearance even when
  // the observer API is unavailable or markup is unexpectedly different.
  if (!newsletter || !("IntersectionObserver" in window)) {
    loadNewsletterStyles();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    loadNewsletterStyles();
  }, { rootMargin: "1600px 0px" });

  observer.observe(newsletter);
  // Direct links to the newsletter must always receive the styles.
  if (location.hash === "#newsletter-home") {
    observer.disconnect();
    loadNewsletterStyles();
  }
})();
