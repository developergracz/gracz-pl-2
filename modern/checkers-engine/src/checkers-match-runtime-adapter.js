import { getSessionSnapshot, submitMove } from "./session.js";

export function createCheckersMatchRuntimeAdapter() {
  return {
    applyCommand({ state, command }) {
      if (command?.type !== "move") throw new TypeError("Adapter Checkers P7 obsługuje obecnie wyłącznie polecenie move.");
      const result = submitMove(state, {
        playerId: command.playerId,
        requestId: command.requestId,
        move: command.move,
      });
      return result.session;
    },
    project(state, viewerId) {
      return getSessionSnapshot(state, viewerId);
    },
  };
}
