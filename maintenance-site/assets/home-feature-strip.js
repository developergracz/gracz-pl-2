(() => {
  'use strict';

  const strip = document.querySelector('.home-feature-strip');
  const hideButton = document.querySelector('[data-home-feature-hide]');
  if (!strip || !hideButton) return;

  const storageKey = 'graczHomeFeatureStripHiddenR1';

  function createRestoreButton() {
    if (document.querySelector('[data-home-feature-restore]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-feature-restore';
    button.setAttribute('data-home-feature-restore', '');
    button.textContent = 'POKAŻ POLECANE';
    button.addEventListener('click', () => {
      try { localStorage.removeItem(storageKey); } catch (_) {}
      strip.hidden = false;
      requestAnimationFrame(() => strip.classList.remove('is-hiding'));
      button.remove();
      hideButton.focus();
    });
    document.body.appendChild(button);
  }

  function hideStrip({ persist = true } = {}) {
    if (persist) {
      try { localStorage.setItem(storageKey, '1'); } catch (_) {}
    }
    strip.classList.add('is-hiding');
    window.setTimeout(() => {
      strip.hidden = true;
      createRestoreButton();
    }, 260);
  }

  hideButton.addEventListener('click', () => hideStrip());

  let shouldHide = false;
  try { shouldHide = localStorage.getItem(storageKey) === '1'; } catch (_) {}
  if (shouldHide) {
    strip.hidden = true;
    createRestoreButton();
  }
})();