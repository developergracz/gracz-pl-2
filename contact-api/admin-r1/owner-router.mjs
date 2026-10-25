// Private HTTPS-only owner gateway. Default DENY; no paid identity service.
import {readFile} from 'node:fs/promises';
import {createOwnerAuth,parseOwnerCookie,newCookie,clearCookie} from './owner-auth.mjs';
import {createNewOnlyAdminReader} from './new-only-reader.mjs';
import {createNewOnlySummary} from './summary.mjs';
import {createNewOnlyTrendDetail} from './trend-detail.mjs';
import {createReadService} from './service.mjs';
import {privateHeaders,denyAdmin} from './deny.mjs';
import {getAttachmentCapabilities} from '../attachment-lab/integration.mjs';
import {createSeoLiveReader} from './seo-live-reader.mjs';
import {createSeoGoogleReader} from './seo-google-reader.mjs';
import {createSeoSpeedReader} from './seo-speed-reader.mjs';
import {createSeoGuardian} from './seo-guardian.mjs';
const PREFIX='/owner/newsletter';
const OWNER_HUB=PREFIX+'/systemadmin';
const OWNER_HUB_LOGIN=PREFIX+'/login/systemadmin';
// One existing OWNER session, no second account or cross-domain session cookie.
// All HTML, APIs and styles are served only from the trusted backend origin.
function withAdminSwitchBar(html,current) {
  const nav=(name,path,id)=>'<a href="'+path+'"'+(current===id?' aria-current="page"':'')+'>'+name+'</a>';
  const bar='<nav class="systemadmin-topnav" aria-label="Przełączanie paneli administracyjnych">'+
    '<a class="systemadmin-topnav-brand" href="'+OWNER_HUB+'">gracz<span>.pl</span> · SYSTEM ADMIN</a>'+
    nav('Centrum administracyjne',OWNER_HUB,'hub')+
    nav('SEO Control Center',PREFIX+'/seo','seo')+
    nav('Panel administracyjny Newslettera',PREFIX+'/','newsletter')+
    '<button type="button" id="systemadmin-logout" class="systemadmin-logout">Wyloguj</button>'+
    '<span id="systemadmin-logout-status" class="systemadmin-logout-status" role="status" aria-live="polite"></span>'+
    '</nav>';
  const identity='<section class="owner-premium-identity" aria-label="Panel Admin gracz.pl">'+
    '<p class="owner-premium-eyebrow">FULL MAX PREMIUM · CENTRUM WŁAŚCICIELA</p>'+
    '<div class="owner-premium-heading">Panel Admin <span>gracz.pl</span></div>'+
    '<p class="owner-premium-description">Bezpieczne logowanie do Centrum administracyjnego gracz.pl.</p>'+
    '</section>';
  const footer='<footer class="owner-premium-footer">© gracz.pl · Prywatne centrum administracyjne · Wszystkie prawa zastrzeżone</footer>';
  const layoutClass='owner-admin-layout'+(current==='hub'?' owner-admin-hub-layout':'');
  return html.replace('</head>','<link rel="stylesheet" href="'+PREFIX+'/systemadmin.css">'+
      '<script src="'+PREFIX+'/systemadmin-logout.js" defer></script></head>')
    .replace('<body>','<body class="'+layoutClass+'">'+bar+identity)
    .replace('</body>',footer+'</body>');
}
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
async function input(req,limit=maxBody){
  if(String(req.headers['content-type']||'').split(';')[0]!=='application/json')throw Error('invalid_type');
  let body='';
  for await(const chunk of req){
    body+=chunk;
    if(Buffer.byteLength(body)>limit)throw Error('too_large');
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
const PUBLIC_OWNER_FORM_ORIGIN='https://gracz.pl';
// The static gracz.pl form does NOT store credentials. Its only destination
// is a top-level HTTPS document POST, never an iframe, fetch or CORS grant.
async function publicOwnerFormInput(req){
  if(String(req.headers['content-type']||'').split(';')[0]!=='application/x-www-form-urlencoded')
    throw Error('invalid_type');
  let body='',size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>512)throw Error('too_large');
    body+=chunk.toString('utf8');
  }
  const fields=new URLSearchParams(body);
  const names=[...fields.keys()];
  if(names.length!==2||!names.includes('username')||!names.includes('password'))
    throw Error('invalid_fields');
  const username=fields.get('username'),password=fields.get('password');
  if(!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)||password.length<9||
     password.length>128)return null;
  return {username,password};
}
const loginHtml=(passwordOnly,recoveryReady=false)=>`<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel Admin — logowanie gracz.pl</title>
<link rel="stylesheet" href="${PREFIX}/admin.css">
<script src="${PREFIX}/login.js" defer></script></head>
<body class="owner-login-page"><main class="owner-login"><div class="owner-login-brand" aria-label="gracz.pl — Prywatny panel admina newslettera serwisu gracz.pl"><div class="logo" aria-hidden="true">gracz<span>.pl</span></div></div>
<p class="owner-login-eyebrow">FULL MAX PREMIUM · CENTRUM WŁAŚCICIELA</p>
<h1>Panel Admin <span>gracz.pl</span></h1>
<p class="owner-login-subtitle">${passwordOnly?'Bezpieczne logowanie do Centrum administracyjnego gracz.pl.':'Bezpieczne logowanie do Centrum administracyjnego gracz.pl. Podaj hasło oraz sześciocyfrowy kod z aplikacji Authenticator.'}</p>
<section class="owner-login-center-intro" aria-labelledby="owner-login-center-title">
  <p class="owner-login-center-overline">GRACZ.PL · FULL MAX PREMIUM</p>
  <h2 id="owner-login-center-title">Centrum administracyjne</h2>
  <p class="owner-login-center-copy">Wybierz system, którym chcesz zarządzać. Oba panele są dostępne w ramach jednej sesji właściciela.</p>
</section>
<section class="owner-login-card" aria-label="Bezpieczny formularz logowania">
<div class="owner-login-diamond" aria-hidden="true"></div>
<form id="login-form" autocomplete="off">
${passwordOnly?`<label for="username">Nick administratora</label>
<input id="username" type="text" autocomplete="username"
pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" minlength="3" maxlength="32" required>
<div id="login-nick-validation" class="login-nick-validation" role="alert" hidden>
<span class="login-nick-validation__icon" aria-hidden="true">!</span>
<span id="login-nick-validation-message"></span>
</div>`:''}
<label for="password">Hasło</label>
<input id="password" type="password" autocomplete="current-password"
minlength="${passwordOnly?9:16}" maxlength="128" required>
<div id="login-password-validation" class="login-premium-validation" role="alert" hidden>
<span class="login-premium-validation__icon" aria-hidden="true">!</span>
<span id="login-password-validation-message"></span>
</div>
${passwordOnly?'':`<label for="code">Kod Authenticator</label>
<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code"
pattern="[0-9]{6}" minlength="6" maxlength="6" required>`}
<div class="owner-login-actions">
<button id="login-button" type="submit">Zaloguj się</button>
${passwordOnly&&recoveryReady?'<button id="forgot-open" type="button">Zapomniałem hasła?</button>':''}
</div></form>
<p id="login-status" role="status" aria-live="polite"></p>
</section>
<p class="owner-login-security-note">Formularz wysyła dane bezpośrednio szyfrowanym połączeniem do serwera administracyjnego. Nie zapisujemy hasła na stronie publicznej.</p>
${passwordOnly&&recoveryReady?`<dialog id="forgot-dialog" class="owner-recovery-premium" aria-labelledby="forgot-title" aria-describedby="forgot-description">
<div class="forgot-heading">
<div class="forgot-heading-text">
<p class="forgot-eyebrow">gracz<span>.pl</span> · FULL MAX PREMIUM</p>
<h2 id="forgot-title">Odzyskaj hasło administratora</h2>
</div>
<button id="forgot-close" type="button">Zamknij</button>
</div>
<p id="forgot-description" class="forgot-description">Dostęp do panelu przywrócisz w dwóch prostych krokach.</p>
<div class="forgot-forms">
<section class="forgot-card" aria-label="Wysyłka kodu odzyskiwania">
<div class="forgot-card-heading"><span class="forgot-step" aria-hidden="true">01</span>
<div><h3>Otrzymaj kod odzyskiwania</h3>
<p>Serwer użyje potwierdzonego adresu odzyskiwania zapisanego na koncie.</p></div></div>
<form id="forgot-request-form" autocomplete="off">
<p id="forgot-mailbox-note" class="forgot-mailbox-note">Nie wpisujesz adresu e-mail. Kod wyślemy wyłącznie na wcześniej potwierdzoną skrzynkę przypisaną do konta administratora.</p>
<button type="submit">Wyślij kod odzyskiwania</button>
</form>
<p id="forgot-request-status" role="status" aria-live="polite"></p>
</section>
<section class="forgot-card" aria-label="Ustawienie nowego hasła">
<div class="forgot-card-heading"><span class="forgot-step" aria-hidden="true">02</span>
<div><h3>Ustaw nowe hasło</h3>
<p>Wpisz otrzymany kod i dwukrotnie nowe hasło.</p></div></div>
<form id="forgot-complete-form" autocomplete="off">
<label for="forgot-code">Hasło tymczasowe z wiadomości</label>
<input id="forgot-code" type="text" minlength="10" maxlength="24" pattern="(?:[A-Za-z]{10}|[A-Za-z0-9_-]{24})" autocomplete="one-time-code" required>
<label for="forgot-new-password">Nowe hasło (minimum 9 znaków)</label>
<input id="forgot-new-password" type="password" minlength="9" maxlength="128" autocomplete="new-password" required>
<label for="forgot-repeat">Powtórz nowe hasło</label>
<input id="forgot-repeat" type="password" minlength="9" maxlength="128" autocomplete="new-password" required>
<button type="submit">Ustaw nowe hasło</button>
</form>
<p id="forgot-complete-status" role="status" aria-live="polite"></p>
</section>
</div>
</dialog>`:''}
</main><footer class="owner-premium-login-footer">© gracz.pl · Prywatne centrum administracyjne · Wszystkie prawa zastrzeżone</footer></body></html>`;
export function createOwnerRouter({
  database,enabled=false,passwordSpec,totpBase32,
  username,passwordOnly=false,encryptionKey,subjectKey,origin=ORIGIN,
  recoverySecret,recoveryMailer,recoveryEnabled=false,
  campaignDraftStore=null,campaignDraftsEnabled=false,campaignAudienceProofCount=null,
  campaignWithdrawalReady=null,campaignEgressReady=null,campaignTestSender=null,
  campaignSender=null,limits=null
}={}){
  const auth=enabled?createOwnerAuth({database,passwordSpec,totpBase32,username,passwordOnly,
    recoverySecret,recoveryMailer,recoveryEnabled}):null;
  const enc=key(encryptionKey),subject=key(subjectKey);
  let reader=null;
  if(auth&&enc&&subject&&!enc.equals(subject)){
    try {reader=createNewOnlyAdminReader({database,encryptionKey:enc,subjectKey:subject});}
    catch {reader=null;}
  }
  const readSummary=reader?createNewOnlySummary({database}):null;
  const readTrendDetail=reader?createNewOnlyTrendDetail({database}):null;
  const configured=Boolean(auth&&reader&&readSummary&&readTrendDetail&&origin===ORIGIN);
  const services=new Map();
  const readSeoStatus=createSeoLiveReader();
  const seoGoogle=createSeoGoogleReader();
  const readSeoSpeed=createSeoSpeedReader();
  const readSeoGuardian=createSeoGuardian({readStatus:readSeoStatus,readSpeed:readSeoSpeed});
  // Bounded, process-local recent panel checks. Not a persistent 24h archive.
  const seoHistory=[];
  async function seoSnapshot(){
    const snapshot=await readSeoStatus();
    if(seoHistory.at(-1)?.checkedAt!==snapshot.checkedAt) {
      seoHistory.push({checkedAt:snapshot.checkedAt,ok:snapshot.ok,total:snapshot.total,
        passing:snapshot.passing,issues:snapshot.issues.length});
      if(seoHistory.length>48)seoHistory.shift();
    }
    return snapshot;
  }
  let loginBusy=false;
  let summaryBusy=false,summaryLastAt=-Infinity;
  let trendBusy=false,trendLastAt=-Infinity;
  let recentBusy=false,recentLastAt=-Infinity;
  let settingsBusy=false,settingsLastAt=-Infinity;
  let limitsBusy=false;
  let recoverBusy=false;
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
       url.hash)return denyAdmin(req,res);
    // Only OWNER HTML entry pages may discard exact ChatGPT attribution.
    // Host/TLS and configured checks run first; private JSON endpoints stay fail-closed.
    if(req.method==='GET' &&
       (url.pathname===PREFIX+'/' || url.pathname===PREFIX+'/login' ||
        url.pathname===PREFIX+'/seo' || url.pathname===OWNER_HUB ||
        url.pathname===OWNER_HUB_LOGIN) &&
       url.search==='?utm_source=chatgpt.com'){
      res.writeHead(302,{...privateHeaders,Location:url.pathname});
      return res.end();
    }
    // Only the authenticated PageSpeed endpoint accepts an exact refresh flag.
    // All other private query strings remain rejected.
    const speedRefresh=req.method==='GET'&&
      url.pathname===PREFIX+'/seo/speed'&&url.search==='?refresh=1';
    if(url.search&&!speedRefresh)return denyAdmin(req,res);
    const path=url.pathname;
    const cookie=parseOwnerCookie(req.headers.cookie);
    try{
      // The same Premium login form as gracz.pl/systemadmin, now served from
      // the OWNER origin so the existing Strict cookie and JSON login work.
      if(req.method==='GET'&&(path===PREFIX+'/login/visual'||
         path===PREFIX+'/login/visual/paneladmin')){
        if(!passwordOnly)return text(res,200,loginHtml(passwordOnly,auth?.recoveryReady));
        let html=(await readFile(new URL('../../maintenance-site/systemadmin/index.html',import.meta.url),'utf8'))
          .replace(/<meta http-equiv="refresh"[^>]*>\s*/, '')
          .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '')
          .replace('href="/systemadmin/systemadmin.css"',
            'href="'+PREFIX+'/login/visual.css"')
          .replace('src="/systemadmin/systemadmin-login.js"',
            'src="'+PREFIX+'/login/visual.js"')
          .replace('action="https://gracz-contact-api.onrender.com/owner/newsletter/login/public-form"',
            'action="#"');
        if(path===PREFIX+'/login/visual/paneladmin'){
          html=html
            .replace('class="admin-login-form" method="post"',
              'class="admin-login-form" data-after-login="systemadmin" method="post"')
            .replace('<h1>System Admin <span>gracz.pl</span></h1>',
              '<h1>Panel Admin <span>gracz.pl</span></h1>')
            .replace('Jedno bezpieczne logowanie do obu systemów administracyjnych.',
              'Bezpieczne logowanie do Centrum administracyjnego gracz.pl.')
            .replace('Po zalogowaniu wybierzesz SEO Control Center lub Panel administracyjny Newslettera.',
              'Po zalogowaniu wybierzesz SEO Control Center lub Panel administracyjny Newslettera.');
        }
        return text(res,200,html);
      }
      if(req.method==='GET'&&path===PREFIX+'/login/visual.css')
        return text(res,200,await readFile(new URL('../../maintenance-site/systemadmin/systemadmin.css',import.meta.url)),
          'text/css; charset=utf-8');
      if(req.method==='GET'&&path===PREFIX+'/login/visual.js')
        return text(res,200,await readFile(new URL('./ui/visual-login.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      if(req.method==='GET'&&path===PREFIX+'/login')
        return text(res,200,loginHtml(passwordOnly,auth?.recoveryReady));
      if(req.method==='GET'&&path===OWNER_HUB_LOGIN){
        const html=loginHtml(passwordOnly,auth?.recoveryReady)
          .replace('id="login-form" autocomplete="off"',
            'id="login-form" data-after-login="'+OWNER_HUB+'" autocomplete="off"')
          .replace('<title>Panel Admin — logowanie gracz.pl</title>',
            '<title>System Admin — logowanie gracz.pl</title>')
          .replace('<h1>Panel Admin <span>gracz.pl</span></h1>',
            '<h1>System Admin — logowanie</h1>')
          .replaceAll('Prywatny panel admina newslettera serwisu gracz.pl',
            'Prywatne centrum administracyjne gracz.pl');
        return text(res,200,html);
      }
      if(req.method==='GET'&&path===PREFIX+'/admin.css'){
        return text(res,200,await readFile(new URL('./ui/admin.css',import.meta.url)),
          'text/css; charset=utf-8');
      }
      if(req.method==='GET'&&path===PREFIX+'/login.js')
        return text(res,200,await readFile(new URL('./ui/login.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      // Dedicated HTML form endpoint for HTTPS gracz.pl /systemadmin.
      // Exact first-party Origin, top-level navigation and existing durable
      // credential verification. Session cookies stay scoped to onrender.com.
      if(req.method==='POST'&&path===PREFIX+'/login/public-form'){
        if(!passwordOnly ||
           req.headers.origin!==PUBLIC_OWNER_FORM_ORIGIN ||
           (req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='cross-site') ||
           (req.headers['sec-fetch-mode']&&req.headers['sec-fetch-mode']!=='navigate') ||
           (req.headers['sec-fetch-dest']&&req.headers['sec-fetch-dest']!=='document'))
          return reject(res);
        if(loginBusy)return reject(res,429);
        let data;
        try{data=await publicOwnerFormInput(req);}
        catch{return reject(res,400);}
        if(!data)return reject(res,400);
        loginBusy=true;
        try{
          const outcome=await auth.login(data);
          if(!outcome){
            // The public OWNER form must remain the user's only login screen.
            // A fixed 303 GET returns to gracz.pl without reflecting credentials,
            // exposing account state, or changing the durable 15-minute lockout.
            res.writeHead(303,{...privateHeaders,
              Location:'https://gracz.pl/systemadmin/#login-failed'});
            return res.end();
          }
          clearServices();
          // The submission starts at gracz.pl (cross-site). Redirecting immediately
          // can omit a newly issued SameSite=Strict cookie on the redirect chain.
          // Serve the actual OWNER hub as the successful POST response. The next
          // deliberate click on SEO or Newsletter is same-site and retains Strict.
          const hubHtml=withAdminSwitchBar(
            await readFile(new URL('./ui/systemadmin.html',import.meta.url),'utf8'),'hub');
          res.writeHead(200,{...privateHeaders,
            'Content-Type':'text/html; charset=utf-8',
            'Set-Cookie':newCookie(outcome.token)});
          return res.end(hubHtml);
        }finally{loginBusy=false;}
      }
      if(req.method==='POST'&&path===PREFIX+'/login'){
        if(!safePost(req,origin))return reject(res);
        if(loginBusy)return reject(res,429);
        loginBusy=true;
        try {
          const data=await input(req);
          const outcome=await auth.login({password:data.password,code:data.code,username:data.username});
          if(!outcome)return response(res,401,{ok:false,error:'invalid_credentials'});
          clearServices();
          return response(res,200,{ok:true,csrf:outcome.csrf},
            {'Set-Cookie':newCookie(outcome.token)});
        } finally {loginBusy=false;}
      }
      if(req.method==='POST'&&(path===PREFIX+'/recover/request'||path===PREFIX+'/recover/complete')){
        if(!passwordOnly||!auth?.recoveryReady||!safePost(req,origin))return reject(res,503);
        if(recoverBusy)return reject(res,429);
        recoverBusy=true;
        try{
          const data=await input(req);
          if(path===PREFIX+'/recover/request'){
            if(Object.keys(data).some(k=>k!=='email'))return reject(res);
            await auth.requestPasswordRecovery();
            // Never reveal whether this is the recovery mailbox.
            return response(res,200,{ok:true});
          }
          if(Object.keys(data).some(k=>!['email','code','newPassword'].includes(k)))return reject(res);
          const updated=await auth.completePasswordRecovery(data);
          if(!updated)return response(res,400,{ok:false,error:'invalid_or_expired'});
          clearServices();
          return response(res,200,{ok:true,relogin:true});
        }finally{recoverBusy=false;}
      }
      // Only the HTML entry point redirects unauthenticated browsers to login.
      // Private JSON endpoints still fail closed, without any authentication bypass.
      const ownerEntry=req.method==='GET'&&(path===PREFIX+'/'||path===PREFIX||
        path===PREFIX+'/seo'||path===OWNER_HUB);
      const entryLogin=path===OWNER_HUB?OWNER_HUB_LOGIN:PREFIX+'/login';
      if(!cookie){
        if(ownerEntry){
          res.writeHead(302,{...privateHeaders,Location:entryLogin});
          return res.end();
        }
        return reject(res,401);
      }
      const kind=(path===PREFIX+'/list'||path===PREFIX+'/summary')?'subscriber_list':
        path===PREFIX+'/detail'?'subscriber_detail':'session_read';
      const session=await auth.session(cookie,kind);
      if(!session){
        clearServices();
        if(ownerEntry){
          res.writeHead(302,{...privateHeaders,Location:entryLogin,
            'Set-Cookie':clearCookie});
          return res.end();
        }
        return response(res,401,{ok:false,error:'unauthorized'},
          {'Set-Cookie':clearCookie});
      }
      if(req.method==='GET'&&path===PREFIX+'/session')
        return response(res,200,{ok:true,csrf:session.csrf});
      if(req.method==='GET'&&path===OWNER_HUB)
        return text(res,200,withAdminSwitchBar(
          await readFile(new URL('./ui/systemadmin.html',import.meta.url),'utf8'),'hub'));
      if(req.method==='GET'&&path===PREFIX+'/systemadmin.css')
        return text(res,200,await readFile(new URL('./ui/systemadmin.css',import.meta.url)),
          'text/css; charset=utf-8');
      if(req.method==='GET'&&path===PREFIX+'/systemadmin-logout.js')
        return text(res,200,await readFile(new URL('./ui/systemadmin-logout.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      // Read-only SEO CONTROL CENTER reuses the current durable OWNER session.
      // Never expose its HTML, assets or monitoring JSON before authentication.
      if(req.method==='GET'&&path===PREFIX+'/seo')
        return text(res,200,withAdminSwitchBar(
          await readFile(new URL('./ui/seo.html',import.meta.url),'utf8'),'seo'));
      if(req.method==='GET'&&path===PREFIX+'/seo.js')
        return text(res,200,await readFile(new URL('./ui/seo.js',import.meta.url)),
          'text/javascript; charset=utf-8');
      if(req.method==='GET'&&path===PREFIX+'/seo.css')
        return text(res,200,await readFile(new URL('./ui/seo.css',import.meta.url)),
          'text/css; charset=utf-8');
      if(req.method==='GET'&&path===PREFIX+'/seo/status')
        return response(res,200,await seoSnapshot());
      if(req.method==='GET'&&path===PREFIX+'/seo/guardian')
        return response(res,200,await readSeoGuardian());
      if(req.method==='GET'&&path===PREFIX+'/seo/history'){
        await seoSnapshot();
        return response(res,200,{ok:true,storage:"process_memory",entries:seoHistory.slice()});
      }
      if(req.method==='GET'&&path===PREFIX+'/seo/google')
        return response(res,200,await seoGoogle.read());
      if(req.method==='GET'&&path===PREFIX+'/seo/speed')
        return response(res,200,await readSeoSpeed('mobile',{refresh:speedRefresh}));
      if(req.method==='POST'&&path===PREFIX+'/seo/inspect'){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req,512);
        if(Object.keys(data).length!==1||typeof data.url!=='string')
          return reject(res,400);
        const live=await seoSnapshot();
        if(!live.pages.some(page=>page.url===data.url))
          return reject(res,400);
        return response(res,200,await seoGoogle.inspect(data.url));
      }
      // Read-only OWNER capability contract: never accepts file content.
      // No API route for uploading, scanning, conversion or attachment sending.
      if(req.method==='GET'&&path===PREFIX+'/attachment-capabilities')
        return response(res,200,{ok:true,...getAttachmentCapabilities()});
      if(req.method==='GET'&&(path===PREFIX+'/'||path===PREFIX)){
        let html=await readFile(new URL('./ui/index.html',import.meta.url),'utf8');
        html=html.replace('"/admin.css"','"'+PREFIX+'/admin.css"')
          .replace('"/admin.js"','"'+PREFIX+'/owner-dashboard.js"')
          .replace('PODGLĄD SYNTETYCZNY','TYLKO WŁAŚCICIEL')
          .replace('Dane demonstracyjne · Logowanie OWNER oczekuje na niezależny audyt.\n          Panel produkcyjny pozostaje zamknięty.',
            'Dane subskrybentów tylko do odczytu. Ustawienia konta są dostępne wyłącznie właścicielowi.')
          .replace('Resend jako źródło stanu operacyjnego','Potwierdzone zgody w PostgreSQL')
          .replace('Globalnie lub w temacie','Potwierdzone wypisania')
          .replace('Oczekujący · łącznie','Oczekujący na stronie')
          .replace('<strong>—</strong><small>Agregat HMAC niedostępny</small>',
            '<strong id="pending">—</strong><small>Oczekujący na potwierdzenie</small>');
        html=html.replace('Filtry dotyczą maksymalnie 10 kontaktów na stronie dostawcy.',
            'Filtry dotyczą maksymalnie 10 kontaktów na stronie rejestru.');
        return text(res,200,withAdminSwitchBar(html,'newsletter'));
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

      if(req.method==='POST'&&[
        PREFIX+'/limits/inspect',PREFIX+'/limits/unlock',PREFIX+'/limits/history',
        PREFIX+'/limits/active'
      ].includes(path)){
        if(!limits||!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        if(limitsBusy)return reject(res,429);
        limitsBusy=true;
        try{
          const data=await input(req);
          if(path===PREFIX+'/limits/history'||path===PREFIX+'/limits/active'){
            if(Object.keys(data).length!==0)return reject(res,400);
            return response(res,200,{ok:true,...(
              path===PREFIX+'/limits/active'?limits.listActive():limits.history()
            )});
          }
          if(typeof data.email!=='string')return reject(res,400);
          if(path===PREFIX+'/limits/inspect'){
            if(Object.keys(data).length!==1)return reject(res,400);
            return response(res,200,{ok:true,...limits.inspect(data.email)});
          }
          if(Object.keys(data).length!==2||data.confirmation!=='ODBLOKUJ ADRES')
            return reject(res,400);
          return response(res,200,{ok:true,...limits.unlock(data.email)});
        }catch(error){
          return reject(res,error instanceof TypeError?400:503);
        }finally{limitsBusy=false;}
      }
      if(req.method==='GET'&&path===PREFIX+'/campaign-drafts/availability'){
        let ready=false;
        if(campaignDraftsEnabled&&campaignDraftStore&&database?.enabled){
          try{
            const check=await database.query(
              "SELECT to_regclass('newsletter_campaigns.campaigns') IS NOT NULL "+
              "AND has_schema_privilege(current_user,'newsletter_campaigns','USAGE') "+
              "AND has_table_privilege(current_user,'newsletter_campaigns.campaigns','SELECT,INSERT,UPDATE') AS ready"
            );
            ready=check.rows?.[0]?.ready===true;
          }catch{ready=false;}
        }
        let testSendEnabled=false;
        if(ready&&typeof campaignTestSender?.available==='function')
          testSendEnabled=await campaignTestSender.available();
        let campaignSendEnabled=false;
        if(ready&&typeof campaignSender?.available==='function')
          campaignSendEnabled=await campaignSender.available();
        let targetedSendEnabled=false;
        if(ready&&campaignSendEnabled){
          try{
            const table=await database.queryBounded(
              "SELECT to_regclass('newsletter_campaigns.targeted_audiences') IS NOT NULL "+
              "AND has_table_privilege(current_user,'newsletter_campaigns.targeted_audiences','SELECT,INSERT') AS ready",
              [],{timeoutMs:3000});
            targetedSendEnabled=table.rows?.length===1&&table.rows[0]?.ready===true;
          }catch{targetedSendEnabled=false;}
        }
        return response(res,200,{ok:true,enabled:ready,testSendEnabled,campaignSendEnabled,targetedSendEnabled});
      }
      if(req.method==='POST'&&path===PREFIX+'/campaign-drafts/audience'){
        if(!campaignDraftsEnabled||!campaignDraftStore||
           typeof campaignAudienceProofCount!=='function')return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==0)return reject(res);
        const evidence=await campaignAudienceProofCount();
        let withdrawalReady=false;
        try{
          withdrawalReady=typeof campaignWithdrawalReady==='function' &&
            await campaignWithdrawalReady()===true;
        }catch{withdrawalReady=false;}
        let globalEgressReady=false;
        try{
          globalEgressReady=withdrawalReady===true &&
            typeof campaignEgressReady==='function' &&
            await campaignEgressReady()===true;
        }catch{globalEgressReady=false;}
        // Both booleans are advisory. Neither authorizes marketing egress.
        return response(res,200,{...evidence,withdrawalReady,globalEgressReady});
      }
      if(req.method==='POST'&&path===PREFIX+'/campaign-targeted/save'){
        if(!campaignDraftsEnabled||typeof campaignDraftStore?.saveTargeted!=='function')
          return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req,65536);
        if(Object.keys(data).length!==4||
           !['subject','body','audience','handles'].every(k=>Object.hasOwn(data,k)))
          return reject(res);
        try{
          const ids=serviceFor(session.tokenHash).resolveTargetHandles(data.handles);
          const {handles,...draft}=data;
          const saved=await campaignDraftStore.saveTargeted(draft,ids);
          return response(res,201,{ok:true,...saved});
        }catch(e){
          // A stale/invalid session-scoped selection is rejected BEFORE any
          // draft write. Only this deterministic failure may trigger a fresh
          // OWNER list read; never retry on DB/transport uncertainty.
          if(e?.code==='invalid_request')
            return response(res,409,{ok:false,error:'recipient_selection_expired'});
          if(['invalid_campaign','invalid_targets'].includes(e?.code))
            return response(res,400,{ok:false,error:e.code});
          return reject(res,503);
        }
      }
      if(req.method==='POST'&&path===PREFIX+'/campaign-targeted/send'){
        if(!campaignDraftsEnabled||typeof campaignSender?.sendTargeted!=='function')
          return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==2||!Object.hasOwn(data,'id')||
           data.confirmation!=='WYSYŁAM DO WYBRANYCH')return reject(res,400);
        try{
          const result=await campaignSender.sendTargeted(data.id);
          return response(res,result.state==='uncertain'?202:200,{ok:true,...result});
        }catch{return reject(res,503);}
      }
      if(req.method==='POST'&&path===PREFIX+'/campaigns/send'){
        if(!campaignDraftsEnabled||typeof campaignSender?.send!=='function')
          return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==2||!Object.hasOwn(data,'id')||
           data.confirmation!=='WYSYŁAM KAMPANIĘ')return reject(res);
        try{
          const result=await campaignSender.send(data.id);
          return response(res,result.state==='uncertain'?202:200,{ok:true,...result});
        }catch{return reject(res,503);}
      }
      if(req.method==='POST'&&path===PREFIX+'/campaign-tests/send'){
        // Explicit OWNER click is necessary, but never sufficient: dedicated
        // feature flag, durable send-attempt table and withdrawal checks apply.
        if(!campaignDraftsEnabled||typeof campaignTestSender?.sendTest!=='function')
          return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==1||!Object.hasOwn(data,'id'))
          return reject(res);
        try{
          const result=await campaignTestSender.sendTest(data.id);
          return response(res,result.state==='uncertain'?202:200,{ok:true,...result});
        }catch(error){
          if(error?.code==='invalid_campaign_id')
            return response(res,400,{ok:false,error:'invalid_campaign_id'});
          if(error?.code==='campaign_test_send_unavailable')
            return reject(res,503);
          throw error;
        }
      }
      if(req.method==='POST'&&[
        PREFIX+'/campaign-drafts/save',PREFIX+'/campaign-drafts/list',
        PREFIX+'/campaign-drafts/get',PREFIX+'/campaign-drafts/update',
        PREFIX+'/campaign-drafts/approve',PREFIX+'/campaign-drafts/approved'
      ].includes(path)){
        // Authenticated OWNER, same-origin + CSRF. Content approval is
        // independent of (and never grants) any marketing send permission.
        if(!campaignDraftsEnabled||!campaignDraftStore)return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const writing=path.endsWith('/save')||path.endsWith('/update')||
          path.endsWith('/approve');
        const data=await input(req,writing?65536:maxBody);
        if(path.endsWith('/list')){
          if(Object.keys(data).length!==0)return reject(res);
          return response(res,200,{ok:true,drafts:await campaignDraftStore.list()});
        }
        if(path.endsWith('/approved')){
          if(Object.keys(data).length!==0)return reject(res);
          return response(res,200,{ok:true,campaigns:await campaignDraftStore.listApproved()});
        }
        if(path.endsWith('/get')&&
           (Object.keys(data).length!==1||!Object.hasOwn(data,'id')))return reject(res);
        if(path.endsWith('/update')&&
           (Object.keys(data).length!==4||
            !['id','subject','body','audience'].every(k=>Object.hasOwn(data,k))))
          return reject(res);
        if(path.endsWith('/save')&&
           (Object.keys(data).length!==3||
            !['subject','body','audience'].every(k=>Object.hasOwn(data,k))))
          return reject(res);
        if(path.endsWith('/approve')&&
           (Object.keys(data).length!==5||
            !['id','subject','body','audience','confirmation']
              .every(k=>Object.hasOwn(data,k))||
            data.confirmation!=='ZATWIERDZAM TREŚĆ'))
          return reject(res);
        try{
          if(path.endsWith('/get')){
            const draft=await campaignDraftStore.get(data.id);
            return draft?response(res,200,{ok:true,draft}):
              response(res,404,{ok:false,error:'draft_not_found'});
          }
          if(path.endsWith('/update')){
            const {id,...draft}=data;
            const updated=await campaignDraftStore.update(id,draft);
            return updated?response(res,200,{ok:true,...updated}):
              response(res,404,{ok:false,error:'draft_not_found'});
          }
          if(path.endsWith('/approve')){
            const {id,confirmation,...draft}=data;
            const approved=await campaignDraftStore.approve(id,draft);
            return approved?response(res,200,{ok:true,...approved}):
              response(res,409,{ok:false,error:'campaign_changed_or_approved'});
          }
          const saved=await campaignDraftStore.save(data);
          return response(res,201,{ok:true,...saved});
        }catch(error){
          if(error?.code==='invalid_campaign')
            return response(res,400,{ok:false,error:'invalid_campaign'});
          throw error;
        }
      }
      if(req.method==='POST'&&path===PREFIX+'/settings'){
        if(!passwordOnly||!safePost(req,origin)||
           !auth.checkCsrf(session,req.headers['x-owner-csrf']))return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==0)return reject(res);
        const settings=await auth.settings(cookie);
        if(!settings)return reject(res,401);
        return response(res,200,{ok:true,...settings});
      }
      if(req.method==='POST'&&path===PREFIX+'/change-credentials'){
        if(!passwordOnly||!safePost(req,origin)||
           !auth.checkCsrf(session,req.headers['x-owner-csrf']))return reject(res);
        if(settingsBusy||Date.now()-settingsLastAt<2000)return reject(res,429);
        settingsBusy=true;settingsLastAt=Date.now();
        try{
          const data=await input(req);
          if(Object.keys(data).some(k=>!['oldPassword','newPassword','username'].includes(k))||
             !Object.hasOwn(data,'oldPassword')||
             !Object.hasOwn(data,'newPassword')&&!Object.hasOwn(data,'username'))
            return reject(res);
          const changed=await auth.changeCredentials(cookie,data);
          if(!changed)return response(res,400,{ok:false,error:'invalid_account_change'});
          clearServices();
          return response(res,200,{ok:true,relogin:true},
            {'Set-Cookie':clearCookie});
        }finally{settingsBusy=false;}
      }
      if(req.method==='POST'&&(path===PREFIX+'/recover/email'||path===PREFIX+'/recover/verify')){
        if(!passwordOnly||!auth?.recoveryReady||!safePost(req,origin)||
          !auth.checkCsrf(session,req.headers['x-owner-csrf']))return reject(res);
        if(settingsBusy||Date.now()-settingsLastAt<2000)return reject(res,429);
        settingsBusy=true;settingsLastAt=Date.now();
        try{
          const data=await input(req);
          const isSet=path===PREFIX+'/recover/email';
          if(Object.keys(data).some(k=>!(isSet?['email','password']:['code']).includes(k)))return reject(res);
          const ok=isSet
            ?await auth.beginRecoveryEmail(cookie,data)
            :await auth.confirmRecoveryEmail(cookie,data.code);
          if(!ok)return response(res,400,{ok:false,error:'invalid_or_unavailable'});
          return response(res,200,{ok:true});
        }finally{settingsBusy=false;}
      }
      if(req.method==='POST'&&path===PREFIX+'/recent-subscribers'){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        if(recentBusy||Date.now()-recentLastAt<3000)return reject(res,429);
        recentBusy=true;recentLastAt=Date.now();
        try{
          const data=await input(req);
          if(Object.keys(data).length!==0)return reject(res);
          return response(res,200,await reader.readRecent());
        }finally{recentBusy=false;}
      }
      if(req.method==='POST'&&path===PREFIX+'/trend-detail'){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        if(trendBusy||Date.now()-trendLastAt<1200)return reject(res,429);
        trendBusy=true;trendLastAt=Date.now();
        try{
          const data=await input(req);
          if(Object.keys(data).some(k=>!['from','to','source'].includes(k))||
             !Object.hasOwn(data,'from')||!Object.hasOwn(data,'to'))
            return reject(res);
          const result=await readTrendDetail(data);
          return result?response(res,200,result)
            :response(res,400,{ok:false,error:'invalid_range'});
        }finally{trendBusy=false;}
      }
      if(req.method==='POST'&&path===PREFIX+'/summary'){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        if(Object.keys(data).length!==0)return reject(res);
        if(summaryBusy||Date.now()-summaryLastAt<3000)return reject(res,429);
        summaryBusy=true;summaryLastAt=Date.now();
        try{
          return response(res,200,await readSummary());
        }finally{summaryBusy=false;}
      }
      if(req.method==='POST'&&(path===PREFIX+'/list'||path===PREFIX+'/detail')){
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const data=await input(req);
        const svc=serviceFor(session.tokenHash);
        const value=path===PREFIX+'/list'
          ?await svc.list({cursor:data.cursor??null,query:data.query??'',state:data.state??'all',
             from:data.from??'',to:data.to??''})
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
