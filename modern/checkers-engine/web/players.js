const session = JSON.parse(sessionStorage.getItem("gracz-session") || "null");
if (!session) location.href = "/";

const state = { rooms: [], players: [], invitations: [], filter: "all", query: "" };
const $ = (selector) => document.querySelector(selector);
const displayName = (value) => typeof value === "string" && value.localeCompare("Czeslaw", "pl", { sensitivity: "base" }) === 0
  ? "Czesław"
  : String(value ?? "gracz").normalize("NFC");

$("#user-name").textContent = displayName(session?.user?.displayName);
$("#back").addEventListener("click", () => { location.href = "/"; });
$("#search").addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
  state.filter = button.dataset.filter;
  render();
}));

const roomModal = $("#room-modal");
const roomModalForm = $("#room-modal-form");
const roomModalName = $("#room-modal-name");
const timeControl = $("#room-time-control");
const rated = $("#room-rated");
const access = $("#room-access");
const preferredColor = $("#room-color");
const undoAllowed = $("#room-undo");
const drawAllowed = $("#room-draw");
const spectatorsAllowed = $("#room-spectators");
const chatAllowed = $("#room-chat");
const configSummary = $("#room-config-summary");

function roomOptions() {
  return {
    timeControl: timeControl.value,
    rated: rated.value === "rated",
    access: access.value,
    preferredColor: preferredColor.value,
    undoAllowed: undoAllowed.checked,
    drawAllowed: drawAllowed.checked,
    spectatorsAllowed: spectatorsAllowed.checked,
    chatAllowed: chatAllowed.checked,
  };
}

function updateConfigSummary() {
  const options = roomOptions();
  const timeLabel = timeControl.options[timeControl.selectedIndex]?.textContent || options.timeControl;
  configSummary.textContent = `${timeLabel} · ${options.rated ? "Rankingowa" : "Towarzyska"} · Wycofanie ruchu: ${options.undoAllowed ? "tak" : "nie"} · Remis: ${options.drawAllowed ? "tak" : "nie"}`;
}

for (const element of [timeControl, rated, access, preferredColor, undoAllowed, drawAllowed, spectatorsAllowed, chatAllowed]) {
  element.addEventListener("change", updateConfigSummary);
}

function openRoomModal() {
  roomModal.hidden = false;
  roomModalName.value = "Szybka gra";
  timeControl.value = "5+0";
  rated.value = "rated";
  access.value = "public";
  preferredColor.value = "white";
  undoAllowed.checked = true;
  drawAllowed.checked = true;
  spectatorsAllowed.checked = true;
  chatAllowed.checked = true;
  updateConfigSummary();
  requestAnimationFrame(() => {
    roomModalName.focus();
    roomModalName.select();
  });
}

function closeRoomModal() { roomModal.hidden = true; }

$("#create-room").addEventListener("click", openRoomModal);
$("#room-modal-close").addEventListener("click", closeRoomModal);
$("#room-modal-cancel").addEventListener("click", closeRoomModal);
roomModal.addEventListener("click", (event) => { if (event.target === roomModal) closeRoomModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !roomModal.hidden) closeRoomModal(); });

roomModalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const roomName = roomModalName.value.trim();
  if (!roomName) return;
  const options = roomOptions();
  const submit = roomModalForm.querySelector(".room-modal-ok");
  submit.disabled = true;
  submit.textContent = "Tworzenie…";
  try {
    const created = await api("/lobby/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomName, ...options }),
    });
    sessionStorage.setItem(`gracz-room-options:${created.roomId || session.user.userId}`, JSON.stringify(options));
    closeRoomModal();
    await refresh();
    toast(`Utworzono stół: ${roomName}`);
  } catch (error) {
    toast(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Utwórz stół";
  }
});

function matches(text) { return !state.query || String(text).toLowerCase().includes(state.query); }
function ownRoom() { return state.rooms.find((room) => room.status === "waiting" && room.white?.id === session.user.userId); }

