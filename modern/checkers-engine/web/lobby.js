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
        piece.className = `mini-piece ${row < 3 ? "black" : "white"}`;
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
expandCheckers.addEventListener("click", () => { location.href = "/players.html"; });
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
function showLogoutFarewell(userName) {
  const safeName = String(userName || "Graczu").trim().slice(0, 40) || "Graczu";
  const style = document.createElement("style");
  style.textContent = `
    .logout-farewell{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(2,7,11,.88);backdrop-filter:blur(9px)}
    .logout-farewell-card{width:min(540px,94vw);padding:34px 32px;text-align:center;border:1px solid #28513d;border-radius:18px;background:linear-gradient(180deg,#101c23,#091116);box-shadow:0 30px 90px #000b,0 0 45px #18db6c16;color:#edf6f1}
    .logout-farewell-logo{margin-bottom:18px;font-size:27px;font-weight:900;letter-spacing:-2px}.logout-farewell-logo span{font-size:14px;color:#ff3440;letter-spacing:-1px}
    .logout-farewell-icon{width:64px;height:64px;margin:0 auto 16px;display:grid;place-items:center;border-radius:50%;background:#0c2b1b;border:1px solid #226b43;color:#36e985;font-size:30px}
    .logout-farewell-card h2{margin:0 0 12px;font-size:28px}.logout-farewell-card h2 strong{color:#38e989}.logout-farewell-card p{margin:8px auto;color:#b9c8c1;line-height:1.65;max-width:430px}.logout-farewell-card .bye{margin-top:18px;color:#f2f8f5;font-size:17px;font-weight:800}.logout-farewell-card button{margin-top:22px;padding:12px 26px;border:0;border-radius:8px;background:linear-gradient(180deg,#22e779,#0db455);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 8px 24px #0db45535}
  `;
  document.head.append(style);
  const overlay = document.createElement("div");
  overlay.className = "logout-farewell";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const card = document.createElement("section");
  card.className = "logout-farewell-card";
  card.innerHTML = '<div class="logout-farewell-logo">gracz<span>.PL</span></div><div class="logout-farewell-icon">✓</div><h2>Dziękujemy, <strong></strong>!</h2><p>Dziękujemy, że nas odwiedziłeś. Mamy nadzieję, że dobrze się bawiłeś i spędziłeś z nami miło czas.</p><p>Zapraszamy ponownie — czekają na Ciebie kolejne rozgrywki i gracze.</p><div class="bye">Do zobaczenia, <span></span>!</div><button type="button">Wróć do logowania</button>';
  card.querySelector('h2 strong').textContent = safeName;
  card.querySelector('.bye span').textContent = safeName;
  const finish = () => location.reload();
  card.querySelector('button').addEventListener('click', finish);
  overlay.append(card);
  document.body.append(overlay);
  setTimeout(finish, 6500);
}

document.querySelector("#logout").addEventListener("click", () => {
  const userName = session?.user?.displayName || session?.user?.userId || "Graczu";
  if (lobbyPoll) clearInterval(lobbyPoll);
  sessionStorage.clear();
  session = null;
  showLogoutFarewell(userName);
});

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
  document.querySelector("#account-box").innerHTML = `<a href="/settings.html#account" aria-label="Otwórz konto gracza"><strong></strong></a><a href="/settings.html#account">konto gracza</a><nav><a href="/settings.html#account">profil</a><a href="/messages.html">wiadomości</a><a href="/settings.html">ustawienia</a></nav>`;
  document.querySelector("#account-box strong").textContent = session.user.displayName;
  ensureInvitePanel(); refreshLobbyState();
  if (lobbyPoll) clearInterval(lobbyPoll); lobbyPoll = setInterval(refreshLobbyState, 5000);
  requestAnimationFrame(() => requestAnimationFrame(alignGomokuConsole));
}
if (session) showLobby();

