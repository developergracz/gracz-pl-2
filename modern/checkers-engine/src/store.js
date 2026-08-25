import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { deserializeSession, serializeSession } from "./session.js";

export class SessionNotFoundError extends Error {
  constructor(gameId) {
    super(`Nie znaleziono sesji ${gameId}.`);
    this.name = "SessionNotFoundError";
    this.code = "SESSION_NOT_FOUND";
  }
}

export class MemorySessionStore {
  #sessions = new Map();

  async create(session) {
    if (this.#sessions.has(session.gameId)) throw duplicateSession(session.gameId);
    this.#sessions.set(session.gameId, session);
    return session;
  }

  async get(gameId) {
    const session = this.#sessions.get(gameId);
    if (!session) throw new SessionNotFoundError(gameId);
    return session;
  }

  async save(session) {
    this.#sessions.set(session.gameId, session);
    return session;
  }
}

export class FileSessionStore {
  constructor(directory) {
    if (typeof directory !== "string" || directory.length === 0) throw new TypeError("Katalog sesji jest wymagany.");
    this.directory = directory;
  }

  async create(session) {
    await mkdir(this.directory, { recursive: true });
    try {
      await readFile(this.#path(session.gameId), "utf8");
      throw duplicateSession(session.gameId);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return this.save(session);
  }

  async get(gameId) {
    try {
      return deserializeSession(await readFile(this.#path(gameId), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") throw new SessionNotFoundError(gameId);
      throw error;
    }
  }

  async save(session) {
    await mkdir(this.directory, { recursive: true });
    const target = this.#path(session.gameId);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, serializeSession(session), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
    return session;
  }

  #path(gameId) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) throw new TypeError("Nieprawidłowy identyfikator sesji.");
    return join(this.directory, `${gameId}.json`);
  }
}

function duplicateSession(gameId) {
  const error = new Error(`Sesja ${gameId} już istnieje.`);
  error.code = "SESSION_EXISTS";
  return error;
}
