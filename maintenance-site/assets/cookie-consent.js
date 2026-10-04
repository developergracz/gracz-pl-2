(() => {
  'use strict';

  const MEASUREMENT_ID = 'G-1TJMKDNQR8';
  const STORAGE_KEY = 'gracz_cookie_consent_v1';
  const COOKIE_NAME = 'gracz_cookie_consent';
  const COOKIE_MAX_AGE = 15552000; // 180 days

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  // Privacy-first default: no analytics or ads storage before a choice.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  let gaStarted = false;
  let currentChoice = null;

  function readChoice() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'analytics' || v === 'denied') return v;
    } catch (_) {}

    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function writeChoice(value) {
    currentChoice = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value) +
      '; Max-Age=' + COOKIE_MAX_AGE + '; Path=/; SameSite=Lax; Secure';
  }

  function updateConsent(analyticsGranted) {
    window.gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function startGA() {
    if (gaStarted) return;
    gaStarted = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    script.onload = () => {
      window.gtag('js', new Date());
      window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
    };
    document.head.appendChild(script);
  }

  function applyChoice(choice) {
    if (choice === 'analytics') {
      updateConsent(true);
      startGA();
    } else {
      updateConsent(false);
    }
  }

  function ensureUi() {
    if (document.getElementById('gracz-cookie-consent')) return;

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'gcc-settings-button';
    settingsButton.setAttribute('aria-label', 'Ustawienia cookies');
    settingsButton.innerHTML = '<span aria-hidden="true">🍪</span><span class="gcc-settings-label">Cookies</span>';
    settingsButton.addEventListener('click', () => showDialog(true));
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
          Używamy niezbędnych mechanizmów do działania serwisu. Analitykę Google Analytics uruchamiamy dopiero po Twojej zgodzie.
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

    const toggle = overlay.querySelector('#gcc-analytics-toggle');
    const close = overlay.querySelector('.gcc-close');

    function finish(choice) {
      writeChoice(choice);
      applyChoice(choice);
      overlay.hidden = true;
      document.documentElement.classList.remove('gcc-open');
    }

    overlay.querySelector('[data-gcc-reject]').addEventListener('click', () => finish('denied'));
    overlay.querySelector('[data-gcc-accept]').addEventListener('click', () => finish('analytics'));
    overlay.querySelector('[data-gcc-save]').addEventListener('click', () => finish(toggle.checked ? 'analytics' : 'denied'));
    close.addEventListener('click', () => {
      if (currentChoice) {
        overlay.hidden = true;
        document.documentElement.classList.remove('gcc-open');
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && currentChoice) {
        overlay.hidden = true;
        document.documentElement.classList.remove('gcc-open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden && currentChoice) {
        overlay.hidden = true;
        document.documentElement.classList.remove('gcc-open');
      }
    });

    document.body.appendChild(overlay);

    function showDialog(fromSettings) {
      const saved = readChoice();
      currentChoice = saved;
      toggle.checked = saved === 'analytics';
      overlay.hidden = false;
      document.documentElement.classList.add('gcc-open');
      if (!fromSettings && !saved) close.hidden = true;
      else close.hidden = false;
      setTimeout(() => (saved ? close : overlay.querySelector('[data-gcc-reject]')).focus(), 0);
    }

    window.GraczCookieConsent = {
      open: () => showDialog(true),
      getChoice: () => readChoice()
    };

    const saved = readChoice();
    currentChoice = saved;
    if (saved) {
      applyChoice(saved);
    } else {
      showDialog(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureUi, { once: true });
  } else {
    ensureUi();
  }
})();