async function ensureOwnRoom() {
  let room = ownRoom();
  if (room) return room;
  room = await api("/lobby/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roomName: "Szybka gra",
      timeControl: "5+0",
      rated: true,
      access: "public",
      preferredColor: "white",
      undoAllowed: true,
      drawAllowed: true,
      spectatorsAllowed: true,
      chatAllowed: true,
    }),
  });
  await refresh();
  return room;
}

async function invite(player) {
  const room = await ensureOwnRoom();
  await api("/lobby/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ toId: player.userId, roomId: room.roomId }),
  });
  toast(`Zaproszenie wysłane do ${displayName(player.displayName)}`);
}

async function join(room) {
  const joined = await api(`/lobby/rooms/${room.roomId}/join`, { method: "POST" });
  location.href = `/game.html?game=${encodeURIComponent(joined.gameId)}&player=${encodeURIComponent(session.user.userId)}`;
}

function roomMeta(room) {
  const localRaw = sessionStorage.getItem(`gracz-room-options:${room.roomId}`);
  let local = null;
  try { local = localRaw ? JSON.parse(localRaw) : null; } catch {}
  const options = room.options || local || {};
  return {
    timeControl: options.timeControl || "5+0",
    rated: options.rated !== false,
    undoAllowed: options.undoAllowed !== false,
    access: options.access || room.access || "public",
  };
}

function render() {
  const rooms = state.rooms
    .filter((room) => matches(`${room.roomName} ${room.white?.name ?? ""} ${room.black?.name ?? ""}`))
    .filter((room) => state.filter === "waiting" ? room.status === "waiting" : state.filter === "playing" ? room.status === "playing" : true);
  const players = state.players
    .filter((player) => player.userId !== session.user.userId)
    .filter((player) => matches(`${player.displayName} ${player.roomName ?? ""}`))
    .filter((player) => state.filter === "available" ? player.status === "dostępny" : state.filter === "playing" ? player.status === "w grze" : true);

  $("#players-count").textContent = state.players.length;
  $("#rooms-count").textContent = state.rooms.length;
  $("#waiting-count").textContent = state.rooms.filter((room) => room.status === "waiting").length;
  $("#room-badge").textContent = rooms.length;
  $("#player-badge").textContent = players.length;
  renderRooms(rooms);
  renderPlayers(players);
  renderInvites();
}

function metaSpan(text, className = "") {
  const span = document.createElement("span");
  if (className) span.className = className;
  span.textContent = text;
  return span;
}

function renderRooms(rooms) {
  const root = $("#rooms");
  root.replaceChildren();
  if (!rooms.length) return root.append(empty("Brak pokoi spełniających wybrane kryteria."));

  rooms.forEach((room, index) => {
    const options = roomMeta(room);
    const row = document.createElement("article");
    row.className = `row ${room.white?.id === session.user.userId ? "own" : ""} ${room.status === "playing" ? "playing-room" : ""}`;

    const number = document.createElement("div");
    number.className = "room-number";
    number.textContent = `#${String(index + 1).padStart(3, "0")}`;

    const main = document.createElement("div");
    main.className = "room-main";
    const title = document.createElement("div");
    title.className = "room-title";
    title.textContent = room.roomName;

    const meta = document.createElement("div");
    meta.className = "meta";
    const status = document.createElement("span");
    status.className = "status";
    const dot = document.createElement("i");
    dot.className = `dot ${room.status === "playing" ? "playing" : ""}`;
    status.append(dot, document.createTextNode(room.status === "waiting" ? "wolny stół" : "gra trwa"));

    const names = [room.white?.name, room.black?.name].filter(Boolean).map(displayName).join(" vs ") || "—";
    meta.append(
      status,
      metaSpan(names),
      metaSpan(`⏱ ${options.timeControl}`),
      metaSpan(options.rated ? "★ rankingowa" : "◇ towarzyska"),
      metaSpan(options.undoAllowed ? "↶ cofnięcie dozwolone" : "↶ bez cofania"),
    );
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    const button = document.createElement("button");
    if (room.white?.id === session.user.userId) {
      button.textContent = "Twój stół";
      button.disabled = true;
    } else if (room.status === "waiting") {
      button.textContent = room.access === "private" ? "Tylko na zaproszenie" : "Dołącz";
      button.className = "primary-action";
      button.disabled = room.access === "private";
      if (!button.disabled) button.addEventListener("click", () => join(room));
    } else {
      button.textContent = "Obserwuj";
      button.disabled = true;
    }
    actions.append(button);
    row.append(number, main, actions);
    root.append(row);
  });
}

