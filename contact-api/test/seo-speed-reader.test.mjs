import test from "node:test";
import assert from "node:assert/strict";
import {createSeoSpeedReader} from "../admin-r1/seo-speed-reader.mjs";
import {readFile} from "node:fs/promises";

function googleReport(extra={}){
  return new Response(JSON.stringify({
    lighthouseResult:{
      categories:{performance:{score:0.83}},
      audits:{
        "largest-contentful-paint":{numericValue:2310.4},
        "cumulative-layout-shift":{numericValue:0.083}
      }
    },
    loadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:145}}},
    ...extra
  }),{status:200});
}

test("PageSpeed parses a real-size Lighthouse result (larger than old 800 KB limit) and caches only success",async()=>{
  let calls=0,t=100_000;
  const huge=googleReport({unused:"x".repeat(1_000_000)});
  const read=createSeoSpeedReader({
    now:()=>t,key:"test-api-key",
    fetcher:async(url,init)=>{
      calls++;
      const target=new URL(url);
      assert.equal(target.searchParams.get("url"),"https://gracz.pl/");
      assert.equal(target.searchParams.get("strategy"),"mobile");
      assert.equal(target.searchParams.get("key"),"test-api-key");
      assert.equal(init.redirect,"error");
      assert.equal(init.signal.aborted,false);
      return huge;
    }
  });
  const first=await read();
  assert.equal(first.state,"available");
  assert.equal(first.score,83);
  assert.equal(first.lcpMs,2310.4);
  assert.equal(first.cls,0.08);
  assert.equal(first.inpMs,145);
  assert.equal(first.inpSource,"page");
  assert.equal(first.tbtMs,null);
  assert.equal(first.reason,undefined);
  t+=4000;
  assert.deepEqual(await read(),first);
  assert.equal(calls,1);
});

test("PageSpeed 429 failure shows a reason and is not cached for 24 hours",async()=>{
  let calls=0;
  const read=createSeoSpeedReader({key:"",fetcher:async url=>{
    calls++;
    assert.equal(new URL(url).searchParams.has("key"),false);
    return calls===1?new Response("{}",{status:429}):googleReport({loadingExperience:{}});
  }});
  const first=await read();
  assert.equal(first.state,"unavailable");
  assert.equal(first.reason,"rate_limited");
  const second=await read();
  assert.equal(second.state,"available");
  assert.equal(second.inpMs,null,"No field INP should remain unknown");
  assert.equal(second.inpSource,null);
  assert.equal(second.tbtMs,null);
  assert.equal(calls,2,"Failure must be retried immediately rather than remembered for 24 h");
});

test("PageSpeed differentiates access, provider and timeout errors without exposing provider content",async()=>{
  for(const [status,reason] of [[403,"access_denied"],[500,"provider_unavailable"],[400,"invalid_request"]]){
    const read=createSeoSpeedReader({fetcher:async()=>new Response('{"secret":"must-not-leak"}',{status})});
    const result=await read();
    assert.equal(result.state,"unavailable");
    assert.equal(result.reason,reason);
    assert.equal(JSON.stringify(result).includes("must-not-leak"),false);
  }
  const timeout=createSeoSpeedReader({fetcher:async()=>{
    const err=new Error("aborted");err.name="TimeoutError";throw err;
  }});
  assert.equal((await timeout()).reason,"timeout");
});

test("PageSpeed rejects overly large and missing Lighthouse scores without showing invented results",async()=>{
  const large=createSeoSpeedReader({
    fetcher:async()=>new Response("{}",{status:200,headers:{"content-length":"13000000"}})
  });
  const a=await large();
  assert.equal(a.state,"unavailable");
  assert.equal(a.reason,"response_too_large");
  assert.equal(a.score,null);
  const invalid=createSeoSpeedReader({
    fetcher:async()=>new Response('{"lighthouseResult":{"categories":{"performance":{"score":null}}}}')
  });
  const b=await invalid();
  assert.equal(b.state,"unavailable");
  assert.equal(b.reason,"invalid_response");
  assert.equal(b.score,null);
});

