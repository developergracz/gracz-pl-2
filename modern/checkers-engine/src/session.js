import { PLAYERS, applyMove, createInitialState, createState } from "./index.js";

export class SessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

export function createGameSession({ gameId, whitePlayerId, blackPlayerId, game = createInitialState() }) {
  requireId(gameId, "gameId");
  requireId(whitePlayerId, "whitePlayerId");
  requireId(blackPlayerId, "blackPlayerId");
  if (whitePlayerId === blackPlayerId) {
    throw new SessionError("Jeden użytkownik nie może zajmować obu miejsc.", "DUPLICATE_PLAYER");
  }

  return freezeSession({
    gameId,
    players: {
      [PLAYERS.WHITE]: { id: whitePlayerId, connected: true },
      [PLAYERS.BLACK]: { id: blackPlayerId, connected: true },
    },
    game,
    messages: [],
    pendingOffer: null,
    blockedPlayers: [],
    events: [event(1, "session.created", { whitePlayerId, blackPlayerId })],
    processedRequests: {},
  });
}

export function sendChatMessage(session, { playerId, text }) {
  validateSession(session);
  const color = requirePlayer(session, playerId);
  if (typeof text !== "string" || text.trim().length < 1 || text.trim().length > 160) {
    throw new SessionError("Wiadomość musi mieć od 1 do 160 znaków.", "INVALID_MESSAGE");
  }
  const message = Object.freeze({ id: session.events.length + 1, playerId, color, text: text.trim() });
  return appendEvent({ ...session, messages: [...session.messages, message] }, "chat.message", message);
}

export function submitGameAction(session, { playerId, action }) {
  validateSession(session);
  const color = requirePlayer(session, playerId);
  const opponent = color === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
  if (action === "resign") {
    if (session.game.status !== "active") throw new SessionError("Partia jest już zakończona.", "GAME_FINISHED");
    const game = createState({ ...session.game, status: "won", winner: opponent, forcedPiece: null });
    return appendEvent({ ...session, game, pendingOffer: null }, "game.resigned", { playerId, color });
  }
  if (action === "draw" || action === "undo") {
    if (session.pendingOffer?.type === action && session.pendingOffer.playerId !== playerId) {
      let game = session.game;
      if (action === "draw") game = createState({ ...game, status: "draw", winner: null, drawReason: "agreement", forcedPiece: null });
      if (action === "undo") game = gameBeforeLastTurn(session);
      return appendEvent({ ...session, game, pendingOffer: null }, `${action}.accepted`, { playerId });
    }
    return appendEvent({ ...session, pendingOffer: { type: action, playerId } }, `${action}.offered`, { playerId });
  }
  if (action === "block") {
    const opponentId = session.players[opponent].id;
    const blockedPlayers = session.blockedPlayers.includes(opponentId)
      ? session.blockedPlayers.filter((id) => id !== opponentId)
      : [...session.blockedPlayers, opponentId];
    return appendEvent({ ...session, blockedPlayers }, "player.blocked", { playerId, opponentId });
  }
  throw new SessionError("Nieznana akcja konsoli.", "INVALID_ACTION");
}

export function submitMove(session, { playerId, requestId, move }) {
  validateSession(session);
  requireId(playerId, "playerId");
  requireId(requestId, "requestId");

  const requestKey = `${playerId}:${requestId}`;
  const processedSequence = session.processedRequests[requestKey];
  if (processedSequence) {
    return Object.freeze({
      session,
      event: session.events.find((item) => item.sequence === processedSequence),
      duplicate: true,
    });
  }

  const color = colorForPlayer(session, playerId);
  if (!color) throw new SessionError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  if (!session.players[color].connected) throw new SessionError("Gracz jest rozłączony.", "PLAYER_DISCONNECTED");
  if (session.game.status !== "active") throw new SessionError("Partia jest już zakończona.", "GAME_FINISHED");
  if (session.game.turn !== color) throw new SessionError("Teraz trwa tura przeciwnika.", "OUT_OF_TURN");

  const game = applyMove(session.game, move);
  const moveEvent = event(session.events.length + 1, "move.accepted", {
    playerId, color, requestId, move: structuredClone(move), game,
  });
  const nextSession = freezeSession({
    ...session,
    game,
    events: [...session.events, moveEvent],
    processedRequests: { ...session.processedRequests, [requestKey]: moveEvent.sequence },
  });
  return Object.freeze({ session: nextSession, event: moveEvent, duplicate: false });
}

