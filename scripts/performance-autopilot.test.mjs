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
 put("gry-karciane/index.html",'<head>'+css+'</head><body>'+shared+'<img src="/assets/gry-karciane-hero-reference.webp" alt=""></body>');
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
