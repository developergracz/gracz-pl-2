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
  var mobileQuery = window.matchMedia('(max-width: 1023px)');

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

    // Close when focus leaves the menu entirely.
    item.addEventListener('focusout', function (event) {
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

  /* ---------- Exact-reference desktop dropdowns ---------- */

  var refMenus = Array.prototype.slice.call(document.querySelectorAll('[data-ref-menu]'));

  function closeRefMenus(except) {
    refMenus.forEach(function (item) {
      if (item === except) return;
      var toggle = item.querySelector('[data-ref-toggle]');
      var popover = item.querySelector('.ref-popover');
      if (!toggle || !popover) return;
      toggle.setAttribute('aria-expanded', 'false');
      popover.hidden = true;
    });
  }

  refMenus.forEach(function (item) {
    var toggle = item.querySelector('[data-ref-toggle]');
    var popover = item.querySelector('.ref-popover');
    if (!toggle || !popover) return;

    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var opening = popover.hidden;
      closeRefMenus(item);
      popover.hidden = !opening;
      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
    });

    item.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !popover.hidden) {
        popover.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
        event.preventDefault();
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-ref-menu]')) closeRefMenus();
  });

})();
