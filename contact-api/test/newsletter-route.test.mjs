import test from "node:test";
import assert from "node:assert/strict";
import { createNewsletterRoute } from "../routes/newsletter-route.mjs";

function setup(newsletter, body) {
  return createNewsletterRoute({
    allowedOrigins: new Set(["https://gracz.pl"]), newsletter,
    newsletterIpBuckets: new Map(), newsletterEmailBuckets: new Map(),
    rateLimit() {}, hashValue: value => value, clientIp: () => "127.0.0.1",
    readJson: async () => body, json: (_res, status, body) => ({ status, body }),
    setCors() {}, bad(message, code) { throw Object.assign(new Error(message), {code}); },
    normalizeEmail: value => value.toLowerCase(), requiredString: value => value,
    optionalString: value => value || "", parseStartedAt: () => 0,
    isValidEmailSyntax: value => value.includes("@"), enforceFormTiming() {},
    validateEmailDomain: async () => {}, logger: { log() {} },
  });
}
const req = { method: "POST", headers: {origin: "https://gracz.pl"} };
const url = new URL("https://test/newsletter/subscribe");
test("B1 public success is neutral including honeypot", async () => {
  for (const state of ["new", "pending", "active", "suppressed"]) {
    const manager = { enabled: true, async requestOptIn() { return {state}; } };
    for (const website of ["", "bot"]) {
      const result = await setup(manager, {email:"test@example.test", consent:true, website})(req, {}, url, "test");
      assert.deepEqual(result, {status:200, body:{ok:true, state:"request_received"}});
    }
  }
});
test("B1 public contract preserves validation and actual provider failure", async () => {
  const failure = Object.assign(new Error("provider unavailable"), {status:502});
  const manager = {enabled:true, async requestOptIn() {throw failure;}};
  await assert.rejects(() => setup(manager, {email:"test@example.test", consent:false})(req, {}, url, "test"), {code:"NEWSLETTER_CONSENT_REQUIRED"});
  await assert.rejects(() => setup(manager, {email:"test@example.test", consent:true})(req, {}, url, "test"), error => error === failure);
});

test("public duplicate response is specific only for confirmed active records", async () => {
  const manager={enabled:true,async requestOptIn(){return {state:"already_subscribed"};}};
  const live=await setup(manager,{email:"known@example.test",consent:true,website:""})(req,{},url,"live");
  assert.deepEqual(live,{status:200,body:{ok:true,state:"already_subscribed"}});
  const honeypot=await setup(manager,{email:"known@example.test",consent:true,website:"bot"})(req,{},url,"bot");
  assert.deepEqual(honeypot,{status:200,body:{ok:true,state:"request_received"}});
  const statusRequest=await setup({enabled:true,async requestOptIn(){return {state:"already_subscribed"};},
    async acceptStatus(){return {state:"request_received"};}},{email:"known@example.test",website:""})(
      req,{},new URL("https://test/newsletter/status-request"),"status");
  assert.deepEqual(statusRequest,{status:200,body:{ok:true,state:"request_received"}});
});

test('status rate observer includes quota exhaustion and rejected 429, not opt-in',async()=>{
  const store=new Map(),seen=[];
  const rateLimit=(map,key,_window,max)=>{
    if(key.startsWith('status:')){
      const data=map.get(key)||{startedAt:1,count:0};
      data.count++;map.set(key,data);
      if(data.count>max)throw Object.assign(new Error('limited'),{code:'RATE_LIMITED',status:429});
    }
  };
  const route=createNewsletterRoute({
    allowedOrigins:new Set(['https://gracz.pl']),
    newsletter:{enabled:true,async requestOptIn(){return {state:'new'};},
      async acceptStatus(){return {state:'request_received'};}},
    newsletterIpBuckets:new Map(),newsletterEmailBuckets:store,rateLimit,
    statusLimitObserver:email=>seen.push(store.get('status:'+email)?.count),
    hashValue:v=>v,clientIp:()=> '127.0.0.1',readJson:async()=>({email:'a@example.com'}),
    json:(_r,status,body)=>({status,body}),setCors(){},
    normalizeEmail:v=>v,requiredString:v=>v,optionalString:()=>'',parseStartedAt:()=>0,
    isValidEmailSyntax:()=>true,validateEmailDomain:async()=>{},logger:{log(){}}
  });
  const endpoint=new URL('https://test.invalid/newsletter/status-request');
  for(let i=0;i<4;i++)assert.equal((await route(req,{},endpoint,'x')).status,200);
  await assert.rejects(()=>route(req,{},endpoint,'x'),{status:429});
  assert.deepEqual(seen,[1,2,3,4,5]);
});
