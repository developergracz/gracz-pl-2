import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,verify} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createSeoGoogleReader} from "../admin-r1/seo-google-reader.mjs";
import {createSeoSpeedReader} from "../admin-r1/seo-speed-reader.mjs";

const property="sc-domain:gracz.pl";
const email="seo-reader@test-project.iam.gserviceaccount.com";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{
  format:"pem",type:"pkcs8"},publicKeyEncoding:{format:"pem",type:"spki"}});
const now=()=>1800000000000;

test("GSC fails closed when credentials or exact property are missing",async()=>{
  const absent=createSeoGoogleReader({email:null,privateKey:null,property,now});
  assert.equal((await absent.read()).state,"needs_configuration");
  assert.equal((await absent.inspect("https://gracz.pl/")).state,"needs_configuration");
  const forged=createSeoGoogleReader({email,privateKey,property:"sc-domain:evil.invalid",now});
  assert.equal((await forged.read()).state,"needs_configuration");
});

test("GSC uses signed OAuth service account, read-only scope, and caches search data",async()=>{
  let authCount=0,queries=0;
  const fetcher=async(url,options)=>{
    if(url==="https://oauth2.googleapis.com/token"){
      authCount++;
      const p=new URLSearchParams(options.body);
      const jwt=p.get("assertion").split(".");
      assert.equal(jwt.length,3);
      const payload=JSON.parse(Buffer.from(jwt[1],"base64url").toString());
      assert.equal(payload.scope,"https://www.googleapis.com/auth/webmasters.readonly");
      assert.equal(payload.aud,"https://oauth2.googleapis.com/token");
      assert.equal(payload.iss,email);
      assert.equal(verify("RSA-SHA256",Buffer.from(jwt[0]+"."+jwt[1]),publicKey,
        Buffer.from(jwt[2],"base64url")),true);
      return new Response(JSON.stringify({access_token:"test-access-token-1234567",expires_in:3600}));
    }
    assert.ok(url.startsWith("https://www.googleapis.com/webmasters/v3/sites/"));
    assert.equal(options.headers.Authorization,"Bearer test-access-token-1234567");
    queries++;
    const params=JSON.parse(options.body);
    const rows=params.dimensions.length?[]:[{clicks:8,impressions:120,ctr:0.08,position:3.5}];
    return new Response(JSON.stringify({rows}));
  };
  const google=createSeoGoogleReader({fetcher,now,email,privateKey,property});
  const r=await google.read();
  assert.equal(r.state,"connected");
  assert.equal(r.totals.clicks,8);
  assert.equal(r.totals.impressions,120);
  assert.equal(r.totals.ctr,8);
  await google.read();
  assert.equal(authCount,1);
  assert.equal(queries,9);
});