export function disconnectPlayer(session, playerId) {
  return setConnection(session, playerId, false);
}

export function reconnectPlayer(session, playerId) {
  const nextSession = setConnection(session, playerId, true);
  return Object.freeze({ session: nextSession, snapshot: getSessionSnapshot(nextSession, playerId) });
}

export function getSessionSnapshot(session, playerId) {
  validateSession(session);
  const color = colorForPlayer(session, playerId);
  if (!color) throw new SessionError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  return structuredClone({
    gameId: session.gameId,
    color,
    players: session.players,
    game: session.game,
    messages: session.messages,
    pendingOffer: session.pendingOffer,
    blockedPlayers: session.blockedPlayers,
    lastEventSequence: session.events.at(-1)?.sequence ?? 0,
  });
}

export function serializeSession(session) {
  validateSession(session);
  return JSON.stringify(session);
}

export function deserializeSession(serialized) {
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new SessionError("Zapis sesji nie jest prawidłowym JSON-em.", "INVALID_SESSION");
  }
  validateSession(value);
  return freezeSession({
    ...value,
    game: createState(value.game),
    events: value.events.map((item) => event(item.sequence, item.type, item.payload)),
    processedRequests: { ...value.processedRequests },
    messages: [...(value.messages ?? [])],
    pendingOffer: value.pendingOffer ?? null,
    blockedPlayers: [...(value.blockedPlayers ?? [])],
  });
}

function gameBeforeLastTurn(session) {
  const moves = session.events.filter((item) => item.type === "move.accepted");
  if (!moves.length) throw new SessionError("Nie ma ruchu do cofnięcia.", "NOTHING_TO_UNDO");

  const lastColor = moves.at(-1).payload.color;
  let firstMoveOfTurn = moves.length - 1;
  while (firstMoveOfTurn > 0 && moves[firstMoveOfTurn - 1].payload.color === lastColor) {
    firstMoveOfTurn -= 1;
  }

  return firstMoveOfTurn === 0
    ? createInitialState()
    : createState(moves[firstMoveOfTurn - 1].payload.game);
}

function setConnection(session, playerId, connected) {
  validateSession(session);
  const color = colorForPlayer(session, playerId);
  if (!color) throw new SessionError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  if (session.players[color].connected === connected) return session;
  const connectionEvent = event(
    session.events.length + 1,
    connected ? "player.reconnected" : "player.disconnected",
    { playerId, color },
  );
  return freezeSession({
    ...session,
    players: { ...session.players, [color]: { id: playerId, connected } },
    events: [...session.events, connectionEvent],
    processedRequests: { ...session.processedRequests },
  });
}

function colorForPlayer(session, playerId) {
  if (session.players[PLAYERS.WHITE].id === playerId) return PLAYERS.WHITE;
  if (session.players[PLAYERS.BLACK].id === playerId) return PLAYERS.BLACK;
  return null;
}

function requirePlayer(session, playerId) {
  requireId(playerId, "playerId");
  const color = colorForPlayer(session, playerId);
  if (!color) throw new SessionError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  return color;
}

function appendEvent(session, type, payload) {
  const nextEvent = event(session.events.length + 1, type, payload);
  return freezeSession({ ...session, events: [...session.events, nextEvent], processedRequests: { ...session.processedRequests } });
}

function event(sequence, type, payload) {
  return Object.freeze({ sequence, type, payload: Object.freeze(structuredClone(payload)) });
}

function validateSession(session) {
  if (!session || typeof session !== "object") throw new SessionError("Sesja jest wymagana.", "INVALID_SESSION");
  requireId(session.gameId, "gameId");
  if (!session.players?.white || !session.players?.black || !Array.isArray(session.events)) {
    throw new SessionError("Sesja ma nieprawidłową strukturę.", "INVALID_SESSION");
  }
}

function requireId(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new SessionError(`Pole ${field} musi być krótkim tekstem.`, "INVALID_ID");
  }
}

function freezeSession(session) {
  Object.freeze(session.players.white);
  Object.freeze(session.players.black);
  Object.freeze(session.players);
  Object.freeze(session.events);
  Object.freeze(session.messages);
  Object.freeze(session.blockedPlayers);
  Object.freeze(session.processedRequests);
  return Object.freeze(session);
}
