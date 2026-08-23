import "./avatar-library.js";

const STORAGE_KEY = "gracz-player-settings-v1";
const sections = {
  account: ["Konto i profil", "Zarządzaj danymi widocznymi dla innych graczy."],
  security: ["Bezpieczeństwo", "Chroń konto, hasło i metody logowania."],
  privacy: ["Prywatność", "Kontroluj widoczność profilu, wiadomości i zaproszenia."],
  notifications: ["Powiadomienia", "Wybierz, o jakich zdarzeniach chcesz wiedzieć."],
  messages: ["Wiadomości i chat", "Dostosuj prywatne wiadomości i rozmowy przy stole."],
  games: ["Gry i rozgrywka", "Ustaw domyślne zachowanie konsoli i dobierania graczy."],
  appearance: ["Wygląd i dostępność", "Dostosuj interfejs i ułatwienia dostępu."],
  sessions: ["Sesje i urządzenia", "Sprawdzaj logowania i bezpieczeństwo aktywnych sesji."],
  data: ["Dane i konto", "Zarządzaj kopią danych oraz statusem konta."],
};

const defaults = {
  "security.newLogin": true,
  "security.accountChanges": true,
  "privacy.profile": "all",
  "privacy.online": "all",
  "privacy.history": "all",
  "privacy.messages": "all",
  "privacy.invites": "all",
  "privacy.antiSpam": true,
  "notify.messages": true,
  "notify.invites": true,
  "notify.tournaments": true,
  "notify.ranking": true,
  "notify.email": true,
  "notify.sms": false,
  "notify.sound": true,
  "messages.readReceipts": true,
  "messages.autoArchive": false,
  "messages.preview": true,
  "chat.enabled": true,
  "chat.filter": true,
  "chat.richText": true,
  "games.sound": true,
  "games.confirmResign": true,
  "games.autoRotate": true,
  "games.time": "3",
  "games.matchmaking": true,
  "games.similarRating": true,
  "appearance.theme": "dark",
  "appearance.scale": "normal",
  "appearance.reduceMotion": false,
  "appearance.highContrast": false,
  "access.focus": true,
  "access.labels": true,
  phone: "",
  recoveryChannel: "email",
};

let settings = loadSettings();
let profile = null;
let toastTimer = null;
let saveTimer = null;

function loadSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { ...defaults }; }
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  const state = document.querySelector("#save-state");
  state.textContent = "Zapisywanie…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { state.textContent = "Wszystkie zmiany zapisane"; }, 450);
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3400);
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json", ...(options.headers || {}) }, ...options });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body.error?.message || `Błąd ${response.status}`);
  return body;
}

async function ensureIdentity() {
  try {
    const result = await api("/auth/me");
    document.querySelector("#identity").textContent = `${result.user.displayName} (@${result.user.userId})`;
    document.querySelector("#password-user").value = result.user.userId;
    return result.user;
  } catch {
    location.replace("/");
    return null;
  }
}

async function loadProfile() {
  try {
    const result = await api("/account/profile");
    profile = result.profile;
    const name = profile.displayName || profile.userId;
    document.querySelector("#profile-name").textContent = name;
    document.querySelector("#profile-id").textContent = `@${profile.userId}`;
    document.querySelector("#avatar").textContent = name.slice(0, 1).toUpperCase();
    document.querySelector("#display-name").value = profile.displayName || "";
    document.querySelector("#user-id").value = profile.userId || "";
    document.querySelector("#bio").value = profile.bio || "";
    document.querySelector("#bio-count").textContent = String((profile.bio || "").length);
    document.querySelector("#country").value = ["PL", "DE", "CZ", "SK"].includes(profile.country) ? profile.country : "other";
    document.querySelector("#language").value = profile.language || "pl";
    document.querySelector("#email").value = profile.email || "";
    document.querySelector("#recovery-email").value = profile.recoveryEmail || "";
    document.querySelector("#twofa").checked = Boolean(profile.twoFactor);
    syncTwoFactorBadge();
  } catch (error) {
    toast(`Nie udało się wczytać profilu: ${error.message}`);
  }
}

