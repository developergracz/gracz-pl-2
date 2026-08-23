import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export class GlobalChatService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } }) : null;
    this.memory = [];
    this.presence = new Map();
    this.rate = new Map();
    this.subscribers = new Set();
    this.ready = this.pool ? this.init() : Promise.resolve();
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_global_chat (
        message_id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        body TEXT NOT NULL,
        reply_to UUID NULL,
        reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edited_at TIMESTAMPTZ NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS gracz_global_chat_created_idx ON gracz_global_chat(created_at DESC);
      CREATE TABLE IF NOT EXISTS gracz_global_chat_reports (
        report_id UUID PRIMARY KEY,
        message_id UUID NOT NULL,
        reporter_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(message_id, reporter_id)
      );
    `);
  }

  touch(user) {
    this.presence.set(user.userId, { userId: user.userId, displayName: user.displayName, seenAt: Date.now() });
    const cutoff = Date.now() - 90_000;
    for (const [id, item] of this.presence) if (item.seenAt < cutoff) this.presence.delete(id);
  }

  online() {
    const cutoff = Date.now() - 90_000;
    return [...this.presence.values()]
      .filter((item) => item.seenAt >= cutoff)
      .map(({ userId, displayName }) => ({ userId, displayName }))
      .slice(0, 100);
  }

  subscribe(response, user) {
    this.touch(user);
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.write(`event: connected\ndata: ${JSON.stringify({ online: this.online() })}\n\n`);
    const client = { response, userId: user.userId };
    this.subscribers.add(client);
    const ping = setInterval(() => {
      if (!response.writableEnded) response.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 25_000);
    const close = () => { clearInterval(ping); this.subscribers.delete(client); };
    response.on("close", close);
    response.on("finish", close);
  }

  broadcast(event, payload) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.subscribers) {
      if (client.response.writableEnded) { this.subscribers.delete(client); continue; }
      client.response.write(data);
    }
  }

  assertRate(userId, body) {
    const now = Date.now();
    const state = this.rate.get(userId) || { times: [], last: "" };
    state.times = state.times.filter((t) => now - t < 10_000);
    if (state.times.length >= 5) throw chatError("Wysyłasz wiadomości zbyt szybko. Odczekaj chwilę.", "CHAT_RATE_LIMIT", 429);
    if (state.last === body && state.times.length) throw chatError("Nie wysyłaj tej samej wiadomości kilka razy.", "CHAT_DUPLICATE", 429);
    state.times.push(now); state.last = body; this.rate.set(userId, state);
  }

  cleanBody(value) {
    const raw = String(value ?? "").replace(/\r/g, "").trim();
    if (!raw) throw chatError("Wpisz wiadomość.", "CHAT_EMPTY", 400);
    if (raw.length > 600) throw chatError("Wiadomość jest za długa.", "CHAT_TOO_LONG", 400);
    if ((raw.match(/https?:\/\//gi) || []).length > 2) throw chatError("W jednej wiadomości można umieścić maksymalnie 2 linki.", "CHAT_LINK_LIMIT", 400);
    return raw;
  }

  async list(user, limit = 80) {
    this.touch(user);
    const safeLimit = Math.max(20, Math.min(150, Number(limit) || 80));
    if (!this.pool) return { messages: this.memory.slice(-safeLimit), online: this.online() };
    const { rows } = await this.pool.query(`SELECT message_id,user_id,display_name,body,reply_to,reactions,created_at,edited_at,deleted FROM gracz_global_chat ORDER BY created_at DESC LIMIT $1`, [safeLimit]);
    return { messages: rows.reverse().map(mapRow), online: this.online() };
  }

  async send(user, input = {}) {
    this.touch(user);
    const body = this.cleanBody(input.body);
    this.assertRate(user.userId, body);
    const replyTo = /^[0-9a-f-]{36}$/i.test(String(input.replyTo || "")) ? String(input.replyTo) : null;
    let item = { messageId: randomUUID(), userId: user.userId, displayName: user.displayName, body, replyTo, reactions: {}, createdAt: new Date().toISOString(), editedAt: null, deleted: false };
    if (!this.pool) {
      this.memory.push(item);
      if (this.memory.length > 500) this.memory.splice(0, this.memory.length - 500);
    } else {
      const { rows } = await this.pool.query(`INSERT INTO gracz_global_chat(message_id,user_id,display_name,body,reply_to) VALUES($1,$2,$3,$4,$5) RETURNING message_id,user_id,display_name,body,reply_to,reactions,created_at,edited_at,deleted`, [item.messageId, item.userId, item.displayName, item.body, replyTo]);
      item = mapRow(rows[0]);
    }
    this.broadcast("message.created", { message: item, online: this.online() });
    return item;
  }

  async edit(user, messageId, bodyValue) {
    const body = this.cleanBody(bodyValue);
    let item;
    if (!this.pool) {
      item = this.memory.find((m) => m.messageId === messageId && m.userId === user.userId && !m.deleted);
      if (!item) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404);
      item.body = body; item.editedAt = new Date().toISOString();
    } else {
      const { rows } = await this.pool.query(`UPDATE gracz_global_chat SET body=$3,edited_at=NOW() WHERE message_id=$1 AND user_id=$2 AND deleted=FALSE AND created_at > NOW()-INTERVAL '15 minutes' RETURNING message_id,user_id,display_name,body,reply_to,reactions,created_at,edited_at,deleted`, [messageId, user.userId, body]);
      if (!rows[0]) throw chatError("Wiadomość można edytować tylko przez 15 minut.", "CHAT_EDIT_EXPIRED", 403);
      item = mapRow(rows[0]);
    }
    this.broadcast("message.updated", { message: item });
    return item;
  }

  async remove(user, messageId) {
    if (!this.pool) {
      const item = this.memory.find((m) => m.messageId === messageId && m.userId === user.userId);
      if (!item) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404);
      item.deleted = true; item.body = "";
    } else {
      const { rowCount } = await this.pool.query(`UPDATE gracz_global_chat SET deleted=TRUE,body='' WHERE message_id=$1 AND user_id=$2`, [messageId, user.userId]);
      if (!rowCount) throw chatError("Nie możesz usunąć tej wiadomości.", "CHAT_FORBIDDEN", 403);
    }
    this.broadcast("message.deleted", { messageId });
    return { ok: true };
  }

  async react(user, messageId, emoji) {
    const allowed = new Set(["👍","❤️","😂","😮","👏","🔥"]);
    if (!allowed.has(emoji)) throw chatError("Nieprawidłowa reakcja.", "CHAT_REACTION", 400);
    let item;
    if (!this.pool) {
      item = this.memory.find((m) => m.messageId === messageId && !m.deleted);
      if (!item) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404);
      const users = new Set(item.reactions[emoji] || []); users.has(user.userId) ? users.delete(user.userId) : users.add(user.userId); item.reactions[emoji] = [...users];
    } else {
      const { rows } = await this.pool.query(`SELECT reactions FROM gracz_global_chat WHERE message_id=$1 AND deleted=FALSE`, [messageId]);
      if (!rows[0]) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404);
      const reactions = rows[0].reactions || {}; const users = new Set(reactions[emoji] || []); users.has(user.userId) ? users.delete(user.userId) : users.add(user.userId); reactions[emoji] = [...users];
      const updated = await this.pool.query(`UPDATE gracz_global_chat SET reactions=$2::jsonb WHERE message_id=$1 RETURNING message_id,user_id,display_name,body,reply_to,reactions,created_at,edited_at,deleted`, [messageId, JSON.stringify(reactions)]);
      item = mapRow(updated.rows[0]);
    }
    this.broadcast("message.updated", { message: item });
    return item;
  }

  async report(user, messageId, reasonValue) {
    const reason = String(reasonValue || "inne").trim().slice(0, 240) || "inne";
    if (this.pool) await this.pool.query(`INSERT INTO gracz_global_chat_reports(report_id,message_id,reporter_id,reason) VALUES($1,$2,$3,$4) ON CONFLICT(message_id,reporter_id) DO NOTHING`, [randomUUID(), messageId, user.userId, reason]);
    return { ok: true };
  }

  async close() {
    for (const client of this.subscribers) client.response.end();
    this.subscribers.clear();
    if (this.pool) await this.pool.end();
  }
}

export function createGlobalChatHandler({ service, auth, authSessions }) {
  return async function globalChatHandler(request, response) {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/global-chat")) return false;
    if (url.pathname.endsWith(".html") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) return false;
    try {
      const user = await trustedChatUser(request, auth, authSessions);
      service.touch(user);
      if (request.method === "GET" && url.pathname === "/global-chat/events") { service.subscribe(response, user); return true; }
      if (request.method === "GET" && url.pathname === "/global-chat/messages") return json(response, 200, await service.list(user, url.searchParams.get("limit")));
      if (request.method === "GET" && url.pathname === "/global-chat/presence") return json(response, 200, { online: service.online() });
      if (request.method === "POST" && url.pathname === "/global-chat/messages") return json(response, 201, { message: await service.send(user, await readJson(request)) });
      const msg = url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})$/i);
      if (msg && request.method === "PATCH") return json(response, 200, { message: await service.edit(user, msg[1], (await readJson(request)).body) });
      if (msg && request.method === "DELETE") return json(response, 200, await service.remove(user, msg[1]));
      const reaction = url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})\/reaction$/i);
      if (reaction && request.method === "POST") return json(response, 200, { message: await service.react(user, reaction[1], (await readJson(request)).emoji) });
      const report = url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})\/report$/i);
      if (report && request.method === "POST") return json(response, 200, await service.report(user, report[1], (await readJson(request)).reason));
      return json(response, 404, { error: { message: "Nie znaleziono funkcji chatu." } });
    } catch (error) {
      return json(response, error.status || 500, { error: { code: error.code || "CHAT_ERROR", message: error.message || "Błąd chatu." } });
    }
  };
}

async function trustedChatUser(request, auth, authSessions) {
  const cookies = Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => { const i=part.indexOf("="); return i>0 ? [part.slice(0,i).trim(), decodeURIComponent(part.slice(i+1).trim())] : ["",""]; }).filter(([k])=>k));
  const token = cookies["__Host-gracz_session"] || (String(request.headers.authorization || "").startsWith("Bearer ") ? String(request.headers.authorization).slice(7) : null);
  if (!token || token === "cookie") throw chatError("Zaloguj się, aby korzystać z chatu.", "UNAUTHENTICATED", 401);
  const user = auth.verify(token);
  if (authSessions && user.tokenId && await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
  return { userId: user.userId, displayName: user.displayName, tokenId: user.tokenId };
}

async function readJson(request) {
  const chunks=[]; let size=0;
  for await (const c of request) { size += c.length; if (size>16_384) throw chatError("Żądanie jest za duże.","PAYLOAD_TOO_LARGE",413); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"); }
  catch { throw chatError("Nieprawidłowe dane.","INVALID_JSON",400); }
}

function json(response,status,body){ if(response.writableEnded) return true; response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}); response.end(JSON.stringify(body)); return true; }
function mapRow(r){ return { messageId:r.message_id,userId:r.user_id,displayName:r.display_name,body:r.body,replyTo:r.reply_to,reactions:r.reactions||{},createdAt:r.created_at,editedAt:r.edited_at,deleted:Boolean(r.deleted) }; }
function chatError(message,code,status){ const e=new Error(message); e.code=code; e.status=status; return e; }
