(() => {
  const STORAGE_KEY = "gracz-session";
  const COOKIE_MARKER = "cookie";
  const REGISTRATION_DRAFT_PREFIX = "gracz-registration-draft:";
  const TERMS_PENDING_KEY = "gracz-registration-terms-pending";
  let termsAcceptedForRestoredDraft = false;

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }

  function storeCookieSession(user) {
    if (!user) return null;
    const safe = { token: COOKIE_MARKER, user: { userId: user.userId, displayName: user.displayName } };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  async function migrateLegacyBearer(session) {
    if (!session?.user || !session?.token || session.token === COOKIE_MARKER) return null;
    try {
      const response = await fetch("/auth/migrate", { method: "POST", headers: { authorization: `Bearer ${session.token}`, accept: "application/json" }, credentials: "same-origin" });
      if (!response.ok) return null;
      const result = await response.json();
      return storeCookieSession(result.user || session.user);
    } catch { return null; }
  }

  async function restoreFromCookie() {
    try {
      const response = await fetch("/auth/me", { credentials: "same-origin", headers: { accept: "application/json" } });
      if (!response.ok) return null;
      const result = await response.json();
      return storeCookieSession(result.user);
    } catch { return null; }
  }

  async function ensureSession() {
    const existing = readSession();
    if (existing?.token && existing.token !== COOKIE_MARKER) {
      const migrated = await migrateLegacyBearer(existing);
      if (migrated) return migrated;
      sessionStorage.removeItem(STORAGE_KEY);
    }
    if (existing?.token === COOKIE_MARKER && existing?.user) return existing;
    return restoreFromCookie();
  }

  function showFarewell(userName) {
    const safeName = String(userName || "Graczu").trim().slice(0, 40) || "Graczu";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:24px;background:rgba(2,7,11,.9);backdrop-filter:blur(9px)";
    const card = document.createElement("section");
    card.style.cssText = "width:min(560px,94vw);padding:36px 32px;text-align:center;border:1px solid #28513d;border-radius:18px;background:linear-gradient(180deg,#101c23,#091116);box-shadow:0 30px 90px #000b,0 0 45px #18db6c16;color:#edf6f1;font-family:Inter,Arial,sans-serif";
    const logo = document.createElement("div"); logo.style.cssText = "margin-bottom:18px;font-size:28px;font-weight:900;letter-spacing:-2px"; logo.textContent = "gracz.PL";
    const icon = document.createElement("div"); icon.textContent = "✓"; icon.style.cssText = "width:66px;height:66px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;background:#0c2b1b;border:1px solid #226b43;color:#36e985;font-size:31px";
    const title = document.createElement("h2"); title.style.cssText = "margin:0 0 14px;font-size:30px"; title.append("Dziękujemy, ");
    const strong = document.createElement("strong"); strong.style.color = "#38e989"; strong.textContent = safeName; title.append(strong, "!");
    const p1 = document.createElement("p"); p1.style.cssText = "margin:8px auto;color:#b9c8c1;line-height:1.65;max-width:450px"; p1.textContent = "Dziękujemy, że nas odwiedziłeś. Mamy nadzieję, że dobrze się bawiłeś i spędziłeś z nami miło czas.";
    const p2 = document.createElement("p"); p2.style.cssText = p1.style.cssText; p2.textContent = "Zapraszamy ponownie — czekają na Ciebie kolejne rozgrywki i gracze.";
    const bye = document.createElement("div"); bye.style.cssText = "margin-top:20px;color:#f2f8f5;font-size:18px;font-weight:800"; bye.textContent = `Do zobaczenia, ${safeName}!`;
    const hint = document.createElement("div"); hint.style.cssText = "margin-top:14px;color:#789087;font-size:11px"; hint.textContent = "Okno zamknie się automatycznie za 10 sekund.";
    const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px";
    const loginButton = document.createElement("button"); loginButton.type = "button"; loginButton.textContent = "Zaloguj ponownie"; loginButton.style.cssText = "min-width:170px;padding:12px 22px;border:0;border-radius:8px;background:linear-gradient(180deg,#22e779,#0db455);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 8px 24px #0db45535";
    const closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.textContent = "Zamknij"; closeButton.style.cssText = "min-width:130px;padding:12px 22px;border:1px solid #49615a;border-radius:8px;background:#111b20;color:#dce8e2;font-weight:800;cursor:pointer";
    let finished = false, timeoutId = null;
    const showLogin = () => { if (finished) return; finished = true; if (timeoutId) clearTimeout(timeoutId); location.replace("/"); };
    loginButton.addEventListener("click", showLogin); closeButton.addEventListener("click", showLogin);
    actions.append(loginButton, closeButton); card.append(logo, icon, title, p1, p2, bye, hint, actions); overlay.append(card); document.body.append(overlay); loginButton.focus(); timeoutId = setTimeout(showLogin, 10_000);
  }

  function installLogout() {
    const logout = document.querySelector("#logout");
    if (!logout) return;
    logout.addEventListener("click", async (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const current = readSession(); const userName = current?.user?.displayName || current?.user?.userId || "Graczu";
      try { await fetch("/auth/logout", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } }); } catch {}
      sessionStorage.removeItem(STORAGE_KEY); showFarewell(userName);
    }, true);
  }

  function installEnterLogin() {
    const form = document.querySelector("#auth-form"), login = form?.elements?.userId, password = form?.elements?.password;
    if (!form || !login || !password) return;
    const submitOnEnter = (event) => {
      if (event.key !== "Enter" || event.isComposing || event.repeat) return;
      const loginTab = document.querySelector('[data-mode="login"]'); if (!loginTab?.classList.contains("active")) return;
      event.preventDefault(); form.requestSubmit(document.querySelector("#auth-submit"));
    };
    login.addEventListener("keydown", submitOnEnter); password.addEventListener("keydown", submitOnEnter);
  }

  function clarifyRegistrationEmailLabel() {
    const field = document.querySelector("#email-field"); if (!field) return;
    const textNode = [...field.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = "Wpisz Twój adres e-mail";
  }

  function installRegistrationVerificationFields() {
    const form = document.querySelector("#auth-form"), emailField = document.querySelector("#email-field"), registerTab = document.querySelector('[data-mode="register"]');
    if (!form || !emailField || !registerTab || document.querySelector("#phone-field")) return;
    const phoneField = document.createElement("label"); phoneField.id = "phone-field"; phoneField.hidden = true; phoneField.textContent = "Wpisz Twój numer telefonu";
    const phoneInput = document.createElement("input"); phoneInput.name = "phone"; phoneInput.type = "tel"; phoneInput.inputMode = "tel"; phoneInput.autocomplete = "tel"; phoneInput.maxLength = 24; phoneInput.placeholder = "np. +48 500 600 700";
    const phoneHelp = document.createElement("small"); phoneHelp.className = "field-help"; phoneHelp.textContent = "Numer będzie używany do kodów SMS i odzyskiwania dostępu, jeśli wybierzesz SMS."; phoneField.append(phoneInput, phoneHelp);
    const channelField = document.createElement("fieldset"); channelField.id = "verification-channel-field"; channelField.hidden = true; channelField.style.cssText = "margin:0;padding:10px 12px;border:1px solid #243840;border-radius:8px";
    const legend = document.createElement("legend"); legend.textContent = "Gdzie chcesz otrzymać kod aktywacyjny?"; legend.style.cssText = "padding:0 6px;font-weight:700";
    const emailLabel = document.createElement("label"); emailLabel.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0;font-weight:500";
    const emailRadio = document.createElement("input"); emailRadio.type = "radio"; emailRadio.name = "verificationChannel"; emailRadio.value = "email"; emailRadio.checked = true; emailLabel.append(emailRadio, document.createTextNode("Kod na adres e-mail"));
    let smsEnabled = false; const smsLabel = document.createElement("label"); smsLabel.hidden = true; smsLabel.style.cssText = emailLabel.style.cssText;
    const smsRadio = document.createElement("input"); smsRadio.type = "radio"; smsRadio.name = "verificationChannel"; smsRadio.value = "sms"; smsLabel.append(smsRadio, document.createTextNode("Kod SMS na numer telefonu"));
    const channelHelp = document.createElement("small"); channelHelp.className = "field-help"; channelHelp.textContent = "Ten sam wybrany kanał będzie mógł służyć później do odzyskiwania hasła.";
    channelField.append(legend, emailLabel, smsLabel, channelHelp); emailField.after(phoneField, channelField);
    const sync = () => { const registering = registerTab.classList.contains("active"); if (!smsEnabled) { emailRadio.checked = true; smsRadio.checked = false; } smsLabel.hidden = !smsEnabled; phoneField.hidden = !registering || !smsEnabled || !smsRadio.checked; channelField.hidden = !registering; phoneInput.required = registering && smsEnabled && smsRadio.checked; };
    emailRadio.addEventListener("change", sync); smsRadio.addEventListener("change", sync); new MutationObserver(sync).observe(registerTab, { attributes: true, attributeFilter: ["class"] }); sync(); fetch("/auth/sms-config", { headers:{ accept:"application/json" }, cache:"no-store" }).then(response => response.ok ? response.json() : { enabled:false }).then(result => { smsEnabled = result.enabled === true; sync(); }).catch(() => { smsEnabled = false; sync(); });
  }

  function installRegistrationDraftPreservation() {
    const form = document.querySelector("#auth-form");
    const registerTab = document.querySelector('[data-mode="register"]');
    if (!form || !registerTab) return;

    const saveDraft = () => {
      const values = {};
      for (const field of form.elements) {
        if (!field?.name || field.name === "website") continue;
        if (field.type === "radio") {
          if (field.checked) values[field.name] = { type: "radio", value: field.value };
        } else if (field.type === "checkbox") {
          values[field.name] = { type: "checkbox", checked: field.checked };
        } else {
          values[field.name] = { type: field.type || "text", value: field.value };
        }
      }
      window.name = REGISTRATION_DRAFT_PREFIX + JSON.stringify({ savedAt: Date.now(), values });
    };

    document.addEventListener("click", (event) => {
      const link = event.target.closest?.('a[href*="regulamin.html"]');
      if (!link || !registerTab.classList.contains("active")) return;
      saveDraft();
    }, true);

    if (!window.name.startsWith(REGISTRATION_DRAFT_PREFIX)) return;
    let draft = null;
    try { draft = JSON.parse(window.name.slice(REGISTRATION_DRAFT_PREFIX.length)); } catch {}
    window.name = "";
    if (!draft?.values || Date.now() - Number(draft.savedAt || 0) > 30 * 60 * 1000) return;

    registerTab.click();
    for (const [name, saved] of Object.entries(draft.values)) {
      const fields = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
      for (const field of fields) {
        if (saved.type === "radio") field.checked = field.value === saved.value;
        else if (saved.type === "checkbox") field.checked = Boolean(saved.checked);
        else field.value = String(saved.value ?? "");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    const pendingBaseline = sessionStorage.getItem(TERMS_PENDING_KEY);
    const acceptedAt = localStorage.getItem("gracz-terms-accepted-at") || "";
    const terms = form.elements.terms;
    if (terms) {
      if (pendingBaseline !== null && acceptedAt && acceptedAt !== pendingBaseline) {
        terms.checked = true;
        termsAcceptedForRestoredDraft = true;
      } else {
        terms.checked = false;
      }
      terms.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sessionStorage.removeItem(TERMS_PENDING_KEY);
  }

  function installTermsCheckboxOpen() {
    const terms = document.querySelector("#terms");
    const termsLink = document.querySelector("#terms-link");
    if (!terms || !termsLink) return;

    // Użytkownik akceptuje regulamin bezpośrednio w formularzu.
    // Sam link pozostaje dostępny w nowej karcie i nie blokuje checkboxa.
    terms.disabled = false;
    terms.removeAttribute("aria-disabled");
    termsLink.target = "_blank";
    termsLink.rel = "noopener";
  }

  function installPasswordRecovery() {
    const trigger = document.querySelector("#forgot-password");
    const loginInput = document.querySelector('#auth-form [name="userId"]');
    if (!trigger || !loginInput) return;
    trigger.addEventListener("click", () => {
      if (document.querySelector("#password-recovery-overlay")) return;
      const overlay = document.createElement("div"); overlay.id = "password-recovery-overlay"; overlay.style.cssText = "position:fixed;inset:0;z-index:22000;display:grid;place-items:center;padding:24px;background:rgba(2,7,11,.92);backdrop-filter:blur(9px)";
      const card = document.createElement("section"); card.style.cssText = "position:relative;width:min(520px,94vw);max-height:calc(100vh - 48px);overflow:auto;padding:32px;border:1px solid #304d68;border-radius:16px;background:linear-gradient(180deg,#101b24,#0a1219);box-shadow:0 30px 90px #000c;color:#eef5f9";
      const close = document.createElement("button"); close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Zamknij"); close.style.cssText = "position:absolute;right:15px;top:12px;border:0;background:transparent;color:#a9bac6;font-size:30px;cursor:pointer";
      const title = document.createElement("h2"); title.textContent = "Odzyskaj dostęp do konta"; title.style.cssText = "margin:0 38px 8px 0";
      const intro = document.createElement("p"); intro.textContent = "Podaj adres e-mail przypisany do konta. Wyślemy na niego 6-cyfrowy kod ważny przez 10 minut."; intro.style.cssText = "color:#9eb0bc;line-height:1.55;font-size:13px";
      const stepOne = document.createElement("div"); stepOne.style.cssText = "display:grid;gap:12px";
      const email = document.createElement("input"); email.type = "email"; email.placeholder = "Adres e-mail przypisany do konta"; email.autocomplete = "email"; email.required = true;
      const requestButton = document.createElement("button"); requestButton.type = "button"; requestButton.textContent = "Wyślij kod odzyskiwania";
      const stepTwo = document.createElement("div"); stepTwo.hidden = true; stepTwo.style.cssText = "display:grid;gap:12px";
      const code = document.createElement("input"); code.type = "text"; code.inputMode = "numeric"; code.maxLength = 6; code.placeholder = "6-cyfrowy kod"; code.autocomplete = "one-time-code"; code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 6); });
      const password = document.createElement("input"); password.type = "password"; password.minLength = 15; password.maxLength = 128; password.placeholder = "Nowe hasło — minimum 15 znaków"; password.autocomplete = "new-password";
      const confirm = document.createElement("input"); confirm.type = "password"; confirm.minLength = 15; confirm.maxLength = 128; confirm.placeholder = "Powtórz nowe hasło"; confirm.autocomplete = "new-password";
      const resetButton = document.createElement("button"); resetButton.type = "button"; resetButton.textContent = "Ustaw nowe hasło";
      const message = document.createElement("p"); message.setAttribute("role", "alert"); message.style.cssText = "min-height:20px;margin:4px 0 0;color:#ff8b91;font-size:12px;line-height:1.45";
      for (const input of [email,code,password,confirm]) input.style.cssText = "box-sizing:border-box;width:100%;padding:12px 13px;border:1px solid #3b5060;border-radius:8px;background:#071017;color:#fff;font:inherit";
      for (const button of [requestButton,resetButton]) button.style.cssText = "width:100%;padding:13px;border:0;border-radius:8px;background:linear-gradient(180deg,#3f7aee,#2854bc);color:#fff;font-weight:900;cursor:pointer";
      const passwordField = createPasswordVisibilityField(password);
      const confirmField = createPasswordVisibilityField(confirm);
      function createPasswordVisibilityField(input) {
        const field = document.createElement("div"); field.style.cssText = "position:relative;width:100%";
        input.style.paddingRight = "72px";
        const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = "Pokaż"; toggle.setAttribute("aria-label", "Pokaż hasło"); toggle.style.cssText = "position:absolute;right:12px;top:50%;transform:translateY(-50%);padding:6px;border:0;background:transparent;color:#79aaff;font-size:12px;font-weight:800;cursor:pointer";
        toggle.addEventListener("click", () => {
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          toggle.textContent = show ? "Ukryj" : "Pokaż";
          toggle.setAttribute("aria-label", show ? "Ukryj hasło" : "Pokaż hasło");
          input.focus();
        });
        field.append(input, toggle);
        return field;
      }
      const setBusy = (button, busy, text) => { button.disabled = busy; if (text) button.textContent = text; };
      requestButton.addEventListener("click", async () => {
        const address = email.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) { message.textContent = "Wpisz prawidłowy adres e-mail."; email.focus(); return; }
        setBusy(requestButton, true, "Wysyłanie kodu…"); message.textContent = "";
        try {
          const response = await fetch("/auth/request-password-reset", { method:"POST", headers:{"content-type":"application/json","accept":"application/json"}, body:JSON.stringify({ email:address, verificationChannel:"email" }) });
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error?.message || "Nie udało się wysłać kodu.");
          stepOne.hidden = true; stepTwo.hidden = false; message.style.color = "#63dda0"; message.textContent = "Jeżeli adres jest przypisany do Twojego konta, kod został wysłany e-mailem."; code.focus();
        } catch (error) { message.style.color = "#ff8b91"; message.textContent = error.message; setBusy(requestButton, false, "Wyślij kod odzyskiwania"); }
      });
      email.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (!requestButton.disabled) requestButton.click();
      });
      let resetCompleted = false;
      let recoveredUserId = "";
      resetButton.addEventListener("click", async () => {
        if (resetCompleted) { overlay.remove(); if (recoveredUserId) loginInput.value = recoveredUserId; document.querySelector("#auth-password")?.focus(); return; }
        const newPassword = password.value;
        if (!/^\d{6}$/.test(code.value)) { message.style.color = "#ff8b91"; message.textContent = "Wpisz dokładnie 6 cyfr kodu."; code.focus(); return; }
        if (newPassword.length < 15 || !/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(newPassword) || !/[a-ząćęłńóśźż]/.test(newPassword) || !/\d/.test(newPassword)) { message.style.color = "#ff8b91"; message.textContent = "Nowe hasło musi mieć minimum 15 znaków, wielką i małą literę oraz cyfrę."; password.focus(); return; }
        if (newPassword !== confirm.value) { message.style.color = "#ff8b91"; message.textContent = "Wpisane hasła nie są identyczne."; confirm.focus(); return; }
        setBusy(resetButton, true, "Zmiana hasła…"); message.textContent = "";
        try {
          const response = await fetch("/auth/reset-password", { method:"POST", headers:{"content-type":"application/json","accept":"application/json"}, body:JSON.stringify({ email:email.value.trim().toLowerCase(), verificationChannel:"email", token:code.value, newPassword }) });
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error?.message || "Nie udało się zmienić hasła.");
          recoveredUserId = String(result.userId || "");
          message.style.color = "#63dda0"; message.textContent = result.message || "Hasło zostało zmienione."; resetCompleted = true; resetButton.textContent = "Wróć do logowania"; resetButton.disabled = false;
        } catch (error) { message.style.color = "#ff8b91"; message.textContent = error.message; setBusy(resetButton, false, "Ustaw nowe hasło"); }
      });
      close.addEventListener("click", () => overlay.remove()); overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
      stepOne.append(email,requestButton); stepTwo.append(code,passwordField,confirmField,resetButton); card.append(close,title,intro,stepOne,stepTwo,message); overlay.append(card); document.body.append(overlay); email.focus();
    });
  }

  function installActivationDialog() {
    const error = document.querySelector("#auth-error"), form = document.querySelector("#auth-form");
    if (!error || !form) return;
    let opened = false;
    const observer = new MutationObserver(() => {
      if (opened || !error.textContent.includes("Kod aktywacyjny został wysłany")) return;
      opened = true;
      const userId = String(form.elements.userId?.value || "").trim();
      const overlay = document.createElement("div"); overlay.style.cssText = "position:fixed;inset:0;z-index:21000;display:grid;place-items:center;padding:24px;background:rgba(2,7,11,.92);backdrop-filter:blur(8px)";
      const card = document.createElement("section"); card.style.cssText = "width:min(470px,94vw);padding:32px;text-align:center;border:1px solid #28513d;border-radius:16px;background:#0d171d;color:#edf6f1;box-shadow:0 28px 80px #000b";
      const title = document.createElement("h2"); title.textContent = "Aktywuj nowe konto";
      const text = document.createElement("p"); text.style.cssText = "color:#b9c8c1;line-height:1.55"; text.textContent = "Wysłaliśmy 6-cyfrowy kod na podany adres e-mail. Wpisz go poniżej. Kod jest ważny przez 10 minut.";
      const input = document.createElement("input"); input.type = "text"; input.inputMode = "numeric"; input.autocomplete = "one-time-code"; input.maxLength = 6; input.minLength = 6; input.size = 6; input.pattern = "[0-9]{6}"; input.placeholder = "000000"; input.setAttribute("aria-label", "6-cyfrowy kod aktywacyjny"); input.style.cssText = "box-sizing:border-box;width:260px;max-width:100%;margin:12px auto;padding:14px 18px;text-align:center;font-size:30px;line-height:1.2;letter-spacing:5px;border:1px solid #35534a;border-radius:9px;background:#081015;color:#fff;font-variant-numeric:tabular-nums"; input.addEventListener("input", () => { input.value = input.value.replace(/\\D/g, "").slice(0, 6); });
      const message = document.createElement("p"); message.style.cssText = "min-height:20px;color:#ff7a7a;font-size:13px";
      const button = document.createElement("button"); button.type = "button"; button.textContent = "Aktywuj konto"; button.style.cssText = "padding:12px 24px;border:0;border-radius:8px;background:#16c96b;color:#fff;font-weight:900;cursor:pointer";
      const verify = async () => {
        const code = input.value.trim(); if (!/^\d{6}$/.test(code)) { message.textContent = "Wpisz dokładnie 6 cyfr."; return; }
        button.disabled = true; message.textContent = "Sprawdzanie kodu…"; message.style.color = "#b9c8c1";
        try {
          const response = await fetch("/auth/login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ userId, verificationCode: code }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "Nie udało się aktywować konta.");
          storeCookieSession(result.user); location.reload();
        } catch (err) { message.style.color = "#ff7a7a"; message.textContent = err.message; button.disabled = false; }
      };
      button.addEventListener("click", verify); input.addEventListener("keydown", (event) => { if (event.key === "Enter") verify(); });
      card.append(title, text, input, message, button); overlay.append(card); document.body.append(overlay); input.focus();
    });
    observer.observe(error, { childList: true, characterData: true, subtree: true });
  }

  function openRequestedAuthMode() {
    if (location.hash !== "#register") return;
    const registerTab = document.querySelector('[data-mode="register"]');
    if (!registerTab) return;
    registerTab.click();
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  window.graczAuthReady = ensureSession();
  window.graczGetSession = () => readSession();

  const install = () => {
    installLogout();
    installEnterLogin();
    clarifyRegistrationEmailLabel();
    installRegistrationVerificationFields();
    installRegistrationDraftPreservation();
    installTermsCheckboxOpen();
    installPasswordRecovery();
    installActivationDialog();
    openRequestedAuthMode();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
