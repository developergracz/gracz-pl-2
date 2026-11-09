/* Select one homepage CSS file synchronously during HTML parsing.
 * Parser-inserted stylesheets are render-blocking: no unstyled first paint.
 * The approved full stylesheet is retained for no-JS visitors. */
(() => {
  "use strict";
  const media = window.matchMedia("(max-width:680px)");
  const mobileHref = "/assets/home-lcp-bundle-r1-mobile.css?v=20261106-mobile-v1&game-boards=r1&five-premium-cards=r1&chess-hover-preview=r2&checkers-hover-preview=r1&academy-graphics=r1";
  const fullHref = "/assets/home-lcp-bundle-r1.css?v=css-lcp-20261106-unused-css-prune-r1&game-boards=r1&five-premium-cards=r1&chess-hover-preview=r2&checkers-hover-preview=r1&academy-graphics=r1";
  const selected = media.matches ? mobileHref : fullHref;
  // This script is synchronous in <head>; document.write injects a parser-
  // inserted stylesheet, unlike appendChild which caused an observed CLS.
  document.write('<link rel="stylesheet" data-home-css-viewport href="' + selected + '">');
  const switchAtBreakpoint = (e) => {
    const link = document.querySelector("link[data-home-css-viewport]");
    if (link) link.href = e.matches ? mobileHref : fullHref;
  };
  if (media.addEventListener) media.addEventListener("change", switchAtBreakpoint);
  else if (media.addListener) media.addListener(switchAtBreakpoint);
})();
