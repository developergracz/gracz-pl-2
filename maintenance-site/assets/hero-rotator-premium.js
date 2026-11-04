/* GRACZ.PL HERO R3 — one fixed console, three prebuilt views: gomoku -> warcaby -> soon.
   The only runtime change is .r4-hero[data-hero-slide]; CSS swaps the panes and the game CTA.
   No game API, WebSocket, iframe, image request or DOM re-mounting per transition. */
(() => {
  'use strict';
  const hero = document.querySelector('.r4-hero[data-hero-slide]');
  if (!hero) return;

  // Build the Warcaby starting position (12 + 12 on dark squares) once, during initialisation.
  const board = hero.querySelector('#r4-hero-checkers-board');
  if (board && !board.childElementCount) {
    const squares = document.createDocumentFragment();
    for (let index = 0; index < 64; index += 1) {
      const row = Math.floor(index / 8);
      const dark = (row + index % 8) % 2 === 1;
      const square = document.createElement('span');
      square.className = dark ? 'r4-sq r4-sq--dark' : 'r4-sq';
      if (dark && (row < 3 || row > 4)) {
        const man = document.createElement('i');
        man.className = 'r4-man r4-man--' + (row < 3 ? 'black' : 'white');
        square.appendChild(man);
      }
      squares.appendChild(square);
    }
    board.appendChild(squares);
  }

  const slides = ['gomoku', 'warcaby', 'soon'];
  const interval = 5000;
  let index = Math.max(0, slides.indexOf(hero.dataset.heroSlide));
  let timer = 0;
  let hovered = false;
  let focused = false;

  const schedule = () => {
    window.clearTimeout(timer);
    if (hovered || focused) return;
    timer = window.setTimeout(() => {
      if (!document.hidden) {
        index = (index + 1) % slides.length;
        hero.dataset.heroSlide = slides[index];
      }
      schedule();
    }, interval);
  };

  // Rotation pauses only while the visitor interacts with the active game button.
  const cta = hero.querySelector('.r4-game-cta-stack');
  if (cta) {
    cta.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { hovered = true; schedule(); }
    });
    cta.addEventListener('pointerleave', () => { if (hovered) { hovered = false; schedule(); } });
    cta.addEventListener('focusin', () => { focused = true; schedule(); });
    cta.addEventListener('focusout', event => {
      if (!cta.contains(event.relatedTarget)) { focused = false; schedule(); }
    });
  }
  schedule();
})();
