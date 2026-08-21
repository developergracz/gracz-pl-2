let mode = "login";
let session = JSON.parse(sessionStorage.getItem("gracz-session") || "null");
const authSection = document.querySelector("#auth"), lobbySection = document.querySelector("#lobby");
const form = document.querySelector("#auth-form"), nameField = document.querySelector("#name-field");

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