test("SEO UI displays provider reasons and retains private OWNER route",async()=>{
  const js=await readFile(new URL("../admin-r1/ui/seo.js",import.meta.url),"utf8");
  const router=await readFile(new URL("../admin-r1/owner-router.mjs",import.meta.url),"utf8");
  assert.match(js,/const speedReasons=\{/);
  assert.match(js,/speedReasons\[data.reason\]/);
  assert.match(js,/INP: dane użytkowników \(strona lub domena\)/);
  assert.match(router,/path===PREFIX\+'\/seo\/speed'/);
  assert.match(js,/readPrivate\("speed\?refresh=1"\)/);
  assert.match(router,/url\.pathname===PREFIX\+'\/seo\/speed'&&url\.search==='\?refresh=1'/);
  assert.match(router,/if\(url\.search&&!speedRefresh\)return denyAdmin/);
  assert.match(router,/await readSeoSpeed\('mobile',\{refresh:speedRefresh\}\)/);
});


test("PageSpeed forced refresh bypasses 24-hour cache once 60-second quota guard expires",async()=>{
  let t=100_000,calls=0;
  const read=createSeoSpeedReader({now:()=>t,fetcher:async()=>{
    calls++;
    return googleReport({lighthouseResult:{
      categories:{performance:{score:calls===1 ? 0.91 : 0.95}},
      audits:{"largest-contentful-paint":{numericValue:calls===1?3098:2410},
        "cumulative-layout-shift":{numericValue:0}}
    }});
  }});
  const first=await read();
  assert.equal(first.score,91);
  t+=10_000;
  const blocked=await read("mobile",{refresh:true});
  assert.equal(blocked.state,"rate_guard");
  assert.equal(blocked.retryAfterSeconds,50);
  assert.equal(calls,1);
  assert.equal((await read()).score,91,"Default read retains 24-hour cache");
  t+=50_000;
  const fresh=await read("mobile",{refresh:true});
  assert.equal(fresh.state,"available");
  assert.equal(fresh.score,95);
  assert.equal(fresh.lcpMs,2410);
  assert.equal(calls,2);
  assert.equal((await read()).score,95,"Fresh success replaces cached result");
});

test("simultaneous forced PageSpeed clicks share a single upstream measurement",async()=>{
  let resolve, calls=0;
  const fetcher=async()=>{
    calls++;
    return new Promise(done=>{resolve=()=>done(googleReport());});
  };
  const read=createSeoSpeedReader({fetcher});
  const a=read("mobile",{refresh:true});
  const b=read("mobile",{refresh:true});
  assert.equal(calls,1);
  resolve();
  const [one,two]=await Promise.all([a,b]);
  assert.deepEqual(one,two);
  assert.equal(one.state,"available");
  assert.equal(calls,1);
});

test("invalid PageSpeed strategy cannot trigger a refresh request",async()=>{
  let calls=0;
  const read=createSeoSpeedReader({fetcher:async()=>{calls++;return googleReport();}});
  assert.equal((await read("invalid",{refresh:true})).state,"invalid_strategy");
  assert.equal(calls,0);
});


test("INP prefers homepage CrUX when both homepage and domain values are available",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    loadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:180}}},
    originLoadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:380}}},
    lighthouseResult:{
      categories:{performance:{score:0.92}},
      audits:{"total-blocking-time":{numericValue:132.83}}
    }
  })});
  const data=await read();
  assert.equal(data.state,"available");
  assert.equal(data.inpMs,180);
  assert.equal(data.inpSource,"page");
  assert.equal(data.tbtMs,132.83);
});

test("INP uses domain-level CrUX only when homepage INP is missing",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    loadingExperience:{metrics:{}},
    originLoadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:215}}},
    lighthouseResult:{
      categories:{performance:{score:0.88}},
      audits:{"total-blocking-time":{numericValue:210}}
    }
  })});
  const data=await read();
  assert.equal(data.inpMs,215);
  assert.equal(data.inpSource,"origin");
  assert.equal(data.tbtMs,210);
});

test("No field INP is represented as unknown, not replaced by lab TBT",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    loadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:null}}},
    originLoadingExperience:{metrics:{INTERACTION_TO_NEXT_PAINT:{percentile:-1}}},
    lighthouseResult:{
      categories:{performance:{score:0.91}},
      audits:{"total-blocking-time":{numericValue:294.87}}
    }
  })});
  const data=await read();
  assert.equal(data.inpMs,null);
  assert.equal(data.inpSource,null);
  assert.equal(data.tbtMs,294.87);
});

test("Invalid or missing TBT does not produce an invented laboratory value",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    loadingExperience:{},
    originLoadingExperience:{metrics:{}},
    lighthouseResult:{
      categories:{performance:{score:0.92}},
      audits:{"total-blocking-time":{numericValue:-3}}
    }
  })});
  const data=await read();
  assert.equal(data.inpMs,null);
  assert.equal(data.inpSource,null);
  assert.equal(data.tbtMs,null);
});

