import {randomBytes} from 'node:crypto';

// A top-level GET receives the existing __Host- session cookie on the auth
// origin (SameSite=Lax). The browser returns to gracz.pl with a 90-second,
// single-use, anonymous ticket in the fragment. No cookie or user identity
// ever crosses domains. This gates the UI, not the public static search index.
const WEB_ORIGIN='https://gracz.pl';
const TICKET_LIFETIME=90000;
const VALID_PARAMS=['q','filter','scope','sort'];

const reply=(res,status,data,headers={})=>{
 res.writeHead(status,{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  ...headers
 });
 res.end(JSON.stringify(data));
};

export function createSearchAccessRouter({isAuthenticated}){
 const tickets=new Map();
 const tidy=()=>{
  const now=Date.now();
  for(const [key,expires] of tickets){if(expires<=now)tickets.delete(key);}
  while(tickets.size>=10000)tickets.delete(tickets.keys().next().value);
 };
 const corsHeaders={
  'Access-Control-Allow-Origin':WEB_ORIGIN,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Vary':'Origin'
 };
 async function handle(req,res,url){
  if(url.pathname==='/auth/search-entry'){
   if(req.method!=='GET'){reply(res,405,{ok:false,error:'METODA_NIEDOZWOLONA'});return true;}
   tidy();
   let grant='guest';
   try{
    if(await isAuthenticated(req)){
     grant=randomBytes(24).toString('hex');
     tickets.set(grant,Date.now()+TICKET_LIFETIME);
    }
   }catch{grant='unavailable';}
   const target=new URL(WEB_ORIGIN+'/szukaj/');
   for(const name of VALID_PARAMS){
    const val=url.searchParams.get(name);
    if(val&&val.length<=240)target.searchParams.set(name,val);
   }
   target.hash='gate='+grant;
   res.writeHead(302,{
    'Location':target.toString(),
    'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff'
   });
   res.end();
   return true;
  }
  if(url.pathname!=='/auth/search-ticket')return false;
  const origin=req.headers.origin;
  if(origin!==WEB_ORIGIN){
   reply(res,403,{ok:false,error:'NIEDOZWOLONE_POCHODZENIE'});
   return true;
  }
  if(req.method==='OPTIONS'){
   res.writeHead(204,{'Cache-Control':'no-store',...corsHeaders});
   res.end();
   return true;
  }
  if(req.method!=='POST'){
   reply(res,405,{ok:false,error:'METODA_NIEDOZWOLONA'},corsHeaders);
   return true;
  }
  let raw='';
  try{
   for await(const chunk of req){
    raw+=chunk.toString('utf8');
    if(Buffer.byteLength(raw)>512)throw Error('BODY_TOO_LARGE');
   }
   const {ticket}=JSON.parse(raw);
   if(typeof ticket!=='string'||!/^[a-f0-9]{48}$/.test(ticket)){
    reply(res,200,{ok:true,allowed:false},corsHeaders);
    return true;
   }
   tidy();
   const expiry=tickets.get(ticket);
   tickets.delete(ticket); // A ticket is accepted once, never replayed.
   reply(res,200,{ok:true,allowed:typeof expiry==='number'&&expiry>Date.now()},corsHeaders);
  }catch{reply(res,400,{ok:false,error:'BLEDNE_DANE'},corsHeaders);}
  return true;
 }
 return {handle};
}
