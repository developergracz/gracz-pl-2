// Fallback for Google PageSpeed quota errors: local Chrome + Lighthouse on GitHub runner.
// The CLI only receives fixed allowlisted public gracz.pl URLs. No site writes or API credentials.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {PAGE_URLS,classify} from "./performance-observer.mjs";
const exec=promisify(execFile);
const PACKAGE="lighthouse@12.8.2";
const FAIL_REASONS=new Set(["rate_limited","provider_http_403","provider_http_429"]);
export function eligibleForFallback(report) {
 return Boolean(report && PAGE_URLS.includes(report.url) &&
   ["mobile","desktop"].includes(report.strategy) &&
   report.state==="unavailable" && FAIL_REASONS.has(report.reason));
}
// Read-only, bounded LCP attribution from the Lighthouse JSON report.
// Never interpret these diagnostics as authorization to change any source file.
export function summarizeLcpEvidence(audits={}) {
  const relevantIds=Object.keys(audits).filter(x=>
    x==="largest-contentful-paint-element" ||
    x==="lcp-breakdown-insight" || x==="lcp-discovery-insight" ||
    x==="render-blocking-resources" || x==="render-blocking-insight"
  );
  const selectors=[];
  function visit(value,depth=0){
    if(!value || typeof value!=="object" || depth>5 || selectors.length>=4)return;
    if(typeof value.selector==="string" && value.selector.length<250){
      selectors.push({selector:value.selector,description:
        typeof value.nodeLabel==="string" ? value.nodeLabel.slice(0,140) : null});
    }
    if(Array.isArray(value)){
      for(const x of value.slice(0,6))visit(x,depth+1);
    }else{
      for(const k of ["node","element","lcpElement","items","subItems","value","lcpBreakdown"])
        if(value[k])visit(value[k],depth+1);
    }
  }
  for(const id of relevantIds)visit(audits[id]?.details?.items,0);
  const timings={};
  for(const [name,id] of [
    ["fcpMs","first-contentful-paint"],
    ["ttfbMs","server-response-time"],
    ["speedIndexMs","speed-index"]
  ]){
    const n=audits[id]?.numericValue;
    if(Number.isFinite(n) && n>=0)timings[name]=Math.round(n);
  }
  const blockers=[];
  for(const id of ["render-blocking-resources","render-blocking-insight"]){
    const items=audits[id]?.details?.items;
    if(!Array.isArray(items))continue;
    for(const item of items.slice(0,12)){
      if(typeof item?.url!=="string" || blockers.length>=6)continue;
      let pathname;
      try{
        const u=new URL(item.url);
        // Report only pathnames for known public, first-party assets.
        if(u.origin!=="https://gracz.pl")continue;
        pathname=u.pathname.slice(0,150);
      }catch{continue;}
      if(blockers.some(b=>b.path===pathname))continue;
      blockers.push({path:pathname,
        wastedMs:Number.isFinite(item.wastedMs)?Math.round(item.wastedMs):null});
    }
  }
  // Insight audit presence is useful when exact element attribution is unavailable.
  return {element:selectors[0]||null,insightsAvailable:relevantIds,
    timings,blockers};
}
export function parseLighthouse(json,url,strategy){
 const audits=json?.audits,raw=audits?.["largest-contentful-paint"]?.numericValue;
 const score=json?.categories?.performance?.score;
 if(!Number.isFinite(raw)||raw<0||!Number.isFinite(score)||score<0||score>1)
   return {url,strategy,state:"unavailable",reason:"invalid_local_lighthouse_report"};
 return {url,strategy,state:"available",source:"Lighthouse local Chrome lab",
   lcpMs:Math.round(raw),score:Math.round(score*100),
   lcpEvidence:summarizeLcpEvidence(audits),
   tbtMs:Number.isFinite(audits["total-blocking-time"]?.numericValue)?
     Math.round(audits["total-blocking-time"].numericValue):null,
   cls:Number.isFinite(audits["cumulative-layout-shift"]?.numericValue)?
     audits["cumulative-layout-shift"].numericValue:null,
   checkedAt:new Date().toISOString()};
}
export async function localLighthouse(url,strategy,{execute=exec}={}){
 if(!PAGE_URLS.includes(url)||!["mobile","desktop"].includes(strategy))
   return {url,strategy,state:"invalid_scope"};
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),"gracz-lighthouse-"));
 const output=path.join(folder,"report.json");
 try{
   const args=["--yes",PACKAGE,url,"--quiet","--only-categories=performance",
     "--output=json","--output-path="+output,
     "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
     "--max-wait-for-load=20000"];
   if(strategy==="desktop")args.push("--preset=desktop");
   await execute("npx",args,{timeout:120000,maxBuffer:512000,env:{
     ...process.env,CHROME_PATH:process.env.CHROME_PATH||"/usr/bin/google-chrome"
   }});
   return parseLighthouse(JSON.parse(fs.readFileSync(output,"utf8")),url,strategy);
 }catch{return {url,strategy,state:"unavailable",reason:"local_lighthouse_failed"};}
 finally{fs.rmSync(folder,{recursive:true,force:true});}
}
export async function supplement(report,{runner=localLighthouse,maxRuns=2}={}){
 if(!Array.isArray(report?.reports))return {state:"invalid_report"};
 const updated=report.reports.map(x=>({...x}));
 let count=0;
 // Prefer mobile homepage and mobile subpage. Desktop remains scheduled PSI-only
 // if the provider is unavailable, limiting public traffic and CI resource use.
 for(let i=0;i<updated.length&&count<maxRuns;i++){
   const r=updated[i];
   if(!eligibleForFallback(r)||r.strategy!=="mobile")continue;
   count++;
   const fallback=await runner(r.url,r.strategy);
   if(fallback?.state==="available"&&
       Number.isFinite(fallback.lcpMs)&&Number.isFinite(fallback.score))
     updated[i]=fallback;
 }
 return {...report,reports:updated,assessments:updated.map(classify),
   localFallbackRuns:count};
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 const target=process.env.PERF_REPORT_PATH||"performance-report.json";
 let report;
 try{report=JSON.parse(fs.readFileSync(target,"utf8"));}
 catch{process.stdout.write('{"state":"missing_report"}\n');process.exit(0);}
 const out=await supplement(report);
 if(out.state==="invalid_report"){process.stdout.write('{"state":"invalid_report"}\n');process.exit(0);}
 fs.writeFileSync(target,JSON.stringify(out,null,2)+"\n");
 if(process.env.GITHUB_STEP_SUMMARY){
   const lines=["\n### Pomiar zapasowy Lighthouse w Chrome"];
   lines.push("Uruchomione testy zapasowe: "+out.localFallbackRuns);
   for(const r of out.reports)lines.push("- "+new URL(r.url).pathname+" "+r.strategy+": "+(r.lcpMs??"brak pomiaru")+" ms ("+r.state+")");
   fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
 }
 process.stdout.write(JSON.stringify({localFallbackRuns:out.localFallbackRuns,
   reports:out.reports.map(r=>({url:r.url,strategy:r.strategy,state:r.state,lcpMs:r.lcpMs,source:r.source,reason:r.reason}))})+"\n");
}