async function saveProfile() {
  if (!profile) return;
  const displayName = document.querySelector("#display-name").value.trim();
  if (displayName.length < 2 || displayName.length > 40) return toast("Nazwa gracza musi mieć 2–40 znaków.");
  const payload = {
    displayName,
    email: profile.email || "",
    recoveryEmail: document.querySelector("#recovery-email").value.trim(),
    bio: document.querySelector("#bio").value.trim(),
    country: document.querySelector("#country").value === "other" ? (profile.country || "PL") : document.querySelector("#country").value,
    city: profile.city || "",
    language: document.querySelector("#language").value,
    showOnline: settings["privacy.online"] !== "none",
    allowInvites: settings["privacy.invites"] !== "none",
    allowMessages: settings["privacy.messages"] !== "none",
    newsletter: Boolean(profile.newsletter),
    twoFactor: Boolean(document.querySelector("#twofa").checked),
  };
  const button = document.querySelector("#save-profile");
  button.disabled = true; button.textContent = "Zapisywanie…";
  try {
    const result = await api("/account/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    profile = result.profile;
    document.querySelector("#profile-name").textContent = profile.displayName;
    document.querySelector("#avatar").textContent = profile.displayName.slice(0, 1).toUpperCase();
    document.querySelector("#identity").textContent = `${profile.displayName} (@${profile.userId})`;
    sessionStorage.setItem("gracz-session", JSON.stringify({ token: "cookie", user: result.user || { userId: profile.userId, displayName: profile.displayName } }));
    toast("Profil został zapisany.");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false; button.textContent = "Zapisz profil";
  }
}

function showSection(name) {
  document.querySelectorAll(".settings-nav button[data-section]").forEach((button) => button.classList.toggle("active", button.dataset.section === name));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  const [title, subtitle] = sections[name] || sections.account;
  document.querySelector("#page-title").textContent = title;
  document.querySelector("#page-subtitle").textContent = subtitle;
  history.replaceState(null, "", `#${name}`);
  document.querySelector(".settings-main").scrollTop = 0;
}

function bindSettingControls() {
  document.querySelectorAll("[data-setting]").forEach((control) => {
    const key = control.dataset.setting;
    if (control.type === "checkbox") control.checked = Boolean(settings[key]);
    else control.value = String(settings[key] ?? control.value);
    control.addEventListener("change", () => {
      settings[key] = control.type === "checkbox" ? control.checked : control.value;
      persistSettings();
      applyAppearance();
    });
  });
  document.querySelector("#phone").value = settings.phone || "";
  document.querySelector("#recovery-channel").value = settings.recoveryChannel || "email";
  document.querySelector("#phone").addEventListener("input", (event) => { settings.phone = event.target.value.slice(0, 24); persistSettings(); });
  document.querySelector("#recovery-channel").addEventListener("change", (event) => { settings.recoveryChannel = event.target.value; persistSettings(); });
}

function applyAppearance() {
  document.documentElement.classList.toggle("high-contrast", Boolean(settings["appearance.highContrast"]));
  document.documentElement.classList.toggle("large-ui", settings["appearance.scale"] === "large");
  document.documentElement.classList.toggle("compact-ui", settings["appearance.scale"] === "compact");
  document.documentElement.style.scrollBehavior = settings["appearance.reduceMotion"] ? "auto" : "smooth";
}

function syncTwoFactorBadge() {
  const enabled = document.querySelector("#twofa").checked;
  const badge = document.querySelector("#twofa-badge");
  badge.textContent = enabled ? "Preferencja włączona" : "Wyłączone";
  badge.className = `badge ${enabled ? "good" : "warn"}`;
  document.querySelector("#security-score").textContent = enabled ? "Bardzo dobry" : "Dobry";
}

function exportData() {
  const payload = {
    generatedAt: new Date().toISOString(),
    profile: profile ? { ...profile } : null,
    preferences: { ...settings },
    note: "Eksport ustawień użytkownika. Dane serwerowe takie jak historia gier i wiadomości wymagają oddzielnego eksportu backendowego.",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `gracz-pl-ustawienia-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Przygotowano lokalny eksport profilu i ustawień.");
}

function bindActions() {
  document.querySelectorAll(".settings-nav button[data-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
  document.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => toast(button.dataset.toast)));
  document.querySelector("#save-profile").addEventListener("click", saveProfile);
  document.querySelector("#bio").addEventListener("input", (event) => { document.querySelector("#bio-count").textContent = String(event.target.value.length); });
  document.querySelector("#twofa").addEventListener("change", () => {
    syncTwoFactorBadge();
    toast(document.querySelector("#twofa").checked ? "Zapisano preferencję 2FA. Pełna aktywacja wymaga serwerowego modułu TOTP." : "Preferencja 2FA została wyłączona.");
  });
  document.querySelector('[data-action="password"]').addEventListener("click", () => document.querySelector("#password-dialog").showModal());
  document.querySelector("#password-reset").addEventListener("click", () => {
    document.querySelector("#password-dialog").close();
    toast("Bezpieczna zmiana hasła korzysta z weryfikacji e-mail. Formularz zmiany zostanie dołączony po pełnej aktywacji poczty Resend.");
  });
  document.querySelector('[data-action="export"]').addEventListener("click", exportData);
}

async function init() {
  const user = await ensureIdentity();
  if (!user) return;
  bindSettingControls();
  bindActions();
  applyAppearance();
  document.querySelector("#device-info").textContent = `${navigator.platform || "Urządzenie"} · aktywna teraz`;
  const hash = location.hash.slice(1);
  showSection(sections[hash] ? hash : "account");
  await loadProfile();
}

init();
