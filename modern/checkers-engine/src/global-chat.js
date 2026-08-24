import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const TOPIC_CATEGORIES = new Set(["ogólne", "warcaby", "gomoku", "szachy", "turnieje", "pomoc", "offtopic"]);
const MAX_CHAT_SSE_TOTAL = 500;
const MAX_CHAT_SSE_PER_USER = 3;

export class GlobalChatService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } }) : null;
    this.memory = [];
    this.memoryTopics = [];
    this.memoryFriends = [];
    this.presence = new Map();
    this.rate = new Map();
    this.subscribers = new Set();
    this.ready = this.pool ? this.init() : Promise.resolve();
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_chat_topics (
        topic_id UUID PRIMARY KEY,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'ogólne',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS gracz_chat_topics_created_idx ON gracz_chat_topics(created_at DESC);

      CREATE TABLE IF NOT EXISTS gracz_global_chat (
        message_id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        body TEXT NOT NULL,
        reply_to UUID NULL,
        topic_id UUID NULL,
        reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edited_at TIMESTAMPTZ NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE
      );
      ALTER TABLE gracz_global_chat ADD COLUMN IF NOT EXISTS topic_id UUID NULL;
      CREATE INDEX IF NOT EXISTS gracz_global_chat_created_idx ON gracz_global_chat(created_at DESC);
      CREATE INDEX IF NOT EXISTS gracz_global_chat_user_idx ON gracz_global_chat(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS gracz_global_chat_topic_idx ON gracz_global_chat(topic_id,created_at DESC);

      CREATE TABLE IF NOT EXISTS gracz_chat_friends (
        relation_id UUID PRIMARY KEY,
        requester_id TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        addressee_id TEXT NOT NULL,
        addressee_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (requester_id <> addressee_id),
        UNIQUE(requester_id, addressee_id)
      );
      CREATE INDEX IF NOT EXISTS gracz_chat_friends_users_idx ON gracz_chat_friends(requester_id,addressee_id,status);

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
    return [...this.presence.values()].filter((item) => item.seenAt >= cutoff).map(({ userId, displayName }) => ({ userId, displayName })).slice(0, 200);
  }

  subscribe(response, user) {
    this.touch(user);
    const userConnections = [...this.subscribers].filter((client) => client.userId === user.userId).length;
    if (this.subscribers.size >= MAX_CHAT_SSE_TOTAL) throw chatError("Chat jest chwilowo przeciążony. Spróbuj ponownie za chwilę.", "CHAT_STREAM_CAPACITY", 503);
    if (userConnections >= MAX_CHAT_SSE_PER_USER) throw chatError("Masz już zbyt wiele otwartych połączeń z chatem.", "CHAT_STREAM_LIMIT", 429);

    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    const client = { response, userId: user.userId, ping: null, closed: false, close: null };
    const close = () => {
      if (client.closed) return;
      client.closed = true;
      if (client.ping) clearInterval(client.ping);
      this.subscribers.delete(client);
      if (!response.writableEnded) response.end();
    };
    client.close = close;
    this.subscribers.add(client);
    response.on("close", close);
    response.on("finish", close);

    if (!writeSse(client, `event: connected\ndata: ${JSON.stringify({ online: this.online() })}\n\n`)) return close();
    client.ping = setInterval(() => {
      if (!writeSse(client, `event: ping\ndata: ${Date.now()}\n\n`)) close();
    }, 25_000);
  }

  broadcast(event, payload) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...this.subscribers]) if (!writeSse(client, data)) client.close?.();
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

  async list(user, options = {}) {
    this.touch(user);
    const safeLimit = Math.max(20, Math.min(150, Number(options.limit) || 100));
    const q = String(options.q || "").trim().slice(0, 100);
    const userId = String(options.user || "").trim().slice(0, 128);
    const topicId = validUuid(options.topic) ? String(options.topic) : "";
    const from = validDate(options.from) ? options.from : "";
    const to = validDate(options.to) ? options.to : "";

    if (!this.pool) {
      let rows = this.memory.filter((m) => !m.deleted);
      if (q) rows = rows.filter((m) => `${m.body} ${m.displayName} ${m.topicTitle || ""}`.toLocaleLowerCase("pl").includes(q.toLocaleLowerCase("pl")));
      if (userId) rows = rows.filter((m) => m.userId === userId);
      if (topicId) rows = rows.filter((m) => m.topicId === topicId);
      if (from) rows = rows.filter((m) => new Date(m.createdAt) >= new Date(`${from}T00:00:00`));
      if (to) rows = rows.filter((m) => new Date(m.createdAt) <= new Date(`${to}T23:59:59.999`));
      return { messages: rows.slice(-safeLimit), online: this.online() };
    }

    const params = []; const where = ["m.deleted=FALSE"];
    if (q) { params.push(`%${q}%`); where.push(`(m.body ILIKE $${params.length} OR m.display_name ILIKE $${params.length} OR COALESCE(t.title,'') ILIKE $${params.length})`); }
    if (userId) { params.push(userId); where.push(`m.user_id=$${params.length}`); }
    if (topicId) { params.push(topicId); where.push(`m.topic_id=$${params.length}`); }
    if (from) { params.push(from); where.push(`m.created_at >= $${params.length}::date`); }
    if (to) { params.push(to); where.push(`m.created_at < ($${params.length}::date + INTERVAL '1 day')`); }
    params.push(safeLimit);
    const { rows } = await this.pool.query(`SELECT m.message_id,m.user_id,m.display_name,m.body,m.reply_to,m.topic_id,m.reactions,m.created_at,m.edited_at,m.deleted,t.title AS topic_title,t.category AS topic_category FROM gracz_global_chat m LEFT JOIN gracz_chat_topics t ON t.topic_id=m.topic_id WHERE ${where.join(" AND ")} ORDER BY m.created_at DESC LIMIT $${params.length}`, params);
    return { messages: rows.reverse().map(mapRow), online: this.online() };
  }

  async send(user, input = {}) {
    this.touch(user);
    const body = this.cleanBody(input.body); this.assertRate(user.userId, body);
    const replyTo = validUuid(input.replyTo) ? String(input.replyTo) : null;
    const topicId = validUuid(input.topicId) ? String(input.topicId) : null;
    let topicTitle = null, topicCategory = null;
    if (topicId) {
      const topic = await this.getTopic(topicId);
      if (!topic || topic.closed) throw chatError("Ten temat nie jest już dostępny.", "CHAT_TOPIC_CLOSED", 409);
      topicTitle = topic.title; topicCategory = topic.category;
    }
    let item = { messageId: randomUUID(), userId: user.userId, displayName: user.displayName, body, replyTo, topicId, topicTitle, topicCategory, reactions: {}, createdAt: new Date().toISOString(), editedAt: null, deleted: false };
    if (!this.pool) {
      this.memory.push(item); if (this.memory.length > 1000) this.memory.splice(0, this.memory.length - 1000);
    } else {
      const { rows } = await this.pool.query(`INSERT INTO gracz_global_chat(message_id,user_id,display_name,body,reply_to,topic_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING message_id,user_id,display_name,body,reply_to,topic_id,reactions,created_at,edited_at,deleted`, [item.messageId,item.userId,item.displayName,item.body,replyTo,topicId]);
      item = { ...mapRow(rows[0]), topicTitle, topicCategory };
    }
    this.broadcast("message.created", { message: item, online: this.online() });
    return item;
  }

  async edit(user, messageId, bodyValue) {
    const body = this.cleanBody(bodyValue); let item;
    if (!this.pool) {
      item = this.memory.find((m) => m.messageId === messageId && m.userId === user.userId && !m.deleted);
      if (!item) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404);
      item.body = body; item.editedAt = new Date().toISOString();
    } else {
      const { rows } = await this.pool.query(`UPDATE gracz_global_chat SET body=$3,edited_at=NOW() WHERE message_id=$1 AND user_id=$2 AND deleted=FALSE AND created_at > NOW()-INTERVAL '15 minutes' RETURNING message_id,user_id,display_name,body,reply_to,topic_id,reactions,created_at,edited_at,deleted`, [messageId,user.userId,body]);
      if (!rows[0]) throw chatError("Wiadomość można edytować tylko przez 15 minut.", "CHAT_EDIT_EXPIRED", 403);
      item = mapRow(rows[0]);
    }
    this.broadcast("message.updated", { message: item }); return item;
  }

  async remove(user, messageId) {
    if (!this.pool) {
      const item = this.memory.find((m) => m.messageId === messageId && m.userId === user.userId); if (!item) throw chatError("Nie znaleziono wiadomości.", "CHAT_NOT_FOUND", 404); item.deleted=true; item.body="";
    } else {
      const { rowCount } = await this.pool.query(`UPDATE gracz_global_chat SET deleted=TRUE,body='' WHERE message_id=$1 AND user_id=$2`, [messageId,user.userId]); if (!rowCount) throw chatError("Nie możesz usunąć tej wiadomości.", "CHAT_FORBIDDEN", 403);
    }
    this.broadcast("message.deleted", { messageId }); return { ok:true };
  }

  async react(user, messageId, emoji) {
    const allowed = new Set(["👍","❤️","😂","😮","👏","🔥"]); if (!allowed.has(emoji)) throw chatError("Nieprawidłowa reakcja.", "CHAT_REACTION", 400);
    let item;
    if (!this.pool) {
      item=this.memory.find((m)=>m.messageId===messageId&&!m.deleted); if(!item) throw chatError("Nie znaleziono wiadomości.","CHAT_NOT_FOUND",404); const users=new Set(item.reactions[emoji]||[]); users.has(user.userId)?users.delete(user.userId):users.add(user.userId); item.reactions[emoji]=[...users];
    } else {
      const {rows}=await this.pool.query(`SELECT reactions FROM gracz_global_chat WHERE message_id=$1 AND deleted=FALSE`,[messageId]); if(!rows[0]) throw chatError("Nie znaleziono wiadomości.","CHAT_NOT_FOUND",404); const reactions=rows[0].reactions||{}; const users=new Set(reactions[emoji]||[]); users.has(user.userId)?users.delete(user.userId):users.add(user.userId); reactions[emoji]=[...users]; const updated=await this.pool.query(`UPDATE gracz_global_chat SET reactions=$2::jsonb WHERE message_id=$1 RETURNING message_id,user_id,display_name,body,reply_to,topic_id,reactions,created_at,edited_at,deleted`,[messageId,JSON.stringify(reactions)]); item=mapRow(updated.rows[0]);
    }
    this.broadcast("message.updated",{message:item}); return item;
  }

  async report(user,messageId,reasonValue){const reason=String(reasonValue||"inne").trim().slice(0,240)||"inne";if(this.pool)await this.pool.query(`INSERT INTO gracz_global_chat_reports(report_id,message_id,reporter_id,reason) VALUES($1,$2,$3,$4) ON CONFLICT(message_id,reporter_id) DO NOTHING`,[randomUUID(),messageId,user.userId,reason]);return{ok:true};}

  cleanTopic(input={}) {
    const title=String(input.title||"").trim().replace(/\s+/g," ").slice(0,80); if(title.length<3) throw chatError("Temat musi mieć co najmniej 3 znaki.","CHAT_TOPIC_TITLE",400);
    const description=String(input.description||"").trim().slice(0,280);
    const category=TOPIC_CATEGORIES.has(String(input.category||"").toLowerCase())?String(input.category).toLowerCase():"ogólne";
    return {title,description,category};
  }

  async createTopic(user,input={}) {
    const clean=this.cleanTopic(input); const topic={topicId:randomUUID(),ownerId:user.userId,ownerName:user.displayName,...clean,createdAt:new Date().toISOString(),closed:false};
    if(!this.pool)this.memoryTopics.push(topic); else await this.pool.query(`INSERT INTO gracz_chat_topics(topic_id,owner_id,owner_name,title,description,category) VALUES($1,$2,$3,$4,$5,$6)`,[topic.topicId,topic.ownerId,topic.ownerName,topic.title,topic.description,topic.category]);
    this.broadcast("topic.created",{topic}); return topic;
  }

  async topics(options={}) {
    const q=String(options.q||"").trim().slice(0,100), category=String(options.category||"").trim().toLowerCase();
    if(!this.pool){let rows=this.memoryTopics.filter(t=>!t.closed);if(q)rows=rows.filter(t=>`${t.title} ${t.description} ${t.ownerName}`.toLowerCase().includes(q.toLowerCase()));if(category&&TOPIC_CATEGORIES.has(category))rows=rows.filter(t=>t.category===category);return rows.slice(-100).reverse();}
    const params=[];const where=["closed=FALSE"];if(q){params.push(`%${q}%`);where.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR owner_name ILIKE $${params.length})`);}if(category&&TOPIC_CATEGORIES.has(category)){params.push(category);where.push(`category=$${params.length}`);}const {rows}=await this.pool.query(`SELECT topic_id,owner_id,owner_name,title,description,category,created_at,closed,(SELECT COUNT(*)::int FROM gracz_global_chat m WHERE m.topic_id=t.topic_id AND m.deleted=FALSE) AS message_count FROM gracz_chat_topics t WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 100`,params);return rows.map(mapTopic);
  }

  async getTopic(topicId){if(!validUuid(topicId))return null;if(!this.pool)return this.memoryTopics.find(t=>t.topicId===topicId)||null;const {rows}=await this.pool.query(`SELECT topic_id,owner_id,owner_name,title,description,category,created_at,closed FROM gracz_chat_topics WHERE topic_id=$1`,[topicId]);return rows[0]?mapTopic(rows[0]):null;}

  async requestFriend(user,input={}) {
    const targetId=String(input.userId||"").trim().toLowerCase().slice(0,128), targetName=String(input.displayName||targetId).trim().slice(0,80); if(!targetId||targetId===user.userId.toLowerCase())throw chatError("Nie możesz dodać samego siebie.","FRIEND_INVALID",400);
    if(!this.pool){const exists=this.memoryFriends.find(r=>pairMatches(r,user.userId,targetId));if(exists)throw chatError("Relacja ze wskazanym graczem już istnieje.","FRIEND_EXISTS",409);const relation={relationId:randomUUID(),requesterId:user.userId,requesterName:user.displayName,addresseeId:targetId,addresseeName:targetName,status:"pending",createdAt:new Date().toISOString()};this.memoryFriends.push(relation);return relation;}
    const existing=await this.pool.query(`SELECT 1 FROM gracz_chat_friends WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)`,[user.userId,targetId]);if(existing.rowCount)throw chatError("Relacja ze wskazanym graczem już istnieje.","FRIEND_EXISTS",409);
    const id=randomUUID();const {rows}=await this.pool.query(`INSERT INTO gracz_chat_friends(relation_id,requester_id,requester_name,addressee_id,addressee_name) VALUES($1,$2,$3,$4,$5) RETURNING *`,[id,user.userId,user.displayName,targetId,targetName]);return mapFriend(rows[0]);
  }

  async friends(user) {
    let relations;if(!this.pool)relations=this.memoryFriends.filter(r=>r.requesterId===user.userId||r.addresseeId===user.userId);else{const {rows}=await this.pool.query(`SELECT * FROM gracz_chat_friends WHERE requester_id=$1 OR addressee_id=$1 ORDER BY updated_at DESC`,[user.userId]);relations=rows.map(mapFriend);}
    const friends=[],incoming=[],outgoing=[];for(const r of relations){if(r.status==="accepted"){const mine=r.requesterId===user.userId;const peer={relationId:r.relationId,userId:mine?r.addresseeId:r.requesterId,displayName:mine?r.addresseeName:r.requesterName,online:this.presence.has(mine?r.addresseeId:r.requesterId)};friends.push(peer);}else if(r.status==="pending"){(r.addresseeId===user.userId?incoming:outgoing).push(r);}}
    return {friends,incoming,outgoing};
  }

  async respondFriend(user,relationId,action){if(!["accept","reject"].includes(action))throw chatError("Nieprawidłowa operacja.","FRIEND_ACTION",400);if(!this.pool){const r=this.memoryFriends.find(x=>x.relationId===relationId&&x.addresseeId===user.userId&&x.status==="pending");if(!r)throw chatError("Nie znaleziono zaproszenia.","FRIEND_NOT_FOUND",404);if(action==="reject")this.memoryFriends=this.memoryFriends.filter(x=>x!==r);else r.status="accepted";return{ok:true};}if(action==="reject"){const {rowCount}=await this.pool.query(`DELETE FROM gracz_chat_friends WHERE relation_id=$1 AND addressee_id=$2 AND status='pending'`,[relationId,user.userId]);if(!rowCount)throw chatError("Nie znaleziono zaproszenia.","FRIEND_NOT_FOUND",404);}else{const {rowCount}=await this.pool.query(`UPDATE gracz_chat_friends SET status='accepted',updated_at=NOW() WHERE relation_id=$1 AND addressee_id=$2 AND status='pending'`,[relationId,user.userId]);if(!rowCount)throw chatError("Nie znaleziono zaproszenia.","FRIEND_NOT_FOUND",404);}return{ok:true};}

  async removeFriend(user,relationId){if(!this.pool){const before=this.memoryFriends.length;this.memoryFriends=this.memoryFriends.filter(r=>!(r.relationId===relationId&&(r.requesterId===user.userId||r.addresseeId===user.userId)));if(before===this.memoryFriends.length)throw chatError("Nie znaleziono znajomego.","FRIEND_NOT_FOUND",404);return{ok:true};}const {rowCount}=await this.pool.query(`DELETE FROM gracz_chat_friends WHERE relation_id=$1 AND (requester_id=$2 OR addressee_id=$2)`,[relationId,user.userId]);if(!rowCount)throw chatError("Nie znaleziono znajomego.","FRIEND_NOT_FOUND",404);return{ok:true};}

  async close(){for(const client of [...this.subscribers])client.close?.();this.subscribers.clear();if(this.pool)await this.pool.end();}
}

export function createGlobalChatHandler({service,auth,authSessions}){return async function globalChatHandler(request,response){const url=new URL(request.url,"http://localhost");if(!url.pathname.startsWith("/global-chat"))return false;if(url.pathname.endsWith(".html")||url.pathname.endsWith(".css")||url.pathname.endsWith(".js"))return false;try{const user=await trustedChatUser(request,auth,authSessions);service.touch(user);
  if(request.method==="GET"&&url.pathname==="/global-chat/events"){service.subscribe(response,user);return true;}
  if(request.method==="GET"&&url.pathname==="/global-chat/messages")return json(response,200,await service.list(user,{limit:url.searchParams.get("limit"),q:url.searchParams.get("q"),user:url.searchParams.get("user"),topic:url.searchParams.get("topic"),from:url.searchParams.get("from"),to:url.searchParams.get("to")}));
  if(request.method==="GET"&&url.pathname==="/global-chat/presence")return json(response,200,{online:service.online()});
  if(request.method==="POST"&&url.pathname==="/global-chat/messages")return json(response,201,{message:await service.send(user,await readJson(request))});
  if(request.method==="GET"&&url.pathname==="/global-chat/topics")return json(response,200,{topics:await service.topics({q:url.searchParams.get("q"),category:url.searchParams.get("category")})});
  if(request.method==="POST"&&url.pathname==="/global-chat/topics")return json(response,201,{topic:await service.createTopic(user,await readJson(request))});
  if(request.method==="GET"&&url.pathname==="/global-chat/friends")return json(response,200,await service.friends(user));
  if(request.method==="POST"&&url.pathname==="/global-chat/friends")return json(response,201,{relation:await service.requestFriend(user,await readJson(request))});
  const friend=url.pathname.match(/^\/global-chat\/friends\/([0-9a-f-]{36})$/i);if(friend&&request.method==="PATCH")return json(response,200,await service.respondFriend(user,friend[1],(await readJson(request)).action));if(friend&&request.method==="DELETE")return json(response,200,await service.removeFriend(user,friend[1]));
  const msg=url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})$/i);if(msg&&request.method==="PATCH")return json(response,200,{message:await service.edit(user,msg[1],(await readJson(request)).body)});if(msg&&request.method==="DELETE")return json(response,200,await service.remove(user,msg[1]));
  const reaction=url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})\/reaction$/i);if(reaction&&request.method==="POST")return json(response,200,{message:await service.react(user,reaction[1],(await readJson(request)).emoji)});
  const report=url.pathname.match(/^\/global-chat\/messages\/([0-9a-f-]{36})\/report$/i);if(report&&request.method==="POST")return json(response,200,await service.report(user,report[1],(await readJson(request)).reason));
  return json(response,404,{error:{message:"Nie znaleziono funkcji chatu."}});
}catch(error){return json(response,error.status||500,{error:{code:error.code||"CHAT_ERROR",message:error.message||"Błąd chatu."}});}};}

async function trustedChatUser(request,auth,authSessions){const cookies=Object.fromEntries(String(request.headers.cookie||"").split(";").map((part)=>{const i=part.indexOf("=");return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:["",""];}).filter(([k])=>k));const token=cookies["__Host-gracz_session"]||(String(request.headers.authorization||"").startsWith("Bearer ")?String(request.headers.authorization).slice(7):null);if(!token||token==="cookie")throw chatError("Zaloguj się, aby korzystać z chatu.","UNAUTHENTICATED",401);const user=auth.verify(token);if(authSessions&&user.tokenId&&await authSessions.has(user.tokenId))await authSessions.assertActive(user);return{userId:user.userId,displayName:user.displayName,tokenId:user.tokenId};}
async function readJson(request){const chunks=[];let size=0;for await(const c of request){size+=c.length;if(size>32_768)throw chatError("Żądanie jest za duże.","PAYLOAD_TOO_LARGE",413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");}catch{throw chatError("Nieprawidłowe dane.","INVALID_JSON",400);}}
function json(response,status,body){if(response.writableEnded)return true;response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));return true;}
function writeSse(client,data){const response=client?.response;if(client?.closed||!response||response.writableEnded||response.destroyed)return false;try{return response.write(data)!==false;}catch{return false;}}
function mapRow(r){return{messageId:r.message_id,userId:r.user_id,displayName:r.display_name,body:r.body,replyTo:r.reply_to,topicId:r.topic_id||null,topicTitle:r.topic_title||null,topicCategory:r.topic_category||null,reactions:r.reactions||{},createdAt:r.created_at,editedAt:r.edited_at,deleted:Boolean(r.deleted)};}
function mapTopic(r){return{topicId:r.topic_id,ownerId:r.owner_id,ownerName:r.owner_name,title:r.title,description:r.description||"",category:r.category||"ogólne",createdAt:r.created_at,closed:Boolean(r.closed),messageCount:Number(r.message_count||0)};}
function mapFriend(r){return{relationId:r.relation_id,requesterId:r.requester_id,requesterName:r.requester_name,addresseeId:r.addressee_id,addresseeName:r.addressee_name,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at};}
function pairMatches(r,a,b){return(r.requesterId===a&&r.addresseeId===b)||(r.requesterId===b&&r.addresseeId===a);}
function validUuid(v){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));}
function validDate(v){return/^\d{4}-\d{2}-\d{2}$/.test(String(v||""));}
function chatError(message,code,status){const e=new Error(message);e.code=code;e.status=status;return e;}