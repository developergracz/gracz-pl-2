import { GlobalChatService } from './global-chat.js';

const REALTIME_CHANNEL='gracz_global_chat_realtime';
const SCHEMA_LOCK=1_000_004_004;
const PRESENCE_TTL_MS=90_000;
const PRESENCE_REFRESH_MS=15_000;
const MAX_NOTIFICATION_BYTES=768;
const QUERY_TIMEOUT_MS=1_500;
const RECONNECT_DELAY_MS=250;
const SSE_RETRY_MIN_MS=900;
const SSE_RETRY_MAX_MS=1900;
const RECOVERY_MESSAGE_LIMIT=150;
const RECOVERY_BUFFER_LIMIT=256;
const SIGNAL_EVENTS=new Set(['message.created','message.updated','message.deleted','topic.created']);

const SCHEMA_SQL=`
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

  CREATE OR REPLACE FUNCTION gracz_enforce_global_chat_admission() RETURNS TRIGGER AS $$
  DECLARE recent_count INTEGER; recent_body TEXT;
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('global-chat-admission:'||NEW.user_id,0));
    SELECT COUNT(*)::int INTO recent_count
      FROM gracz_global_chat
      WHERE user_id=NEW.user_id AND created_at>NOW()-INTERVAL '10 seconds';
    IF recent_count>=5 THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='CHAT_RATE_LIMIT';
    END IF;
    SELECT body INTO recent_body
      FROM gracz_global_chat
      WHERE user_id=NEW.user_id AND created_at>NOW()-INTERVAL '10 seconds'
      ORDER BY created_at DESC,message_id DESC LIMIT 1;
    IF recent_body IS NOT NULL AND recent_body=NEW.body THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='CHAT_DUPLICATE';
    END IF;
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS gracz_global_chat_admission ON gracz_global_chat;
  CREATE TRIGGER gracz_global_chat_admission
    BEFORE INSERT ON gracz_global_chat
    FOR EACH ROW EXECUTE FUNCTION gracz_enforce_global_chat_admission();

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

  CREATE TABLE IF NOT EXISTS gracz_global_chat_presence (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS gracz_global_chat_presence_seen_idx ON gracz_global_chat_presence(seen_at DESC);
`;

export class DistributedGlobalChatService extends GlobalChatService {
  #listener=null;
  #closing=false;
  #reconnectTimer=null;
  #connectPromise=null;
  #presenceWrites=new Map();

  constructor({pool,logger={error(){}}}={}){
    super(null);
    if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function') throw new TypeError('Współdzielona pula PostgreSQL jest wymagana dla rozproszonego Global Chat.');
    this.pool=pool;
    this.logger=logger;
    this.listenerBackendPid=null;
    this.ready=this.#initialize();
  }