test("GSC URL Inspection returns only real Google verdicts and caches results",async()=>{
  let calls=0;
  const fetcher=async(url,options)=>{
    if(url==="https://oauth2.googleapis.com/token")return new Response(JSON.stringify({
      access_token:"test-access-token-1234567",expires_in:3600
    }));
    assert.equal(url,"https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    calls++;
    assert.deepEqual(JSON.parse(options.body),{
      inspectionUrl:"https://gracz.pl/",siteUrl:property,languageCode:"pl-PL"
    });
    return new Response(JSON.stringify({inspectionResult:{indexStatusResult:{
      verdict:"PASS",coverageState:"Submitted and indexed",indexingState:"INDEXING_ALLOWED",
      lastCrawlTime:"2026-10-20T12:00:00Z"
    }}}));
  };
  const google=createSeoGoogleReader({fetcher,now,email,privateKey,property});
  assert.equal((await google.inspect("https://evil.invalid/")).state,"invalid_url");
  assert.equal((await google.inspect("https://gracz.pl/")).verdict,"PASS");
  assert.equal((await google.inspect("https://gracz.pl/")).coverageState,"Submitted and indexed");
  assert.equal(calls,1);
});
test("PageSpeed accepts only fixed homepage and caches real metrics",async()=>{
  let calls=0;
  const fetcher=async(url)=>{
    calls++;
    const u=new URL(url);
    assert.equal(u.origin,"https://www.googleapis.com");
    assert.equal(u.searchParams.get("url"),"https://gracz.pl/");
    assert.equal(u.searchParams.get("strategy"),"mobile");
    return new Response(JSON.stringify({lighthouseResult:{
      categories:{performance:{score:0.91}},
      audits:{"largest-contentful-paint":{numericValue:1200},
        "cumulative-layout-shift":{numericValue:0.03}}
    }}));
  };
  const speed=createSeoSpeedReader({fetcher,now,key:""});
  assert.equal((await speed("foo")).state,"invalid_strategy");
  const a=await speed(),b=await speed();
  assert.equal(a.state,"available");
  assert.equal(a.score,91);assert.equal(a.lcpMs,1200);
  assert.equal(a.cls,0.03);assert.equal(a.inpMs,null);
  assert.equal(b,a);assert.equal(calls,1);
});
test("PageSpeed quota failures are unknown not fake success",async()=>{
  const speed=createSeoSpeedReader({fetcher:async()=>new Response("{}",{status:429}),now});
  const data=await speed();
  assert.equal(data.state,"unavailable");
  assert.equal(data.score,null);
});
test("SEO private API routes require OWNER session and POST inspection requires CSRF",async()=>{
  const source=await readFile(new URL("../admin-r1/owner-router.mjs",import.meta.url),"utf8");
  const auth=source.indexOf("const session=await auth.session(cookie,kind)");
  for(const route of ["/seo/google","/seo/speed","/seo/history","/seo/inspect"]){
    const method=route==="/seo/inspect"?"POST":"GET";
    const protectedHandler="if(req.method==='"+method+"'&&path===PREFIX+'"+route+"'";
    assert.ok(source.indexOf(protectedHandler)>auth,"protected "+route);
  }
  assert.match(source,/url\.pathname===PREFIX\+'\/seo\/speed'&&url\.search==='\?refresh=1'/);
  assert.match(source,/if\(url\.search&&!speedRefresh\)return denyAdmin\(req,res\)/);
  assert.match(source,/path===PREFIX\+'\/seo\/inspect'\)\{\s*if\(!safePost\(req,origin\)\|\|!auth\.checkCsrf/);
});

test("GSC compares separate FINAL periods, exact gracz query and only overlapping pages",async()=>{
  const seen=[],fixed=()=>Date.parse("2026-10-26T12:00:00Z");
  const fetcher=async(url,options)=>{
    if(url==="https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({access_token:"test-access-token-1234567",expires_in:3600}));
    const q=JSON.parse(options.body);seen.push(q);
    assert.equal(q.type,"web");
    const previous=q.startDate<"2026-09-01";
    const isBrand=Boolean(q.dimensionFilterGroups);
    const type=q.dimensions?.[0]||"total";
    if(isBrand){
      assert.deepEqual(q.dimensionFilterGroups,[{groupType:"and",filters:[
        {dimension:"query",operator:"equals",expression:"gracz"}]}]);
      return new Response(JSON.stringify({rows:[previous?
        {clicks:9,impressions:130,ctr:.069,position:7}:
        {clicks:3,impressions:70,ctr:.04286,position:5}]}));
    }
    if(q.dataState==="all"){
      assert.deepEqual(q.dimensions,["date"]);
      return new Response(JSON.stringify({
        metadata:{first_incomplete_date:"2026-10-24"},
        rows:[{keys:["2026-10-23"],clicks:2,impressions:30,ctr:.066,position:3},
          {keys:["2026-10-25"],clicks:1,impressions:12,ctr:.083,position:4}]
      }));
    }
    assert.equal(q.dataState,undefined);
    if(type==="page")return new Response(JSON.stringify({rows:previous?[
      {keys:["https://gracz.pl/"],clicks:10,impressions:150,ctr:.066,position:5},
      {keys:["https://gracz.pl/gry/"],clicks:4,impressions:80,ctr:.05,position:8}
    ]:[
      {keys:["https://gracz.pl/"],clicks:6,impressions:80,ctr:.075,position:4},
      {keys:["https://gracz.pl/gry/gomoku/"],clicks:3,impressions:20,ctr:.15,position:6},
      {keys:["https://evil.invalid/steal"],clicks:100,impressions:999,ctr:.1,position:2}
    ]}));
    if(type==="date")return new Response(JSON.stringify({rows:[
      {keys:["2026-10-10"],clicks:2,impressions:20,ctr:.1,position:4}
    ]}));
    if(type==="query")return new Response(JSON.stringify({rows:[
      {keys:["gracz.pl"],clicks:5,impressions:100,ctr:.05,position:3}
    ]}));
    return new Response(JSON.stringify({rows:[previous?
      {clicks:40,impressions:2000,ctr:.02,position:8}:
      {clicks:22,impressions:1309,ctr:22/1309,position:5.19}]}));
  };
  const read=createSeoGoogleReader({fetcher,now:fixed,email,privateKey,property});
  const result=await read.read();
  assert.equal(result.state,"connected");
  assert.equal(result.startDate,"2026-09-26");
  assert.equal(result.endDate,"2026-10-23");
  assert.equal(result.comparison.startDate,"2026-08-29");
  assert.equal(result.comparison.endDate,"2026-09-25");
  assert.equal(result.totals.clicks,22);
  assert.equal(result.comparison.previous.clicks,40);
  assert.equal(result.comparison.clicksPercent,-45);
  assert.equal(result.comparison.positionChange,-2.81);
  assert.equal(result.brand.query,"gracz");
  assert.equal(result.brand.current.impressions,70);
  assert.equal(result.brand.positionChange,-2);
  assert.equal(result.pageChanges.length,1);
  assert.equal(result.pageChanges[0].url,"https://gracz.pl/");
  assert.equal(result.pageChanges[0].impressionChange,-70);
  assert.deepEqual(result.alerts.map(x=>x.id).sort(),
    ["clicks_drop","impressions_drop","gracz_drop","page_drop"].sort());
  assert.equal(result.freshness.state,"available");
  assert.equal(result.freshness.timezone,"America/Los_Angeles");
  assert.equal(result.freshness.firstIncompleteDate,"2026-10-24");
  assert.deepEqual(result.freshness.days.map(x=>x.provisional),[false,true]);
  assert.equal(seen.length,9);
  assert.ok(seen.every(x=>x.startDate && x.endDate && x.rowLimit<=250));
  assert.ok(seen.filter(x=>x.dataState==="all").length===1);
  assert.ok(seen.filter(x=>x.dataState===undefined).length===8);
});
test("GSC does not invent Google ranking for missing exact query or single-period pages",async()=>{
  const fixed=()=>Date.parse("2026-10-26T12:00:00Z");
  const fetcher=async(url,options)=>{
    if(url==="https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({access_token:"test-access-token-1234567",expires_in:3600}));
    const q=JSON.parse(options.body);
    if(q.dimensionFilterGroups)return new Response(JSON.stringify({rows:[]}));
    if(q.dataState==="all")return new Response(JSON.stringify({rows:[]}));
    if(q.dimensions[0]==="page")return new Response(JSON.stringify({rows:[
      {keys:["https://gracz.pl/"],clicks:1,impressions:40,ctr:.025,position:8}
    ]}));
    if(q.dimensions.length)return new Response(JSON.stringify({rows:[]}));
    return new Response(JSON.stringify({rows:[]}));
  };
  const data=await createSeoGoogleReader({fetcher,now:fixed,email,privateKey,property}).read();
  assert.equal(data.state,"connected");
  assert.equal(data.brand.current.found,false);
  assert.equal(data.brand.current.position,null);
  assert.equal(data.comparison.clicksPercent,null);
  assert.equal(data.pageChanges[0].impressionChange,0);
  assert.equal(data.alerts.length,0);
  assert.equal(data.freshness.firstIncompleteDate,null);
});
test("Newest partial GSC API failure does not erase validated FINAL metrics",async()=>{
  const fetcher=async(url,options)=>{
    if(url==="https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({access_token:"test-access-token-1234567",expires_in:3600}));
    const q=JSON.parse(options.body);
    if(q.dataState==="all")return new Response("not available",{status:503});
    return new Response(JSON.stringify({rows:q.dimensions.length?[]:[
      {clicks:8,impressions:120,ctr:.066,position:5}
    ]}));
  };
  const d=await createSeoGoogleReader({fetcher,now,email,privateKey,property}).read();
  assert.equal(d.state,"connected");
  assert.equal(d.totals.clicks,8);
  assert.equal(d.freshness.state,"unavailable");
});
test("GSC monitor UI keeps incomplete data separate from 28-day alert calculations",async()=>{
  const html=await readFile(new URL("../admin-r1/ui/seo.html",import.meta.url),"utf8");
  const js=await readFile(new URL("../admin-r1/ui/seo.js",import.meta.url),"utf8");
  const css=await readFile(new URL("../admin-r1/ui/seo.css",import.meta.url),"utf8");
  for(const id of ["google-delta-clicks","google-delta-impressions","google-delta-ctr",
    "google-delta-position","google-brand-clicks","google-brand-impressions",
    "google-brand-ctr","google-brand-position","google-page-changes",
    "google-alert-list","google-fresh-days","google-fresh-state",
    "google-trend-filter","google-compare-period"]){
    assert.ok(html.includes('id="'+id+'"'),"HTML "+id);
    assert.ok(js.includes('"'+id+'"'),"JavaScript "+id);
  }
  assert.match(js,/renderPageChanges/);
  assert.match(js,/fresh\.firstIncompleteDate/);
  assert.ok(js.includes("renderGoogleMonitor(data)"));
  assert.ok(!js.includes("innerHTML"));
  assert.match(css,/seo-google-monitor-r4/);
});
