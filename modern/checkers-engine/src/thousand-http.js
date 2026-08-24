import { AuthError } from './auth.js';
import { ThousandRuleError } from './thousand-engine.js';
import { ThousandServiceError } from './thousand-service.js';
import { ThousandConcurrencyError, ThousandNotFoundError } from './thousand-repository.js';

const SESSION_COOKIE='__Host-gracz_session';

export function createThousandHttpHandler({service,auth,authSessions=null,clock=()=>Date.now()}={}){
  if(!service) throw new TypeError('Serwis Tysiąca jest wymagany.');
  if(!auth) throw new TypeError('Uwierzytelnianie jest wymagane dla API Tysiąca.');
  const limiter=new ActionLimiter({clock});

  return async function thousandHttpHandler(request,response){
    const url=new URL(request.url,'http://localhost');
    if(!url.pathname.startsWith('/thousand/')) return false;
    try{
      assertSameOriginMutation(request);
      const user=await trustedUser(request,auth,authSessions);
      limiter.assertAllowed(user.userId);

      if(request.method==='POST'&&url.pathname==='/thousand/games'){
        const body=await readJson(request);
        if(!Array.isArray(body.players)||!body.players.some(player=>String(player?.userId??'').toLowerCase()===String(user.userId).toLowerCase())){
          throw new ThousandServiceError('Twórca stołu musi być jednym z graczy.','CREATOR_NOT_PLAYER');
        }
        const players=body.players.map(player=>String(player.userId).toLowerCase()===String(user.userId).toLowerCase()
          ? {...player,userId:user.userId,displayName:user.displayName}
          : player);
        const game=await service.createGame({players,dealerIndex:body.dealerIndex??0,rules:body.rules});
        return sendJson(response,201,{gameId:game.gameId,revision:game.revision});
      }

      const match=url.pathname.match(/^\/thousand\/games\/([a-zA-Z0-9_-]{8,96})(?:\/(actions|next-round))?$/);
      if(!match) return sendJson(response,404,{error:{code:'THOUSAND_ROUTE_NOT_FOUND',message:'Nie znaleziono endpointu Tysiąca.'}});
      const [,gameId,action]=match;

      if(request.method==='GET'&&!action){
        return sendJson(response,200,await service.getView(gameId,user.userId));
      }
      if(request.method==='POST'&&action==='actions'){
        const body=await readJson(request);
        const result=await service.performAction(gameId,user.userId,body.action,{expectedRevision:body.expectedRevision??null});
        return sendJson(response,200,result);
      }
      if(request.method==='POST'&&action==='next-round'){
        const body=await readJson(request);
        const result=await service.nextRound(gameId,user.userId,{expectedRevision:body.expectedRevision??null});
        return sendJson(response,200,result);
      }
      return sendJson(response,405,{error:{code:'METHOD_NOT_ALLOWED',message:'Niedozwolona metoda.'}});
    }catch(error){
      return sendThousandError(response,error);
    }
  };
}

async function trustedUser(request,auth,authSessions){
  const cookieToken=parseCookies(request.headers.cookie)[SESSION_COOKIE];
  const bearer=bearerToken(request);
  const token=cookieToken||bearer;
  if(!token) throw new AuthError('Brak aktywnej sesji logowania.');
  const user=auth.verify(token);
  if(authSessions&&user.tokenId){
    if(await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
    else await authSessions.create(user);
  }
  return user;
}

function parseCookies(header){
  const cookies={};
  for(const part of String(header??'').split(';')){
    const index=part.indexOf('=');
    if(index<1) continue;
    const key=part.slice(0,index).trim();
    const value=part.slice(index+1).trim();
    if(!key) continue;
    try{cookies[key]=decodeURIComponent(value)}catch{cookies[key]=value}
  }
  return cookies;
}

function bearerToken(request){
  const header=request.headers.authorization;
  if(typeof header!=='string'||!header.startsWith('Bearer ')) return null;
  const token=header.slice(7).trim();
  return token||null;
}

function assertSameOriginMutation(request){
  if(!['POST','PUT','PATCH','DELETE'].includes(request.method)) return;
  if(request.headers['sec-fetch-site']==='cross-site') throw httpError('Żądanie z obcej strony zostało zablokowane.','CROSS_SITE_REQUEST',403);
  const origin=request.headers.origin;
  if(!origin) return;
  let host;
  try{host=new URL(origin).host}catch{throw httpError('Nieprawidłowe źródło żądania.','CROSS_SITE_REQUEST',403)}
  if(host!==request.headers.host) throw httpError('Żądanie z obcej strony zostało zablokowane.','CROSS_SITE_REQUEST',403);
}

async function readJson(request,maxBytes=32_768){
  const chunks=[];let length=0;
  for await(const chunk of request){
    length+=chunk.length;
    if(length>maxBytes) throw httpError('Żądanie jest za duże.','PAYLOAD_TOO_LARGE',413);
    chunks.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
  catch{throw httpError('Nieprawidłowy JSON.','INVALID_JSON',400)}
}

function sendThousandError(response,error){
  if(response.headersSent||response.writableEnded) return;
  if(error instanceof AuthError) return sendJson(response,401,errorBody(error));
  if(error instanceof ThousandNotFoundError) return sendJson(response,404,errorBody(error));
  if(error instanceof ThousandConcurrencyError||error?.code==='STALE_GAME_REVISION') return sendJson(response,409,errorBody(error));
  if(error instanceof ThousandRuleError||error instanceof ThousandServiceError||error instanceof TypeError) return sendJson(response,400,errorBody(error));
  if(Number.isInteger(error?.status)) return sendJson(response,error.status,errorBody(error));
  console.error('Thousand API error:',error);
  return sendJson(response,500,{error:{code:'THOUSAND_INTERNAL_ERROR',message:'Wewnętrzny błąd gry Tysiąc.'}});
}

function errorBody(error){return {error:{code:error.code??'THOUSAND_INVALID_REQUEST',message:error.message}}}
function sendJson(response,status,body){
  response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  response.end(JSON.stringify(body));
  return true;
}
function httpError(message,code,status){const error=new Error(message);error.code=code;error.status=status;return error}

class ActionLimiter{
  constructor({clock,windowMs=60_000,max=180}){this.clock=clock;this.windowMs=windowMs;this.max=max;this.entries=new Map()}
  assertAllowed(key){
    const now=this.clock();
    const since=now-this.windowMs;
    const events=(this.entries.get(key)??[]).filter(time=>time>since);
    if(events.length>=this.max) throw httpError('Wykonujesz akcje zbyt szybko. Spróbuj za chwilę.','THOUSAND_RATE_LIMIT',429);
    events.push(now);this.entries.set(key,events);
    if(this.entries.size>10_000) this.cleanup(since);
  }
  cleanup(since){for(const [key,events] of this.entries) if(events.every(time=>time<=since)) this.entries.delete(key)}
}
