import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {repairSite} from "./performance-autopilot.mjs";
import {measure,classify} from "./performance-observer.mjs";

const make=()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"gracz-perf-"));
 const put=(name,body="")=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
 put("assets/legal-links.js","function ensureStyles(){}");
 for(const font of ["montserrat-latin.woff2","montserrat-latin-ext.woff2"])put("assets/fonts/"+font);
 put("assets/gry-karciane-hero-reference.webp");
 put("assets/o-gracz-pl-hero-approved.webp");
 const shared='<script src="/assets/legal-links.js?v=r49-premium-email-input-20261022" defer></script><button data-modal="contact">Kontakt</button>';
 const css='<link rel="stylesheet" href="/assets/contact-modal.css?v=r8" data-contact-modal-style>';
 const fontTags=["montserrat-latin.woff2","montserrat-latin-ext.woff2"].map(f=>`<link rel="preload" href="/assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`).join("\n");
 put("index.html",'<head>'+fontTags+'</head><body>'+shared+'</body>');
 put("gry-karciane/index.html",'<head>\n  '+css+'\n</head><body>'+shared+'<img src="/assets/gry-karciane-hero-reference.webp" alt=""></body>');
 put("o-gracz-pl/index.html",'<head></head><body><img src="/assets/o-gracz-pl-hero-approved.webp" alt=""></body>');
 return {root,put,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
};
test("bounded fixes only approved early CSS, hero image and home font prioritization",()=>{
 const f=make();
 try {
   const planned=repairSite(f.root);
   assert.deepEqual(planned.warnings,[]);
   assert.deepEqual(planned.changed,["gry-karciane/index.html","index.html","o-gracz-pl/index.html"]);
   assert.doesNotMatch(fs.readFileSync(path.join(f.root,"index.html"),"utf8"),/fetchpriority/);
   assert.deepEqual(repairSite(f.root,{write:true}),planned);
   assert.deepEqual(repairSite(f.root,{write:true}),{changed:[],warnings:[]});
   const card=fs.readFileSync(path.join(f.root,"gry-karciane/index.html"),"utf8");
   assert.doesNotMatch(card,/contact-modal\.css/);
   assert.match(card,/as="image" type="image\/webp" fetchpriority="high"/);
   assert.match(card,/<img[^>]+fetchpriority="high">/);
   const home=fs.readFileSync(path.join(f.root,"index.html"),"utf8");
   assert.equal((home.match(/fetchpriority="high"/g)||[]).length,2);
 }finally{f.cleanup();}
});
test("unknown or unapproved HTML blocks automated correction",()=>{
 const f=make();
 try {
   f.put("gry-karciane/index.html",'<head><link rel="stylesheet" href="/assets/contact-modal.css?v=r8" data-contact-modal-style></head><img src="/assets/something-else.webp">');
   const before=fs.readFileSync(path.join(f.root,"gry-karciane/index.html"),"utf8");
   const report=repairSite(f.root,{write:true});
   assert.ok(report.warnings.some(x=>x.includes("no verified contact modal loader")));
   assert.ok(report.warnings.some(x=>x.includes("hero image changed")));
   assert.equal(fs.readFileSync(path.join(f.root,"gry-karciane/index.html"),"utf8"),before);
 }finally{f.cleanup();}
});
test("observer reports measured Lighthouse LCP, never field INP",async()=>{
 const sample=await measure({url:"https://gracz.pl/",strategy:"mobile",fetcher:async input=>{
   assert.equal(input.hostname,"www.googleapis.com");
   assert.equal(input.searchParams.get("url"),"https://gracz.pl/");
   return {ok:true,json:async()=>({lighthouseResult:{categories:{performance:{score:.98}},audits:{
    "largest-contentful-paint":{numericValue:2170.75},"total-blocking-time":{numericValue:12},
    "cumulative-layout-shift":{numericValue:0.01}
   }}})};
 }});
 assert.equal(classify(sample).state,"good");
 assert.equal(sample.lcpMs,2171);
 assert.equal(sample.score,98);
 assert.equal(sample.inpMs,undefined);
});
test("provider failures, missing LCP and nonallowlisted URLs fail closed",async()=>{
 const blocked=await measure({url:"https://another-domain.test/",fetcher:async()=>{throw Error("must not run");}});
 assert.equal(blocked.state,"invalid_scope");
 const quota=await measure({url:"https://gracz.pl/",fetcher:async()=>({ok:false,status:429})});
 assert.deepEqual(classify(quota),{state:"unknown",reason:"rate_limited"});
 const missing=await measure({url:"https://gracz.pl/",fetcher:async()=>({ok:true,json:async()=>({})})});
 assert.equal(classify(missing).state,"unknown");
 assert.equal(classify({state:"available",lcpMs:2900,score:90}).state,"attention");
});


