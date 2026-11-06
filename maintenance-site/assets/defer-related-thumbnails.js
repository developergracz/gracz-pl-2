/* GRACZ.PL: defer related-card decoration until approaching the viewport.
 * All other page styles remain unchanged and available on first paint. */
(() => {
  "use strict";
  const target = document.querySelector(".related-card");
  if (!target) return;
  let loaded = false;
  const load = () => {
    if (loaded || document.querySelector('link[data-related-thumbnails]')) return;
    loaded = true;
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = "/assets/related-thumbnails.css?v=category-tiles-r3";
    sheet.setAttribute("data-related-thumbnails", "");
    document.head.appendChild(sheet);
  };
  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, {rootMargin: "1600px 0px"});
  observer.observe(target);
  // Preserve decorated cards after following deep links to the related area.
  if (location.hash && (location.hash === "#" + target.id || target.querySelector(location.hash))) {
    observer.disconnect();
    load();
  }
})();
