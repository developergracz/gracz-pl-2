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
    // The opening includes a capture and a short forced follow-up.
    warcaby: [[42, 35], [19, 26], [44, 37], [21, 28], [35, 21, 28], [12, 30, 21], [30, 44, 37]],
    // Legal chess opening: e4, ...e5, Nf3, ...Nc6, Bc4.
    szachy: [[52, 36], [12, 28], [62, 45], [1, 18], [61, 34], [6, 21], [57, 42], [5, 26]],
    // 15x15 free intersections near an existing mid-game position.
    gomoku: [[82, 'white'], [158, 'black'], [111, 'white'], [159, 'black'], [83, 'white'], [142, 'black'], [115, 'white']]
  };
  // These are four existing GRACZ.PL checkers bot portraits, used only in the promotional panel.
  const botProfiles = {
    warcaby: { name: 'Mila', id: 'N1', src: '/assets/checkers-bot-mila-n1.webp' },
    szachy: { name: 'Kaja', id: 'T1', src: '/assets/checkers-bot-kaja-t1.webp' },
    gomoku: { name: 'Sara', id: 'E1', src: '/assets/checkers-bot-sara-e1.webp' },
    soon: { name: 'Wiktor', id: 'A1', src: '/assets/checkers-bot-wiktor-a1.webp' }
  };
  const botPhoto = hero.querySelector('.owner-bot-person img');
  const botName = hero.querySelector('.owner-bot-name');
  const botGreeting = hero.querySelector('.owner-bot-greeting');
  const clockBotName = hero.querySelector('.owner-clock-bot-name');
  function showBot(name) {
    const bot = botProfiles[name];
    if (!bot) return;
    if (botPhoto) {
      if (botPhoto.getAttribute('src') !== bot.src) botPhoto.setAttribute('src', bot.src);
      botPhoto.alt = bot.name + ' (' + bot.id + ') — bot GRACZ.PL';
    }
    if (botName) botName.textContent = bot.name + ' · ' + bot.id;
    if (botGreeting) botGreeting.textContent = 'Jestem ' + bot.name + ', zagraj ze mną!';
    if (clockBotName) clockBotName.textContent = bot.name;
  }

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
  // Two lightweight demonstration clocks. They are not the actual online game clocks.
  // Side 0 is the bot (left); side 1 is the visitor (right, first move).
  const clockFaces = [...hero.querySelectorAll('.owner-clocks b')];
  const clockSides = [...hero.querySelectorAll('.owner-clocks > div')];
  const clockStart = 7 * 60 * 1000;
  let clockRemaining = [clockStart, clockStart];
  let clockActive = 1;
  let lastClockTick = Date.now();

  function paintClocks() {
    for (let side = 0; side < clockFaces.length; side++) {
      const seconds = Math.ceil(Math.max(0, clockRemaining[side]) / 1000);
      const display = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
        String(seconds % 60).padStart(2, '0');
      clockFaces[side].textContent = display;
      clockSides[side]?.classList.toggle('owner-clock-active',
        clockActive === side && Boolean(examples[slides[current]]) && !stopped());
    }
  }

  function advanceClocks() {
    const now = Date.now();
    if (clockActive !== null && examples[slides[current]] && !stopped()) {
      clockRemaining[clockActive] = Math.max(0,
        clockRemaining[clockActive] - Math.max(0, now - lastClockTick));
    }
    lastClockTick = now;
    paintClocks();
  }

  function resetClocks(name) {
    clockRemaining = [clockStart, clockStart];
    clockActive = examples[name] ? 1 : null;
    lastClockTick = Date.now();
    paintClocks();
  }

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
      cells.forEach(cell => cell.classList.remove('preview-from', 'preview-to', 'preview-moving-cell'));
      for (const { node, index } of initial[name]) {
        if (typeof node.getAnimations === 'function') {
          node.getAnimations().forEach(animation => animation.cancel());
        }
        node.classList.remove('preview-moving-piece');
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
    // Raise the target cell above every neighbouring square while the piece
    // travels from its previous position; otherwise it passes underneath them.
    target.classList.add('preview-moving-cell');
    node.classList.add('preview-moving-piece');
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
      const animation = node.animate(
        [{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'translate(0, 0)' }],
        { duration: 380, easing: 'ease-in-out' }
      );
      const clearLayer = () => {
        target.classList.remove('preview-moving-cell');
        node.classList.remove('preview-moving-piece');
      };
      animation.addEventListener('finish', clearLayer, { once: true });
      animation.addEventListener('cancel', clearLayer, { once: true });
    } else {
      target.classList.remove('preview-moving-cell');
      node.classList.remove('preview-moving-piece');
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
            { duration: 320, easing: 'ease-out' }
          );
        }
      }
    } else {
      const [from, to, captured] = step;
      const source = boards[name][from];
      const target = boards[name][to];
      const node = source?.querySelector(name === 'warcaby' ? '.owner-piece' : '.owner-chess-piece');
      if (node && target && !target.querySelector(name === 'warcaby' ? '.owner-piece' : '.owner-chess-piece')) {
        if (name === 'warcaby' && Number.isInteger(captured)) {
          const taken = boards[name][captured]?.querySelector('.owner-piece');
          if (taken) taken.remove();
        }
        boards[name].forEach(cell => cell.classList.remove('preview-from', 'preview-to'));
        animateMove(node, source, target);
      }
    }
    moveIndex++;
    // A completed demonstration move starts the opponent's countdown.
    advanceClocks();
    if (clockActive !== null) {
      clockActive = 1 - clockActive;
      lastClockTick = Date.now();
      paintClocks();
    }
    const board = hero.querySelector('.owner-slide[data-owner-slide="' + name + '"]');
    if (board) board.dataset.previewMoves = String(moveIndex);
    if (caption) {
      const names = { warcaby: 'Warcaby', szachy: 'Szachy', gomoku: 'Gomoku' };
      caption.textContent = names[name] + ' — ruch pokazowy ' + moveIndex + '/' + moves.length;
    }
    if (moveIndex < moves.length) moveTimer = window.setTimeout(makeMove, 1500);
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
      advanceClocks();
      const oldName = slides[current];
      current = (current + 1) % slides.length;
      hero.setAttribute('data-hero-slide', slides[current]);
      resetClocks(slides[current]);
      showBot(slides[current]);
      reset(oldName);
      reset(slides[current]);
      moveIndex = 0;
      if (caption) caption.textContent = slides[current] === 'soon'
        ? 'W niedługim czasie więcej gier!' : defaultCaption;
      schedule();
    }, durations[name]);
    if (examples[name] && moveIndex < examples[name].length) {
      moveTimer = window.setTimeout(makeMove, 900);
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
  showBot(slides[current]);
  resetClocks(slides[current]);
  window.setInterval(advanceClocks, 160);
  schedule();
})();
