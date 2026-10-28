/* No inline handlers: preserves strict Content-Security-Policy. */
(() => {
  const sheet = document.querySelector('link[data-gracz-mobile-deferred]');
  if (!sheet) return;
  const activate = () => { sheet.media = '(max-width:680px)'; };
  if (sheet.sheet) activate();
  else sheet.addEventListener('load', activate, { once: true });
})();