function installNewsletterV2() {
  const section = document.querySelector('.newsletter');
  if (!section || section.dataset.v2 === '1') return;
  section.dataset.v2 = '1';

  const style = document.createElement('style');
  style.textContent = `
    .newsletter-v2{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(360px,1.35fr);gap:28px;align-items:start;padding:28px 30px;border:1px solid #28493c;border-radius:16px;background:linear-gradient(135deg,#0d171c,#111f24);box-shadow:0 18px 52px #0006;color:#eef7f2}
    .newsletter-v2 h3{margin:0 0 8px;font-size:28px}.newsletter-v2 .lead{margin:0;color:#aebdb6;line-height:1.55}.newsletter-v2 .nl-badge{display:inline-flex;align-items:center;gap:7px;margin-bottom:14px;padding:5px 9px;border:1px solid #276445;border-radius:999px;color:#59ec96;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .nl-form{display:grid;gap:12px}.nl-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nl-field{display:grid;gap:6px}.nl-field label,.nl-group legend{font-size:12px;font-weight:800;color:#dce9e2}.nl-field input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #314b43;border-radius:8px;background:#091216;color:#fff;outline:none}.nl-field input:focus{border-color:#25cf70;box-shadow:0 0 0 3px #25cf7020}
    .nl-group{margin:0;padding:11px 12px 10px;border:1px solid #263b35;border-radius:9px}.nl-group legend{padding:0 6px}.nl-options{display:flex;flex-wrap:wrap;gap:8px 13px}.nl-options label,.nl-consent{display:flex;align-items:flex-start;gap:7px;color:#bfcdc6;font-size:12px;line-height:1.35}.nl-options input,.nl-consent input{accent-color:#20d96d;margin-top:2px}.nl-consent a{color:#69e99d}
    .nl-submit{padding:12px 18px;border:0;border-radius:8px;background:linear-gradient(180deg,#25ed7b,#0fba55);color:#06150c;font-weight:900;cursor:pointer;box-shadow:0 9px 26px #10bd5635}.nl-submit:disabled{opacity:.55;cursor:wait}.nl-status{min-height:18px;margin:0;color:#ff9d9d;font-size:12px}.nl-safe{display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border:1px solid #234434;border-radius:8px;background:#0d1d15;color:#9fb5aa;font-size:11px;line-height:1.4}
    .nl-thanks{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:22px;background:rgba(1,5,8,.86);backdrop-filter:blur(10px)}.nl-thanks[hidden]{display:none}.nl-thanks-card{position:relative;width:min(650px,94vw);padding:38px 38px 32px;text-align:center;border:1px solid #285b50;border-radius:20px;background:linear-gradient(180deg,#10191f,#080f14);box-shadow:0 34px 100px #000c,0 0 55px #18d66f18;color:#fff}.nl-thanks-brand{margin-bottom:22px;font-size:24px;font-weight:950;letter-spacing:-1.5px}.nl-thanks-brand span{color:#ff3946;font-size:13px}.nl-thanks-card h2{margin:0;font-size:34px;line-height:1.16}.nl-thanks-card h2 strong{color:#57a9ff}.nl-heart{display:flex;align-items:center;gap:12px;justify-content:center;margin:22px 0;color:#ef4356}.nl-heart:before,.nl-heart:after{content:'';height:1px;width:120px;background:#516069}.nl-thanks-card p{margin:8px auto;max-width:520px;color:#d8e0e4;line-height:1.65}.nl-thanks-card .secondary{color:#9eacb4}.nl-thanks-card .chosen-nick{color:#57a9ff;font-weight:800}.nl-thanks-ok{width:100%;margin-top:24px;padding:13px 18px;border:0;border-radius:9px;background:linear-gradient(180deg,#28ea7b,#12b859);color:#04120a;font-size:16px;font-weight:950;cursor:pointer}.nl-thanks-close{position:absolute;right:16px;top:14px;width:36px;height:36px;border:1px solid #33454f;border-radius:50%;background:#070d11;color:#fff;font-size:21px;cursor:pointer}
    @media(max-width:820px){.newsletter-v2{grid-template-columns:1fr}.nl-row{grid-template-columns:1fr}.nl-thanks-card{padding:34px 22px 26px}.nl-thanks-card h2{font-size:28px}}
  `;
  document.head.append(style);

  section.className = 'newsletter newsletter-v2';
  section.innerHTML = `
    <div class="nl-copy"><span class="nl-badge">✉ Newsletter Gracz.pl</span><h3>Bądź na bieżąco</h3><p class="lead">Zapisz się, aby otrzymywać informacje o testach, premierze platformy, turniejach i najważniejszych nowościach Gracz.pl.</p></div>
    <form class="nl-form" id="newsletter-v2-form" novalidate>
      <div class="nl-row"><div class="nl-field"><label for="nl-nick">Twój nick</label><input id="nl-nick" name="nick" maxlength="40" autocomplete="nickname" placeholder="np. gracz123" required></div><div class="nl-field"><label for="nl-email">Adres e-mail</label><input id="nl-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="twoj@email.pl" required></div></div>
      <fieldset class="nl-group"><legend>Interesujące Cię gry</legend><div class="nl-options"><label><input type="checkbox" name="games" value="warcaby" checked> Warcaby</label><label><input type="checkbox" name="games" value="gomoku" checked> Gomoku</label><label><input type="checkbox" name="games" value="tysiac"> Tysiąc</label><label><input type="checkbox" name="games" value="poker"> Poker</label></div></fieldset>
      <fieldset class="nl-group"><legend>O czym chcesz wiedzieć</legend><div class="nl-options"><label><input type="checkbox" name="topics" value="testy" checked> Testy platformy</label><label><input type="checkbox" name="topics" value="premiera" checked> Premiera i uruchomienie</label><label><input type="checkbox" name="topics" value="turnieje"> Turnieje</label><label><input type="checkbox" name="topics" value="nowosci" checked> Nowości</label></div></fieldset>
      <label class="nl-consent"><input type="checkbox" name="consent" required><span>Wyrażam zgodę na otrzymywanie newslettera Gracz.pl na podany adres e-mail. Zapoznałem się z <a href="/polityka-prywatnosci.html" target="_blank" rel="noopener">Polityką prywatności</a>.</span></label>
      <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
      <div class="nl-safe">🛡 <span>Twój adres wykorzystamy wyłącznie do obsługi newslettera. Zapis można w każdej chwili anulować.</span></div>
      <button class="nl-submit" type="submit">ZAPISZ SIĘ →</button><p class="nl-status" role="alert" aria-live="polite"></p>
    </form>`;

  const overlay = document.createElement('div');
  overlay.className = 'nl-thanks';
  overlay.hidden = true;
  overlay.innerHTML = `<section class="nl-thanks-card" role="dialog" aria-modal="true" aria-labelledby="nl-thanks-title"><button class="nl-thanks-close" type="button" aria-label="Zamknij">×</button><div class="nl-thanks-brand">gracz<span>.pl</span></div><h2 id="nl-thanks-title">Dziękujemy Ci <strong>gracz</strong><br>za zapisanie się<br>do naszego serwisu!</h2><div class="nl-heart">♥</div><p>Na wskazany adres e-mail zostanie wysłana wiadomość potwierdzająca zapisanie się do naszego newslettera wraz z Twoim wybranym nickiem <span class="chosen-nick">„gracz”</span>.</p><p class="secondary">Będziemy informować Cię o testach, premierze i uruchomieniu platformy.</p><button class="nl-thanks-ok" type="button">✓ OK</button></section>`;
  document.body.append(overlay);

  const closeThanks = () => { overlay.hidden = true; };
  overlay.querySelector('.nl-thanks-close').addEventListener('click', closeThanks);
  overlay.querySelector('.nl-thanks-ok').addEventListener('click', closeThanks);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeThanks(); });

  const newsletterForm = section.querySelector('#newsletter-v2-form');
  newsletterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = newsletterForm.querySelector('.nl-status');
    const submit = newsletterForm.querySelector('.nl-submit');
    const data = new FormData(newsletterForm);
    const nick = String(data.get('nick') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const website = String(data.get('website') || '');
    if (website) return;
    if (nick.length < 2) { status.textContent = 'Podaj nick składający się z co najmniej 2 znaków.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status.textContent = 'Podaj prawidłowy adres e-mail.'; return; }
    if (!data.get('consent')) { status.textContent = 'Aby się zapisać, zaznacz zgodę na newsletter.'; return; }
    const payload = { nick, email, games: data.getAll('games'), topics: data.getAll('topics'), source: 'homepage', consent: true };
    submit.disabled = true; submit.textContent = 'ZAPISYWANIE…'; status.textContent = '';
    try {
      let saved = false;
      for (const endpoint of ['/api/newsletter/subscribe', '/newsletter/subscribe', '/ajaxNewsletter.php']) {
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'accept': 'application/json' }, body: JSON.stringify(payload) });
          if (response.ok) { saved = true; break; }
          if (![404, 405].includes(response.status)) {
            let message = '';
            try { message = (await response.json()).error?.message || ''; } catch {}
            if (message) throw new Error(message);
          }
        } catch (error) {
          if (error?.message) status.textContent = error.message;
        }
      }
      if (!saved) {
        localStorage.setItem('gracz-newsletter-pending', JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
      }
      overlay.querySelector('h2 strong').textContent = nick;
      overlay.querySelector('.chosen-nick').textContent = `„${nick}”`;
      overlay.hidden = false;
      newsletterForm.reset();
    } finally {
      submit.disabled = false; submit.textContent = 'ZAPISZ SIĘ →';
    }
  });
}

installNewsletterV2();

document.querySelector('[data-placeholder="shop"]')?.addEventListener("click", (event) => {
  event.preventDefault();
  let notice = document.querySelector("#navigation-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "navigation-notice";
    Object.assign(notice.style, { position: "fixed", right: "20px", bottom: "20px", zIndex: "9999", padding: "12px 16px", border: "1px solid #28503f", borderRadius: "9px", background: "#0b171d", color: "#eef6f2", boxShadow: "0 12px 34px #0008" });
    document.body.append(notice);
  }
  notice.textContent = "Sklep Gracz.pl jest jeszcze w przygotowaniu.";
  notice.hidden = false;
  clearTimeout(notice.hideTimer);
  notice.hideTimer = setTimeout(() => { notice.hidden = true; }, 3000);
});
