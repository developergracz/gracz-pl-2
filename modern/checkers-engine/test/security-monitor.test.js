import test from "node:test";
import assert from "node:assert/strict";
import { SecurityMonitor } from "../src/security-monitor.js";

test("newsletter alert fingerprints the source and never sends the raw IP",async()=>{
  const calls=[],records=[];
  const monitor=new SecurityMonitor({
    audit:{record:async value=>records.push(value)},
    fetchImpl:async(_url,init)=>{calls.push(JSON.parse(init.body));return{ok:true};},
    alertWebhook:"https://alerts.example.invalid/hook",
    hashSalt:"test-only-salt",
  });
  for(let i=0;i<5;i++)await monitor.observeNewsletter({event:"honeypot",source:"203.0.113.77"});
  assert.equal(calls.length,1);
  assert.equal(records.length,1);
  const serialized=JSON.stringify(calls[0]);
  assert.equal(serialized.includes("203.0.113.77"),false);
  assert.match(calls[0].metadata.sourceId,/^[a-f0-9]{16}$/);
  assert.equal(calls[0].kind,"newsletter-honeypot-spike");
});

test("newsletter alert cooldown is scoped per fingerprint",async()=>{
  const calls=[];
  const monitor=new SecurityMonitor({fetchImpl:async(_url,init)=>{calls.push(JSON.parse(init.body));return{ok:true};},alertWebhook:"https://alerts.example.invalid/hook",hashSalt:"test-only-salt"});
  for(let i=0;i<5;i++)await monitor.observeNewsletter({event:"fast-submit",source:"198.51.100.1"});
  for(let i=0;i<5;i++)await monitor.observeNewsletter({event:"fast-submit",source:"198.51.100.2"});
  assert.equal(calls.length,2);
  assert.notEqual(calls[0].metadata.sourceId,calls[1].metadata.sourceId);
});
