(() => {
  "use strict";
  // Load below-the-fold newsletter adjustments without another blocking CSS link.
  if (!document.body.classList.contains("homepage-premium-max")) return;
  // Reuse only the Full Max Premium rules; legacy R16 styles must not load.
  // Newsletter premium is below the fold: keep the single critical CSS request.
  if (!document.querySelector("link[data-newsletter-fullmax-home]")) {
    const premium=document.createElement("link");
    premium.rel="stylesheet";
    premium.href="/assets/newsletter-home-fullmax-r1.css?v=20261105-email-phone-r3";
    premium.setAttribute("data-newsletter-fullmax-home","");
    document.head.appendChild(premium);
  }
})();
