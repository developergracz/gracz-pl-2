const SESSION_COOKIE="__Host-gracz_session";

export function createNewsletterAdminHandler({service,auth,authSessions,rbac,mfa,audit,security}){
  if(!service||!auth||!rbac||!mfa||!security)throw new TypeError("Newsletter admin dependencies are required.");
  return async function newsletterAdminHandler(request,response){
    const url=new URL(request.url,"http://localhost");
    if(!url.pathname.startsWith("/admin/newsletter"))return false;
    try{
      security.assertSameOrigin(request);
      const user=await trustedUser(request,auth,authSessions);
      security.limit(request,"admin-newsletter",user.userId,{limit:120,windowMs:60_000});

      if(request.method==="GET"&&url.pathname==="/admin/newsletter/dashboard"){
        await rbac.require(user.userId,"newsletter.read");
        const result=await service.dashboard();
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.dashboard.view",request,security});
        return json(response,200,result);
      }

      if(request.method==="GET"&&url.pathname==="/admin/newsletter/subscribers"){
        await rbac.require(user.userId,"newsletter.read");
        const result=await service.listSubscribers(Object.fromEntries(url.searchParams.entries()));
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.subscribers.list",request,security,metadata:{page:result.page,pageSize:result.pageSize}});
        return json(response,200,result);
      }

      const emailMatch=url.pathname.match(/^\/admin\/newsletter\/subscribers\/(\d+)\/email$/);
      if(request.method==="GET"&&emailMatch){
        await rbac.require(user.userId,"newsletter.email.reveal");
        await requirePrivilegedMfa(user.userId,request,mfa);
        security.limit(request,"admin-newsletter-email",user.userId,{limit:20,windowMs:10*60_000});
        const result=await service.revealEmail(emailMatch[1]);
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.email.reveal",request,security,targetType:"newsletter_subscriber",targetId:String(emailMatch[1])});
        return json(response,200,result);
      }

      const subscriberMatch=url.pathname.match(/^\/admin\/newsletter\/subscribers\/(\d+)$/);
      if(request.method==="GET"&&subscriberMatch){
        await rbac.require(user.userId,"newsletter.read");
        const result=await service.subscriber(subscriberMatch[1]);
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.subscriber.view",request,security,targetType:"newsletter_subscriber",targetId:String(subscriberMatch[1])});
        return json(response,200,result);
      }

      if(request.method==="GET"&&url.pathname==="/admin/newsletter/stats"){
        await rbac.require(user.userId,"newsletter.read");
        const result=await service.stats(Object.fromEntries(url.searchParams.entries()));
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.stats.view",request,security,metadata:{groupBy:result.groupBy}});
        return json(response,200,result);
      }

      if(request.method==="GET"&&url.pathname==="/admin/newsletter/security/events"){
        await rbac.require(user.userId,"newsletter.security.read");
        const result=await service.securityEvents({limit:url.searchParams.get("limit")||100});
        await record(audit,{actorId:user.userId,eventType:"newsletter.admin.security.view",request,security});
        return json(response,200,result);
      }

      return json(response,404,{error:{code:"NOT_FOUND",message:"Nie znaleziono operacji administracyjnej newslettera."}});
    }catch(error){
      await record(audit,{eventType:"newsletter.admin.access",outcome:"failure",request,security,metadata:{code:error?.code||"NEWSLETTER_ADMIN_ERROR",path:url.pathname}}).catch(()=>{});
      return json(response,error?.status||500,{error:{code:error?.code||"INTERNAL_ERROR",message:error?.status&&error.status<500?error.message:"Wewnętrzny błąd aplikacji."}});
    }
  };
}

async function trustedUser(request,auth,authSessions){
  const token=cookies(request)[SESSION_COOKIE];
  if(!token)throw Object.assign(new Error("Wymagane jest logowanie."),{code:"UNAUTHENTICATED",status:401});
  const user=auth.verify(token);
  if(authSessions&&user.tokenId)await authSessions.assertActive(user);
  return user;
}

async function requirePrivilegedMfa(userId,request,mfa){
  if(!await mfa.isEnabled(userId))throw Object.assign(new Error("Konto uprzywilejowane musi mieć włączone MFA."),{code:"MFA_REQUIRED",status:403});
  const code=String(request.headers["x-gracz-mfa-code"]||"");
  if(!/^\d{6}$/.test(code))throw Object.assign(new Error("Wymagany jest 6-cyfrowy kod MFA."),{code:"MFA_REQUIRED",status:403});
  try{await mfa.verify(userId,code);}catch{throw Object.assign(new Error("Nieprawidłowy kod MFA."),{code:"MFA_INVALID",status:403});}
}

async function record(audit,{actorId=null,eventType,outcome="success",request,security,targetType=null,targetId=null,metadata={}}){
  if(!audit)return;
  return audit.record({actorId,eventType,outcome,targetType,targetId,source:security.source(request),userAgent:request.headers["user-agent"],metadata});
}

function cookies(request){
  const result={};
  for(const part of String(request.headers.cookie||"").split(";")){
    const at=part.indexOf("=");if(at<1)continue;
    const key=part.slice(0,at).trim();
    try{result[key]=decodeURIComponent(part.slice(at+1).trim());}catch{result[key]=part.slice(at+1).trim();}
  }
  return result;
}

function json(response,status,body){
  response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  response.end(JSON.stringify(body));
  return true;
}
