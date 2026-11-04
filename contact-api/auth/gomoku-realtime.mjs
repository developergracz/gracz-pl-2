import {WebSocketServer,WebSocket} from 'ws';
import {createHash} from 'node:crypto';

const endpoint='/auth/gomoku/realtime';
const origin='https://gracz-contact-api.onrender.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBuffered=256*1024;
const sessionKey=req=>createHash('sha256').update(String(req.headers.cookie||'').split(';')
 .map(x=>x.trim()).find(x=>x.startsWith('__Host-gracz_session='))||'').digest('hex');

// Transport adapter only: all session/room checks and clock decisions run through
// the existing router. No new DB pool, game engine, identity or write protocol.
export function createGomokuRealtime({server,router,maxConnections=512,heartbeatMs=25000}){
 const wss=new WebSocketServer({noServer:true,maxPayload:1024,perMessageDeflate:false});
 const clients=new Set(),accounts=new Map(),queue=new Set();
 let stopping=false,handshakes=0,running=0,admissionStart=0,admissions=0;
 async function read(req,path){
  let status=0,body;
  const response={writeHead(code){status=code;},setHeader(){},end(raw){body=JSON.parse(String(raw));}};
  await router.handle({method:'GET',headers:req.headers,socket:req.socket},response,new URL(path,origin));
  if(status!==200||body?.ok!==true)throw Object.assign(Error('READ_DENIED'),{status});
  return body;
 }
 function send(client,message){
  const raw=JSON.stringify(message);
  if(client.socket.readyState!==WebSocket.OPEN)return false;
  if(client.socket.bufferedAmount+Buffer.byteLength(raw)>maxBuffered){client.socket.terminate();return false;}
  client.socket.send(raw);return true;
 }
 function enqueue(client){
  if(stopping||!clients.has(client)||!client.id)return;
  if(client.syncing){client.dirty=true;return;}
  queue.add(client);pump();
 }
 function pump(){
  while(!stopping&&running<8&&queue.size){
   const client=queue.values().next().value;queue.delete(client);
   if(!clients.has(client))continue;
   running++;client.syncing=true;
   void synchronize(client).finally(()=>{
    running--;client.syncing=false;
    if(client.dirty){client.dirty=false;enqueue(client);}
    pump();
   });
  }
 }
 function deadline(client,match){
  clearTimeout(client.deadline);
  if(match.state.winner)return;
  const undo=match.undoRequest,clock=match.state.clock;
  const at=undo?Date.parse(undo.createdAt)+180001:
   clock?.since?Date.parse(clock.since)+clock.remaining[match.state.turn-1]+1:NaN;
  if(Number.isFinite(at))client.deadline=setTimeout(()=>enqueue(client),Math.max(100,Math.min(at-Date.now(),2147483647)));
 }
 async function synchronize(client){
  const id=client.id,generation=client.generation;
  // Close a stalled consumer, but retain the worker slot until the read settles.
  // Thus a slow database cannot create an unbounded backlog of abandoned queries.
  const timeout=setTimeout(()=>client.socket.terminate(),10000);
  try{
   const result=await read(client.req,'/auth/match?id='+id);
   const match=result.match;
   if(match?.game!=='gomoku'||!match.playable)throw Object.assign(Error('ROOM_DENIED'),{status:403});
   const chat=await read(client.req,'/auth/match/chat?id='+id);
   if(!clients.has(client)||id!==client.id||generation!==client.generation)return;
   const previous=client.match;
   if(!previous){
    client.seq=0;
    if(!send(client,{type:'snapshot',matchId:id,seq:++client.seq,match,messages:chat.messages,serverTime:result.serverTime}))return;
   }else{
    if(match.version<previous.version){client.socket.close(1012,'resync');return;}
    if(JSON.stringify(match)!==JSON.stringify(previous)){
     const changes=[];
     match.state.board.forEach((piece,index)=>{if(piece!==previous.state.board[index])changes.push([index,piece]);});
     const oldHistory=previous.state.history||[],history=match.state.history||[];
     let historyFrom=0;
     while(historyFrom<oldHistory.length&&historyFrom<history.length&&
       JSON.stringify(oldHistory[historyFrom])===JSON.stringify(history[historyFrom]))historyFrom++;
     const {board:ignoredBoard,history:ignoredHistory,...state}=match.state;
     if(!send(client,{type:'match',matchId:id,seq:++client.seq,baseVersion:previous.version,version:match.version,
      match:{...match,state},changes,historyFrom,historyAppend:history.slice(historyFrom),serverTime:result.serverTime}))return;
    }
    const known=new Set(client.messages.map(m=>m.id));
    const added=chat.messages.filter(m=>!known.has(m.id));
    if(added.length&&!send(client,{type:'chat',matchId:id,seq:++client.seq,messages:added}))return;
   }
   client.match=match;client.messages=chat.messages;deadline(client,match);
  }catch(error){
   client.socket.close([401,403,404].includes(error.status)?1008:1013,'resync required');
  }finally{clearTimeout(timeout);}
 }
 function notify(id){for(const client of clients)if(client.id===id)enqueue(client);}
 function onConnection(socket,req,account){
  const client={socket,req,account,key:sessionKey(req),alive:true,id:null,match:null,messages:[],seq:0,
   generation:0,syncing:false,dirty:false,bucketStart:Date.now(),messagesReceived:0,deadline:null};
  clients.add(client);accounts.set(account,(accounts.get(account)||0)+1);
  const subscribeTimeout=setTimeout(()=>{if(!client.id)socket.close(1008,'subscription required');},10000);
  socket.on('pong',()=>{client.alive=true;});
  socket.on('error',()=>socket.terminate());
  socket.on('close',()=>{
   clearTimeout(subscribeTimeout);clearTimeout(client.deadline);clients.delete(client);queue.delete(client);
   const count=(accounts.get(account)||1)-1;if(count)accounts.set(account,count);else accounts.delete(account);
  });
  socket.on('message',(data,binary)=>{
   if(Date.now()-client.bucketStart>=10000){client.bucketStart=Date.now();client.messagesReceived=0;}
   if(binary||++client.messagesReceived>8){socket.close(1008,'rate limit');return;}
   let message;try{message=JSON.parse(data);}catch{socket.close(1008,'invalid message');return;}
   if(message?.type!=='subscribe'||!uuid.test(message.matchId)||!Number.isSafeInteger(message.version)||message.version< -1){
    socket.close(1008,'invalid subscription');return;
   }
   client.id=message.matchId;client.generation++;client.match=null;client.messages=[];
   clearTimeout(subscribeTimeout);clearTimeout(client.deadline);enqueue(client);
  });
 }
 async function upgrade(req,socket,head){
  socket.on('error',()=>socket.destroy());
  const reject=(status=403)=>{if(!socket.destroyed)socket.end('HTTP/1.1 '+status+' Rejected\r\nConnection: close\r\n\r\n');};
  if(req.url!==endpoint||req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return reject();
  const now=Date.now();if(now-admissionStart>=1000){admissionStart=now;admissions=0;}
  if(stopping||clients.size+handshakes>=maxConnections||handshakes>=16||++admissions>20)return reject(503);
  handshakes++;socket.setTimeout(5000,()=>socket.destroy());
  try{
   const session=await read(req,'/auth/session');
   if(!session.loggedIn||typeof session.nickname!=='string')return reject(401);
   if(stopping||clients.size>=maxConnections||(accounts.get(session.nickname)||0)>=4)return reject(503);
   if(socket.destroyed)return;
   socket.setTimeout(0);
   wss.handleUpgrade(req,socket,head,ws=>onConnection(ws,req,session.nickname));
  }catch{reject(503);}finally{handshakes--;}
 }
 server.on('upgrade',upgrade);
 const heartbeat=setInterval(()=>{
  for(const client of clients){
   if(!client.alive||client.socket.bufferedAmount>maxBuffered){client.socket.terminate();continue;}
   if(client.socket.readyState!==WebSocket.OPEN)continue;
   client.alive=false;client.socket.ping();
   if(client.match)send(client,{type:'heartbeat',matchId:client.id,seq:client.seq});
  }
 },heartbeatMs);heartbeat.unref();
 // Bounded reconciliation also detects revoked sessions and external changes.
 // This is not the ping/pong heartbeat and never writes online_presence.
 const reconcile=setInterval(()=>{for(const client of clients)enqueue(client);},60000);reconcile.unref();
 function observe(req,res,url){
  if(req.method!=='POST'||!['/auth/logout','/auth/friends/action'].includes(url.pathname))return;
  res.once('finish',()=>{
   if(res.statusCode!==200)return;
   const key=sessionKey(req);
   for(const client of clients)if(client.key===key){
    if(url.pathname==='/auth/logout')client.socket.close(1008,'session ended');else notify(client.id);
   }
  });
 }
 function close(){
  if(stopping)return;stopping=true;clearInterval(heartbeat);clearInterval(reconcile);
  server.off('upgrade',upgrade);queue.clear();for(const client of clients)client.socket.terminate();wss.close();
 }
 return {notify,observe,close};
}
