(() => {
  'use strict';

  const MEASUREMENT_ID = 'G-1TJMKDNQR8';
  const STORAGE_KEY = 'gracz_cookie_consent_v1';
  const COOKIE_NAME = 'gracz_cookie_consent';
  const COOKIE_MAX_AGE = 15552000; // 180 days
  const CONSENT_TTL_MS = COOKIE_MAX_AGE * 1000;
  const PRIVACY_PATH = '/polityka-prywatnosci';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  let gaStarted = false;
  let gaScript = null;
  let gaLoadToken = 0;
  let currentChoice = null;
  let currentExpiresAt = 0;
  let lastFocused = null;
  const inertState = new Map();

  function isAllowedChoice(value) {
    return value === 'analytics' || value === 'denied';
  }

  function normalizeRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!isAllowedChoice(raw.value)) return null;
    const expiresAt = Number(raw.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return { value: raw.value, expiresAt };
  }

  function parseLocalRecord(raw) {
    if (!raw) return null;
    try {
      return normalizeRecord(JSON.parse(raw));
    } catch (_) {
      return null;
    }
  }

  function parseCookieRecord(raw) {
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      const parts = decoded.split('|');
      if (parts.length !== 3 || parts[0] !== 'v1') return null;
      return normalizeRecord({ value: parts[1], expiresAt: Number(parts[2]) });
    } catch (_) {
      return null;
    }
  }

  function safeRemoveLocalChoice() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function expireConsentCookie() {
    try {
      document.cookie = COOKIE_NAME + '=; Max-Age=0; Path=/; SameSite=Lax; Secure';
    } catch (_) {}
  }

  function readChoice() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseLocalRecord(raw);
        if (parsed) return parsed;
        safeRemoveLocalChoice();
      }
    } catch (_) {}

    try {
      const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
      if (match) {
        const parsed = parseCookieRecord(match[1]);
        if (parsed) return parsed;
        expireConsentCookie();
      }
    } catch (_) {}

    return null;
  }

  function writeChoice(value) {
    if (!isAllowedChoice(value)) return null;

    const expiresAt = Date.now() + CONSENT_TTL_MS;
    const record = { value, expiresAt };
    currentChoice = value;
    currentExpiresAt = expiresAt;

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (_) {}

    try {
      const cookieValue = encodeURIComponent('v1|' + value + '|' + expiresAt);
      document.cookie = COOKIE_NAME + '=' + cookieValue +
        '; Max-Age=' + COOKIE_MAX_AGE + '; Path=/; SameSite=Lax; Secure';
    } catch (_) {}

    return record;
  }

  function updateConsent(analyticsGranted) {
    window.gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function clearGACookies() {
    let cookies = '';
    try { cookies = document.cookie || ''; } catch (_) { return; }

    const names = cookies
      .split(';')
      .map(part => part.split('=')[0].trim())
      .filter(name => name === '_ga' || name.startsWith('_ga_'));

    const domains = [null];
    const host = location.hostname;
    if (host === 'gracz.pl' || host.endsWith('.gracz.pl')) {
      domains.push('gracz.pl', '.gracz.pl');
    }

    names.forEach(name => {
      domains.forEach(domain => {
        try {
          document.cookie = name + '=; Max-Age=0; Path=/' +
            (domain ? '; Domain=' + domain : '') +
            '; SameSite=Lax; Secure';
        } catch (_) {}
      });
    });
  }

  function invalidatePendingGA() {
    gaLoadToken += 1;
    if (gaScript && !gaScript.dataset.gccLoaded) {
      try { gaScript.remove(); } catch (_) {}
    }
    gaScript = null;
    gaStarted = false;
  }

  function startGA() {
    if (gaStarted || currentChoice !== 'analytics') return;

    window['ga-disable-' + MEASUREMENT_ID] = false;
    gaStarted = true;
    const token = ++gaLoadToken;
    const script = document.createElement('script');
    gaScript = script;
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);

    script.onload = () => {
      script.dataset.gccLoaded = '1';
      if (token !== gaLoadToken || currentChoice !== 'analytics') return;
      window.gtag('js', new Date());
      window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
    };

    script.onerror = () => {
      if (token === gaLoadToken) {
        gaStarted = false;
        gaScript = null;
      }
    };

    document.head.appendChild(script);
  }

  function applyChoice(choice) {
    if (choice === 'analytics') {
      updateConsent(true);
      startGA();
    } else {
      window['ga-disable-' + MEASUREMENT_ID] = true;
      updateConsent(false);
    }
  }

  function withdrawAnalyticsAndReload() {
    window['ga-disable-' + MEASUREMENT_ID] = true;
    updateConsent(false);
    invalidatePendingGA();
    clearGACookies();
    try {
      location.reload();
    } catch (_) {
      // If navigation is unavailable, the denied consent state remains active.
    }
  }

  function isPrivacyPage() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    return path === PRIVACY_PATH;
  }

  function setBackgroundInert(overlay) {
    inertState.clear();
    Array.from(document.body.children).forEach(node => {
      if (node === overlay) return;
      inertState.set(node, node.hasAttribute('inert'));
      node.setAttribute('inert', '');
    });
  }

  function restoreBackgroundInert() {
    inertState.forEach((wasInert, node) => {
      if (!node.isConnected) return;
      if (!wasInert) node.removeAttribute('inert');
    });
    inertState.clear();
  }

  function focusableElements(container) {
    return Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
  }

  function ensureUi() {
    if (document.getElementById('gracz-cookie-consent')) return;

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'gcc-settings-button';
    settingsButton.setAttribute('aria-label', 'Ustawienia cookies');
    settingsButton.innerHTML = '<span aria-hidden="true">🍪</span><span class="gcc-settings-label">Cookies</span>';
    document.body.appendChild(settingsButton);

    const overlay = document.createElement('div');
    overlay.id = 'gracz-cookie-consent';
    overlay.className = 'gcc-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="gcc-dialog" role="dialog" aria-modal="true" aria-labelledby="gcc-title" aria-describedby="gcc-desc">
        <div class="gcc-header">
          <div>
            <p class="gcc-kicker">gracz.pl</p>
            <h2 id="gcc-title">Ustawienia plików cookie</h2>
          </div>
          <button type="button" class="gcc-close" aria-label="Zamknij ustawienia">×</button>
        </div>
        <p id="gcc-desc" class="gcc-copy">
          Używamy niezbędnych mechanizmów do działania serwisu. Google Analytics uruchamiamy dopiero po Twojej zgodzie.
          Zgodę możesz w każdej chwili zmienić.
        </p>

        <div class="gcc-row gcc-row--locked">
          <div>
            <strong>Niezbędne</strong>
            <span>Podstawowe funkcje serwisu i zapamiętanie wyboru zgody.</span>
          </div>
          <span class="gcc-pill">Zawsze aktywne</span>
        </div>

        <label class="gcc-row gcc-row--toggle">
          <div>
            <strong>Analityka</strong>
            <span>Google Analytics 4 pomaga nam mierzyć ruch i ulepszać gracz.pl.</span>
          </div>
          <input id="gcc-analytics-toggle" type="checkbox">
          <span class="gcc-switch" aria-hidden="true"></span>
        </label>

        <div class="gcc-links">
          <a href="/polityka-prywatnosci/">Polityka prywatności</a>
        </div>

        <div class="gcc-actions">
          <button type="button" class="gcc-btn gcc-btn--secondary" data-gcc-reject>Odrzuć wszystko</button>
          <button type="button" class="gcc-btn gcc-btn--ghost" data-gcc-save>Zapisz wybór</button>
          <button type="button" class="gcc-btn gcc-btn--primary" data-gcc-accept>Akceptuj analitykę</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    const toggle = overlay.querySelector('#gcc-analytics-toggle');
    const close = overlay.querySelector('.gcc-close');

    function hideDialog(restoreFocus = true) {
      overlay.hidden = true;
      document.documentElement.classList.remove('gcc-open');
      restoreBackgroundInert();

      if (restoreFocus) {
        const target = lastFocused && lastFocused.isConnected ? lastFocused : settingsButton;
        setTimeout(() => target.focus(), 0);
      }
    }

    function showDialog(fromSettings) {
      const saved = readChoice();
      if (saved) {
        currentChoice = saved.value;
        currentExpiresAt = saved.expiresAt;
      }

      toggle.checked = currentChoice === 'analytics';
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : settingsButton;
      overlay.hidden = false;
      document.documentElement.classList.add('gcc-open');
      close.hidden = !fromSettings && !currentChoice;
      setBackgroundInert(overlay);

      const initial = currentChoice ? close : overlay.querySelector('[data-gcc-reject]');
      setTimeout(() => initial.focus(), 0);
    }

    function finish(choice) {
      const previous = currentChoice;
      writeChoice(choice);

      if (choice === 'denied' && (previous === 'analytics' || gaStarted)) {
        hideDialog(false);
        withdrawAnalyticsAndReload();
        return;
      }

      applyChoice(choice);
      hideDialog(true);
    }

    settingsButton.addEventListener('click', () => showDialog(true));
    overlay.querySelector('[data-gcc-reject]').addEventListener('click', () => finish('denied'));
    overlay.querySelector('[data-gcc-accept]').addEventListener('click', () => finish('analytics'));
    overlay.querySelector('[data-gcc-save]').addEventListener('click', () => finish(toggle.checked ? 'analytics' : 'denied'));

    close.addEventListener('click', () => {
      if (currentChoice) hideDialog(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && currentChoice) hideDialog(true);
    });

    document.addEventListener('keydown', (e) => {
      if (overlay.hidden) return;

      if (e.key === 'Escape' && currentChoice) {
        e.preventDefault();
        hideDialog(true);
        return;
      }

      if (e.key !== 'Tab') return;
      const focusables = focusableElements(overlay);
      if (!focusables.length) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const record = parseLocalRecord(event.newValue);
      if (!record) return;

      const previous = currentChoice;
      currentChoice = record.value;
      currentExpiresAt = record.expiresAt;

      if (record.value === 'denied' && (previous === 'analytics' || gaStarted)) {
        withdrawAnalyticsAndReload();
      } else if (record.value === 'analytics') {
        applyChoice('analytics');
      } else {
        applyChoice('denied');
      }
    });

    window.GraczCookieConsent = {
      open: () => showDialog(true),
      getChoice: () => {
        const saved = readChoice();
        return saved ? saved.value : currentChoice;
      }
    };

    const saved = readChoice();
    if (saved) {
      currentChoice = saved.value;
      currentExpiresAt = saved.expiresAt;
      applyChoice(saved.value);
    } else if (!isPrivacyPage()) {
      showDialog(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUi, { once: true });
  } else {
    ensureUi();
  }
})();