const SESSION_COOKIE="__Host-gracz_session";

export function createAdminSecurityHandler({auth,authSessions,rbac,mfa,audit,security}){
  if(!auth||!rbac||!mfa||!security)throw new TypeError("Admin security dependencies are required.");
  return async function adminSecurityHandler(request,response){const url=new URL(request.url,"http://localhost");if(!url.pathname.startsWith("/admin/security/"))return false;try{security.assertSameOrigin(request);const user=await trustedUser(request,auth,authSessions);const role=await rbac.getRole(user.userId);if(role==="player")throw forbidden("Panel administracyjny nie jest dostępny dla kont graczy.");
    security.limit(request,"admin-security",user.userId,{limit:40,windowMs:60_000});
    if(request.method==="GET"&&url.pathname==="/admin/security/me")return json(response,200,{user:{userId:user.userId,displayName:user.displayName,role,mfaEnabled:await mfa.isEnabled(user.userId)}});
    if(request.method==="POST"&&url.pathname==="/admin/security/mfa/setup"){await rbac.require(user.userId,"admin.settings").catch(async()=>{if(role!=="moderator")throw forbidden();});const setup=await mfa.begin(user.userId);await audit?.record({actorId:user.userId,eventType:"mfa.setup.started",source:security.source(request),userAgent:request.headers["user-agent"]});return json(response,200,setup);}
    if(request.method==="POST"&&url.pathname==="/admin/security/mfa/enable"){const body=await readJson(request);await mfa.enable(user.userId,body.code);return json(response,200,{ok:true});}
    await requirePrivilegedMfa(user.userId,request,mfa);
    if(request.method==="POST"&&url.pathname==="/admin/security/roles"){await rbac.require(user.userId,"admin.users");const body=await readJson(request);const result=await rbac.setRole({actorId:user.userId,targetId:body.userId,role:body.role,actorMfaVerified:true});await audit?.record({actorId:user.userId,eventType:"admin.role.changed",targetType:"account",targetId:body.userId,source:security.source(request),userAgent:request.headers["user-agent"],metadata:{newRole:body.role}});return json(response,200,result);}
    if(request.method==="GET"&&url.pathname==="/admin/security/audit-health"){await rbac.require(user.userId,"admin.audit");return json(response,200,{ok:true,audit:"enabled",mfa:"required",role});}
    return json(response,404,{error:{code:"NOT_FOUND",message:"Nie znaleziono operacji administracyjnej."}});
  }catch(error){await audit?.record({eventType:"admin.access",outcome:"failure",source:security.source(request),userAgent:request.headers["user-agent"],metadata:{code:error.code||"ADMIN_ERROR",path:url.pathname}}).catch(()=>{});return json(response,error.status||403,{error:{code:error.code||"FORBIDDEN",message:error.message||"Brak uprawnień."}});}};
}

async function requirePrivilegedMfa(userId,request,mfa){if(!await mfa.isEnabled(userId))throw Object.assign(new Error("Konto uprzywilejowane musi mieć włączone MFA."),{code:"MFA_REQUIRED",status:403});const code=String(request.headers["x-gracz-mfa-code"]||"");await mfa.verify(userId,code);}
async function trustedUser(request,auth,authSessions){const token=cookies(request)[SESSION_COOKIE];if(!token)throw Object.assign(new Error("Wymagane jest logowanie."),{code:"UNAUTHENTICATED",status:401});const user=auth.verify(token);if(authSessions&&user.tokenId)await authSessions.assertActive(user);return user;}
function cookies(request){const result={};for(const part of String(request.headers.cookie||"").split(";")){const at=part.indexOf("=");if(at<1)continue;const key=part.slice(0,at).trim();try{result[key]=decodeURIComponent(part.slice(at+1).trim());}catch{result[key]=part.slice(at+1).trim();}}return result;}
async function readJson(request,limit=20_000){let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>limit)throw Object.assign(new Error("Żądanie jest zbyt duże."),{code:"REQUEST_TOO_LARGE",status:413});}try{return JSON.parse(raw||"{}");}catch{throw Object.assign(new Error("Nieprawidłowe dane."),{code:"INVALID_JSON",status:400});}}
function forbidden(message="Brak uprawnień."){return Object.assign(new Error(message),{code:"FORBIDDEN",status:403});}
function json(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));return true;}
