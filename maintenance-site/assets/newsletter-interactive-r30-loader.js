(() => {
  "use strict";
  // Load below-the-fold newsletter adjustments without another blocking CSS link.
  if (!document.body.classList.contains("homepage-premium-max")) return;
  if (document.querySelector("link[data-newsletter-r30]")) return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.media="(min-width:961px)";
  link.href="/assets/newsletter-approved-interactive-r30.css?v=20261103";
  link.setAttribute("data-newsletter-r30","");
  document.head.appendChild(link);
  // Newsletter premium is below the fold: keep the single critical CSS request.
  if (!document.querySelector("link[data-newsletter-fullmax-home]")) {
    const premium=document.createElement("link");
    premium.rel="stylesheet";
    premium.href="/assets/newsletter-home-fullmax-r1.css?v=20261105";
    premium.setAttribute("data-newsletter-fullmax-home","");
    document.head.appendChild(premium);
  }
})();
