/* Keep the complete, owner-approved cascade without blocking first paint.
   Media=print keeps the request non-render-blocking. The matching script is
   same-origin under the existing CSP; no inline event handlers required. */
(() => {
  const sheet = document.querySelector('link[data-home-full-css]');
  if (!sheet) return;
  const enable = () => { sheet.media = 'all'; };
  if (sheet.sheet) enable();
  else sheet.addEventListener('load', enable, {once: true});
})();
