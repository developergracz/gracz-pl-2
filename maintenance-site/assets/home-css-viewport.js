/* Select one parser-early homepage stylesheet; never download both viewport variants. */
(() => {
  "use strict";
  const mobile = window.matchMedia("(max-width:680px)").matches;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = mobile
    ? "/assets/home-lcp-bundle-r1-mobile.css?v=20261106-mobile-v1"
    : "/assets/home-lcp-bundle-r1.css?v=css-lcp-20261106-unused-css-prune-r1";
  document.head.appendChild(link);
})();
