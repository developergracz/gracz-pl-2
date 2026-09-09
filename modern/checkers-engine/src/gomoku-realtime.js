const REALTIME_CHANNEL="gracz_gomoku_realtime";
const MAX_NOTIFICATION_BYTES=512;
const RECONNECT_DELAY_MS=250;
const QUERY_TIMEOUT_MS=1_500;
const ALLOWED_EVENT_TYPES=new Set(["gomoku.updated"]);

export class GomokuRealtimeHub {
  #subscribers=new Map();
  #listener=null;
  #closing=false;
  #reconnectTimer=null;
  #connectPromise=null;

  constructor({service,pool=service?.pool??null,logger={error(){}}}={}){
    if(!service||typeof service.view!=="function") throw new TypeError("Serwis Gomoku jest wymagany dla realtime.");
    if(pool&&(typeof pool.connect!=="function"||typeof pool.query!=="function")) throw new TypeError("Pula PostgreSQL realtime Gomoku ma nieprawidłowy kontrakt.");
    this.service=service;
    this.pool=pool;
    this.logger=logger;
    this.listenerBackendPid=null;
    this.ready=pool?this.#connectListener().catch(error=>{this.#log(error)}):Promise.resolve();
  }

  async subscribe(gameId,userId,response){
    assertGameId(gameId);
    if(!userId) throw new TypeError("Identyfikator gracza Gomoku jest wymagany dla realtime.");
    if(this.pool) await this.#ensureListener();
    const snapshot=await this.service.view(gameId,userId);
    const revision=revisionOf(snapshot);
    const subscription={userId,response,lastRevision:revision};
    const subscribers=this.#subscribers.get(gameId)??new Set();
    subscribers.add(subscription);
    this.#subscribers.set(gameId,subscribers);

    response.writeHead(200,{
      "content-type":"text/event-stream; charset=utf-8",
      "cache-control":"no-cache, no-store",
      connection:"keep-alive",
      "x-accel-buffering":"no",
    });
    response.write(encodeEvent("gomoku.snapshot",snapshot));

    const keepAlive=setInterval(()=>{
      try{response.write(": keep-alive\n\n")}catch{try{response.end()}catch{}}
    },20_000);
    keepAlive.unref?.();

    const remove=()=>{
      clearInterval(keepAlive);
      subscribers.delete(subscription);
      if(subscribers.size===0) this.#subscribers.delete(gameId);
    };
    response.on("close",remove);
    return remove;
  }

  async publish(gameId,type="gomoku.updated"){
    if(!isGameId(gameId)||!ALLOWED_EVENT_TYPES.has(type)) return false;
    if(!this.pool){
      await this.#fanOut(gameId,type);
      return true;
    }
    const payload=JSON.stringify({gameId,type});
    if(Buffer.byteLength(payload,"utf8")>MAX_NOTIFICATION_BYTES) return false;
    try{
      await this.pool.query({
        text:"SELECT pg_notify($1, $2)",
        values:[REALTIME_CHANNEL,payload],
        query_timeout:QUERY_TIMEOUT_MS,
      });
      return true;
    }catch(error){
      this.#log(error);
      return false;
    }
  }

  async #ensureListener(){
    try{await this.#connectListener()}catch(error){this.#log(error);throw realtimeUnavailable(error)}
    if(!this.#listener) throw realtimeUnavailable();
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
      if(this.#closing){client.release(true);return}
      client.on("notification",notification=>{
        if(notification.channel===REALTIME_CHANNEL) void this.#handleNotification(notification.payload);
      });
      client.on("error",error=>this.#listenerLost(client,error));
      client.on("end",()=>this.#listenerLost(client));
      await client.query({text:`LISTEN ${REALTIME_CHANNEL}`,query_timeout:QUERY_TIMEOUT_MS});
      if(this.#closing){client.release(true);return}
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
      this.ready=this.#connectListener().catch(error=>{this.#log(error)});
    },RECONNECT_DELAY_MS);
    this.#reconnectTimer.unref?.();
  }

  async #handleNotification(rawPayload){
    const event=parseNotification(rawPayload);
    if(!event) return;
    await this.#fanOut(event.gameId,event.type);
  }

  async #fanOut(gameId,type){
    const subscribers=[...(this.#subscribers.get(gameId)??[])];
    await Promise.allSettled(subscribers.map(async subscriber=>{
      try{
        const view=await this.service.view(gameId,subscriber.userId);
        const revision=revisionOf(view);
        if(revision<=subscriber.lastRevision)return;
        subscriber.lastRevision=revision;
        subscriber.response.write(encodeEvent(type,view));
      }catch(error){
        this.#log(error);
        try{subscriber.response.end()}catch{}
      }
    }));
  }

  #recycleSubscribers(){
    for(const subscribers of this.#subscribers.values())for(const {response} of subscribers)try{response.end()}catch{}
    this.#subscribers.clear();
  }

  #log(error){try{this.logger?.error?.(error)}catch{}}

  close(){
    this.#closing=true;
    if(this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer=null;
    this.#recycleSubscribers();
    const listener=this.#listener;
    this.#listener=null;
    this.listenerBackendPid=null;
    if(listener){
      listener.query?.({text:"UNLISTEN *",query_timeout:500}).catch?.(()=>{});
      try{listener.release(true)}catch{}
    }
  }
}

function revisionOf(view){const revision=Number(view?.revision);if(!Number.isInteger(revision)||revision<0)throw new TypeError("Nieprawidłowa rewizja widoku Gomoku.");return revision}
function realtimeUnavailable(cause=null){const error=new Error("Realtime Gomoku jest chwilowo niedostępny.");error.code="GOMOKU_REALTIME_UNAVAILABLE";error.status=503;if(cause)error.cause=cause;return error}
function parseNotification(rawPayload){
  if(Buffer.byteLength(String(rawPayload??""),"utf8")>MAX_NOTIFICATION_BYTES) return null;
  let event;
  try{event=JSON.parse(String(rawPayload??"{}"))}catch{return null}
  if(!isGameId(event?.gameId)||!ALLOWED_EVENT_TYPES.has(event?.type)) return null;
  return {gameId:event.gameId,type:event.type};
}
function assertGameId(gameId){if(!isGameId(gameId)) throw new TypeError("Nieprawidłowy identyfikator gry Gomoku dla realtime.")}
function isGameId(gameId){return /^[a-zA-Z0-9_-]{1,128}$/.test(String(gameId??""))}
function encodeEvent(type,data){return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`}