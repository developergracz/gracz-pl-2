import test from "node:test";
import assert from "node:assert/strict";
import { NewsletterService, createNewsletterHandler } from "../src/newsletter.js";
import { SecurityService, RateLimitError } from "../src/security-service.js";

function request(body,{headers={},method="POST",url="/newsletter/subscribe"}={}){
  const raw=typeof body==="string"?body:JSON.stringify(body);
  return{method,url,headers:{host:"gracz.pl",origin:"https://gracz.pl","sec-fetch-site":"same-origin",...headers},socket:{remoteAddress:"203.0.113.9"},async *[Symbol.asyncIterator](){yield raw;}};
}
function response(){return{status:null,headers:{},body:"",setHeader(k,v){this.headers[String(k).toLowerCase()]=String(v);},writeHead(status,headers={}){this.status=status;for(const[k,v]of Object.entries(headers))this.headers[String(k).toLowerCase()]=String(v);},end(value){this.body=String(value||"");}};}
function service(){return new NewsletterService(null,{mail:{send:async()=>({sent:true})},baseUrl:"https://gracz.pl"});}

test("stage 5: cross-site newsletter mutation is blocked",async()=>{
  const svc=service(),security=new SecurityService(),handler=createNewsletterHandler(svc,{security}),res=response();
  await handler(request({email:"user@example.com",consent:true,legal:true},{headers:{origin:"https://evil.example","sec-fetch-site":"cross-site"}}),res);
  assert.equal(res.status,403);
  assert.equal(JSON.parse(res.body).error.code,"CROSS_SITE_REQUEST");
  assert.equal(svc.memory.size,0);
  await svc.close();
});

test("stage 5: malformed, manipulated and oversized JSON is rejected",async()=>{
  const svc=service(),handler=createNewsletterHandler(svc,{security:new SecurityService()});
  const malformed=response();await handler(request("{not-json"),malformed);assert.equal(malformed.status,400);assert.equal(JSON.parse(malformed.body).error.code,"INVALID_JSON");
  const manipulated=response();await handler(request({email:"user@example.com",consent:"true",legal:true}),manipulated);assert.equal(manipulated.status,400);assert.equal(JSON.parse(manipulated.body).error.code,"CONSENT_REQUIRED");
  const oversized=response();await handler(request(JSON.stringify({padding:"x".repeat(10_100)})),oversized);assert.equal(oversized.status,413);assert.equal(JSON.parse(oversized.body).error.code,"REQUEST_TOO_LARGE");
  assert.equal(svc.memory.size,0);await svc.close();
});

test("stage 5: XSS and SQL-injection-shaped nicknames never reach storage or mail",async()=>{
  const sent=[],svc=new NewsletterService(null,{mail:{send:async message=>{sent.push(message);return{sent:true};}}});
  await assert.rejects(svc.subscribe({email:"safe@example.com",preferredNick:'<img src=x onerror=alert(1)>',consent:true,legal:true}),e=>e.code==="INVALID_NICK");
  await assert.rejects(svc.subscribe({email:"safe@example.com",preferredNick:"x' OR 1=1--",consent:true,legal:true}),e=>e.code==="INVALID_NICK");
  assert.equal(svc.memory.size,0);assert.equal(sent.length,0);await svc.close();
});

test("stage 5: invalid Turnstile result blocks subscription",async()=>{
  const svc=service(),security={assertSameOrigin(){},source(){return"203.0.113.9";},normalize:null,limit(){},async verifyTurnstile(){throw Object.assign(new Error("Weryfikacja bezpieczeństwa nie powiodła się."),{code:"TURNSTILE_FAILED",status:403});}},handler=createNewsletterHandler(svc,{security}),res=response();
  await handler(request({email:"user@example.com",preferredNick:"Player_1",consent:true,legal:true,challengeToken:"invalid"}),res);
  assert.equal(res.status,403);assert.equal(JSON.parse(res.body).error.code,"TURNSTILE_FAILED");assert.equal(svc.memory.size,0);await svc.close();
});

test("stage 5: expired confirmation token cannot be used",async()=>{
  const sent=[],svc=new NewsletterService(null,{mail:{send:async message=>{sent.push(message);return{sent:true};}},baseUrl:"https://gracz.pl"});
  await svc.subscribe({email:"expired@example.com",preferredNick:"Expired_1",consent:true,legal:true});
  const token=decodeURIComponent(sent[0].text.match(/confirm\?token=([^\s]+)/)[1]);
  svc.memory.get("expired@example.com").confirmationExpiresAt=Date.now()-1;
  await assert.rejects(svc.confirm(token),e=>e.code==="TOKEN_INVALID");
  assert.equal(svc.memory.get("expired@example.com").status,"pending_confirmation");await svc.close();
});

test("stage 5: rate-limit response is audited without identity data",async()=>{
  const records=[],security={assertSameOrigin(){},source(){return"203.0.113.9";},limit(){throw new RateLimitError(90);},audit:{async record(value){records.push(value);}}};
  const svc=service(),handler=createNewsletterHandler(svc,{security}),res=response();
  await handler(request({email:"private@example.com",preferredNick:"Private_1",consent:true,legal:true}),res);
  assert.equal(res.status,429);assert.equal(res.headers["retry-after"],"90");assert.equal(records[0].eventType,"newsletter.rate_limited");
  const serialized=JSON.stringify(records[0]);assert.equal(serialized.includes("private@example.com"),false);assert.equal(serialized.includes("Private_1"),false);
  await svc.close();
});