test("SEO PageSpeed interface labels provenance and TBT independently",async()=>{
  const js=await readFile(new URL("../admin-r1/ui/seo.js",import.meta.url),"utf8");
  const html=await readFile(new URL("../admin-r1/ui/seo.html",import.meta.url),"utf8");
  assert.match(html,/id="speed-inp-source"/);
  assert.match(html,/id="speed-tbt"/);
  assert.match(html,/TBT · laboratorium/);
  assert.match(js,/data.inpSource==="origin"/);
  assert.match(js,/Cała domena gracz.pl · dane terenowe/);
  assert.match(js,/data.inpSource==="page"/);
  assert.match(js,/Brak danych terenowych/);
  assert.match(js,/data.tbtMs\?\?"—"/);
});

test("modern Lighthouse LCP breakdown retains only numeric phases and short element identity",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    lighthouseResult:{categories:{performance:{score:0.93}},audits:{
      "largest-contentful-paint":{numericValue:2832},
      "lcp-breakdown-insight":{details:{type:"list",items:[
        {type:"table",items:[
          {subpart:"timeToFirstByte",duration:420.152},
          {subpart:"resourceLoadDelay",duration:190},
          {subpart:"resourceLoadDuration",duration:349.856},
          {subpart:"elementRenderDelay",duration:1872.12},
          {subpart:"other",duration:900}
        ]},
        {type:"node",selector:"#hero-title",nodeLabel:"Graj. Ucz się. Rywalizuj."}
      ]}}
    }}
  })});
  const data=await read();
  assert.equal(data.state,"available");
  assert.deepEqual(data.lcpElement,{selector:"#hero-title",label:"Graj. Ucz się. Rywalizuj."});
  assert.deepEqual(data.lcpPhases,{
    timeToFirstByte:420.15,
    resourceLoadDelay:190,
    resourceLoadDuration:349.86,
    elementRenderDelay:1872.12
  });
  assert.equal(data.score,93);
  assert.equal(data.lcpMs,2832);
});

test("text-only LCP has no fake image phases; missing audit remains unknown",async()=>{
  const response=createSeoSpeedReader({fetcher:async()=>googleReport({
    lighthouseResult:{categories:{performance:{score:0.99}},audits:{
      "lcp-breakdown-insight":{details:{type:"list",items:[
        {type:"table",items:[
          {subpart:"timeToFirstByte",duration:290.11},
          {subpart:"elementRenderDelay",duration:320.56}
        ]},
        {type:"node",selector:"h1",nodeLabel:"Portal"}
      ]}}
    }}
  })});
  const result=await response();
  assert.deepEqual(result.lcpPhases,{
    timeToFirstByte:290.11,resourceLoadDelay:null,
    resourceLoadDuration:null,elementRenderDelay:320.56
  });
  const missing=await createSeoSpeedReader({fetcher:async()=>googleReport()})();
  assert.equal(missing.lcpElement,null);
  assert.equal(missing.lcpPhases,null);
});

test("older Lighthouse element shape is supported and malformed timings are never displayed as zero",async()=>{
  const read=createSeoSpeedReader({fetcher:async()=>googleReport({
    lighthouseResult:{categories:{performance:{score:0.9}},audits:{
      "largest-contentful-paint-element":{details:{type:"list",items:[
        {type:"table",items:[{node:{type:"node",selector:"main h1",
          nodeLabel:"Example heading"}}]}
      ]}},
      "lcp-breakdown-insight":{details:{type:"list",items:[
        {type:"table",items:[{subpart:"timeToFirstByte",duration:-200},
          {subpart:"elementRenderDelay",duration:"42"}]}
      ]}}
    }}
  })});
  const out=await read();
  assert.deepEqual(out.lcpElement,{selector:"main h1",label:"Example heading"});
  assert.equal(out.lcpPhases,null);
});

test("OWNER SEO UI displays new LCP details from the same PageSpeed reading safely",async()=>{
  const js=await readFile(new URL("../admin-r1/ui/seo.js",import.meta.url),"utf8");
  const html=await readFile(new URL("../admin-r1/ui/seo.html",import.meta.url),"utf8");
  for(const id of ["speed-lcp-element","speed-lcp-ttfb","speed-lcp-load-delay",
    "speed-lcp-load-time","speed-lcp-render-delay"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/showLcpDiagnostics\(data\)/);
  assert.match(js,/clearLcpDiagnostics\(\)/);
  assert.match(js,/text\("speed-lcp-element",element\?\.selector/);
  assert.match(js,/Brak szczegółów w raporcie/);
  assert.match(js,/textContent=String\(value\)/);
});
