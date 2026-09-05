import {
  createGameSession,
  disconnectPlayer,
  getSessionSnapshot,
  reconnectPlayer,
  sendChatMessage,
  submitGameAction,
  submitMove,
} from "./session.js";
import { CommonMatchRuntime, MatchRuntimeError, assertExpectedVersion } from "./match-runtime.js";

export function createLegacyMatchRuntime({ checkersStore, thousandService, gomokuService, ownershipCoordinator = null } = {}) {
  const runtime = new CommonMatchRuntime({ ownershipCoordinator });
  if (checkersStore) runtime.register("checkers", new CheckersMatchAdapter({ store: checkersStore }));
  if (thousandService) runtime.register("thousand", new ThousandMatchAdapter({ service: thousandService }));
  if (gomokuService) runtime.register("gomoku", new GomokuMatchAdapter({ service: gomokuService }));
  return runtime;
}

export class CheckersMatchAdapter {
  constructor({ store } = {}) {
    if (!store || typeof store.get !== "function" || typeof store.save !== "function" || typeof store.create !== "function") {
      throw new TypeError("CheckersMatchAdapter wymaga magazynu sesji.");
    }
    this.store = store;
  }

  async getView({ matchId, actorUserId }) {
    const session = await this.store.get(matchId);
    return { version: sessionVersion(session), view: getSessionSnapshot(session, actorUserId) };
  }

  async execute(command) {
    if (command.commandType === "match.create") {
      assertExpectedVersion(0, command.expectedVersion);
      const session = createGameSession({
        gameId: command.matchId,
        whitePlayerId: command.payload.whitePlayerId,
        blackPlayerId: command.payload.blackPlayerId,
        ...(command.payload.game ? { game: command.payload.game } : {}),
      });
      if (![session.players.white.id, session.players.black.id].includes(command.actorUserId)) {
        throw new MatchRuntimeError("Twórca meczu musi być jego uczestnikiem.", "MATCH_ACTOR_NOT_PLAYER", 403);
      }
      const saved = await this.store.create(session);
      return checkersResult(saved ?? session, command.actorUserId);
    }

    const session = await this.store.get(command.matchId);
    assertExpectedVersion(sessionVersion(session), command.expectedVersion);

    if (command.commandType === "match.move") {
      const result = submitMove(session, {
        playerId: command.actorUserId,
        requestId: command.payload.requestId ?? command.commandId,
        move: command.payload.move,
      });
      const saved = await this.store.save(result.session);
      return { ...checkersResult(saved ?? result.session, command.actorUserId), duplicate: result.duplicate };
    }

    if (command.commandType === "match.action") {
      const next = submitGameAction(session, { playerId: command.actorUserId, action: command.payload.action });
      const saved = await this.store.save(next);
      return checkersResult(saved ?? next, command.actorUserId);
    }

    if (command.commandType === "match.chat") {
      const next = sendChatMessage(session, { playerId: command.actorUserId, text: command.payload.text });
      const saved = await this.store.save(next);
      return checkersResult(saved ?? next, command.actorUserId);
    }

    if (command.commandType === "match.disconnect") {
      const next = disconnectPlayer(session, command.actorUserId);
      const saved = await this.store.save(next);
      return checkersResult(saved ?? next, command.actorUserId);
    }

    if (command.commandType === "match.reconnect") {
      const result = reconnectPlayer(session, command.actorUserId);
      const saved = await this.store.save(result.session);
      return { version: sessionVersion(saved ?? result.session), view: getSessionSnapshot(saved ?? result.session, command.actorUserId) };
    }

    throw unsupported("checkers", command.commandType);
  }
}

export class ThousandMatchAdapter {
  constructor({ service } = {}) {
    if (!service || typeof service.createGame !== "function" || typeof service.getView !== "function" || typeof service.performAction !== "function") {
      throw new TypeError("ThousandMatchAdapter wymaga ThousandGameService.");
    }
    this.service = service;
  }

  async getView({ matchId, actorUserId }) {
    const view = await this.service.getView(matchId, actorUserId);
    return { version: Number(view.revision), view };
  }

  async execute(command) {
    if (command.commandType === "match.create") {
      assertExpectedVersion(0, command.expectedVersion);
      const players = command.payload.players;
      if (!Array.isArray(players) || !players.some((player) => String(player?.userId ?? "").toLowerCase() === command.actorUserId.toLowerCase())) {
        throw new MatchRuntimeError("Twórca meczu musi być jego uczestnikiem.", "MATCH_ACTOR_NOT_PLAYER", 403);
      }
      await this.service.createGame({
        gameId: command.matchId,
        players,
        dealerIndex: command.payload.dealerIndex ?? 0,
        rules: command.payload.rules,
      });
      return this.getView({ matchId: command.matchId, actorUserId: command.actorUserId });
    }

    if (command.commandType === "match.action") {
      const view = await this.service.performAction(command.matchId, command.actorUserId, command.payload.action, {
        expectedRevision: command.expectedVersion,
      });
      return { version: Number(view.revision), view };
    }

    if (command.commandType === "match.next-round") {
      if (typeof this.service.nextRound !== "function") throw unsupported("thousand", command.commandType);
      const view = await this.service.nextRound(command.matchId, command.actorUserId, {
        expectedRevision: command.expectedVersion,
      });
      return { version: Number(view.revision), view };
    }

    throw unsupported("thousand", command.commandType);
  }
}

export class GomokuMatchAdapter {
  constructor({ service } = {}) {
    if (!service || typeof service.createGame !== "function" || typeof service.view !== "function" || typeof service.move !== "function") {
      throw new TypeError("GomokuMatchAdapter wymaga GomokuService.");
    }
    this.service = service;
  }

  async getView({ matchId, actorUserId }) {
    const view = await this.service.view(matchId, actorUserId);
    return { version: Number(view.revision), view };
  }

  async execute(command) {
    if (command.commandType === "match.create") {
      assertExpectedVersion(0, command.expectedVersion);
      const players = command.payload.players;
      if (!Array.isArray(players) || !players.some((player) => String(player?.userId ?? "") === command.actorUserId)) {
        throw new MatchRuntimeError("Twórca meczu musi być jego uczestnikiem.", "MATCH_ACTOR_NOT_PLAYER", 403);
      }
      const view = await this.service.createGame({ gameId: command.matchId, players });
      return { version: Number(view.revision), view };
    }

    if (command.commandType === "match.move") {
      const current = await this.service.view(command.matchId, command.actorUserId);
      assertExpectedVersion(Number(current.revision), command.expectedVersion);
      const view = await this.service.move(command.matchId, command.actorUserId, {
        row: command.payload.row,
        column: command.payload.column,
        requestId: command.payload.requestId ?? command.commandId,
      });
      return { version: Number(view.revision), view };
    }

    throw unsupported("gomoku", command.commandType);
  }
}

function checkersResult(session, actorUserId) {
  return { version: sessionVersion(session), view: getSessionSnapshot(session, actorUserId) };
}

function sessionVersion(session) {
  return Number(session?.events?.at(-1)?.sequence ?? 0);
}

function unsupported(gameType, commandType) {
  return new MatchRuntimeError(`Komenda ${commandType} nie jest obsługiwana przez adapter ${gameType}.`, "MATCH_COMMAND_NOT_SUPPORTED", 400);
}
