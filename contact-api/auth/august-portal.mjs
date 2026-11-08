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
 ['assets/tournaments.js','tournaments.js']
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
export function createAugustPortal({database,publicIdentity}){
 let servicePromise=null;
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
   if(parts.length===4&&act==='matches'&&uuid.test(mid)&&resultAction==='result'&&req.method==='POST')
    return answer(res,200,await svc.report(user,id,mid,(await jsonBody(req)).result));
   return fail(res,404,'Nie znaleziono operacji turniejowej');
  }catch(e){
   const known=Number.isInteger(e.status)&&e.status>=400&&e.status<500;
   console.error('AUGUST_PORTAL_ERROR',{code:typeof e.code==='string'?e.code:'INTERNAL'});
   return fail(res,known?e.status:503,known?e.message:'Moduł jest czasowo niedostępny');
  }
 }
 return {handle};
}