  async #initialize(){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)',[SCHEMA_LOCK]);
      await client.query({text:SCHEMA_SQL,query_timeout:QUERY_TIMEOUT_MS});
      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    }finally{
      client.release();
    }

    const {rows}=await this.pool.query({
      text:`SELECT user_id,display_name,seen_at FROM gracz_global_chat_presence WHERE seen_at >= NOW()-INTERVAL '90 seconds' ORDER BY seen_at DESC LIMIT 200`,
      query_timeout:QUERY_TIMEOUT_MS,
    });
    for(const row of rows) this.presence.set(row.user_id,{userId:row.user_id,displayName:row.display_name,seenAt:new Date(row.seen_at).getTime()});
    await this.#connectListener();
  }

  async send(user,input={}){
    try{return await super.send(user,input)}catch(error){
      if(error?.code==='P0001'&&error?.message==='CHAT_RATE_LIMIT')throw semanticChatError('Wysyłasz wiadomości zbyt szybko. Odczekaj chwilę.','CHAT_RATE_LIMIT');
      if(error?.code==='P0001'&&error?.message==='CHAT_DUPLICATE')throw semanticChatError('Nie wysyłaj tej samej wiadomości kilka razy.','CHAT_DUPLICATE');
      throw error;
    }
  }

  touch(user){
    const now=Date.now();
    this.presence.set(user.userId,{userId:user.userId,displayName:user.displayName,seenAt:now});
    this.#cleanupPresence(now);
    const last=this.#presenceWrites.get(user.userId)??0;
    if(now-last<PRESENCE_REFRESH_MS) return;
    this.#presenceWrites.set(user.userId,now);
    void this.#persistPresence(user).catch(error=>this.#log(error));
  }

  online(){
    this.#cleanupPresence(Date.now());
    return super.online();
  }

  async friends(user){
    this.online();
    return super.friends(user);
  }

  subscribe(response,user){
    if(!this.#listener) throw realtimeUnavailable();
    this.touch(user);
    response.writeHead(200,{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-store, no-transform",connection:"keep-alive","x-accel-buffering":"no"});
    response.write(`retry: ${sseRetryMs()}\n\n`);
    const client={response,userId:user.userId,recovering:true,buffer:[]};
    this.subscribers.add(client);
    const ping=setInterval(()=>{
      this.touch(user);
      if(!response.writableEnded) response.write(`event: ping\ndata: ${Date.now()}\n\n`);
    },25_000);
    ping.unref?.();
    const close=()=>{clearInterval(ping);this.subscribers.delete(client)};
    response.on('close',close);response.on('finish',close);
    void this.#recoverSubscriber(client).catch(error=>{
      this.#log(error);
      try{response.end()}catch{}
    });
  }

  async #recoverSubscriber(client){
    const {rows}=await this.pool.query({
      text:`SELECT m.message_id,m.user_id,m.display_name,m.body,m.reply_to,m.topic_id,m.reactions,m.created_at,m.edited_at,m.deleted,t.title AS topic_title,t.category AS topic_category
            FROM gracz_global_chat m
            LEFT JOIN gracz_chat_topics t ON t.topic_id=m.topic_id
            ORDER BY m.created_at DESC,m.message_id DESC
            LIMIT $1`,
      values:[RECOVERY_MESSAGE_LIMIT],query_timeout:QUERY_TIMEOUT_MS,
    });
    if(!this.subscribers.has(client)||client.response.writableEnded)return;
    for(const row of rows.reverse()){
      if(row.deleted)client.response.write(encodeSse('message.deleted',{messageId:row.message_id}));
      else client.response.write(encodeSse('message.created',{message:mapMessage(row),online:this.online()}));
    }
    client.response.write(encodeSse('connected',{online:this.online(),reconciled:true}));
    client.response.write(encodeSse('topic.created',{reconciled:true}));
    client.recovering=false;
    const pending=client.buffer.splice(0);
    for(const data of pending){
      if(client.response.writableEnded)break;
      client.response.write(data);
    }
  }

  broadcast(event,payload){
    if(!SIGNAL_EVENTS.has(event)) return this.#broadcastLocal(event,payload);
    const signal=signalFor(event,payload);
    if(!signal) return this.#broadcastLocal(event,payload);
    void this.#notify(signal).catch(error=>{
      this.#log(error);
      this.#broadcastLocal(event,payload);
    });
  }

  async #persistPresence(user){
    await this.pool.query({
      text:`INSERT INTO gracz_global_chat_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=NOW()`,
      values:[String(user.userId).slice(0,128),String(user.displayName).slice(0,80)],
      query_timeout:QUERY_TIMEOUT_MS,
    });
    await this.#notify({kind:'presence',userId:String(user.userId).slice(0,128)});
  }

  async #notify(signal){
    const payload=JSON.stringify(signal);
    if(Buffer.byteLength(payload,'utf8')>MAX_NOTIFICATION_BYTES) throw new Error('Global Chat realtime signal is too large.');
    await this.pool.query({
      text:'SELECT pg_notify($1,$2)',
      values:[REALTIME_CHANNEL,payload],
      query_timeout:QUERY_TIMEOUT_MS,
    });
  }

  #connectListener(){
    if(this.#closing||this.#listener) return Promise.resolve();
    if(this.#connectPromise) return this.#connectPromise;
    this.#connectPromise=this.#openListener().finally(()=>{this.#connectPromise=null});
    return this.#connectPromise;
  }

  async #openListener(){
    let client;
    try{
      client=await this.pool.connect();
      if(this.#closing){client.release();return}
      client.on('notification',notification=>{
        if(notification.channel===REALTIME_CHANNEL) void this.#handleNotification(notification.payload);
      });
      client.on('error',error=>this.#listenerLost(client,error));
      client.on('end',()=>this.#listenerLost(client));
      await client.query({text:`LISTEN ${REALTIME_CHANNEL}`,query_timeout:QUERY_TIMEOUT_MS});
      if(this.#closing){client.release();return}
      this.#listener=client;
      this.listenerBackendPid=client.processID??null;
    }catch(error){
      if(client) try{client.release(true)}catch{}
      if(!this.#closing) this.#scheduleReconnect();
      throw error;
    }
  }

  #listenerLost(client,error=null){
    if(error) this.#log(error);
    if(this.#listener===client){
      this.#listener=null;
      this.listenerBackendPid=null;
      try{client.release(true)}catch{}
      this.#recycleSubscribers();
    }
    if(!this.#closing) this.#scheduleReconnect();
  }

  #scheduleReconnect(){
    if(this.#closing||this.#reconnectTimer) return;
    this.#reconnectTimer=setTimeout(()=>{
      this.#reconnectTimer=null;
      this.#connectListener().catch(error=>this.#log(error));
    },RECONNECT_DELAY_MS);
    this.#reconnectTimer.unref?.();
  }

  async #handleNotification(raw){
    const signal=parseSignal(raw);
    if(!signal) return;
    try{
      if(signal.kind==='presence'){
        await this.#refreshPresence(signal.userId);
        this.#broadcastLocal('presence.updated',{online:this.online()});
        return;
      }
      if(signal.event==='message.deleted'){
        this.#broadcastLocal('message.deleted',{messageId:signal.entityId});
        return;
      }
      if(signal.event==='topic.created'){
        const topic=await this.getTopic(signal.entityId);
        if(topic) this.#broadcastLocal('topic.created',{topic});
        return;
      }
      const message=await this.#readMessage(signal.entityId);
      if(!message) return;
      const payload=signal.event==='message.created'?{message,online:this.online()}:{message};
      this.#broadcastLocal(signal.event,payload);
    }catch(error){this.#log(error)}
  }

  async #refreshPresence(userId){
    const {rows}=await this.pool.query({
      text:`SELECT user_id,display_name,seen_at FROM gracz_global_chat_presence WHERE user_id=$1 AND seen_at >= NOW()-INTERVAL '90 seconds'`,
      values:[userId],query_timeout:QUERY_TIMEOUT_MS,
    });
    const row=rows[0];
    if(!row){this.presence.delete(userId);return}
    this.presence.set(row.user_id,{userId:row.user_id,displayName:row.display_name,seenAt:new Date(row.seen_at).getTime()});
  }

  async #readMessage(messageId){
    const {rows}=await this.pool.query({
      text:`SELECT m.message_id,m.user_id,m.display_name,m.body,m.reply_to,m.topic_id,m.reactions,m.created_at,m.edited_at,m.deleted,t.title AS topic_title,t.category AS topic_category FROM gracz_global_chat m LEFT JOIN gracz_chat_topics t ON t.topic_id=m.topic_id WHERE m.message_id=$1`,
      values:[messageId],query_timeout:QUERY_TIMEOUT_MS,
    });
    return rows[0]?mapMessage(rows[0]):null;
  }

  #broadcastLocal(event,payload){
    const data=encodeSse(event,payload);
    for(const client of this.subscribers){
      if(client.response.writableEnded){this.subscribers.delete(client);continue}
      if(client.recovering){
        if(client.buffer.length>=RECOVERY_BUFFER_LIMIT){try{client.response.end()}catch{};this.subscribers.delete(client);continue}
        client.buffer.push(data);continue;
      }
      try{client.response.write(data)}catch{this.subscribers.delete(client)}
    }
  }

  #recycleSubscribers(){
    for(const client of this.subscribers)try{client.response.end()}catch{}
    this.subscribers.clear();
  }

  #cleanupPresence(now){
    const cutoff=now-PRESENCE_TTL_MS;
    for(const [id,item] of this.presence) if(item.seenAt<cutoff) this.presence.delete(id);
    for(const [id,last] of this.#presenceWrites) if(last<cutoff) this.#presenceWrites.delete(id);
  }

  #log(error){try{this.logger?.error?.(error)}catch{}}

  async close(){
    this.#closing=true;
    if(this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer=null;
    this.#recycleSubscribers();
    const listener=this.#listener;this.#listener=null;this.listenerBackendPid=null;
    if(listener) try{listener.release(true)}catch{}
  }
}

