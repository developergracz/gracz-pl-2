const SESSION_COOKIE="__Host-gracz_session";

export function createAdminSecurityHandler({auth,authSessions,rbac,mfa,audit,security}){
  if(!auth||!rbac||!mfa||!security)throw new TypeError("Admin security dependencies are required.");
  return async function adminSecurityHandler(request,response){
    const url=new URL(request.url,"http://localhost");
    if(!url.pathname.startsWith("/admin/security"))return false;
    try{
      security.assertSameOrigin(request);
      const user=await trustedUser(request,auth,authSessions);
      const role=await rbac.getRole(user.userId);
      if(role==="player")throw forbidden("Panel administracyjny nie jest dostępny dla kont graczy.");
      security.limit(request,"admin-security",user.userId,{limit:40,windowMs:60_000});

      if(request.method==="GET"&&(url.pathname==="/admin/security"||url.pathname==="/admin/security/"))return html(response,200,panelHtml());
      if(request.method==="GET"&&url.pathname==="/admin/security/panel.js")return javascript(response,200,panelJs());
      if(request.method==="GET"&&url.pathname==="/admin/security/me")return json(response,200,{user:{userId:user.userId,displayName:user.displayName,role,mfaEnabled:await mfa.isEnabled(user.userId)}});
      if(request.method==="POST"&&url.pathname==="/admin/security/mfa/setup"){
        if(role!=="moderator")await rbac.require(user.userId,"admin.settings");
        const mfaAlreadyEnabled=await mfa.isEnabled(user.userId);
        if(mfaAlreadyEnabled)await requirePrivilegedMfa(user.userId,request,mfa);
        const setup=await mfa.begin(user.userId);
        await audit?.record({actorId:user.userId,eventType:mfaAlreadyEnabled?"mfa.reset.started":"mfa.setup.started",source:security.source(request),userAgent:request.headers["user-agent"],metadata:{reconfiguration:mfaAlreadyEnabled}});
        return json(response,200,setup);
      }
      if(request.method==="POST"&&url.pathname==="/admin/security/mfa/enable"){
        const body=await readJson(request);await mfa.enable(user.userId,body.code);return json(response,200,{ok:true});
      }

      await requirePrivilegedMfa(user.userId,request,mfa);
      if(request.method==="POST"&&url.pathname==="/admin/security/roles"){
        await rbac.require(user.userId,"admin.users");const body=await readJson(request);
        const result=await rbac.setRole({actorId:user.userId,targetId:body.userId,role:body.role,actorMfaVerified:true});
        await audit?.record({actorId:user.userId,eventType:"admin.role.changed",targetType:"account",targetId:body.userId,source:security.source(request),userAgent:request.headers["user-agent"],metadata:{newRole:body.role}});
        return json(response,200,result);
      }
      if(request.method==="GET"&&url.pathname==="/admin/security/audit-health"){
        await rbac.require(user.userId,"admin.audit");return json(response,200,{ok:true,audit:"append-only",mfa:"required",role});
      }
      return json(response,404,{error:{code:"NOT_FOUND",message:"Nie znaleziono operacji administracyjnej."}});
    }catch(error){
      await audit?.record({eventType:"admin.access",outcome:"failure",source:security.source(request),userAgent:request.headers["user-agent"],metadata:{code:error.code||"ADMIN_ERROR",path:url.pathname}}).catch(()=>{});
      if(request.method==="GET"&&(url.pathname==="/admin/security"||url.pathname==="/admin/security/"))return html(response,error.status||403,errorHtml(error.message||"Brak uprawnień."));
      return json(response,error.status||403,{error:{code:error.code||"FORBIDDEN",message:error.message||"Brak uprawnień."}});
    }
  };
}

