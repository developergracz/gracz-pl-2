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
    events: [event(1, "session.created", { whitePlayerId, blackPlayerId })],
    processedRequests: {},
  });
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
  });
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
  Object.freeze(session.processedRequests);
  return Object.freeze(session);
}