function signalFor(event,payload){
  if(event==='message.created'||event==='message.updated'){
    const entityId=payload?.message?.messageId;
    return validUuid(entityId)?{kind:'entity',event,entityId}:null;
  }
  if(event==='message.deleted'){
    const entityId=payload?.messageId;
    return validUuid(entityId)?{kind:'entity',event,entityId}:null;
  }
  if(event==='topic.created'){
    const entityId=payload?.topic?.topicId;
    return validUuid(entityId)?{kind:'entity',event,entityId}:null;
  }
  return null;
}

function parseSignal(raw){
  const text=String(raw??'');
  if(Buffer.byteLength(text,'utf8')>MAX_NOTIFICATION_BYTES) return null;
  let signal;try{signal=JSON.parse(text)}catch{return null}
  if(signal?.kind==='presence'){
    const userId=String(signal.userId??'');
    return userId&&userId.length<=128?{kind:'presence',userId}:null;
  }
  if(signal?.kind!=='entity'||!SIGNAL_EVENTS.has(signal.event)||!validUuid(signal.entityId)) return null;
  return {kind:'entity',event:signal.event,entityId:signal.entityId};
}

function sseRetryMs(){return SSE_RETRY_MIN_MS+Math.floor(Math.random()*(SSE_RETRY_MAX_MS-SSE_RETRY_MIN_MS+1))}
function encodeSse(event,payload){return`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`}
function semanticChatError(message,code){const error=new Error(message);error.code=code;error.status=429;return error}
function realtimeUnavailable(){const error=new Error('Realtime Global Chat jest chwilowo niedostępny.');error.code='GLOBAL_CHAT_REALTIME_UNAVAILABLE';error.status=503;return error}
function mapMessage(row){return{messageId:row.message_id,userId:row.user_id,displayName:row.display_name,body:row.body,replyTo:row.reply_to,topicId:row.topic_id||null,topicTitle:row.topic_title||null,topicCategory:row.topic_category||null,reactions:row.reactions||{},createdAt:row.created_at,editedAt:row.edited_at,deleted:Boolean(row.deleted)}}
function validUuid(value){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}