let mode = "login";
let session = JSON.parse(sessionStorage.getItem("gracz-session") || "null");
const authSection = document.querySelector("#auth"), lobbySection = document.querySelector("#lobby");
const form = document.querySelector("#auth-form"), nameField = document.querySelector("#name-field");
const hostSeat = document.querySelector("#host-seat");
const guestSeat = document.querySelector("#guest-seat");
const inviteButton = document.querySelector("#invite-button");
let lobbyRooms = [];
let lobbyPlayers = [];
let lobbyPoll = null;

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

function alignGomokuConsole() {
  const board = document.querySelector(".gomoku .gomoku-board");
  const side = document.querySelector(".gomoku .module-side");
  const panel = document.querySelector(".gomoku .console-panel");
  if (!board || !side || !panel || lobbySection.hidden) return;
  side.style.height = "auto"; panel.style.height = "auto"; panel.style.flex = "0 0 auto";
  const boardRect = board.getBoundingClientRect();
  const sideRect = side.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const sideHeight = Math.round(boardRect.height);
  const remaining = Math.max(92, Math.round(boardRect.bottom - panelRect.top));
  side.style.height = `${sideHeight}px`;
  panel.style.height = `${remaining}px`;
  panel.style.minHeight = `${remaining}px`;
  panel.style.maxHeight = "none";
  panel.style.flex = "0 0 auto";
  if (Math.abs(sideRect.top - boardRect.top) > 1) side.style.height = `${Math.max(0, Math.round(boardRect.bottom - sideRect.top))}px`;
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
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { setCheckersExpanded(false); closeInvitePanel(); } });

function ensureInvitePanel() {
  let overlay = document.querySelector("#invite-overlay");
  if (overlay) return overlay;
  const style = document.createElement("style");
  style.textContent = `
    .invite-overlay{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;padding:24px;background:#0007}.invite-overlay[hidden]{display:none}
    .invite-window{width:min(760px,96vw);max-height:82vh;overflow:auto;border:1px solid #b9b3a8;border-radius:10px;background:#f7f5ef;box-shadow:0 18px 50px #0007;color:#4c5a60}
    .invite-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #d2cec4;background:#fff}.invite-head h2{margin:0;color:#36769b;font-size:22px}.invite-close{border:0;background:transparent;font-size:28px;cursor:pointer;color:#687b82}
    .invite-body{padding:16px}.invite-tabs{display:flex;gap:8px;margin-bottom:12px}.invite-tabs button{padding:7px 12px;border:1px solid #c4bda9;background:#fff7df;cursor:pointer}.invite-tabs button.active{font-weight:bold;background:#f0d48b}
    .invite-list{display:grid;gap:8px}.invite-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid #d6d0c4;background:#fff;border-radius:6px}.invite-row small{display:block;margin-top:3px;color:#7b878b}.invite-row button{padding:7px 12px;border:1px solid #947324;border-radius:4px;background:linear-gradient(#ffe29a,#eeb640);font-weight:bold;cursor:pointer}.invite-row button:disabled{opacity:.45;cursor:default}
    .invite-empty{padding:18px;text-align:center;border:1px dashed #c9c2b5;background:#fff}.invite-note{margin:0 0 12px;padding:9px 11px;background:#eef5e8;border:1px solid #c9d9bc}.incoming-invite{position:fixed;right:22px;bottom:22px;z-index:2300;width:min(360px,calc(100vw - 44px));padding:14px;border:1px solid #c8b26d;border-radius:8px;background:#fff8dc;box-shadow:0 10px 30px #0005}.incoming-invite strong{display:block;margin-bottom:6px}.incoming-actions{display:flex;gap:8px;margin-top:10px}.incoming-actions button{flex:1;padding:8px;cursor:pointer}
  `;
  document.head.append(style);
  overlay = document.createElement("div");
  overlay.id = "invite-overlay";
  overlay.className = "invite-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `<section class="invite-window" role="dialog" aria-modal="true" aria-labelledby="invite-title"><header class="invite-head"><h2 id="invite-title">Zaproś gracza</h2><button class="invite-close" type="button" aria-label="Zamknij">×</button></header><div class="invite-body"><p class="invite-note">Wybierz gracza lub sprawdź aktualne pokoje. Zaproszenie trafi bezpośrednio do wybranego gracza.</p><div class="invite-tabs"><button type="button" data-invite-view="players" class="active">Gracze</button><button type="button" data-invite-view="rooms">Pokoje</button></div><div id="invite-list" class="invite-list"></div></div></section>`;
  document.body.append(overlay);
  overlay.querySelector(".invite-close").addEventListener("click", closeInvitePanel);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeInvitePanel(); });
  overlay.querySelectorAll("[data-invite-view]").forEach((button) => button.addEventListener("click", () => {
    overlay.querySelectorAll("[data-invite-view]").forEach((item) => item.classList.toggle("active", item === button));
    renderInviteList(button.dataset.inviteView);
  }));
  return overlay;
}

