import { randomUUID } from "node:crypto";

import { createGameSession } from "./session.js";

export class LobbyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LobbyError";
    this.code = code;
  }
}

export class LobbyService {
  #rooms = new Map();

  constructor({ sessionStore, idGenerator = randomUUID }) {
    if (!sessionStore) throw new TypeError("Magazyn sesji jest wymagany.");
    this.sessionStore = sessionStore;
    this.idGenerator = idGenerator;
  }

  listRooms() {
    return [...this.#rooms.values()].map(publicRoom);
  }

  createRoom({ ownerId, ownerName, roomName = "Nowy pokój" }) {
    requireText(ownerId, "ownerId");
    requireText(ownerName, "ownerName");
    requireText(roomName, "roomName");
    const room = {
      roomId: this.idGenerator(), roomName, status: "waiting",
      white: { id: ownerId, name: ownerName }, black: null, gameId: null,
    };
    this.#rooms.set(room.roomId, room);
    return publicRoom(room);
  }

  async joinRoom({ roomId, playerId, playerName }) {
    const room = this.#rooms.get(roomId);
    if (!room) throw new LobbyError("Pokój nie istnieje.", "ROOM_NOT_FOUND");
    if (room.status !== "waiting") throw new LobbyError("Pokój nie oczekuje na gracza.", "ROOM_NOT_JOINABLE");
    if (room.white.id === playerId) throw new LobbyError("Twórca pokoju nie może dołączyć drugi raz.", "DUPLICATE_PLAYER");
    room.black = { id: playerId, name: playerName };
    room.status = "playing";
    room.gameId = `game-${room.roomId}`;
    await this.sessionStore.create(createGameSession({
      gameId: room.gameId, whitePlayerId: room.white.id, blackPlayerId: room.black.id,
    }));
    return publicRoom(room);
  }
}

function publicRoom(room) {
  return structuredClone({
    roomId: room.roomId, roomName: room.roomName, status: room.status,
    white: room.white, black: room.black, gameId: room.gameId,
  });
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new LobbyError(`Pole ${field} jest nieprawidłowe.`, "INVALID_ROOM");
  }
}
