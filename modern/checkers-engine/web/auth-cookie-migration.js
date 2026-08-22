(() => {
  const STORAGE_KEY = "gracz-session";
  const COOKIE_MARKER = "cookie";

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
      const response = await fetch("/auth/migrate", {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
        credentials: "same-origin",
      });
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

    const logo = document.createElement("div");
    logo.style.cssText = "margin-bottom:18px;font-size:28px;font-weight:900;letter-spacing:-2px";
    logo.textContent = "gracz.PL";

    const icon = document.createElement("div");
    icon.textContent = "✓";
    icon.style.cssText = "width:66px;height:66px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;background:#0c2b1b;border:1px solid #226b43;color:#36e985;font-size:31px";

    const title = document.createElement("h2");
    title.style.cssText = "margin:0 0 14px;font-size:30px";
    title.append("Dziękujemy, ");
    const strong = document.createElement("strong");
    strong.style.color = "#38e989";
    strong.textContent = safeName;
    title.append(strong, "!");

    const p1 = document.createElement("p");
    p1.style.cssText = "margin:8px auto;color:#b9c8c1;line-height:1.65;max-width:450px";
    p1.textContent = "Dziękujemy, że nas odwiedziłeś. Mamy nadzieję, że dobrze się bawiłeś i spędziłeś z nami miło czas.";

    const p2 = document.createElement("p");
    p2.style.cssText = p1.style.cssText;
    p2.textContent = "Zapraszamy ponownie — czekają na Ciebie kolejne rozgrywki i gracze.";

    const bye = document.createElement("div");
    bye.style.cssText = "margin-top:20px;color:#f2f8f5;font-size:18px;font-weight:800";
    bye.textContent = `Do zobaczenia, ${safeName}!`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Wróć do logowania";
    button.style.cssText = "margin-top:24px;padding:12px 26px;border:0;border-radius:8px;background:linear-gradient(180deg,#22e779,#0db455);color:#fff;font-weight:900;cursor:pointer";

    const finish = () => location.replace("/");
    button.addEventListener("click", finish);
    card.append(logo, icon, title, p1, p2, bye, button);
    overlay.append(card);
    document.body.append(overlay);
    setTimeout(finish, 7000);
  }

  function installLogout() {
    const logout = document.querySelector("#logout");
    if (!logout) return;
    logout.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = readSession();
      const userName = current?.user?.displayName || current?.user?.userId || "Graczu";
      try {
        await fetch("/auth/logout", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
      } catch {}
      sessionStorage.removeItem(STORAGE_KEY);
      showFarewell(userName);
    }, true);
  }

  window.graczAuthReady = ensureSession();
  window.graczGetSession = () => readSession();

  const install = () => installLogout();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
