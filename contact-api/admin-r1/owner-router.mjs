// Private HTTPS-only owner gateway. Default DENY; no paid identity service.
import {readFile} from 'node:fs/promises';
import {createOwnerAuth,parseOwnerCookie,newCookie,clearCookie} from './owner-auth.mjs';
import {createNewOnlyAdminReader} from './new-only-reader.mjs';
import {createReadService} from './service.mjs';
import {privateHeaders,denyAdmin} from './deny.mjs';
const PREFIX='/owner/newsletter';
const ORIGIN='https://gracz-contact-api.onrender.com';
const maxBody=2048;
const maxServices=8;
const key=value=>{
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))return null;
  const decoded=Buffer.from(value,'base64url');
  return decoded.length===32&&decoded.toString('base64url')===value?decoded:null;
};
function response(res,status,body,more={}){
  res.writeHead(status,{...privateHeaders,...more,
    'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}
function text(res,status,data,mime='text/html; charset=utf-8'){
  res.writeHead(status,{...privateHeaders,'Content-Type':mime});
  res.end(data);
}
function reject(res,status=403){
  response(res,status,{ok:false,error:status===429?'rate_limited':'unavailable'});
}
async function input(req){
  if(String(req.headers['content-type']||'').split(';')[0]!=='application/json')throw Error('invalid_type');
  let body='';
  for await(const chunk of req){
    body+=chunk;
    if(Buffer.byteLength(body)>maxBody)throw Error('too_large');
  }
  const parsed=JSON.parse(body);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('invalid_body');
  return parsed;
}
function safePost(req,origin){
  const fetchSite=req.headers['sec-fetch-site'];
  return req.headers.origin===origin &&
    (!fetchSite||fetchSite==='same-origin') &&
    req.headers['sec-fetch-mode']!=='no-cors';
}
const loginHtml=`<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logowanie właściciela — gracz.pl</title>
<link rel="stylesheet" href="${PREFIX}/admin.css">
<script src="${PREFIX}/login.js" defer></script></head>
<body><main class="owner-login"><p class="eyebrow">GRACZ.PL · PANEL PRYWATNY</p>
<h1>Logowanie właściciela</h1>
<p>Podaj hasło oraz sześciocyfrowy kod z aplikacji Authenticator.</p>
<form id="login-form" autocomplete="off">
<label for="password">Hasło</label>
<input id="password" type="password" autocomplete="current-password"
minlength="16" maxlength="128" required>
<label for="code">Kod Authenticator</label>
<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code"
pattern="[0-9]{6}" minlength="6" maxlength="6" required>
<button id="login-button" type="submit">Zaloguj</button></form>
<p id="login-status" role="status" aria-live="polite"></p>
</main></body></html>`;
export function createOwnerRouter({
  database,enabled=false,passwordSpec,totpBase32,
  encryptionKey,subjectKey,origin=ORIGIN
}={}){
  const auth=enabled?createOwnerAuth({database,passwordSpec,totpBase32}):null;
  const enc=key(encryptionKey),subject=key(subjectKey);
  let reader=null;
  if(auth&&enc&&subject&&!enc.equals(subject)){
    try {reader=createNewOnlyAdminReader({database,encryptionKey:enc,subjectKey:subject});}
    catch {reader=null;}
  }
  const configured=Boolean(auth&&reader&&origin===ORIGIN);
  const services=new Map();
  let loginBusy=false;
  function serviceFor(tokenHash){
    let svc=services.get(tokenHash);
    if(!svc){
      while(services.size>=maxServices){
        const first=services.keys().next().value;
        services.get(first).clear();services.delete(first);
      }
      svc=createReadService({...reader,audit:async()=>{}});
      services.set(tokenHash,svc);
    }
    return svc;
  }
  function clearServices(){
    for(const svc of services.values())svc.clear();
    services.clear();
  }
  async function handle(req,res,url){
    if(!configured)return denyAdmin(req,res);
    // Render's TLS-terminated hostname only; never accept preview, www or
    // client-controlled forwarded host as a separate authority.
    if(req.headers.host!==new URL(origin).host ||
       req.headers['x-forwarded-proto']!=='https' ||
       url.search||url.hash)return denyAdmin(req,res);
    const path=url.pathname;
    const cookie=parseOwnerCookie(req.headers.cookie);
    try{
      if(req.method==='GET'&&path===PREFIX+'/login')
        return text(res,200,loginHtml);
      if(req.method==='GET'&&path===PREFIX+'/admin.css'){
        return text(res,200,await readFile(new URL('./ui/admin.css',import.meta.url)),
          'text/css; charset=utf-8');
      }
      if(req.method==='GET'&&path===PREFIX+'/login.js')
        return text(res,200,await readFile(new URL('./ui/login.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      if(req.method==='POST'&&path===PREFIX+'/login'){
        if(!safePost(req,origin))return reject(res);
        if(loginBusy)return reject(res,429);
        loginBusy=true;
        try {
          const data=await input(req);
          const outcome=await auth.login({password:data.password,code:data.code});
          if(!outcome)return response(res,401,{ok:false,error:'invalid_credentials'});
          clearServices();
          return response(res,200,{ok:true,csrf:outcome.csrf},
            {'Set-Cookie':newCookie(outcome.token)});
        } finally {loginBusy=false;}
      }
      // Every private route requires a live, durable server-side session.
      if(!cookie)return reject(res,401);
      const kind=path===PREFIX+'/list'?'subscriber_list':
        path===PREFIX+'/detail'?'subscriber_detail':'session_read';
      const session=await auth.session(cookie,kind);
      if(!session){
        clearServices();
        return response(res,401,{ok:false,error:'unauthorized'},
          {'Set-Cookie':clearCookie});
      }
      if(req.method==='GET'&&path===PREFIX+'/session')
        return response(res,200,{ok:true,csrf:session.csrf});
      if(req.method==='GET'&&(path===PREFIX+'/'||path===PREFIX)){
        let html=await readFile(new URL('./ui/index.html',import.meta.url),'utf8');
        html=html.replace('"/admin.css"','"'+PREFIX+'/admin.css"')
          .replace('"/admin.js"','"'+PREFIX+'/owner-dashboard.js"')
          .replace('PODGLĄD SYNTETYCZNY','TYLKO WŁAŚCICIEL')
          .replace('Dane demonstracyjne · Logowanie OWNER oczekuje na niezależny audyt.\n          Panel produkcyjny pozostaje zamknięty.',
            'Dane nowych subskrybentów. Panel tylko do odczytu.')
          .replace('Resend jako źródło stanu operacyjnego','Potwierdzone zgody w PostgreSQL')
          .replace('Wypisani na stronie','Wypisani na stronie')
          .replace('Globalnie lub w temacie','Potwierdzone wypisania')
          .replace('Oczekujący · łącznie','Oczekujący na stronie')
          .replace('<strong>—</strong><small>Agregat HMAC niedostępny</small>',
            '<strong id="pending">—</strong><small>Oczekujący na potwierdzenie</small>');
        html=html.replace('</header>','<button type="button" id="logout">Wyloguj</button></header>')
          .replace('Filtry dotyczą maksymalnie 10 kontaktów na stronie dostawcy.',
            'Filtry dotyczą maksymalnie 10 kontaktów na stronie rejestru.');
        return text(res,200,html);
      }
      if(req.method==='GET'&&path===PREFIX+'/owner-dashboard.js')
        return text(res,200,await readFile(new URL('./ui/owner-dashboard.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      if(req.method==='POST'&&path===PREFIX+'/logout'){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        await auth.logout(cookie);
        clearServices();
        return response(res,200,{ok:true},{'Set-Cookie':clearCookie});
      }
      if(req.method==='POST'&&(path===PREFIX+'/list'||path===PREFIX+'/detail')){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        const svc=serviceFor(session.tokenHash);
        const value=path===PREFIX+'/list'
          ?await svc.list({cursor:data.cursor??null,query:data.query??'',state:data.state??'all'})
          :await svc.detail(data.handle);
        return response(res,200,value);
      }
      return denyAdmin(req,res);
    } catch {
      // No e-mail, credentials, SQL, session or other private details in logs.
      return reject(res,503);
    }
  }
  return Object.freeze({configured,handle});
}
