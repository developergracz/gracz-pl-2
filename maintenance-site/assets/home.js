/*
 * gracz.pl — homepage UI interactions only (menu, dropdowns, informational
 * modal). No network requests, no storage, no data collection.
 */
(function () {
  'use strict';

  var MESSAGES = {
    community: {
      title: 'Funkcje społecznościowe są w przygotowaniu',
      text: 'Pracujemy nad profilem gracza, rankingami, turniejami i funkcjami społecznościowymi. Udostępnimy je w kolejnych etapach rozwoju gracz.pl.',
      button: 'Rozumiem'
    },
    search: {
      title: 'Wyszukiwarka jest w przygotowaniu',
      text: 'Wyszukiwanie w serwisie zostanie uruchomione wraz z kolejnymi funkcjami gracz.pl.',
      button: 'Zamknij'
    },
    login: {
      title: 'Logowanie nie jest jeszcze aktywne',
      text: 'System kont użytkowników jest obecnie przygotowywany. Logowanie udostępnimy w kolejnym etapie rozwoju gracz.pl.',
      button: 'Rozumiem'
    },
    register: {
      title: 'Rejestracja nie jest jeszcze aktywna',
      text: 'Możliwość zakładania kont zostanie uruchomiona po zakończeniu przygotowania systemu użytkowników gracz.pl.',
      button: 'Rozumiem'
    },
    next: {
      title: 'Gracz Next jest w rozwoju',
      text: 'Budujemy wspólne środowisko gier, profilu gracza, rankingów, poradników i funkcji społecznościowych. Kolejne elementy będziemy uruchamiać etapami.',
      button: 'Rozumiem'
    },
    newsletter: {
      title: 'Newsletter jest w przygotowaniu',
      text: 'Możliwość zapisania się na informacje o nowych funkcjach gracz.pl uruchomimy w kolejnym etapie.',
      button: 'Rozumiem'
    },
    updates: {
      title: 'Aktualności są w przygotowaniu',
      text: 'Sekcję aktualności uruchomimy wraz z kolejnymi publicznymi funkcjami gracz.pl.',
      button: 'Rozumiem'
    },
    privacy: {
      title: 'Polityka prywatności',
      text: 'Polityka prywatności jest przygotowywana.',
      button: 'Rozumiem'
    },
    terms: {
      title: 'Regulamin',
      text: 'Regulamin serwisu jest przygotowywany.',
      button: 'Rozumiem'
    },
    contact: {
      title: 'Kontakt',
      text: 'Sekcja kontaktowa zostanie udostępniona wraz z kolejnym etapem serwisu.',
      button: 'Rozumiem'
    },
    'social-facebook': {
      title: 'gracz.pl na Facebooku',
      text: 'Ten kanał gracz.pl jest jeszcze przygotowywany.',
      button: 'Rozumiem'
    },
    'social-youtube': {
      title: 'gracz.pl na YouTube',
      text: 'Ten kanał gracz.pl jest jeszcze przygotowywany.',
      button: 'Rozumiem'
    },
    'social-discord': {
      title: 'gracz.pl na Discordzie',
      text: 'Ten kanał gracz.pl jest jeszcze przygotowywany.',
      button: 'Rozumiem'
    }
  };

  var body = document.body;
  var header = document.querySelector('.site-header');
  var burger = document.querySelector('.burger');
  var mobileQuery = window.matchMedia('(max-width: 1179px)');

  /* ---------- Dropdown menus ---------- */

  var menuItems = Array.prototype.slice.call(document.querySelectorAll('.has-menu'));

  function canHover() {
    return !mobileQuery.matches && window.matchMedia('(hover: hover)').matches;
  }

  function toggleOf(item) {
    return item.querySelector('.menu-toggle');
  }

  function setMenu(item, open) {
    item.classList.toggle('is-open', open);
    toggleOf(item).setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeMenus(except) {
    menuItems.forEach(function (item) {
      if (item !== except) setMenu(item, false);
    });
  }

  menuItems.forEach(function (item) {
    var toggle = toggleOf(item);

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      var open = !item.classList.contains('is-open');
      // A mouse click right after hover-open should keep the menu open.
      if (event.detail > 0 && canHover()) open = true;
      closeMenus(item);
      setMenu(item, open);
    });

    // Hover opens on pointer devices (desktop layout only).
    item.addEventListener('mouseenter', function () {
      if (canHover()) {
        closeMenus(item);
        setMenu(item, true);
      }
    });
    item.addEventListener('mouseleave', function () {
      if (canHover()) {
        setMenu(item, false);
      }
    });

    // Close when focus leaves the menu entirely (desktop only: in the mobile
    // accordion, collapsing on mousedown would shift the item being tapped).
    item.addEventListener('focusout', function (event) {
      if (mobileQuery.matches) return;
      if (!item.contains(event.relatedTarget)) setMenu(item, false);
    });

    // Arrow-key movement inside an open dropdown.
    item.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var entries = Array.prototype.slice.call(item.querySelectorAll('.dropdown a, .dropdown button'));
      if (!entries.length) return;
      if (!item.classList.contains('is-open')) setMenu(item, true);
      var index = entries.indexOf(document.activeElement);
      var next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next < 0) next = entries.length - 1;
      if (next >= entries.length) next = 0;
      entries[next].focus();
      event.preventDefault();
    });
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.has-menu')) closeMenus();
  });

  /* ---------- Mobile menu ---------- */

  function setPanel(open) {
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    if (!open) closeMenus();
  }

  burger.addEventListener('click', function () {
    setPanel(!header.classList.contains('menu-open'));
  });

  mobileQuery.addEventListener('change', function () {
    setPanel(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || modal.open) return;
    var openItem = menuItems.filter(function (item) { return item.classList.contains('is-open'); })[0];
    if (openItem) {
      setMenu(openItem, false);
      toggleOf(openItem).focus();
    } else if (header.classList.contains('menu-open')) {
      setPanel(false);
      burger.focus();
    }
  });

  /* ---------- Informational modal ---------- */

  var modal = document.getElementById('modal');
  var modalTitle = document.getElementById('modal-title');
  var modalText = document.getElementById('modal-text');
  var modalOk = modal.querySelector('.modal-ok');
  var lastTrigger = null;

  function openModal(key, trigger) {
    var message = MESSAGES[key];
    if (!message) return;
    lastTrigger = trigger || document.activeElement;
    closeMenus();
    setPanel(false);
    modalTitle.textContent = message.title;
    modalText.textContent = message.text;
    modalOk.textContent = message.button;
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    body.classList.add('modal-open');
    modalOk.focus();
  }

  function closeModal() {
    if (typeof modal.close === 'function' && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute('open');
      onClosed();
    }
  }

  function onClosed() {
    body.classList.remove('modal-open');
    if (lastTrigger && document.contains(lastTrigger) && lastTrigger.offsetParent !== null) {
      lastTrigger.focus();
    } else if (burger.offsetParent !== null) {
      burger.focus();
    }
    lastTrigger = null;
  }

  modal.addEventListener('close', onClosed);

  modal.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeModal();
  });

  modal.addEventListener('click', function (event) {
    // A click on the <dialog> element itself (not the box) is a backdrop click.
    if (event.target === modal || event.target.closest('[data-close]')) closeModal();
  });

  // Keep Tab / Shift+Tab inside the dialog (also for the non-showModal fallback).
  modal.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusables = modal.querySelectorAll('button');
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  });

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-modal]');
    if (!trigger) return;
    event.preventDefault();
    openModal(trigger.getAttribute('data-modal'), trigger);
  });

  /* Newsletter: no backend yet — never send or store the address. */
  var newsForm = document.querySelector('[data-newsletter]');
  if (newsForm) {
    newsForm.addEventListener('submit', function (event) {
      event.preventDefault();
      openModal('newsletter', newsForm.querySelector('button'));
    });
  }



  /* ---------- Homepage Academy progress ---------- */
  var HOME_ACADEMY_CONFIG = {
    poker: {
      key: 'graczPokerAcademyProgressV1',
      modules: ['zasady','uklady','pozycja','decyzje','matematyka','quiz']
    },
    tysiac: {
      key: 'graczTysiacAcademyProgressV1',
      modules: ['zasady','licytacja','meldunki','ruch','punktacja','quiz']
    },
    warcaby: {
      key: 'graczWarcabyAcademyProgressV1',
      modules: ['podstawy','bicie','seria','damka','strategia','quiz']
    },
    gomoku: {
      key: 'graczGomokuAcademyProgressV1',
      modules: ['podstawy','zagrozenia','atak','ruch','strategia','quiz']
    }
  };

  function readHomeAcademyProgress(config) {
    try {
      var raw = window.localStorage.getItem(config.key);
      var data = raw ? JSON.parse(raw) : {};
      var done = config.modules.filter(function (module) { return !!data[module]; }).length;
      return {
        done: done,
        total: config.modules.length,
        pct: Math.round((done / config.modules.length) * 100)
      };
    } catch (error) {
      return { done: 0, total: config.modules.length, pct: 0 };
    }
  }

  function renderHomeAcademyProgress() {
    var panel = document.querySelector('[data-home-academy-progress]');
    if (!panel) return;

    var sum = 0;
    var started = 0;
    var completed = 0;

    Object.keys(HOME_ACADEMY_CONFIG).forEach(function (name) {
      var progress = readHomeAcademyProgress(HOME_ACADEMY_CONFIG[name]);
      var card = panel.querySelector('[data-home-progress-game="' + name + '"]');
      if (!card) return;

      var value = card.querySelector('[data-home-progress-value]');
      var fill = card.querySelector('[data-home-progress-fill]');
      var action = card.querySelector('[data-home-progress-action]');

      if (value) value.textContent = progress.pct + '%';
      if (fill) fill.style.width = progress.pct + '%';
      if (action) {
        action.textContent = progress.pct >= 100 ? 'Powtórz' : (progress.pct > 0 ? 'Kontynuuj' : 'Rozpocznij');
      }

      card.classList.toggle('is-started', progress.pct > 0);
      card.classList.toggle('is-complete', progress.pct >= 100);
      card.setAttribute('aria-label',
        (card.querySelector('.home-progress-game__name strong') || {}).textContent +
        ': ' + progress.pct + ' procent. ' +
        (progress.pct >= 100 ? 'Ścieżka ukończona.' : (progress.pct > 0 ? 'Kontynuuj naukę.' : 'Rozpocznij naukę.'))
      );

      sum += progress.pct;
      if (progress.pct > 0) started++;
      if (progress.pct >= 100) completed++;
    });

    var totalPct = Math.round(sum / 4);
    var total = panel.querySelector('[data-home-academy-total]');
    var summary = panel.querySelector('[data-home-academy-summary]');
    if (total) total.textContent = totalPct + '%';

    if (summary) {
      if (completed === 4) {
        summary.textContent = 'Wszystkie ścieżki ukończone — możesz wracać do ćwiczeń';
      } else if (started === 0) {
        summary.textContent = 'Rozpocznij pierwszą ścieżkę Academy';
      } else if (completed > 0) {
        summary.textContent = completed + ' z 4 ścieżek ukończonych';
      } else {
        summary.textContent = 'Masz rozpoczęte ' + started + ' z 4 ścieżek';
      }
    }
  }

  renderHomeAcademyProgress();

  window.addEventListener('storage', function (event) {
    var keys = Object.keys(HOME_ACADEMY_CONFIG).map(function (name) {
      return HOME_ACADEMY_CONFIG[name].key;
    });
    if (keys.indexOf(event.key) !== -1) renderHomeAcademyProgress();
  });

})();
