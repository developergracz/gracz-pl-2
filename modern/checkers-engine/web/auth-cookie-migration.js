(() => {
  const STORAGE_KEY = "gracz-session";
  const COOKIE_MARKER = "cookie";

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }

  function storeCookieSession(user) {
    if (!user) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: COOKIE_MARKER, user }));
  }

  async function migrateLegacyBearer() {
    const session = readSession();
    if (!session?.user || !session?.token || session.token === COOKIE_MARKER) return;
    try {
      const response = await fetch("/auth/migrate", {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const result = await response.json();
      storeCookieSession(result.user || session.user);
    } catch {}
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

  async function run() {
    await migrateLegacyBearer();
    installLogout();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else void run();
})();
