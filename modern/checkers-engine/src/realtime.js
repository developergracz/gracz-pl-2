import { getSessionSnapshot } from "./session.js";

const MAX_CONNECTIONS_PER_PLAYER = 2;
const MAX_CONNECTIONS_PER_GAME = 6;
const MAX_CONNECTIONS_TOTAL = 2_000;

export class RealtimeHub {
  #subscribers = new Map();

  subscribe(session, playerId, response) {
    const key = session.gameId;
    const subscribers = this.#subscribers.get(key) ?? new Set();
    const playerConnections = [...subscribers].filter((item) => item.playerId === playerId).length;
    const totalConnections = [...this.#subscribers.values()].reduce((sum, set) => sum + set.size, 0);

    if (playerConnections >= MAX_CONNECTIONS_PER_PLAYER || subscribers.size >= MAX_CONNECTIONS_PER_GAME || totalConnections >= MAX_CONNECTIONS_TOTAL) {
      response.writeHead(429, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "30",
      });
      response.end(JSON.stringify({ error: { code: "REALTIME_CONNECTION_LIMIT", message: "Zbyt wiele aktywnych połączeń aktualizacji gry. Zamknij nieużywane karty i spróbuj ponownie." } }));
      return () => {};
    }

    const subscription = { playerId, response };
    subscribers.add(subscription);
    this.#subscribers.set(key, subscribers);

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    const initialOk = response.write(encodeEvent("game.snapshot", getSessionSnapshot(session, playerId)));
    if (!initialOk) response.end();

    const remove = () => {
      subscribers.delete(subscription);
      if (subscribers.size === 0) this.#subscribers.delete(key);
    };
    response.on("close", remove);
    response.on("finish", remove);
    return remove;
  }

  publish(session, type = "game.snapshot") {
    for (const subscriber of this.#subscribers.get(session.gameId) ?? []) {
      try {
        const writable = subscriber.response.write(encodeEvent(type, getSessionSnapshot(session, subscriber.playerId)));
        if (!writable) subscriber.response.end();
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
