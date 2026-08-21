const params = new URLSearchParams(location.search);
const gameId = params.get("game") ?? "demo";
const playerId = params.get("player") ?? "alice";
const api = params.get("api") ?? "";
const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
document.querySelector("#identity").textContent = `Gracz: ${playerId}`;

let snapshot = null;
let selected = null;

function render() {
  if (!snapshot) return;
  boardElement.replaceChildren();
  const ownTurn = snapshot.game.turn === snapshot.color && snapshot.game.status === "active";
  statusElement.textContent = snapshot.game.status === "draw" ? "Remis"
    : snapshot.game.status === "won" ? `Wygrywa: ${snapshot.game.winner}`
      : ownTurn ? "Twój ruch" : "Ruch przeciwnika";

  snapshot.game.board.forEach((row, rowIndex) => row.forEach((piece, columnIndex) => {
    const square = document.createElement("button");
    square.type = "button";
    square.className = `square ${(rowIndex + columnIndex) % 2 ? "dark" : "light"}`;
    square.dataset.row = rowIndex;
    square.dataset.column = columnIndex;
    square.setAttribute("role", "gridcell");
    square.setAttribute("aria-label", `Pole ${rowIndex + 1}, ${columnIndex + 1}${piece ? `, ${piece}` : ""}`);
    if (selected?.row === rowIndex && selected?.column === columnIndex) square.classList.add("selected");
    if (piece) {
      const token = document.createElement("span");
      token.className = `piece ${piece.startsWith("white") ? "white" : "black"} ${piece.endsWith("king") ? "king" : ""}`;
      square.append(token);
    }
    square.addEventListener("click", () => choose({ row: rowIndex, column: columnIndex }, piece, ownTurn));
    boardElement.append(square);
  }));
}

async function choose(position, piece, ownTurn) {
  if (!ownTurn) return;
  if (piece?.startsWith(snapshot.color)) {
    selected = position;
    return render();
  }
  if (!selected) return;
  const requestId = crypto.randomUUID();
  const response = await fetch(`${api}/games/${gameId}/moves`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-player-id": playerId },
    body: JSON.stringify({ requestId, move: { from: selected, to: position } }),
  });
  const result = await response.json();
  selected = null;
  if (!response.ok) statusElement.textContent = result.error?.message ?? "Ruch odrzucony";
}

async function connect() {
  const response = await fetch(`${api}/games/${gameId}/events`, { headers: { "x-player-id": playerId } });
  if (!response.ok || !response.body) throw new Error("Nie udało się połączyć z partią.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const raw of events) {
      const data = raw.split("\n").find((line) => line.startsWith("data: "));
      if (data) { snapshot = JSON.parse(data.slice(6)); render(); }
    }
  }
}

document.querySelector("#reconnect").addEventListener("click", () => connect().catch(showError));
connect().catch(showError);
function showError(error) { statusElement.textContent = error.message; }
