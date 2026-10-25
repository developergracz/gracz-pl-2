// GRACZ.PL Performance Guardian R3 — Lighthouse and rules only, no paid AI/API.
// Laboratory observations are advisory. Automatic code changes remain limited
// to the separately tested, allowlisted source repair engine.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {PAGE_URLS, classify} from "./performance-observer.mjs";
import {localLighthouse} from "./performance-lighthouse-fallback.mjs";

export const LCP_GOOD_MS = 2500;
const MAIN = PAGE_URLS[0];

export function sampleTargets(tick = Date.now()) {
  const subpageIndex = 1 + (Math.floor(tick / 21600000) % (PAGE_URLS.length - 1));
  return [
    {url:MAIN, strategy:"mobile"},
    {url:MAIN, strategy:"desktop"},
    {url:PAGE_URLS[subpageIndex], strategy:"mobile"}
  ];
}
export function diagnoseMeasurement(sample) {
  const assessment = classify(sample);
  if (assessment.state==="unknown")
    return {state:"unknown",finding:"Pomiar niedostępny — brak podstaw do naprawy.",checks:[]};
  if (assessment.state==="good")
    return {state:"good",finding:"Laboratoryjny LCP mieści się w celu 2,5 s.",checks:[]};

  // Investigations, not claims of proven root causes.
  const checks = [
    "Sprawdź w raporcie Lighthouse element LCP, obraz główny, fonty i zasoby blokujące renderowanie."
  ];
  if (Number.isFinite(sample.tbtMs) && sample.tbtMs > 200)
    checks.push("Podwyższone TBT: zbadaj skrypty i zadania blokujące wątek główny.");
  if (Number.isFinite(sample.cls) && sample.cls > 0.1)
    checks.push("Podwyższone CLS: sprawdź wymiary obrazów i przesunięcia układu.");
  return {state:"attention",finding:"Laboratoryjny LCP przekracza 2,5 s; przyczyna nie jest jeszcze potwierdzona.",checks};
}
export function evaluateFreeReport(reports, checkedAt = new Date().toISOString()) {
  if (!Array.isArray(reports) || reports.some(r=>
    !r || !PAGE_URLS.includes(r.url) || !["mobile","desktop"].includes(r.strategy)))
    throw Error("Unexpected measurement scope");
  const assessments = reports.map(classify);
  const diagnostic = reports.map((r,i)=>({
    url:r.url,strategy:r.strategy,source:r.source || "unavailable",
    lcpMs:reports[i].lcpMs??null,
    ...diagnoseMeasurement(r)
  }));
  return {
    checkedAt,kind:"local_lighthouse_lab",paidAiUsed:false,
    reports,assessments,diagnostic,
    state:diagnostic.some(d=>d.state==="attention") ? "attention" :
      diagnostic.every(d=>d.state==="good") ? "good" : "incomplete"
  };
}
export async function runFreeCycle({tick = Date.now(),runner = localLighthouse}={}) {
  const results=[];
  for(const target of sampleTargets(tick)){
    try {
      const r=await runner(target.url,target.strategy);
      if(r?.state==="available" && Number.isFinite(r.lcpMs) &&
         Number.isFinite(r.score) && r.lcpMs>=0) {
        results.push({...r,url:target.url,strategy:target.strategy});
      }else{
        results.push({url:target.url,strategy:target.strategy,
          state:"unavailable",reason:r?.reason || "local_lighthouse_failed"});
      }
    }catch{
      results.push({...target,state:"unavailable",reason:"local_lighthouse_failed"});
    }
  }
  return evaluateFreeReport(results);
}
export function formatSummary(result) {
  const lines=[
    "## GRACZ.PL Performance Guardian — bezpłatny pomiar Lighthouse",
    "",
    "| Strona | Urządzenie | LCP | Stan |",
    "|---|---|---:|---|"
  ];
  for(let i=0;i<result.reports.length;i++){
    const r=result.reports[i], d=result.diagnostic[i];
    lines.push(`| ${new URL(r.url).pathname} | ${r.strategy} | ${d.lcpMs===null?"brak":d.lcpMs+" ms"} | ${d.state} |`);
  }
  lines.push("","**Diagnostyka:**");
  for(const d of result.diagnostic){
    if(d.state==="attention")lines.push(
      "- "+new URL(d.url).pathname+" ("+d.strategy+"): "+d.finding+" "+d.checks.join(" ")
    );
  }
  if(!result.diagnostic.some(d=>d.state==="attention"))
    lines.push("- Brak potwierdzonego problemu LCP w dostępnej próbie.");
  lines.push("","Wyniki laboratoryjne, nie CrUX. Brak danych nie oznacza regresji.",
    "Brak wywołań OpenAI API ani Google PageSpeed API. Automatyczne poprawki ogranicza osobna lista dozwolonych zmian.");
  return lines.join("\n")+"\n";
}
const main = process.argv[1] &&
  path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  const report=await runFreeCycle();
  fs.writeFileSync(process.env.PERF_REPORT_PATH || "performance-report.json",
    JSON.stringify(report,null,2)+"\n");
  if(process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,formatSummary(report));
  process.stdout.write(JSON.stringify({
    state:report.state,paidAiUsed:false,
    reports:report.reports.map(r=>({url:r.url,strategy:r.strategy,
      lcpMs:r.lcpMs??null,state:r.state,reason:r.reason}))
  })+"\n");
}