function closeInvitePanel() {
  const overlay = document.querySelector("#invite-overlay");
  if (overlay) overlay.hidden = true;
}

function ownWaitingRoom() {
  return lobbyRooms.find((room) => room.status === "waiting" && room.white.id === session.user.userId);
}

async function openInvitePanel() {
  let room = ownWaitingRoom();
  if (!room) {
    await createRoom("Szybka gra");
    room = ownWaitingRoom();
  }
  await refreshLobbyState();
  const overlay = ensureInvitePanel();
  overlay.hidden = false;
  renderInviteList("players");
}

function renderInviteList(view) {
  const root = document.querySelector("#invite-list");
  if (!root) return;
  root.replaceChildren();
  if (view === "rooms") {
    if (!lobbyRooms.length) return root.append(emptyInvite("Brak aktywnych pokoi."));
    lobbyRooms.forEach((room) => {
      const row = document.createElement("div"); row.className = "invite-row";
      const info = document.createElement("div");
      info.innerHTML = `<strong></strong><small></small>`;
      info.querySelector("strong").textContent = room.roomName;
      info.querySelector("small").textContent = `${room.white.name} · ${room.status === "waiting" ? "oczekuje na gracza" : "gra trwa"}`;
      const button = document.createElement("button"); button.type = "button"; button.textContent = room.status === "waiting" && room.white.id !== session.user.userId ? "Dołącz" : room.white.id === session.user.userId ? "Twój stół" : "W grze";
      button.disabled = room.status !== "waiting" || room.white.id === session.user.userId;
      button.addEventListener("click", () => joinRoom(room));
      row.append(info, button); root.append(row);
    });
    return;
  }
  const players = lobbyPlayers.filter((player) => player.userId !== session.user.userId);
  if (!players.length) return root.append(emptyInvite("Nie ma teraz innych aktywnych graczy."));
  players.forEach((player) => {
    const row = document.createElement("div"); row.className = "invite-row";
    const info = document.createElement("div"); info.innerHTML = `<strong></strong><small></small>`;
    info.querySelector("strong").textContent = player.displayName;
    info.querySelector("small").textContent = player.roomName ? `${player.status} · ${player.roomName}` : player.status;
    const button = document.createElement("button"); button.type = "button"; button.textContent = player.status === "w grze" ? "W grze" : "Zaproś"; button.disabled = player.status === "w grze";
    button.addEventListener("click", async () => {
      const room = ownWaitingRoom();
      if (!room) return;
      button.disabled = true; button.textContent = "Wysyłanie…";
      try {
        await api("/lobby/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toId: player.userId, roomId: room.roomId }) });
        button.textContent = "Zaproszono";
      } catch { button.disabled = false; button.textContent = "Zaproś"; }
    });
    row.append(info, button); root.append(row);
  });
}
function emptyInvite(text) { const node = document.createElement("div"); node.className = "invite-empty"; node.textContent = text; return node; }
inviteButton.addEventListener("click", openInvitePanel);

function showIncomingInvitation(invitation) {
  if (document.querySelector(`[data-incoming-id="${CSS.escape(invitation.invitationId)}"]`)) return;
  const box = document.createElement("aside"); box.className = "incoming-invite"; box.dataset.incomingId = invitation.invitationId;
  box.innerHTML = `<strong></strong><div></div><div class="incoming-actions"><button type="button" data-answer="no">Odrzuć</button><button type="button" data-answer="yes">Akceptuj</button></div>`;
  box.querySelector("strong").textContent = `${invitation.fromName} zaprasza Cię do Warcabów`;
  box.querySelector("div:not(.incoming-actions)").textContent = `Stół: ${invitation.roomName}`;
  box.querySelector('[data-answer="no"]').addEventListener("click", async () => { await respondInvitation(invitation, false); box.remove(); });
  box.querySelector('[data-answer="yes"]').addEventListener("click", async () => { const result = await respondInvitation(invitation, true); box.remove(); if (result.accepted) location.href = `/game.html?game=${encodeURIComponent(result.room.gameId)}&player=${encodeURIComponent(session.user.userId)}`; });
  document.body.append(box);
}
async function respondInvitation(invitation, accept) { return api(`/lobby/invitations/${invitation.invitationId}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept }) }); }

function renderLobbyState(state) {
  lobbyRooms = state.rooms;
  lobbyPlayers = state.players;
  renderRooms(state.rooms);
  state.invitations.forEach(showIncomingInvitation);
  const online = document.querySelector(".main-nav a:first-child");
  if (online) online.textContent = `${state.players.length} graczy online`;
  if (document.querySelector("#invite-overlay") && !document.querySelector("#invite-overlay").hidden) {
    const view = document.querySelector("[data-invite-view].active")?.dataset.inviteView ?? "players";
    renderInviteList(view);
  }
}
async function refreshLobbyState() {
  if (!session || lobbySection.hidden) return;
  try { renderLobbyState(await api("/lobby/state")); } catch {}
}

document.querySelectorAll("[data-console-tab]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-console-tab]").forEach((item) => item.classList.toggle("active", item === button));
  const messages = { chat: "", history: "Brak zapisanych ruchów.", users: "Gracze pojawią się tutaj po rozpoczęciu gry.", options: "Opcje stołu będą dostępne po rozpoczęciu gry." };
  document.querySelector("#console-content").textContent = messages[button.dataset.consoleTab];
}));
document.querySelector("#lobby-chat-form").addEventListener("submit", (event) => event.preventDefault());
renderMiniBoard();
window.addEventListener("resize", alignGomokuConsole);
if ("ResizeObserver" in window) { const gomokuBoard = document.querySelector(".gomoku .gomoku-board"); if (gomokuBoard) new ResizeObserver(alignGomokuConsole).observe(gomokuBoard); }

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
document.querySelector("#room-form").addEventListener("submit", async (event) => { event.preventDefault(); await createRoom(new FormData(event.currentTarget).get("roomName")); });
hostSeat.addEventListener("click", () => createRoom("Szybka gra"));
guestSeat.addEventListener("click", async () => { const room = lobbyRooms.find((item) => item.status === "waiting" && item.white.id !== session.user.userId); if (room) await joinRoom(room); });
document.querySelector("#logout").addEventListener("click", () => { if (lobbyPoll) clearInterval(lobbyPoll); sessionStorage.clear(); location.reload(); });

async function createRoom(roomName) {
  hostSeat.disabled = true;
  try { await api("/lobby/rooms", { method: "POST", body: JSON.stringify({ roomName }), headers: { "content-type": "application/json" } }); await refreshLobbyState(); }
  finally { hostSeat.disabled = false; }
}
async function joinRoom(room) {
  const joined = await api(`/lobby/rooms/${room.roomId}/join`, { method: "POST" });
  location.href = `/game.html?game=${encodeURIComponent(joined.gameId)}&player=${encodeURIComponent(session.user.userId)}`;
}
function renderRooms(rooms) {
  lobbyRooms = rooms;
  const ownRoom = rooms.some((room) => room.status === "waiting" && room.white.id === session.user.userId);
  const joinableRoom = rooms.find((room) => room.status === "waiting" && room.white.id !== session.user.userId);
  hostSeat.disabled = ownRoom;
  guestSeat.disabled = !joinableRoom;
  const root = document.querySelector("#rooms"); root.replaceChildren();
  rooms.forEach((room) => {
    const item = document.createElement("article"); item.className = "room"; item.innerHTML = `<div><strong></strong><p></p></div>`;
    item.querySelector("strong").textContent = room.roomName; item.querySelector("p").textContent = `${room.white.name} · ${room.status}`;
    const button = document.createElement("button"); button.className = "primary"; button.textContent = room.status === "waiting" ? "Dołącz" : "W grze"; button.disabled = room.status !== "waiting" || room.white.id === session.user.userId;
    button.addEventListener("click", () => joinRoom(room)); item.append(button); root.append(item);
  });
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...options.headers, authorization: `Bearer ${session.token}` } });
  const result = await response.json();
  if (!response.ok) { document.querySelector("#lobby-error").textContent = result.error?.message; throw new Error(result.error?.message); }
  return result;
}
function showLobby() {
  authSection.hidden = true; lobbySection.hidden = false;
  document.querySelector("#user-name").textContent = session.user.displayName;
  document.querySelector("#account-box").innerHTML = `<strong></strong><span>konto gracza</span><nav><a>profil</a><a>wiadomości</a><a>ustawienia</a></nav>`;
  document.querySelector("#account-box strong").textContent = session.user.displayName;
  ensureInvitePanel(); refreshLobbyState();
  if (lobbyPoll) clearInterval(lobbyPoll); lobbyPoll = setInterval(refreshLobbyState, 5000);
  requestAnimationFrame(() => requestAnimationFrame(alignGomokuConsole));
}
if (session) showLobby();
