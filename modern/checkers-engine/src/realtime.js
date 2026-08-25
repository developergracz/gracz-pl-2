import { getSessionSnapshot } from "./session.js";

export class RealtimeHub {
  #subscribers = new Map();

  subscribe(session, playerId, response) {
    const key = session.gameId;
    const subscription = { playerId, response };
    const subscribers = this.#subscribers.get(key) ?? new Set();
    subscribers.add(subscription);
    this.#subscribers.set(key, subscribers);

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.write(encodeEvent("game.snapshot", getSessionSnapshot(session, playerId)));

    const remove = () => {
      subscribers.delete(subscription);
      if (subscribers.size === 0) this.#subscribers.delete(key);
    };
    response.on("close", remove);
    return remove;
  }

  publish(session, type = "game.snapshot") {
    for (const subscriber of this.#subscribers.get(session.gameId) ?? []) {
      try {
        subscriber.response.write(encodeEvent(type, getSessionSnapshot(session, subscriber.playerId)));
      } catch {
        subscriber.response.end();
      }
    }
  }

  close() {
    for (const subscribers of this.#subscribers.values()) {
      for (const { response } of subscribers) response.end();
    }
    this.#subscribers.clear();
  }
}

function encodeEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
