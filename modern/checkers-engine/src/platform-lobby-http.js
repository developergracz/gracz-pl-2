import { randomBytes } from 'node:crypto';
import { AuthError } from './auth.js';

const SESSION_COOKIE='__Host-gracz_session';

export function createPlatformLobbyHttpHandler({lobby,auth,authSessions=null,trafficGuard=null,sharedTrafficGuard=null}={}){
  if(!lobby) throw new TypeError('Lobby jest wymagane.');
  if(!auth) throw new TypeError('Uwierzytelnianie jest wymagane.');
  return async function platformLobbyHttpHandler(request,response){
    const url=new URL(request.url,'http://localhost');

    if(request.method==='POST'&&url.pathname==='/auth/guest'){
      try{
        assertSameOriginMutation(request);
        const suffix=randomBytes(4).toString('hex');
        const user={userId:`guest-${suffix}`,displayName:`Gość ${suffix.slice(0,4).toUpperCase()}`};
        const token=auth.issueGuest({...user,ttlSeconds:1800});
        response.setHeader('Set-Cookie',`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Lax`);
        return sendJson(response,201,{token:'cookie',user:{...user,guest:true},expiresIn:1800});
      }catch(error){return sendJson(response,Number.isInteger(error?.status)?error.status:400,errorBody(error))}
    }

    if(!url.pathname.startsWith('/lobby/')) return false;
    try{
      assertSameOriginMutation(request);
      const user=await trustedUser(request,auth,authSessions);

      if(request.method==='GET'&&url.pathname==='/lobby/state'){
        await assertAccountLimits(trafficGuard,sharedTrafficGuard,{request,userId:user.userId,action:'lobby'});
        if(typeof lobby.readState!=='function') throw new TypeError('Lobby readState jest wymagane dla /lobby/state.');
        return sendJson(response,200,await lobby.readState(user));
      }

      if(url.pathname==='/lobby/rooms'){
        await assertAccountLimits(trafficGuard,sharedTrafficGuard,{request,userId:user.userId,action:'room'});
        if(request.method==='GET'){
          await lobby.touchUser(user);
          return sendJson(response,200,{rooms:await lobby.listRooms()});
        }
        if(request.method==='POST'){
          const body=await readJson(request);
          if(typeof lobby.createRoomForActiveUser!=='function') throw new TypeError('Lobby createRoomForActiveUser jest wymagane dla POST /lobby/rooms.');
          const room=await lobby.createRoomForActiveUser({
            ownerId:user.userId,
            ownerName:user.displayName,
            roomName:String(body.roomName||'Nowy pokój').trim().slice(0,128)||'Nowy pokój',
            gameType:Object.hasOwn(body,'gameType')?body.gameType:undefined,
            maxPlayers:body.maxPlayers??null,
          });
          return sendJson(response,201,room);
        }
        return false;
      }

      if(request.method==='POST'&&url.pathname==='/lobby/invitations'){
        await assertAccountLimits(trafficGuard,sharedTrafficGuard,{request,userId:user.userId,action:'invitation'});
        await lobby.touchUser(user);
        const body=await readJson(request);
        const invitation=await lobby.createInvitation({fromId:user.userId,fromName:user.displayName,toId:body.toId,roomId:body.roomId});
        return sendJson(response,201,invitation);
      }

      const invitationMatch=url.pathname.match(/^\/lobby\/invitations\/([a-zA-Z0-9_-]{1,128})\/respond$/);
      if(invitationMatch&&request.method==='POST'){
        await assertAccountLimits(trafficGuard,sharedTrafficGuard,{request,userId:user.userId,action:'invitation'});
        const body=await readJson(request);
        return sendJson(response,200,await lobby.respondInvitation({invitationId:invitationMatch[1],userId:user.userId,userName:user.displayName,accept:body.accept===true}));
      }

      const joinMatch=url.pathname.match(/^\/lobby\/rooms\/([a-zA-Z0-9_-]{1,128})\/join$/);
      if(joinMatch&&request.method==='POST'){
        await assertAccountLimits(trafficGuard,sharedTrafficGuard,{request,userId:user.userId,action:'room'});
        await lobby.touchUser(user);
        return sendJson(response,200,await lobby.joinRoom({roomId:joinMatch[1],playerId:user.userId,playerName:user.displayName}));
      }

      return false;
    }catch(error){
      if(error instanceof AuthError) return sendJson(response,401,errorBody(error));
      const status=Number.isInteger(error?.status)?error.status
        :['ROOM_NOT_FOUND','INVITATION_NOT_FOUND'].includes(error?.code)?404
        :['INVALID_GAME_TYPE','UNSUPPORTED_GAME_TYPE','INVALID_ROOM'].includes(error?.code)?400:409;
      return sendJson(response,status,errorBody(error));
    }
  };
}

async function assertAccountLimits(localGuard,sharedGuard,input){
  if(localGuard?.assertAccountAllowed) localGuard.assertAccountAllowed(input);
  if(sharedGuard?.assertAccountAllowed) await sharedGuard.assertAccountAllowed(input);
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
function bearerToken(request){const value=String(request.headers.authorization??'');return value.startsWith('Bearer ')?value.slice(7).trim()||null:null}
function assertSameOriginMutation(request){
  if(!['POST','PUT','PATCH','DELETE'].includes(request.method)) return;
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
