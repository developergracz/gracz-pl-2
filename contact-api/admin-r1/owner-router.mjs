// Private HTTPS-only owner gateway. Default DENY; no paid identity service.
import {readFile} from 'node:fs/promises';
import {createOwnerAuth,parseOwnerCookie,newCookie,clearCookie} from './owner-auth.mjs';
import {createNewOnlyAdminReader} from './new-only-reader.mjs';
import {createNewOnlySummary} from './summary.mjs';
import {createNewOnlyTrendDetail} from './trend-detail.mjs';
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
const loginHtml=(passwordOnly,recoveryReady=false)=>`<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logowanie właściciela — gracz.pl</title>
<link rel="stylesheet" href="${PREFIX}/admin.css">
<script src="${PREFIX}/login.js" defer></script></head>
<body><main class="owner-login"><div class="owner-login-brand" aria-label="gracz.pl — Prywatny panel admina newslettera serwisu gracz.pl"><div class="logo" aria-hidden="true">gracz<span>.pl</span></div><p>Prywatny panel admina newslettera serwisu gracz.pl</p></div>
<h1>Logowanie właściciela</h1>
<p>${passwordOnly?'Podaj nick administratora i hasło.':'Podaj hasło oraz sześciocyfrowy kod z aplikacji Authenticator.'}</p>
<form id="login-form" autocomplete="off">
${passwordOnly?`<label for="username">Nick administratora</label>
<input id="username" type="text" autocomplete="username"
pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" minlength="3" maxlength="32" required>`:''}
<label for="password">Hasło</label>
<input id="password" type="password" autocomplete="current-password"
minlength="${passwordOnly?9:16}" maxlength="128" required>
${passwordOnly?'':`<label for="code">Kod Authenticator</label>
<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code"
pattern="[0-9]{6}" minlength="6" maxlength="6" required>`}
<button id="login-button" type="submit">Zaloguj</button></form>
<p id="login-status" role="status" aria-live="polite"></p>
${passwordOnly&&recoveryReady?`<p><button id="forgot-open" type="button">Zapomniałem hasła?</button></p>
<dialog id="forgot-dialog" aria-labelledby="forgot-title">
<div class="forgot-heading">
<h2 id="forgot-title">Odzyskaj hasło administratora</h2>
<button id="forgot-close" type="button">Zamknij</button>
</div>
<p>Wpisz potwierdzony adres e-mail odzyskiwania.</p>
<div class="forgot-forms">
<section aria-label="Wysyłka kodu odzyskiwania">
<form id="forgot-request-form" autocomplete="off">
<label for="forgot-email">Adres e-mail odzyskiwania</label>
<input id="forgot-email" type="email" autocomplete="email" maxlength="254" required>
<button type="submit">Wyślij hasło tymczasowe</button>
</form>
<p id="forgot-request-status" role="status" aria-live="polite"></p>
</section>
<section aria-label="Ustawienie nowego hasła">
<form id="forgot-complete-form" autocomplete="off">
<label for="forgot-code">Hasło tymczasowe z wiadomości</label>
<input id="forgot-code" type="text" minlength="24" maxlength="24" autocomplete="one-time-code" required>
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
</main></body></html>`;
export function createOwnerRouter({
  database,enabled=false,passwordSpec,totpBase32,
  username,passwordOnly=false,encryptionKey,subjectKey,origin=ORIGIN,
  recoverySecret,recoveryMailer,recoveryEnabled=false,
  campaignDraftStore=null,campaignDraftsEnabled=false,campaignAudienceProofCount=null,
  campaignWithdrawalReady=null
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
  let loginBusy=false;
  let summaryBusy=false,summaryLastAt=-Infinity;
  let trendBusy=false,trendLastAt=-Infinity;
  let recentBusy=false,recentLastAt=-Infinity;
  let settingsBusy=false,settingsLastAt=-Infinity;
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
       url.search||url.hash)return denyAdmin(req,res);
    const path=url.pathname;
    const cookie=parseOwnerCookie(req.headers.cookie);
    try{
      if(req.method==='GET'&&path===PREFIX+'/login')
        return text(res,200,loginHtml(passwordOnly,auth?.recoveryReady));
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
            await auth.requestPasswordRecovery(data.email);
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
      // Every private route requires a live, durable server-side session.
      if(!cookie)return reject(res,401);
      const kind=(path===PREFIX+'/list'||path===PREFIX+'/summary')?'subscriber_list':
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
            'Dane subskrybentów tylko do odczytu. Ustawienia konta są dostępne wyłącznie właścicielowi.')
          .replace('Resend jako źródło stanu operacyjnego','Potwierdzone zgody w PostgreSQL')
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
        return response(res,200,{ok:true,enabled:ready});
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
        // Advisory only. This is NOT authorization to send any campaign.
        return response(res,200,{...evidence,withdrawalReady});
      }
      if(req.method==='POST'&&[
        PREFIX+'/campaign-drafts/save',PREFIX+'/campaign-drafts/list',
        PREFIX+'/campaign-drafts/get',PREFIX+'/campaign-drafts/update'
      ].includes(path)){
        // OWNER session has already been checked. All mutations remain
        // drafts-only and require same-origin + CSRF. No send or approval routes.
        if(!campaignDraftsEnabled||!campaignDraftStore)return reject(res,503);
        if(!safePost(req,origin)||!auth.checkCsrf(session,req.headers['x-owner-csrf']))
          return reject(res);
        const writing=path.endsWith('/save')||path.endsWith('/update');
        const data=await input(req,writing?65536:maxBody);
        if(path.endsWith('/list')){
          if(Object.keys(data).length!==0)return reject(res);
          return response(res,200,{ok:true,drafts:await campaignDraftStore.list()});
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
