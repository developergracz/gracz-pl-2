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
  assert.equal(queries,4);
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
