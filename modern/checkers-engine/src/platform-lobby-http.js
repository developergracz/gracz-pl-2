import { AuthError } from './auth.js';

const SESSION_COOKIE='__Host-gracz_session';

export function createPlatformLobbyHttpHandler({lobby,auth,authSessions=null}={}){
  if(!lobby) throw new TypeError('Lobby jest wymagane.');
  if(!auth) throw new TypeError('Uwierzytelnianie jest wymagane.');
  return async function platformLobbyHttpHandler(request,response){
    const url=new URL(request.url,'http://localhost');
    if(request.method!=='POST'||url.pathname!=='/lobby/rooms') return false;
    try{
      assertSameOriginMutation(request);
      const user=await trustedUser(request,auth,authSessions);
      lobby.touchUser(user);
      const body=await readJson(request);
      const room=lobby.createRoom({
        ownerId:user.userId,
        ownerName:user.displayName,
        roomName:String(body.roomName||'Nowy pokój').trim().slice(0,128)||'Nowy pokój',
        gameType:body.gameType||'checkers',
      });
      return sendJson(response,201,room);
    }catch(error){
      if(error instanceof AuthError) return sendJson(response,401,errorBody(error));
      const status=['INVALID_GAME_TYPE','INVALID_ROOM'].includes(error?.code)?400:409;
      return sendJson(response,status,errorBody(error));
    }
  };
}

async function trustedUser(request,auth,authSessions){
  const token=parseCookies(request.headers.cookie)[SESSION_COOKIE]||bearerToken(request);
  if(!token||token==='cookie') throw new AuthError('Brak aktywnej sesji logowania.');
  const user=auth.verify(token);
  if(authSessions&&user.tokenId){
    if(await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
    else await authSessions.create(user);
  }
  return user;
}
function parseCookies(header){
  const result={};
  for(const part of String(header??'').split(';')){
    const index=part.indexOf('='); if(index<1) continue;
    const key=part.slice(0,index).trim(), value=part.slice(index+1).trim();
    if(!key) continue; try{result[key]=decodeURIComponent(value)}catch{result[key]=value}
  }
  return result;
}
function bearerToken(request){
  const value=String(request.headers.authorization??'');
  return value.startsWith('Bearer ')?value.slice(7).trim()||null:null;
}
function assertSameOriginMutation(request){
  if(request.headers['sec-fetch-site']==='cross-site') throw httpError('Żądanie z obcej strony zostało zablokowane.','CROSS_SITE_REQUEST',403);
  const origin=request.headers.origin; if(!origin) return;
  let originHost; try{originHost=new URL(origin).host}catch{throw httpError('Nieprawidłowe źródło żądania.','CROSS_SITE_REQUEST',403)}
  if(originHost!==request.headers.host) throw httpError('Żądanie z obcej strony zostało zablokowane.','CROSS_SITE_REQUEST',403);
}
async function readJson(request,maxBytes=16_384){
  const chunks=[];let length=0;
  for await(const chunk of request){length+=chunk.length;if(length>maxBytes)throw httpError('Żądanie jest za duże.','PAYLOAD_TOO_LARGE',413);chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{throw httpError('Nieprawidłowy JSON.','INVALID_JSON',400)}
}
function httpError(message,code,status){const error=new Error(message);error.code=code;error.status=status;return error}
function errorBody(error){return{error:{code:error.code||'LOBBY_ERROR',message:error.message||'Błąd lobby.'}}}
function sendJson(response,status,body){response.writeHead(errorStatus(body,status),{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));return true}
function errorStatus(body,status){return Number.isInteger(body?.error?.status)?body.error.status:status}
