/* GRACZ.PL: approved GRACZ NEXT preview adapted for the existing legacy homepage.
   No game engine, API, requests or live game state are mounted in this promotional console. */
(() => {
  'use strict';

  const hero = document.querySelector('#public-portal[data-page="home"] .owner-accepted-hero');
  if (!hero) return;

  const slides = ['warcaby', 'szachy', 'gomoku', 'soon'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, slides.indexOf(hero.getAttribute('data-hero-slide')));
  let timer = null;
  let pausedByUser = false;
  let hoveringAction = false;
  const cta = hero.querySelector('.r4-game-cta-stack');

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'portal-rotation-toggle';
  pause.textContent = 'Wstrzymaj pokaz';
  pause.setAttribute('aria-pressed', 'false');
  pause.setAttribute('aria-label', 'Wstrzymaj automatyczną zmianę plansz');
  hero.appendChild(pause);

  function schedule() {
    window.clearTimeout(timer);
    if (
      pausedByUser ||
      reducedMotion.matches ||
      document.hidden ||
      hoveringAction ||
      (cta && cta.contains(document.activeElement))
    ) return;

    timer = window.setTimeout(() => {
      current = (current + 1) % slides.length;
      hero.setAttribute('data-hero-slide', slides[current]);
      schedule();
    }, 5000);
  }

  pause.addEventListener('click', () => {
    pausedByUser = !pausedByUser;
    pause.setAttribute('aria-pressed', String(pausedByUser));
    pause.textContent = pausedByUser ? 'Wznów pokaz' : 'Wstrzymaj pokaz';
    pause.setAttribute('aria-label', pausedByUser ? 'Wznów automatyczną zmianę plansz' : 'Wstrzymaj automatyczną zmianę plansz');
    schedule();
  });

  if (cta) {
    cta.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      hoveringAction = true;
      schedule();
    });
    cta.addEventListener('pointerleave', () => {
      hoveringAction = false;
      schedule();
    });
    cta.addEventListener('focusin', schedule);
    cta.addEventListener('focusout', () => window.queueMicrotask(schedule));
  }

  document.addEventListener('visibilitychange', schedule);
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', schedule);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(schedule);
  }
  schedule();
})();
