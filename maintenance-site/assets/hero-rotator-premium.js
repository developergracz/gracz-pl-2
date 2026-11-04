/* Static HERO presentation only. Reuses the approved image and one existing console.
   No iframe, game endpoint call, dynamic image download or DOM replacement per transition. */
(() => {
  'use strict';
  const hero = document.querySelector('.r4-hero');
  const board = hero?.querySelector('#r4-hero-checkers-board');
  if (!hero || !board) return;

  // Prebuild the two sets of 12 pieces once, while the initial Gomoku image is visible.
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < 8; row += 1) {
    if (row > 2 && row < 5) continue;
    for (let column = 0; column < 8; column += 1) {
      if ((row + column) % 2 !== 1) continue;
      const piece = document.createElement('span');
      piece.className = 'r4-console-piece r4-console-piece--' + (row < 3 ? 'black' : 'white');
      piece.style.setProperty('--x', String(column));
      piece.style.setProperty('--y', String(row));
      fragment.appendChild(piece);
    }
  }
  board.appendChild(fragment);

  const states = ['gomoku', 'warcaby', 'soon'];
  let index = 0;
  hero.dataset.heroSlide = states[index];

  // Users navigating by keyboard or hovering the HERO keep their current link.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  let hovered = false;
  let focused = false;
  for (const link of hero.querySelectorAll('.r4-hero-live-actions a, .r4-hero-actions a')) {
    link.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') hovered = true;
    });
    link.addEventListener('pointerleave', () => { hovered = false; });
  }
  hero.addEventListener('focusin', () => { focused = true; });
  hero.addEventListener('focusout', event => {
    if (!hero.contains(event.relatedTarget)) focused = false;
  });

  window.setInterval(() => {
    if (document.hidden || hovered || focused) return;
    index = (index + 1) % states.length;
    hero.dataset.heroSlide = states[index];
  }, 5000);
})();
