import test from "node:test";
import assert from "node:assert/strict";
import {PAGE_URLS} from "./performance-observer.mjs";
import {sampleTargets,diagnoseMeasurement,evaluateFreeReport,runFreeCycle,formatSummary} from "./performance-free-guardian.mjs";

const available=(url,strategy,lcpMs,tbtMs=8,cls=0)=>
  ({url,strategy,state:"available",lcpMs,tbtMs,cls,score:95,source:"Lighthouse local Chrome lab"});

test("R3 samples fixed site URLs only, with mobile and desktop homepage",()=>{
  const targets=sampleTargets(0);
  assert.deepEqual(targets.slice(0,2),[
    {url:"https://gracz.pl/",strategy:"mobile"},
    {url:"https://gracz.pl/",strategy:"desktop"}
  ]);
  assert.ok(PAGE_URLS.slice(1).includes(targets[2].url));
  assert.equal(targets[2].strategy,"mobile");
  assert.notEqual(sampleTargets(0)[2].url,sampleTargets(21600000)[2].url);
});
test("R3 never calls external AI or PageSpeed; only injected local runner",async()=>{
  const received=[];
  const result=await runFreeCycle({tick:0,runner:async(url,strategy)=>{
    received.push([url,strategy]);
    return available(url,strategy,1400);
  }});
  assert.equal(received.length,3);
  assert.equal(result.paidAiUsed,false);
  assert.equal(result.kind,"local_lighthouse_lab");
  assert.equal(result.state,"good");
  assert.equal(result.assessments.every(a=>a.state==="good"),true);
});
test("high LCP results suggest investigation, not invented root causes or destructive writes",async()=>{
  const reports=[
    available(PAGE_URLS[0],"mobile",3220,302,.13),
    available(PAGE_URLS[0],"desktop",520),
    available(PAGE_URLS[1],"mobile",3400)
  ];
  const r=evaluateFreeReport(reports,"2026-10-25T00:00:00.000Z");
  assert.equal(r.state,"attention");
  assert.equal(r.assessments[0].state,"attention");
  assert.match(r.diagnostic[0].finding,/przyczyna nie jest jeszcze potwierdzona/);
  assert.equal(r.diagnostic[0].checks.length,3);
  assert.match(formatSummary(r),/3220 ms/);
  assert.match(formatSummary(r),/Brak wywołań OpenAI API/);
});
test("unknown results stay unknown and runner errors do not trigger fictitious repair",async()=>{
  const r=await runFreeCycle({runner:async()=>{throw Error("Chrome absent");},tick:0});
  assert.equal(r.state,"incomplete");
  assert.equal(r.reports.every(x=>x.state==="unavailable"),true);
  assert.equal(r.diagnostic.every(x=>x.state==="unknown"),true);
  assert.equal(r.assessments.every(x=>x.state==="unknown"),true);
});
test("out-of-scope telemetry is refused, only trusted site can enter diagnostics",()=>{
  assert.throws(()=>evaluateFreeReport([available("https://unrelated.example/","mobile",2000)]),/scope/);
  assert.throws(()=>evaluateFreeReport([available(PAGE_URLS[0],"tablet",2000)]),/scope/);
  assert.equal(diagnoseMeasurement({state:"unavailable",reason:"Chrome unavailable"}).state,"unknown");
});
