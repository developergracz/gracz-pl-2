(() => {
  'use strict';

  const strip = document.querySelector('.home-feature-strip');
  const hideButton = document.querySelector('[data-home-feature-hide]');
  if (!strip || !hideButton) return;

  function createRestoreButton() {
    if (document.querySelector('[data-home-feature-restore]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-feature-restore';
    button.setAttribute('data-home-feature-restore', '');
    button.setAttribute('aria-label', 'Pokaż ponownie pole polecanych funkcji');
    button.textContent = 'POKAŻ';

    button.addEventListener('click', () => {
      strip.hidden = false;
      strip.classList.remove('is-hiding');
      button.remove();
      window.requestAnimationFrame(() => hideButton.focus());
    });

    document.body.appendChild(button);
  }

  hideButton.addEventListener('click', () => {
    strip.classList.add('is-hiding');

    window.setTimeout(() => {
      strip.hidden = true;
      createRestoreButton();
    }, 260);
  });
})();