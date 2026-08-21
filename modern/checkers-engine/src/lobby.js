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
  #presence = new Map();
  #invitations = new Map();

  constructor({ sessionStore, idGenerator = randomUUID }) {
    if (!sessionStore) throw new TypeError("Magazyn sesji jest wymagany.");
    this.sessionStore = sessionStore;
    this.idGenerator = idGenerator;
  }

  touchUser({ userId, displayName }) {
    requireText(userId, "userId");
    requireText(displayName, "displayName");
    this.#presence.set(userId, { userId, displayName: normalizeDisplayName(displayName), seenAt: Date.now() });
  }

  listRooms() {
    return [...this.#rooms.values()].map(publicRoom);
  }

  listPlayers() {
    const cutoff = Date.now() - 45_000;
    for (const [userId, presence] of this.#presence) {
      if (presence.seenAt < cutoff) this.#presence.delete(userId);
    }
    return [...this.#presence.values()].map((presence) => {
      const room = [...this.#rooms.values()].find((candidate) =>
        candidate.white?.id === presence.userId || candidate.black?.id === presence.userId);
      return {
        userId: presence.userId,
        displayName: normalizeDisplayName(presence.displayName),
        status: room?.status === "playing" ? "w grze" : "dostępny",
        roomId: room?.roomId ?? null,
        roomName: room?.roomName ?? null,
      };
    });
  }

  listInvitations(userId) {
    return [...this.#invitations.values()]
      .filter((invitation) => invitation.toId === userId && invitation.status === "pending")
      .map((invitation) => structuredClone({ ...invitation, fromName: normalizeDisplayName(invitation.fromName) }));
  }

  createRoom({ ownerId, ownerName, roomName = "Nowy pokój" }) {
    requireText(ownerId, "ownerId");
    requireText(ownerName, "ownerName");
    requireText(roomName, "roomName");
    const existing = [...this.#rooms.values()].find((room) => room.white.id === ownerId && room.status === "waiting");
    if (existing) return publicRoom(existing);
    const room = {
      roomId: this.idGenerator(), roomName, status: "waiting",
      white: { id: ownerId, name: normalizeDisplayName(ownerName) }, black: null, gameId: null,
    };
    this.#rooms.set(room.roomId, room);
    return publicRoom(room);
  }

  createInvitation({ fromId, fromName, toId, roomId }) {
    requireText(fromId, "fromId");
    requireText(fromName, "fromName");
    requireText(toId, "toId");
    requireText(roomId, "roomId");
    if (fromId === toId) throw new LobbyError("Nie możesz zaprosić samego siebie.", "INVALID_INVITATION");
    const room = this.#rooms.get(roomId);
    if (!room || room.status !== "waiting" || room.white.id !== fromId) {
      throw new LobbyError("Najpierw zajmij miejsce przy własnym stole.", "ROOM_NOT_JOINABLE");
    }
    const target = this.listPlayers().find((player) => player.userId === toId);
    if (!target) throw new LobbyError("Gracz nie jest już dostępny.", "PLAYER_OFFLINE");
    if (target.status === "w grze") throw new LobbyError("Ten gracz jest już w grze.", "PLAYER_BUSY");
    for (const invitation of this.#invitations.values()) {
      if (invitation.status === "pending" && invitation.fromId === fromId && invitation.toId === toId && invitation.roomId === roomId) {
        return structuredClone(invitation);
      }
    }
    const invitation = {
      invitationId: this.idGenerator(), status: "pending", roomId,
      roomName: room.roomName, fromId, fromName: normalizeDisplayName(fromName), toId, createdAt: Date.now(),
    };
    this.#invitations.set(invitation.invitationId, invitation);
    return structuredClone(invitation);
  }

  async respondInvitation({ invitationId, userId, userName, accept }) {
    const invitation = this.#invitations.get(invitationId);
    if (!invitation || invitation.toId !== userId || invitation.status !== "pending") {
      throw new LobbyError("Zaproszenie nie jest już aktualne.", "INVITATION_NOT_FOUND");
    }
    invitation.status = accept ? "accepted" : "declined";
    if (!accept) return { accepted: false };
    const room = await this.joinRoom({ roomId: invitation.roomId, playerId: userId, playerName: normalizeDisplayName(userName) });
    return { accepted: true, room };
  }

  async joinRoom({ roomId, playerId, playerName }) {
    const room = this.#rooms.get(roomId);
    if (!room) throw new LobbyError("Pokój nie istnieje.", "ROOM_NOT_FOUND");
    if (room.status !== "waiting") throw new LobbyError("Pokój nie oczekuje na gracza.", "ROOM_NOT_JOINABLE");
    if (room.white.id === playerId) throw new LobbyError("Twórca pokoju nie może dołączyć drugi raz.", "DUPLICATE_PLAYER");
    room.black = { id: playerId, name: normalizeDisplayName(playerName) };
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
    white: room.white ? { ...room.white, name: normalizeDisplayName(room.white.name) } : null,
    black: room.black ? { ...room.black, name: normalizeDisplayName(room.black.name) } : null,
    gameId: room.gameId,
  });
}

function normalizeDisplayName(value) {
  if (typeof value !== "string") return value;
  if (value.localeCompare("Czeslaw", "pl", { sensitivity: "base" }) === 0) return "Czesław";
  return value.normalize("NFC");
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new LobbyError(`Pole ${field} jest nieprawidłowe.`, "INVALID_ROOM");
  }
}
