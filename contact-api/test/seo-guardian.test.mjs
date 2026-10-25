import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createSeoGuardian} from "../admin-r1/seo-guardian.mjs";

const site=()=>({
  scope:"public_live",checkedAt:"2026-10-25T11:30:00.000Z",ok:true,
  total:18,passing:18,issues:[],pages:[]
});
const speed=()=>({
  state:"available",checkedAt:"2026-10-25T11:36:00.000Z",score:99,lcpMs:2121.5
});
const make=(s=site(),p=speed())=>createSeoGuardian({
  readStatus:async()=>s,readSpeed:async strategy=>{
    assert.equal(strategy,"mobile");
    return p;
  },now:()=>1792930000000
});

test("healthy only when the full public SEO scan and real cached Lighthouse both pass",async()=>{
  const r=await make()();
  assert.equal(r.state,"healthy");
  assert.equal(r.scope,"owner_read_only");
  assert.equal(r.technical.state,"healthy");
  assert.equal(r.technical.total,18);
  assert.equal(r.performance.lcpMs,2121.5);
  assert.equal(r.performance.score,99);
  assert.equal(r.alerts.length,0);
  assert.equal(r.performance.source,"Lighthouse mobile · laboratoryjny");
});

test("technical noindex and robots issues produce critical alerts",async()=>{
  const s={...site(),ok:false,passing:16,issues:[
    {url:"https://gracz.pl/",code:"robots_invalid"},
    {url:"https://gracz.pl/gry/",code:"noindex"}
  ]};
  const r=await make(s)();
  assert.equal(r.state,"attention");
  assert.equal(r.technical.issueCount,2);
  assert.deepEqual(r.alerts.map(a=>a.code),["robots_invalid","noindex"]);
  assert.ok(r.alerts.every(a=>a.severity==="critical"));
});

test("LCP at or above 2500ms and low Lighthouse score are explicit warnings",async()=>{
  const r=await make(site(),{...speed(),lcpMs:2500,score:89})();
  assert.equal(r.state,"attention");
  assert.equal(r.performance.state,"attention");
  assert.deepEqual(r.alerts.map(a=>a.code),["lcp_high","lighthouse_low"]);
});

test("unavailable Google PageSpeed is unknown, never declared healthy or a slow page",async()=>{
  const r=await make(site(),{state:"unavailable",reason:"rate_limited"})();
  assert.equal(r.state,"unknown");
  assert.equal(r.performance.lcpMs,null);
  assert.equal(r.performance.score,null);
  assert.equal(r.alerts[0].code,"speed_unknown");
  assert.equal(JSON.stringify(r).includes("rate_limited"),false);
});

test("unavailable site remains unknown while valid performance does not conceal missing indexability",async()=>{
  const r=await make(null,speed())();
  assert.equal(r.state,"unknown");
  assert.equal(r.technical.total,null);
  assert.equal(r.alerts[0].code,"site_unknown");
});

test("one provider failure does not mask available critical SEO defects",async()=>{
  const read=createSeoGuardian({
    readStatus:async()=>({...site(),ok:false,issues:[
      {url:"https://gracz.pl/",code:"sitemap_invalid"}
    ]}),
    readSpeed:async()=>{throw Error("API key secret should not leak");}
  });
  const r=await read();
  assert.equal(r.state,"attention");
  assert.deepEqual(r.alerts.map(a=>a.code),["sitemap_invalid","speed_unknown"]);
  assert.equal(JSON.stringify(r).includes("secret"),false);
});

test("unknown or malicious issue URLs cannot become outbound links or script content",async()=>{
  const s={...site(),ok:false,issues:[
    {url:"https://evil.invalid/other",code:"unexpected_code"}
  ]};
  const r=await make(s)();
  assert.equal(r.alerts[0].url,"https://gracz.pl");
  assert.equal(r.alerts[0].message,"Problem techniczny wymagający sprawdzenia");
});

test("Guardian endpoint exists only after existing OWNER authentication and UI uses textContent",async()=>{
  const router=await readFile(new URL("../admin-r1/owner-router.mjs",import.meta.url),"utf8");
  const js=await readFile(new URL("../admin-r1/ui/seo.js",import.meta.url),"utf8");
  const html=await readFile(new URL("../admin-r1/ui/seo.html",import.meta.url),"utf8");
  const auth=router.indexOf("const session=await auth.session(cookie,kind)");
  const handler=router.indexOf("path===PREFIX+'/seo/guardian'");
  assert.ok(auth>0&&handler>auth);
  assert.match(router,/await readSeoGuardian\(\)/);
  assert.match(html,/id="seo-guardian"/);
  assert.match(html,/id="guardian-alerts"/);
  assert.match(js,/readPrivate\("guardian"\)/);
  assert.match(js,/item\.textContent=String\(alert\.message/);
  assert.doesNotMatch(js,/item\.innerHTML=/);
});
