/*
 * gracz.pl — Academy progress integrity helpers (Poker, Tysiąc, Warcaby, Gomoku).
 *
 * A module is completed only after a real action of the learner:
 *   - graded trainer session  -> finished with enough correct answers,
 *   - explore-only lab        -> every option has been inspected,
 *   - calculator              -> a valid calculation was produced,
 *   - reading-only step       -> the learner presses an explicit "mark as done" button,
 *   - quiz                    -> existing score criterion.
 * Following a roadmap/anchor link or merely scrolling past a section never completes a module.
 *
 * No network access, no data collection. State itself stays in each Academy script / localStorage key.
 */
(function () {
  'use strict';

  var NS = window.GraczAcademy = window.GraczAcademy || {};
  var painters = [];

  /** Share of correct answers needed to pass a trainer session (2 of 3). */
  NS.passMark = function (total) {
    return Math.ceil(total * 2 / 3);
  };

  /** Re-render every hint / mark button; Academy scripts call this from their render function. */
  NS.refresh = function () {
    painters.forEach(function (paint) { paint(); });
  };

  /** Status line appended to the end of a lab section (polite live region). */
  NS.hint = function (root) {
    if (!root) return null;
    var el = root.querySelector(':scope > .academy-hint');
    if (!el) {
      el = document.createElement('p');
      el.className = 'academy-hint';
      el.setAttribute('role', 'status');
      root.appendChild(el);
    }
    return el;
  };

  /** Instruction/status line for a lab whose completion is decided by the Academy script. */
  NS.status = function (root, textFn) {
    var hint = NS.hint(root);
    if (!hint) return;
    function paint() { hint.textContent = textFn(); }
    painters.push(paint);
    paint();
  };

  /**
   * Explore-only lab: completes after every distinct option was clicked at least once.
   * opts: { root, items, attr, isDone(), done() }
   */
  NS.explore = function (opts) {
    var root = opts.root;
    if (!root) return;
    var hint = NS.hint(root);
    var seen = {};
    var wasDone = false;

    function total() {
      var values = {};
      Array.prototype.forEach.call(root.querySelectorAll(opts.items), function (el) {
        values[el.getAttribute(opts.attr)] = true;
      });
      return Object.keys(values).length;
    }

    function paint() {
      var done = opts.isDone();
      if (wasDone && !done) seen = {};
      wasDone = done;
      hint.textContent = done
        ? 'Krok zaliczony.'
        : 'Zaliczenie kroku: sprawdź wszystkie opcje (' + Object.keys(seen).length + ' z ' + total() + ').';
    }

    root.addEventListener('click', function (e) {
      var el = e.target.closest(opts.items);
      if (!el || !root.contains(el)) return;
      seen[el.getAttribute(opts.attr)] = true;
      if (Object.keys(seen).length >= total() && !opts.isDone()) opts.done();
      paint();
    });

    painters.push(paint);
    paint();
  };

  /**
   * Reading-only step: explicit "mark as done" toggle placed right after the section.
   * opts: { sectionId, key, label, isDone(), toggle() }
   */
  NS.mark = function (opts) {
    var section = document.getElementById(opts.sectionId);
    if (!section || !section.parentNode) return;

    var box = document.createElement('div');
    box.className = 'academy-mark';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Postęp Academy — krok „' + opts.label + '”');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'academy-mark__btn';
    btn.setAttribute('data-academy-mark', opts.key);
    btn.addEventListener('click', function () { opts.toggle(); });

    var note = document.createElement('span');
    note.className = 'academy-mark__note';
    note.textContent = 'Ten krok nie ma osobnego ćwiczenia — zaznacz go sam po przerobieniu sekcji.';

    box.appendChild(btn);
    box.appendChild(note);
    section.parentNode.insertBefore(box, section.nextSibling);

    function paint() {
      var done = !!opts.isDone();
      btn.setAttribute('aria-pressed', done ? 'true' : 'false');
      btn.textContent = done
        ? '✓ Krok „' + opts.label + '” przerobiony — kliknij, aby cofnąć'
        : 'Oznacz krok „' + opts.label + '” jako przerobiony';
    }

    painters.push(paint);
    paint();
  };
})();
