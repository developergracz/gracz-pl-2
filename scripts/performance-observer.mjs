// Production PageSpeed observer. External results are advisory, never an automatic code-edit instruction.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

export const PAGE_URLS = Object.freeze([
 "https://gracz.pl/", "https://gracz.pl/gry/", "https://gracz.pl/gry-karciane/",
 "https://gracz.pl/poradniki/", "https://gracz.pl/o-gracz-pl/",
 "https://gracz.pl/gry/warcaby/", "https://gracz.pl/gry/gomoku/",
 "https://gracz.pl/gry/tysiac/", "https://gracz.pl/gry/poker-treningowy/"
]);
export function classify(report) {
 if (report.state !== "available") return {state:"unknown",reason:report.reason || "no_data"};
 const lcp = report.lcpMs;
 if (!Number.isFinite(lcp) || lcp < 0) return {state:"unknown",reason:"invalid_lcp"};
 return {state:lcp > 2500 ? "attention":"good",lcpMs:lcp,score:report.score,source:"Lighthouse lab"};
}
export async function measure({url,strategy="mobile",fetcher=fetch,key=""}={}) {
 if (!PAGE_URLS.includes(url) || !["mobile","desktop"].includes(strategy))
   return {url,strategy,state:"invalid_scope"};
 const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
 endpoint.searchParams.set("url",url);
 endpoint.searchParams.set("strategy",strategy);
 endpoint.searchParams.set("category","performance");
 if (key) endpoint.searchParams.set("key",key);
 try {
   const response = await fetcher(endpoint,{signal:AbortSignal.timeout(35000),headers:{"accept":"application/json"}});
   if (!response.ok) return {url,strategy,state:"unavailable",reason:response.status===429?"rate_limited":"provider_http_"+response.status};
   const payload = await response.json();
   const audits = payload?.lighthouseResult?.audits;
   const raw = audits?.["largest-contentful-paint"]?.numericValue;
   const rawScore = payload?.lighthouseResult?.categories?.performance?.score;
   if (!Number.isFinite(raw) || !Number.isFinite(rawScore))
     return {url,strategy,state:"unavailable",reason:"incomplete_report"};
   return {url,strategy,state:"available",lcpMs:Math.round(raw),score:Math.round(rawScore*100),
     tbtMs:Number.isFinite(audits?.["total-blocking-time"]?.numericValue) ?
       Math.round(audits["total-blocking-time"].numericValue):null,
     cls:Number.isFinite(audits?.["cumulative-layout-shift"]?.numericValue) ?
       audits["cumulative-layout-shift"].numericValue:null,checkedAt:new Date().toISOString()};
 }catch{
   return {url,strategy,state:"unavailable",reason:"network_or_timeout"};
 }
}
const main=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if (main) {
 // A bounded rotating sample. Lighthouse values are laboratory snapshots, not real-time RUM.
 const subpage = PAGE_URLS[1 + Math.floor(Date.now()/21600000) % (PAGE_URLS.length-1)];
 const jobs = [["https://gracz.pl/","mobile"],["https://gracz.pl/","desktop"],[subpage,"mobile"]];
 const reports=[];
 for (const [url,strategy] of jobs) reports.push(await measure({
   url,strategy,key:process.env.SEO_PAGESPEED_API_KEY||""
 }));
 const result={checkedAt:new Date().toISOString(),kind:"lab_sample",reports,
   assessments:reports.map(classify)};
 const target=process.env.PERF_REPORT_PATH;
 if (target) fs.writeFileSync(target,JSON.stringify(result,null,2)+"\n");
 const summary=process.env.GITHUB_STEP_SUMMARY;
 if(summary) {
   const lines=["## GRACZ.PL Performance Autopilot — kontrola laboratoryjna","","| Strona | Urządzenie | LCP | Stan |","|---|---|---:|---|"];
   for (let i=0;i<reports.length;i++) {
     const r=reports[i],c=result.assessments[i];
     lines.push(`| ${new URL(r.url).pathname} | ${r.strategy} | ${c.lcpMs ?? "brak danych"} ms | ${c.state} |`);
   }
   lines.push("","Pomiar Lighthouse nie zastępuje danych CrUX. Brak danych nie jest traktowany jako wolna strona.");
   fs.appendFileSync(summary,lines.join("\n")+"\n");
 }
 process.stdout.write(JSON.stringify(result)+"\n");
 // A provider outage must not prompt an unsafe repair, rollback or deployment.
}
