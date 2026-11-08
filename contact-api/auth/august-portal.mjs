import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TournamentService} from './august/tournaments-service.mjs';

// All pages are isolated under /konto/sierpien/ and do not replace
// /konto/panel/. The current first-party session is the ONLY identity authority.
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'august');
const BASE='/konto/sierpien/';
const API='/auth/august/';
const ORIGIN='https://gracz-contact-api.onrender.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pageFiles=new Map([
 ['turnieje.html','tournaments.html'],['assets/tournaments.css','tournaments.css'],
 ['assets/tournaments.js','tournaments.js'],
 ['settings.html','settings.html'],
 ['assets/settings.css','settings.css'],
 ['messages.html','messages.html'],
 ['assets/messages.css','messages.css'],
 ['community.html','community.html'],
 ['assets/community.css','community.css'],
 ['global-chat.html','global-chat.html'],
 ['assets/global-chat.css','global-chat.css'],
 ['players.html','players.html'],
 ['assets/players.css','players.css'],
 ['assets/bridge.js','bridge.js']
]);
const cache=new Map();
function answer(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(data));return true;
}
const fail=(res,status,message)=>answer(res,status,{ok:false,error:{message}});
async function jsonBody(req){
 let raw='';
 for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>8192)throw Error('Za duże żądanie');}
 try{return JSON.parse(raw||'{}');}catch{throw Error('Błędny JSON');}
}
export function createAugustPortal({database,publicIdentity,enabled=process.env.GRACZ_AUGUST_PORTAL_PREVIEW==='1'||process.env.GRACZ_AUGUST_PORTAL_ACTIVE==='1'}){
 let servicePromise=null;
 let chatPromise=null;
 const attempts=new Map();
 const service=()=>{
  if(!servicePromise)servicePromise=(async()=>{
   await publicIdentity.probe();
   const instance=new TournamentService(database);
   await instance.ready;
   return instance;
  })().catch(e=>{servicePromise=null;throw e;});
  return servicePromise;
 };
 async function handle(req,res,url){
  if(!enabled)return false;
  if(req.method==='GET'&&url.pathname.startsWith(BASE)){
   const name=url.pathname.slice(BASE.length);
   if(!pageFiles.has(name))return false;
   const filename=pageFiles.get(name);
   let bytes=cache.get(filename);
   if(!bytes){bytes=await readFile(join(ROOT,filename));cache.set(filename,bytes);}
   const type=filename.endsWith('.css')?'text/css':filename.endsWith('.js')?'text/javascript':'text/html';
   res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
   res.end(bytes);return true;
  }
  if(!url.pathname.startsWith(API))return false;
  if(!['GET','POST'].includes(req.method))return fail(res,405,'Niedozwolona metoda');
  if(req.method==='POST'&&(req.headers.origin!==ORIGIN||req.headers['sec-fetch-site']==='cross-site'))
   return fail(res,403,'Niedozwolone pochodzenie');
  try{
   const user=await publicIdentity.authenticateGameRequest(req);
   if(!user)return fail(res,401,'Zaloguj się do GRACZ.PL');
   if(url.pathname===API+'whoami'&&req.method==='GET')
    return answer(res,200,{ok:true,user});
   if(url.pathname===API+'chat'){
    if(!chatPromise)chatPromise=(async()=>{
     await publicIdentity.probe();
     await database.query("CREATE TABLE IF NOT EXISTS gracz_public_identity.august_chat (id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE, body varchar(1000) NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
     await database.query("CREATE INDEX IF NOT EXISTS august_chat_created_idx ON gracz_public_identity.august_chat(created_at DESC)");
    })().catch(e=>{chatPromise=null;throw e});
    await chatPromise;
    if(req.method==='GET'){
     const recent=await database.query("SELECT m.id,a.nickname,m.body,m.created_at FROM (SELECT id,account_id,body,created_at FROM gracz_public_identity.august_chat ORDER BY created_at DESC,id DESC LIMIT 100) m JOIN gracz_public_identity.accounts a ON a.id=m.account_id WHERE a.verified_at IS NOT NULL ORDER BY m.created_at ASC,m.id ASC");
     return answer(res,200,{ok:true,messages:recent.rows.map(x=>({id:x.id,nickname:x.nickname,body:x.body,createdAt:x.created_at}))});
    }
    const key='chat:'+user.userId,now=Date.now(),old=attempts.get(key);
    const next=old&&old.until>now?{count:old.count+1,until:old.until}:{count:1,until:now+60000};
    attempts.set(key,next);
    if(next.count>12)return fail(res,429,'Zbyt wiele wiadomości');
    const data=await jsonBody(req),body=typeof data.body==='string'?data.body.trim():'';
    if(!body||body.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body))
     return fail(res,400,'Wpisz wiadomość do 1000 znaków');
    const id=(await import('node:crypto')).randomUUID();
    await database.query("INSERT INTO gracz_public_identity.august_chat(id,account_id,body) VALUES($1,$2,$3)",[id,user.userId,body]);
    return answer(res,201,{ok:true,id});
   }
   if(!url.pathname.startsWith(API+'tournaments'))return false;
   const svc=await service();
   const sub=url.pathname.slice((API+'tournaments').length);
   if(req.method==='POST'){
    const key=user.userId,now=Date.now(),old=attempts.get(key);
    const next=old&&old.until>now?{count:old.count+1,until:old.until}:{count:1,until:now+60000};
    attempts.set(key,next);
    if(attempts.size>10000){for(const [id,v] of attempts)if(v.until<=now)attempts.delete(id);}
    if(next.count>30)return fail(res,429,'Zbyt wiele operacji');
   }
   if(sub===''&&req.method==='GET')return answer(res,200,{tournaments:await svc.list(user,Object.fromEntries(url.searchParams))});
   if(sub===''&&req.method==='POST')return answer(res,201,{tournament:await svc.create(user,await jsonBody(req))});
   const parts=sub.split('/').filter(Boolean);
   if(!parts.length||!uuid.test(parts[0]))return fail(res,404,'Nie znaleziono turnieju');
   const [id,act,mid,resultAction]=parts;
   if(parts.length===1&&req.method==='GET')return answer(res,200,await svc.detail(user,id));
   if(parts.length===2&&req.method==='POST'&&['join','leave','start'].includes(act)){
    const value=act==='join'?await svc.join(user,id):act==='leave'?await svc.leave(user,id):await svc.start(user,id);
    return answer(res,200,value);
   }
   if(parts.length===4&&act==='matches'&&uuid.test(mid)&&req.method==='POST'){
    if(resultAction==='launch')
      return answer(res,200,await svc.launch(user,id,mid));
    if(resultAction==='result')
      return answer(res,200,await svc.syncResult(user,id,mid));
   }
   return fail(res,404,'Nie znaleziono operacji turniejowej');
  }catch(e){
   const known=Number.isInteger(e.status)&&e.status>=400&&e.status<500;
   console.error('AUGUST_PORTAL_ERROR',{code:typeof e.code==='string'?e.code:'INTERNAL'});
   return fail(res,known?e.status:503,known?e.message:'Moduł jest czasowo niedostępny');
  }
 }
 return {handle};
}
