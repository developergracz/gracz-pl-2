import test from "node:test";
import assert from "node:assert/strict";
import {createPerformanceReader,parseGuardianLog} from "../admin-r1/performance-reader.mjs";

const repo="https://api.github.com/repos/developergracz/gracz-pl-2";
const result={state:"attention",paidAiUsed:false,reports:[
  {url:"https://gracz.pl/",strategy:"mobile",lcpMs:3100,
   lcpElement:{selector:".home-hero-premium__lead"},
   timings:{fcpMs:2100,ttfbMs:240},
   renderBlockers:[{path:"/assets/home.css",wastedMs:480},
     {path:"https://evil.example/secret",wastedMs:5}]},
  {url:"https://gracz.pl/gry/poker-treningowy/",strategy:"mobile",lcpMs:2600},
  {url:"https://other.example/",strategy:"desktop",lcpMs:4}
]};
const log='2026-10-25T20:00:00Z '+JSON.stringify(result)+"\n";
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
function mockFetch(calls){
  return async(url,options)=>{
    calls.push({url,options});
    if(url===repo+"/actions/workflows/performance-autopilot.yml/runs?branch=main&per_page=6")
      return json({workflow_runs:[{
        id:456,head_branch:"main",status:"completed",conclusion:"success",
        created_at:"2026-10-25T19:50:00Z",head_sha:"a".repeat(40)
      }]});
    if(url===repo+"/actions/runs/456/jobs?per_page=40")
      return json({jobs:[{id:987,name:"Observe LCP and self-repair only approved regressions",
        status:"completed",conclusion:"success"}]});
    if(url===repo+"/actions/jobs/987/logs")return new Response(log,{status:200});
    if(url===repo+"/actions/workflows/performance-rollback-stage.yml/runs?per_page=1")
      return json({workflow_runs:[{id:321,conclusion:"success",updated_at:"2026-10-25T19:00:00Z"}]});
    throw Error("unexpected URL "+url);
  };
}
test("a missing GitHub read token is fail-closed and does not call a provider",async()=>{
  const read=createPerformanceReader({token:"",fetcher:async()=>{throw Error("unexpected call");},now:()=>123});
  const value=await read();
  assert.equal(value.state,"needs_configuration");
  assert.equal(value.ok,false);
  assert.deepEqual(value.history,[]);
});
test("sanitizes GitHub log fields to public website measurements without secrets",()=>{
  const reports=parseGuardianLog(log);
  assert.equal(reports.length,2);
  assert.equal(reports[0].state,"attention");
  assert.equal(reports[0].element,".home-hero-premium__lead");
  assert.equal(reports[0].ttfbMs,240);
  assert.deepEqual(reports[0].blockers,[{path:"/assets/home.css",wastedMs:480}]);
  assert.equal(parseGuardianLog("not a report"),null);
});
test("loads authenticated bounded runs, logs and rollback evidence with cache",async()=>{
  const calls=[];
  const read=createPerformanceReader({token:"test-read-only-token",fetcher:mockFetch(calls),
    now:()=>Date.parse("2026-10-25T21:00:00Z")});
  const d=await read();
  assert.equal(d.state,"available");
  assert.equal(d.history.length,1);
  assert.equal(d.latest.id,456);
  assert.equal(d.latest.reports[1].lcpMs,2600);
  assert.equal(d.rollback.conclusion,"success");
  assert.match(d.latest.url,/github.com\/developergracz\/gracz-pl-2\/actions\/runs\/456/);
  assert.ok(calls.every(x=>x.url.startsWith(repo)));
  assert.ok(calls.every(x=>x.options.headers.Authorization==="Bearer test-read-only-token"));
  await read();
  assert.equal(calls.length,4,"request is cached to avoid API usage and rate limits");
});
test("GitHub failures never fabricate success or measurements",async()=>{
  const read=createPerformanceReader({token:"test",fetcher:async()=>new Response("",{status:404})});
  const d=await read();
  assert.equal(d.state,"unavailable");
  assert.equal(d.latest,null);
});
test("untrusted logs redirect is not followed with an auth token",async()=>{
  const urls=[];
  const fetcher=async(url)=>{
    urls.push(url);
    if(url.endsWith("/runs?branch=main&per_page=6"))
      return json({workflow_runs:[{id:456,head_branch:"main",status:"completed",
        conclusion:"success",created_at:"2026-10-25",head_sha:"a".repeat(40)}]});
    if(url.endsWith("/456/jobs?per_page=40"))return json({jobs:[{id:987,
      name:"Observe LCP and self-repair only approved regressions",
      status:"completed",conclusion:"success"}]});
    if(url.endsWith("/jobs/987/logs"))
      return new Response(null,{status:302,headers:{location:"http://127.0.0.1/private"}});
    return json({workflow_runs:[]});
  };
  const r=await createPerformanceReader({token:"test",fetcher})();
  assert.equal(r.state,"incomplete");
  assert.ok(urls.every(url=>url.startsWith(repo)));
});


