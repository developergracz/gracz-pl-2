import test from "node:test";
import assert from "node:assert/strict";
import { RbacService } from "../src/rbac-service.js";
import { NewsletterAdminService, maskEmail, parseSubscriberSearch } from "../src/newsletter-admin-service.js";
import { createNewsletterAdminHandler } from "../src/newsletter-admin-handler.js";

function response(){return{status:null,headers:{},body:"",writeHead(status,headers={}){this.status=status;this.headers=headers;},end(value){this.body=String(value||"");}};}
function request(url,{headers={},method="GET"}={}){return{method,url,headers:{cookie:"__Host-gracz_session=fake",host:"gracz.pl","sec-fetch-site":"same-origin",...headers},socket:{remoteAddress:"127.0.0.1"}};}
function baseDeps({permissions=new Set(["newsletter.read"]),mfaCode="123456"}={}){
  const calls=[];
  const service={
    dashboard:async()=>({totals:{subscribed:1,pending:0,unsubscribed:0},newToday:1,newLastHour:1,recentEvents:[]}),
    listSubscribers:async()=>({page:1,pageSize:50,total:1,items:[{id:1,maskedEmail:"cz***@example.com"}]}),
    subscriber:async()=>({subscriber:{id:1,maskedEmail:"cz***@example.com"},sources:[],consentHistory:[],events:[]}),
    revealEmail:async()=>({email:"czeslaw@example.com"}),
    stats:async()=>({groupBy:"day",items:[]}),
    securityEvents:async()=>({items:[]}),
  };
  return{
    service,
    auth:{verify:()=>({userId:"admin",displayName:"Admin",tokenId:"t1"})},
    authSessions:{assertActive:async()=>true},
    rbac:{require:async(_user,permission)=>{if(!permissions.has(permission))throw Object.assign(new Error("Brak uprawnień."),{code:"FORBIDDEN",status:403});}},
    mfa:{isEnabled:async()=>true,verify:async(_user,code)=>{if(code!==mfaCode)throw new Error("bad mfa");}},
    audit:{record:async(event)=>{calls.push(event);return event;}},
    security:{assertSameOrigin:()=>true,limit:()=>true,source:()=>"127.0.0.1"},
    calls,
  };
}

test("maskEmail never returns the full address",()=>{
  assert.equal(maskEmail("czeslaw@example.com"),"cz***@example.com");
  assert.equal(maskEmail("a@example.com"),"a***@example.com");
  assert.equal(maskEmail("invalid"),"***");
});

test("subscriber search accepts nick or masked email but rejects a full email",()=>{
  assert.deepEqual(parseSubscriberSearch("Victorio"),{kind:"nick",value:"victorio"});
  assert.deepEqual(parseSubscriberSearch("cz***@gmail.com"),{kind:"maskedEmail",prefix:"cz",domain:"gmail.com"});
  assert.throws(()=>parseSubscriberSearch("czeslaw@gmail.com"),error=>error.code==="INVALID_REQUEST"&&error.status===400);
  assert.throws(()=>parseSubscriberSearch("cz**@gmail.com"),error=>error.code==="INVALID_REQUEST"&&error.status===400);
});

test("RBAC grants newsletter read/security to moderator, all newsletter permissions to administrator",async()=>{
  const rbac=new RbacService(null);
  rbac.memory.set("mod","moderator");
  rbac.memory.set("admin","administrator");
  rbac.memory.set("player","player");
  assert.equal(await rbac.can("mod","newsletter.read"),true);
  assert.equal(await rbac.can("mod","newsletter.security.read"),true);
  assert.equal(await rbac.can("mod","newsletter.email.reveal"),false);
  assert.equal(await rbac.can("admin","newsletter.manage"),true);
  assert.equal(await rbac.can("admin","newsletter.email.reveal"),true);
  assert.equal(await rbac.can("player","newsletter.read"),false);
});

test("newsletter admin rejects missing session with 401",async()=>{
  const deps=baseDeps();
  const handler=createNewsletterAdminHandler(deps);
  const req=request("/admin/newsletter/dashboard");req.headers.cookie="";
  const res=response();await handler(req,res);
  assert.equal(res.status,401);
  assert.equal(JSON.parse(res.body).error.code,"UNAUTHENTICATED");
});

test("newsletter admin rejects missing permission with 403",async()=>{
  const deps=baseDeps({permissions:new Set()});
  const handler=createNewsletterAdminHandler(deps);
  const res=response();await handler(request("/admin/newsletter/dashboard"),res);
  assert.equal(res.status,403);
});

test("full email requires newsletter.email.reveal",async()=>{
  const deps=baseDeps({permissions:new Set(["newsletter.read"])});
  const handler=createNewsletterAdminHandler(deps);
  const res=response();await handler(request("/admin/newsletter/subscribers/1/email",{headers:{"x-gracz-mfa-code":"123456"}}),res);
  assert.equal(res.status,403);
});

test("full email requires a valid six digit MFA code",async()=>{
  const deps=baseDeps({permissions:new Set(["newsletter.email.reveal"])});
  const handler=createNewsletterAdminHandler(deps);
  const noCode=response();await handler(request("/admin/newsletter/subscribers/1/email"),noCode);
  assert.equal(noCode.status,403);
  assert.equal(JSON.parse(noCode.body).error.code,"MFA_REQUIRED");
  const wrong=response();await handler(request("/admin/newsletter/subscribers/1/email",{headers:{"x-gracz-mfa-code":"654321"}}),wrong);
  assert.equal(wrong.status,403);
  assert.equal(JSON.parse(wrong.body).error.code,"MFA_INVALID");
});

test("authorized email reveal returns full email and is audited",async()=>{
  const deps=baseDeps({permissions:new Set(["newsletter.email.reveal"])});
  const handler=createNewsletterAdminHandler(deps);
  const res=response();await handler(request("/admin/newsletter/subscribers/1/email",{headers:{"x-gracz-mfa-code":"123456"}}),res);
  assert.equal(res.status,200);
  assert.equal(JSON.parse(res.body).email,"czeslaw@example.com");
  assert.ok(deps.calls.some(x=>x.eventType==="newsletter.admin.email.reveal"&&x.targetId==="1"));
  assert.ok(!JSON.stringify(deps.calls).includes("czeslaw@example.com"));
});

test("subscriber list only returns masked email from service contract",async()=>{
  const deps=baseDeps();
  const handler=createNewsletterAdminHandler(deps);
  const res=response();await handler(request("/admin/newsletter/subscribers"),res);
  assert.equal(res.status,200);
  const body=JSON.parse(res.body);
  assert.equal(body.items[0].maskedEmail,"cz***@example.com");
  assert.equal("email" in body.items[0],false);
});

test("NewsletterAdminService without PostgreSQL fails closed",async()=>{
  const service=new NewsletterAdminService(null);
  await assert.rejects(service.dashboard(),error=>error.code==="DATABASE_REQUIRED"&&error.status===503);
});
