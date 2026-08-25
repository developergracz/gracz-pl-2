import test from "node:test";
import assert from "node:assert/strict";
import { withNewsletterLifecycleAnalytics } from "../src/newsletter-analytics-wrapper.js";

function fakeService() {
  const hash = value => Buffer.from(`hash:${value}`);
  return {
    tokens:{ hash },
    normalize(value){ return String(value).trim().toLowerCase(); },
    normalizeNick(value){ return { value:value || null, normalized:value ? String(value).toLowerCase() : null }; },
    nicknameAvailable:async()=>({available:true}),
    position:async()=>({position:1}),
    subscribe:async()=>({ok:true,pendingConfirmation:true}),
    resendConfirmation:async()=>({ok:true}),
    confirm:async()=>({ok:true}),
    unsubscribeByToken:async()=>({ok:true}),
  };
}

function fakeRecorder() {
  const calls=[];
  return {
    calls,
    captureSubscribe:async email=>calls.push(["subscribe",email]),
    captureResend:async email=>calls.push(["resend",email]),
    findConfirmationContext:async hash=>{calls.push(["find-confirm",hash.toString()]);return{id:11};},
    captureConfirmed:async id=>calls.push(["confirmed",id]),
    findUnsubscribeContext:async hash=>{calls.push(["find-unsubscribe",hash.toString()]);return{id:11};},
    captureUnsubscribed:async id=>calls.push(["unsubscribed",id]),
  };
}

test("records valid subscribe and resend lifecycle without changing public responses",async()=>{
  const service=fakeService(),recorder=fakeRecorder();
  const wrapped=withNewsletterLifecycleAnalytics(service,recorder);
  assert.deepEqual(await wrapped.subscribe({email:" USER@Example.com "}),{ok:true,pendingConfirmation:true});
  assert.deepEqual(await wrapped.resendConfirmation(" USER@Example.com "),{ok:true});
  assert.deepEqual(recorder.calls,[
    ["subscribe","user@example.com"],
    ["resend","user@example.com"],
  ]);
});

test("records confirmation only after core confirmation succeeds",async()=>{
  const service=fakeService(),recorder=fakeRecorder();
  const wrapped=withNewsletterLifecycleAnalytics(service,recorder);
  assert.deepEqual(await wrapped.confirm("secret-token"),{ok:true});
  assert.deepEqual(recorder.calls,[
    ["find-confirm","hash:secret-token"],
    ["confirmed",11],
  ]);
});

test("records unsubscribe only for a token resolved before core clears it",async()=>{
  const service=fakeService(),recorder=fakeRecorder();
  const wrapped=withNewsletterLifecycleAnalytics(service,recorder);
  assert.deepEqual(await wrapped.unsubscribeByToken("unsubscribe-token"),{ok:true});
  assert.deepEqual(recorder.calls,[
    ["find-unsubscribe","hash:unsubscribe-token"],
    ["unsubscribed",11],
  ]);
});

test("analytics failures fail open and never alter newsletter result",async()=>{
  const service=fakeService();
  const recorder={captureSubscribe:async()=>{throw Object.assign(new Error("db failed"),{code:"DB_DOWN"});}};
  const original=console.error;console.error=()=>{};
  try{
    const wrapped=withNewsletterLifecycleAnalytics(service,recorder);
    assert.deepEqual(await wrapped.subscribe({email:"user@example.com"}),{ok:true,pendingConfirmation:true});
  }finally{console.error=original;}
});

test("non-overridden service methods remain bound to the original service",async()=>{
  const service=fakeService(),recorder=fakeRecorder();
  const wrapped=withNewsletterLifecycleAnalytics(service,recorder);
  assert.deepEqual(await wrapped.nicknameAvailable("Player"),{available:true});
  assert.deepEqual(await wrapped.position("token"),{position:1});
});