function renderPlayers(players) {
  const root = $("#players");
  root.replaceChildren();
  if (!players.length) return root.append(empty("Brak innych aktywnych graczy."));

  players.forEach((player) => {
    const row = document.createElement("article");
    row.className = "row";
    const main = document.createElement("div");

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = displayName(player.displayName);

    const meta = document.createElement("div");
    meta.className = "meta";
    const status = document.createElement("span");
    status.className = "status";
    const dot = document.createElement("i");
    dot.className = `dot ${player.status === "w grze" ? "playing" : ""}`;
    status.append(dot, document.createTextNode(player.status));
    meta.append(status, metaSpan(player.roomName ?? "bez pokoju"));
    main.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    const button = document.createElement("button");
    button.className = "invite";
    button.textContent = player.status === "w grze" ? "W grze" : "Zaproś";
    button.disabled = player.status === "w grze";
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Wysyłanie…";
      try {
        await invite(player);
        button.textContent = "Zaproszono";
      } catch (error) {
        button.disabled = false;
        button.textContent = "Zaproś";
        toast(error.message);
      }
    });
    actions.append(button);
    row.append(main, actions);
    root.append(row);
  });
}

function renderInvites() {
  const root = $("#incoming");
  root.replaceChildren();
  const invitation = state.invitations[0];
  if (!invitation) {
    root.hidden = true;
    return;
  }
  root.hidden = false;

  const card = document.createElement("div");
  card.className = "incoming-card";
  const info = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = `${displayName(invitation.fromName)} zaprasza Cię do gry`;
  const room = document.createElement("div");
  room.textContent = `Stół: ${invitation.roomName}`;
  info.append(strong, room);

  const actions = document.createElement("div");
  actions.className = "incoming-actions";
  for (const [label, accept] of [["Odrzuć", false], ["Akceptuj", true]]) {
    const button = document.createElement("button");
    button.textContent = label;
    button.className = accept ? "primary" : "";
    button.addEventListener("click", () => respond(invitation, accept));
    actions.append(button);
  }
  card.append(info, actions);
  root.append(card);
}

async function respond(invitation, accept) {
  const result = await api(`/lobby/invitations/${invitation.invitationId}/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept }),
  });
  if (result.accepted) {
    location.href = `/game.html?game=${encodeURIComponent(result.room.gameId)}&player=${encodeURIComponent(session.user.userId)}`;
  } else {
    await refresh();
  }
}

function empty(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function toast(text) {
  let element = document.querySelector("#toast");
  if (!element) {
    element = document.createElement("div");
    element.id = "toast";
    Object.assign(element.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: 9999,
      padding: "11px 14px",
      borderRadius: "9px",
      background: "#26343a",
      color: "white",
      boxShadow: "0 8px 24px #0004",
    });
    document.body.append(element);
  }
  element.textContent = text;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${session.token}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Błąd serwera");
  return result;
}

async function refresh() {
  try {
    Object.assign(state, await api("/lobby/state"));
    render();
  } catch (error) {
    toast(error.message);
  }
}

refresh();
setInterval(refresh, 5000);