test("new GitHub Actions blob storage redirects yield real LCP without forwarding the token",async()=>{
  for(const host of ["productionresultssa30.blob.core.windows.net",
                     "productionresultssa149.blob.core.windows.net"]){
    const calls=[];
    const signed="https://"+host+"/some-container/job-logs.txt?sig=fake";
    const fetcher=async(url,options)=>{
      calls.push({url,options});
      if(url===repo+"/actions/workflows/performance-autopilot.yml/runs?branch=main&per_page=6")
        return json({workflow_runs:[{id:456,head_branch:"main",status:"completed",
          conclusion:"success",created_at:"2026-10-25T21:15:00Z",head_sha:"a".repeat(40)}]});
      if(url===repo+"/actions/runs/456/jobs?per_page=40")
        return json({jobs:[{id:987,name:"Observe LCP and self-repair only approved regressions",
          status:"completed",conclusion:"success"}]});
      if(url===repo+"/actions/jobs/987/logs")
        return new Response(null,{status:302,headers:{location:signed}});
      if(url===signed)
        return new Response(log,{status:200,headers:{"content-type":"text/plain"}});
      if(url===repo+"/actions/workflows/performance-rollback-stage.yml/runs?per_page=1")
        return json({workflow_runs:[]});
      throw Error("unexpected URL");
    };
    const read=createPerformanceReader({token:"private-token",fetcher});
    const result=await read();
    assert.equal(result.state,"available");
    assert.equal(result.latest.reports[0].lcpMs,3100);
    assert.equal(result.latest.reports[0].element,".home-hero-premium__lead");
    assert.equal(calls.filter(x=>x.url===signed).length,1);
    assert.ok(!("Authorization" in calls.find(x=>x.url===signed).options.headers));
    assert.equal(calls.find(x=>x.url===signed).options.redirect,"error");
  }
});
test("arbitrary blob hosts and HTTP cannot receive any GitHub log download request",async()=>{
  for(const signed of ["https://attacker.blob.core.windows.net/logs",
                       "https://productionresultssa30.blob.core.windows.net.evil.example/logs",
                       "http://productionresultssa30.blob.core.windows.net/logs",
                       "https://productionresultssa30.blob.core.windows.net:8443/logs"]){
    const received=[];
    const fetcher=async url=>{
      received.push(url);
      if(url===repo+"/actions/workflows/performance-autopilot.yml/runs?branch=main&per_page=6")
        return json({workflow_runs:[{id:456,head_branch:"main",status:"completed",
          conclusion:"success",created_at:"2026-10-25T21:15:00Z",head_sha:"a".repeat(40)}]});
      if(url===repo+"/actions/runs/456/jobs?per_page=40")
        return json({jobs:[{id:987,name:"Observe LCP and self-repair only approved regressions",
          status:"completed",conclusion:"success"}]});
      if(url===repo+"/actions/jobs/987/logs")
        return new Response(null,{status:302,headers:{location:signed}});
      if(url===repo+"/actions/workflows/performance-rollback-stage.yml/runs?per_page=1")
        return json({workflow_runs:[]});
      throw Error("redirect followed outside allowlist");
    };
    const result=await createPerformanceReader({token:"private-token",fetcher})();
    assert.equal(result.state,"incomplete");
    assert.ok(received.every(url=>url.startsWith(repo)));
  }
});


test("GitHub log timestamp is the report write time, not the workflow start",async()=>{
 const reports=parseGuardianLog(log);
 assert.equal(reports[0].reportLoggedAt,"2026-10-25T20:00:00.000Z");
 assert.equal(reports[1].reportLoggedAt,"2026-10-25T20:00:00.000Z");
 const calls=[];
 const data=await createPerformanceReader({token:"test-read-only-token",
   fetcher:mockFetch(calls),now:()=>Date.parse("2026-10-25T21:00:00Z")})();
 assert.equal(data.latest.createdAt,"2026-10-25T19:50:00Z");
 assert.equal(data.latest.reports[0].reportLoggedAt,"2026-10-25T20:00:00.000Z");
});
test("unparseable log timestamps remain unknown, never substituted with run start",()=>{
 const malformed="this-is-not-a-timestamp "+JSON.stringify(result)+"\n";
 const reports=parseGuardianLog(malformed);
 assert.equal(reports.length,2);
 assert.equal(reports[0].reportLoggedAt,null);
});
test("Performance UI labels source, Warsaw clock and separate run start date",async()=>{
 const {readFile}=await import("node:fs/promises");
 const js=await readFile(new URL("../admin-r1/ui/performance.js",import.meta.url),"utf8");
 const html=await readFile(new URL("../admin-r1/ui/performance.html",import.meta.url),"utf8");
 assert.ok(js.includes('timeZone:"Europe/Warsaw"'));
 assert.match(js,/reportLoggedAt/);
 assert.match(js,/Raport pomiarów zapisano:/);
 assert.match(js,/Uruchomienie zadania:/);
 assert.ok(html.includes('Start zadania (Warszawa)'));
 assert.match(html,/Źródło: GitHub Actions/);
});
