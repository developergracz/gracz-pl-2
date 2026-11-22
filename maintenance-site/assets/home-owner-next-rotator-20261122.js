/* GRACZ.PL homepage demonstration — original boards, no game runtime or network calls.
   The scripted examples are legal opening moves, not real online matches. */
(() => {
  'use strict';

  const hero = document.querySelector('#public-portal[data-page="home"] .owner-accepted-hero');
  if (!hero) return;

  const slides = ['warcaby', 'szachy', 'gomoku', 'soon'];
  const durations = { warcaby: 12000, szachy: 12000, gomoku: 12000, soon: 6000 };
  const examples = {
    // 8x8 grid index = row * 8 + column; dark-square diagonal moves.
    warcaby: [[42, 35], [19, 26], [44, 37], [21, 28]],
    // Legal chess opening: e4, ...e5, Nf3, ...Nc6, Bc4.
    szachy: [[52, 36], [12, 28], [62, 45], [1, 18], [61, 34]],
    // 15x15 free intersections near an existing mid-game position.
    gomoku: [[82, 'white'], [158, 'black'], [111, 'white'], [159, 'black']]
  };
  const boardNames = ['warcaby', 'szachy'];
  const boards = {};
  const initial = {};
  for (const name of boardNames) {
    const board = hero.querySelector('.owner-slide[data-owner-slide="' + name + '"]');
    const cells = board ? [...board.querySelectorAll('.owner-square')] : [];
    const positions = cells.flatMap((cell, index) =>
      [...cell.querySelectorAll(name === 'warcaby' ? '.owner-piece' : '.owner-chess-piece')]
        .map(node => ({ node, index })));
    boards[name] = cells;
    initial[name] = positions;
  }
  const gomoku = hero.querySelectorAll('.owner-slide[data-owner-slide="gomoku"] .owner-gomoku-cell');
  const caption = hero.querySelector('.owner-panel-caption');
  const defaultCaption = caption?.textContent || '';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, slides.indexOf(hero.getAttribute('data-hero-slide')));
  let timer = null;
  let moveTimer = null;
  let moveIndex = 0;
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

  function reset(name) {
    const cells = boards[name];
    if (cells) {
      cells.forEach(cell => cell.classList.remove('preview-from', 'preview-to'));
      for (const { node, index } of initial[name]) {
        if (typeof node.getAnimations === 'function') {
          node.getAnimations().forEach(animation => animation.cancel());
        }
        if (node.parentElement !== cells[index]) cells[index].appendChild(node);
      }
    }
    if (name === 'gomoku') {
      for (const stone of hero.querySelectorAll('[data-preview-stone]')) stone.remove();
      gomoku.forEach(cell => cell.classList.remove('preview-to'));
    }
    const board = hero.querySelector('.owner-slide[data-owner-slide="' + name + '"]');
    if (board) board.removeAttribute('data-preview-moves');
  }

  function animateMove(node, source, target) {
    const from = source.getBoundingClientRect();
    target.appendChild(node);
    const to = node.getBoundingClientRect();
    // Transform the already-moved piece from its previous screen position;
    // there is no duplicate or layout-shifting absolutely positioned copy.
    if (typeof node.animate === 'function') {
      const toCenterX = to.left + to.width / 2;
      const toCenterY = to.top + to.height / 2;
      const fromCenterX = from.left + from.width / 2;
      const fromCenterY = from.top + from.height / 2;
      // Source and target squares are identical in size; account for their
      // difference in absolute position rather than resizing the piece.
      const dx = fromCenterX - toCenterX;
      const dy = fromCenterY - toCenterY;
      node.animate(
        [{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'translate(0, 0)' }],
        { duration: 520, easing: 'ease-in-out' }
      );
    }
    source.classList.add('preview-from');
    target.classList.add('preview-to');
  }

  function makeMove() {
    const name = slides[current];
    const moves = examples[name];
    if (!moves || moveIndex >= moves.length || stopped()) return;
    const step = moves[moveIndex];
    if (name === 'gomoku') {
      const [position, color] = step;
      const cell = gomoku[position];
      if (cell && !cell.querySelector('.owner-gomoku-stone')) {
        const stone = document.createElement('i');
        stone.className = 'owner-gomoku-stone' + (color === 'white' ? ' white' : '');
        stone.dataset.previewStone = '1';
        cell.appendChild(stone);
        cell.classList.add('preview-to');
        if (typeof stone.animate === 'function') {
          stone.animate(
            [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 480, easing: 'ease-out' }
          );
        }
      }
    } else {
      const [from, to] = step;
      const source = boards[name][from];
      const target = boards[name][to];
      const node = source?.querySelector(name === 'warcaby' ? '.owner-piece' : '.owner-chess-piece');
      if (node && target && !target.querySelector(name === 'warcaby' ? '.owner-piece' : '.owner-chess-piece')) {
        boards[name].forEach(cell => cell.classList.remove('preview-from', 'preview-to'));
        animateMove(node, source, target);
      }
    }
    moveIndex++;
    const board = hero.querySelector('.owner-slide[data-owner-slide="' + name + '"]');
    if (board) board.dataset.previewMoves = String(moveIndex);
    if (caption) {
      const names = { warcaby: 'Warcaby', szachy: 'Szachy', gomoku: 'Gomoku' };
      caption.textContent = names[name] + ' — ruch pokazowy ' + moveIndex + '/' + moves.length;
    }
    if (moveIndex < moves.length) moveTimer = window.setTimeout(makeMove, 2250);
  }

  function stopped() {
    return pausedByUser || reducedMotion.matches || document.hidden ||
      hoveringAction || (cta && cta.contains(document.activeElement));
  }

  function schedule() {
    window.clearTimeout(timer);
    window.clearTimeout(moveTimer);
    if (stopped()) return;
    const name = slides[current];
    timer = window.setTimeout(() => {
      const oldName = slides[current];
      current = (current + 1) % slides.length;
      hero.setAttribute('data-hero-slide', slides[current]);
      reset(oldName);
      reset(slides[current]);
      moveIndex = 0;
      if (caption) caption.textContent = slides[current] === 'soon'
        ? 'W niedługim czasie więcej gier!' : defaultCaption;
      schedule();
    }, durations[name]);
    if (examples[name] && moveIndex < examples[name].length) {
      moveTimer = window.setTimeout(makeMove, 1700);
    }
  }

  pause.addEventListener('click', () => {
    pausedByUser = !pausedByUser;
    pause.setAttribute('aria-pressed', String(pausedByUser));
    pause.textContent = pausedByUser ? 'Wznów pokaz' : 'Wstrzymaj pokaz';
    pause.setAttribute('aria-label', pausedByUser
      ? 'Wznów automatyczną zmianę plansz' : 'Wstrzymaj automatyczną zmianę plansz');
    schedule();
  });
  if (cta) {
    cta.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { hoveringAction = true; schedule(); }
    });
    cta.addEventListener('pointerleave', () => {
      hoveringAction = false;
      schedule();
    });
    cta.addEventListener('focusin', schedule);
    cta.addEventListener('focusout', () => window.queueMicrotask(schedule));
  }
  document.addEventListener('visibilitychange', schedule);
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', schedule);
  else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(schedule);
  schedule();
})();
