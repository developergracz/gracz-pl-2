import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {eligibleForFallback,parseLighthouse,localLighthouse,supplement} from "./performance-lighthouse-fallback.mjs";
const missing=(url,strategy)=>({url,strategy,state:"unavailable",reason:"rate_limited"});
const HOME="https://gracz.pl/",SUB="https://gracz.pl/gry/";
test("only fixed public URLs and quota failures qualify",()=>{
 assert.equal(eligibleForFallback(missing(HOME,"mobile")),true);
 assert.equal(eligibleForFallback({...missing(HOME,"mobile"),url:"https://other.test/"}),false);
 assert.equal(eligibleForFallback({...missing(HOME,"mobile"),reason:"network_or_timeout"}),false);
});
test("only mobile reports get bounded fallback, provider original remains unknown when fallback fails",async()=>{
 const report={reports:[missing(HOME,"mobile"),missing(HOME,"desktop"),missing(SUB,"mobile")]};
 let n=0;
 const out=await supplement(report,{runner:async(url,strategy)=>{
   n++;return {url,strategy,state:"available",lcpMs:1200,score:95,source:"Lighthouse local Chrome lab"};
 }});
 assert.equal(n,2);
 assert.equal(out.localFallbackRuns,2);
 assert.deepEqual(out.assessments.map(x=>x.state),["good","unknown","good"]);
 const none=await supplement(report,{runner:async()=>({state:"unavailable",reason:"local_lighthouse_failed"})});
 assert.equal(none.assessments[0].state,"unknown");
});
test("invalid Lighthouse report never invents LCP",()=>{
 const invalid=parseLighthouse({audits:{}},HOME,"mobile");
 assert.equal(invalid.state,"unavailable");
 assert.equal(invalid.lcpMs,undefined);
 const good=parseLighthouse({categories:{performance:{score:.92}},audits:{
   "largest-contentful-paint":{numericValue:1800.4},"total-blocking-time":{numericValue:10}
 }},HOME,"mobile");
 assert.equal(good.lcpMs,1800);
 assert.equal(good.score,92);
});
test("CLI runner remains scoped and does not execute on arbitrary URLs",async()=>{
 const blocked=await localLighthouse("https://evil.invalid/","mobile",{execute:async()=>{throw Error("unexpected exec")}});
 assert.equal(blocked.state,"invalid_scope");
 const report=await localLighthouse(HOME,"mobile",{execute:async(command,args)=>{
   assert.equal(command,"npx");
   assert.equal(args[1],"lighthouse@12.8.2");
   const output=args.find(x=>x.startsWith("--output-path=")).split("=")[1];
   fs.writeFileSync(output,JSON.stringify({categories:{performance:{score:.9}},audits:{"largest-contentful-paint":{numericValue:1600}}}));
 }});
 assert.equal(report.state,"available");
 assert.equal(report.lcpMs,1600);
});


test("LCP attribution reports only bounded node selector and timing fields",()=>{
 const a=parseLighthouse({
  categories:{performance:{score:.91}},
  audits:{
    "largest-contentful-paint":{numericValue:3100},
    "first-contentful-paint":{numericValue:1400},
    "server-response-time":{numericValue:202},
    "largest-contentful-paint-element":{
      details:{items:[{node:{selector:".home-hero-premium__title",nodeLabel:"Graj. Ucz się."}}]}
    }
  }
 },"https://gracz.pl/","mobile");
 assert.equal(a.lcpEvidence.element.selector,".home-hero-premium__title");
 assert.equal(a.lcpEvidence.element.description,"Graj. Ucz się.");
 assert.equal(a.lcpEvidence.timings.fcpMs,1400);
 assert.equal(a.lcpEvidence.timings.ttfbMs,202);
 assert.ok(a.lcpEvidence.insightsAvailable.includes("largest-contentful-paint-element"));
});
test("unavailable LCP element audit is reported as unknown without guessing",()=>{
 const a=parseLighthouse({categories:{performance:{score:.95}},audits:{
  "largest-contentful-paint":{numericValue:1800}
 }},"https://gracz.pl/","desktop");
 assert.equal(a.lcpEvidence.element,null);
 assert.deepEqual(a.lcpEvidence.insightsAvailable,[]);
});
