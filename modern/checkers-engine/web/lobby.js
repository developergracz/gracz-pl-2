let mode = "login";
let session = JSON.parse(sessionStorage.getItem("gracz-session") || "null");
const authSection = document.querySelector("#auth"), lobbySection = document.querySelector("#lobby");
const form = document.querySelector("#auth-form"), nameField = document.querySelector("#name-field");

function renderMiniBoard() {
  const board = document.querySelector("#mini-board");
  if (!board) return;
  board.replaceChildren();
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const square = document.createElement("span");
      const dark = (row + column) % 2 === 1;
      square.className = `mini-square ${dark ? "dark" : "light"}`;
      if (dark && (row < 3 || row > 4)) {
        const piece = document.createElement("i");
        piece.className = `mini-piece ${row < 3 ? "white" : "black"}`;
        square.append(piece);
      }
      board.append(square);
    }
  }
}

const checkersModule = document.querySelector("#checkers-module");
const expandCheckers = document.querySelector("#expand-checkers");
const closeCheckers = document.querySelector("#close-checkers");
const openCheckers = document.querySelector("#open-checkers");
function setCheckersExpanded(expanded) {
  checkersModule.classList.toggle("expanded", expanded);
  expandCheckers.setAttribute("aria-expanded", String(expanded));
  expandCheckers.textContent = expanded ? "×" : "⛶";
  expandCheckers.title = expanded ? "Pomniejsz konsolę" : "Pokaż konsolę na całym ekranie";
  closeCheckers.hidden = !expanded;
  document.body.classList.toggle("game-expanded", expanded);
}
expandCheckers.addEventListener("click", () => setCheckersExpanded(!checkersModule.classList.contains("expanded")));
openCheckers.addEventListener("click", () => setCheckersExpanded(true));
closeCheckers.addEventListener("click", () => setCheckersExpanded(false));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") setCheckersExpanded(false); });
document.querySelector("#invite-button").addEventListener("click", async () => {
  await navigator.clipboard?.writeText(location.href);
  document.querySelector("#invite-button").textContent = "LINK SKOPIOWANY";
});
document.querySelectorAll("[data-console-tab]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-console-tab]").forEach((item) => item.classList.toggle("active", item === button));
  const messages = { chat: "", history: "Brak zapisanych ruchów.", users: "Gracze pojawią się tutaj po rozpoczęciu gry.", options: "Opcje stołu będą dostępne po rozpoczęciu gry." };
  document.querySelector("#console-content").textContent = messages[button.dataset.consoleTab];
}));
document.querySelector("#lobby-chat-form").addEventListener("submit", (event) => event.preventDefault());
renderMiniBoard();

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
  nameField.hidden = mode !== "register"; nameField.querySelector("input").required = mode === "register";
}));

form.addEventListener("submit", async (event) => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(form));
  const response = await fetch(`/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) return document.querySelector("#auth-error").textContent = result.error?.message;
  session = result; sessionStorage.setItem("gracz-session", JSON.stringify(session)); showLobby();
});

document.querySelector("#room-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const roomName = new FormData(event.currentTarget).get("roomName");
  await api("/lobby/rooms", { method: "POST", body: JSON.stringify({ roomName }), headers: { "content-type": "application/json" } }); await loadRooms();
});
document.querySelector("#logout").addEventListener("click", () => { sessionStorage.clear(); location.reload(); });

async function loadRooms() { const result = await api("/lobby/rooms"); renderRooms(result.rooms); }
function renderRooms(rooms) {
  const root = document.querySelector("#rooms"); root.replaceChildren();
  rooms.forEach((room) => { const item = document.createElement("article"); item.className = "room";
    item.innerHTML = `<div><strong></strong><p></p></div>`; item.querySelector("strong").textContent = room.roomName; item.querySelector("p").textContent = `${room.white.name} · ${room.status}`;
    const button = document.createElement("button"); button.className = "primary"; button.textContent = room.status === "waiting" ? "Dołącz" : "W grze"; button.disabled = room.status !== "waiting" || room.white.id === session.user.userId;
    button.addEventListener("click", async () => { const joined = await api(`/lobby/rooms/${room.roomId}/join`, { method: "POST" }); location.href = `/game.html?game=${encodeURIComponent(joined.gameId)}&player=${encodeURIComponent(session.user.userId)}`; });
    item.append(button); root.append(item); });
}
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { ...options.headers, authorization: `Bearer ${session.token}` } }); const result = await response.json(); if (!response.ok) { document.querySelector("#lobby-error").textContent = result.error?.message; throw new Error(result.error?.message); } return result; }
function showLobby() {
  authSection.hidden = true;
  lobbySection.hidden = false;
  document.querySelector("#user-name").textContent = session.user.displayName;
  document.querySelector("#account-box").innerHTML = `<strong></strong><span>konto gracza</span><nav><a>profil</a><a>wiadomości</a><a>ustawienia</a></nav>`;
  document.querySelector("#account-box strong").textContent = session.user.displayName;
  loadRooms();
}
if (session) showLobby();
