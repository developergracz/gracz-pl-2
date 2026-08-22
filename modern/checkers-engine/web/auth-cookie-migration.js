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

  function installLogout() {
    const logout = document.querySelector("#logout");
    if (!logout) return;
    logout.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await fetch("/auth/logout", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
      } catch {}
      sessionStorage.removeItem(STORAGE_KEY);
      location.replace("/");
    }, true);
  }

  window.graczAuthReady = ensureSession();
  window.graczGetSession = () => readSession();

  const install = () => installLogout();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