test("offscreen mobile LCP paint optimization leaves both critical hero regions eager",()=>{
  const root=path.resolve("maintenance-site");
  const home=fs.readFileSync(path.join(root,"assets/home-premium-max.css"),"utf8");
  const poker=fs.readFileSync(path.join(root,"assets/poker-treningowy.css"),"utf8");
  const homeMarkup=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const pokerMarkup=fs.readFileSync(path.join(root,"gry/poker-treningowy/index.html"),"utf8");
  const homeRule=home.split("/* MOBILE LCP R1:").at(-1);
  const pokerRule=poker.split("/* MOBILE LCP R1:").at(-1);
  assert.match(homeRule,/main > :is\(/);
  assert.match(homeRule,/\.academy-showcase/);
  assert.match(homeRule,/\.updates-premium/);
  assert.doesNotMatch(homeRule,/\.home-hero-premium/);
  assert.match(pokerRule,/\.main-column > :is\(/);
  assert.match(pokerRule,/\.poker-scene-section/);
  assert.doesNotMatch(pokerRule,/\.hero-card|\.academy-cockpit|\.site-header/);
  // The live R4/R14 homepage HERO replaced the former home-hero-premium class.
  // Verify both the current visual LCP candidate and semantic copy remain eager.
  assert.match(homeMarkup,/<section class="r4-hero" aria-labelledby="hero-title">/);
  assert.match(homeMarkup,/<picture class="r4-owner-picture" aria-hidden="true">/);
  assert.match(homeMarkup,/<img class="r4-owner-image"[^>]*loading="eager"[^>]*fetchpriority="high">/);
  assert.match(homeMarkup,/<link rel="preload" href="\\/assets\\/gracz-hero-mobile-lcp-r16\\.webp"[^>]*media="\\(max-width:680px\\)"[^>]*fetchpriority="high">/);
  assert.match(homeMarkup,/<link rel="preload" href="\\/assets\\/gracz-hero-approved-r14\\.webp"[^>]*media="\\(min-width:1181px\\)"[^>]*fetchpriority="high">/);
  assert.doesNotMatch(homeRule,/\\.r4-hero\\b/);
  assert.match(pokerMarkup,/class="hero-card"/);
  assert.match(homeRule,/content-visibility:auto/);
  assert.match(pokerRule,/content-visibility:auto/);
});


test("Poker offscreen thumbnails are nonblocking but restored after first paint and without JavaScript",()=>{
 const html=fs.readFileSync("maintenance-site/gry/poker-treningowy/index.html","utf8");
 const js=fs.readFileSync("maintenance-site/assets/poker-treningowy.js","utf8");
 const css=fs.readFileSync("maintenance-site/assets/related-thumbnails.css","utf8");
 assert.match(html,/<link rel="stylesheet" href="\/assets\/related-thumbnails\.css\?v=frameless-r2" media="print" data-poker-related-style>/);
 assert.match(html,/<noscript><link rel="stylesheet" href="\/assets\/related-thumbnails\.css\?v=frameless-r2"><\/noscript>/);
 assert.match(js,/querySelector\('link\[data-poker-related-style\]'\)/);
 assert.match(js,/requestAnimationFrame\(activateRelatedStyle\)/);
 assert.match(js,/relatedStyle\.media='all'/);
 assert.match(css,/\.related-image\{/);
 // Visible first-screen hero, cookie consent and navigation remain render-blocking.
 for (const href of ["cookie-consent.css?v=r3","poker-treningowy.css?v=corr-r1",
   "unified-subpage-hero.css?v=r2","academy-global-qa.css?v=corr-r1",
   "global-header-r1.css?v=r3"]){
   assert.match(html,new RegExp('<link rel="stylesheet" href="/assets/'+href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'">'));
 }
 assert.doesNotMatch(css,/\.gcc-dialog|\.hero-card|\.site-header/);
});
