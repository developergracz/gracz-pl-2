(() => {
  const nativeFetch = window.fetch.bind(window);
  let widgetPromise = null;

  function isProtectedAuthRequest(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    return method === "POST" && ["/auth/login", "/auth/register", "/auth/reset-password"].some((path) => url === path || url.endsWith(path));
  }

  async function parseChallenge(response) {
    if (response.status !== 403) return null;
    try {
      const payload = await response.clone().json();
      return payload?.error?.code === "CHALLENGE_REQUIRED" ? payload.error.challenge : null;
    } catch { return null; }
  }

  async function solveTurnstile(siteKey) {
    if (!siteKey) throw new Error("Brak konfiguracji zabezpieczenia anty-botowego.");
    await loadTurnstile();
    return new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:20px";
      const card = document.createElement("div");
      card.style.cssText = "width:min(420px,100%);background:#101820;color:#fff;border:1px solid #33434f;border-radius:14px;padding:22px;font:14px system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.4)";
      const title = document.createElement("h2");
      title.textContent = "Dodatkowa weryfikacja";
      title.style.cssText = "margin:0 0 8px;font-size:20px";
      const text = document.createElement("p");
      text.textContent = "Wykryliśmy nietypową liczbę prób. Potwierdź, że nie jesteś automatem.";
      text.style.cssText = "margin:0 0 16px;color:#c7d2da;line-height:1.45";
      const mount = document.createElement("div");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Anuluj";
      cancel.style.cssText = "margin-top:16px;border:1px solid #53636f;background:transparent;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer";
      cancel.addEventListener("click", () => { overlay.remove(); reject(new Error("Weryfikacja została anulowana.")); });
      card.append(title, text, mount, cancel);
      overlay.append(card);
      document.body.append(overlay);

      window.turnstile.render(mount, {
        sitekey: siteKey,
        theme: "auto",
        callback(token) { overlay.remove(); resolve(token); },
        "error-callback"() { overlay.remove(); reject(new Error("Nie udało się uruchomić weryfikacji.")); },
        "expired-callback"() { /* użytkownik może wykonać widget ponownie */ },
      });
    });
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (widgetPromise) return widgetPromise;
    widgetPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Nie udało się załadować weryfikacji anty-botowej."));
      document.head.append(script);
    });
    return widgetPromise;
  }

  window.fetch = async function guardedFetch(input, init = {}) {
    const response = await nativeFetch(input, init);
    if (!isProtectedAuthRequest(input, init)) return response;

    const challenge = await parseChallenge(response);
    if (!challenge || challenge.provider !== "turnstile") return response;

    const token = await solveTurnstile(challenge.siteKey);
    let body = {};
    try { body = JSON.parse(init.body || "{}"); } catch { return response; }
    return nativeFetch(input, { ...init, body: JSON.stringify({ ...body, challengeToken: token }) });
  };
})();