async function requirePrivilegedMfa(userId,request,mfa){if(!await mfa.isEnabled(userId))throw Object.assign(new Error("Konto uprzywilejowane musi mieć włączone MFA."),{code:"MFA_REQUIRED",status:403});const code=String(request.headers["x-gracz-mfa-code"]||"");await mfa.verify(userId,code);}
async function trustedUser(request,auth,authSessions){const token=cookies(request)[SESSION_COOKIE];if(!token)throw Object.assign(new Error("Wymagane jest logowanie."),{code:"UNAUTHENTICATED",status:401});const user=auth.verify(token);if(authSessions&&user.tokenId)await authSessions.assertActive(user);return user;}
function cookies(request){const result={};for(const part of String(request.headers.cookie||"").split(";")){const at=part.indexOf("=");if(at<1)continue;const key=part.slice(0,at).trim();try{result[key]=decodeURIComponent(part.slice(at+1).trim());}catch{result[key]=part.slice(at+1).trim();}}return result;}
async function readJson(request,limit=20_000){let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>limit)throw Object.assign(new Error("Żądanie jest zbyt duże."),{code:"REQUEST_TOO_LARGE",status:413});}try{return JSON.parse(raw||"{}");}catch{throw Object.assign(new Error("Nieprawidłowe dane."),{code:"INVALID_JSON",status:400});}}
function forbidden(message="Brak uprawnień."){return Object.assign(new Error(message),{code:"FORBIDDEN",status:403});}
function json(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));return true;}
function html(response,status,body){response.writeHead(status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});response.end(body);return true;}
function javascript(response,status,body){response.writeHead(status,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});response.end(body);return true;}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function panelHtml(){return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel bezpieczeństwa — Gracz.pl</title></head><body style="margin:0;background:#071015;color:#eef6f2;font-family:Arial,sans-serif"><main style="max-width:900px;margin:0 auto;padding:36px 22px"><h1>Gracz.pl — panel bezpieczeństwa</h1><p id="identity">Ładowanie…</p><section style="padding:20px;border:1px solid #28483c;border-radius:12px;margin:20px 0"><h2>MFA administratora</h2><button id="mfa-setup">Rozpocznij konfigurację TOTP</button><pre id="mfa-setup-result" style="white-space:pre-wrap"></pre><input id="mfa-code" inputmode="numeric" maxlength="6" placeholder="6-cyfrowy kod"><button id="mfa-enable">Włącz MFA</button></section><section style="padding:20px;border:1px solid #28483c;border-radius:12px"><h2>Role użytkowników</h2><p>Zmiana roli wymaga kodu MFA.</p><input id="target-user" placeholder="login użytkownika"><select id="target-role"><option>player</option><option>moderator</option><option>administrator</option><option>owner</option></select><input id="admin-mfa" inputmode="numeric" maxlength="6" placeholder="kod MFA"><button id="role-save">Zapisz rolę</button><pre id="role-result" style="white-space:pre-wrap"></pre></section><p><a href="/" style="color:#48e78c">Powrót do Gracz.pl</a></p></main><script src="/admin/security/panel.js" defer></script></body></html>`;}
function errorHtml(message){return `<!doctype html><html lang="pl"><meta charset="utf-8"><body style="margin:0;background:#071015;color:#eef6f2;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh"><main><h1>Gracz.pl</h1><p>${escapeHtml(message)}</p><a style="color:#48e78c" href="/">Powrót</a></main></body></html>`;}
function panelJs(){return `(()=>{const $=s=>document.querySelector(s);async function api(path,opts={}){const r=await fetch(path,{credentials:'same-origin',...opts,headers:{accept:'application/json',...(opts.headers||{})}});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error?.message||'Błąd operacji');return x;}async function boot(){try{const x=await api('/admin/security/me');$('#identity').textContent=x.user.displayName+' · rola: '+x.user.role+' · MFA: '+(x.user.mfaEnabled?'włączone':'niewłączone');}catch(e){$('#identity').textContent=e.message;}}$('#mfa-setup')?.addEventListener('click',async()=>{try{const x=await api('/admin/security/mfa/setup',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});$('#mfa-setup-result').textContent='Sekret TOTP: '+x.secret+'\nURI: '+x.uri;}catch(e){$('#mfa-setup-result').textContent=e.message;}});$('#mfa-enable')?.addEventListener('click',async()=>{try{await api('/admin/security/mfa/enable',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:$('#mfa-code').value})});$('#mfa-setup-result').textContent='MFA zostało włączone.';boot();}catch(e){$('#mfa-setup-result').textContent=e.message;}});$('#role-save')?.addEventListener('click',async()=>{try{const x=await api('/admin/security/roles',{method:'POST',headers:{'content-type':'application/json','x-gracz-mfa-code':$('#admin-mfa').value},body:JSON.stringify({userId:$('#target-user').value,role:$('#target-role').value})});$('#role-result').textContent=JSON.stringify(x,null,2);}catch(e){$('#role-result').textContent=e.message;}});boot();})();`;}
