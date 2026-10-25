"use strict";
const $=id=>document.getElementById(id);
const PUBLIC="https://gracz.pl/";
const POKER="https://gracz.pl/gry/poker-treningowy/";
const asDate=value=>{
  if(!value)return "—";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("pl-PL");
};
const statusLine=message=>{$("performance-status").textContent=message;};
const create=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
function metric(id,value){
  const el=$(id),n=Number.isInteger(value)?value:null;
  el.textContent=n===null?"—":(n/1000).toLocaleString("pl-PL",{minimumFractionDigits:3,maximumFractionDigits:3})+" s";
  el.classList.toggle("is-slow",n!==null&&n>=2500);
  el.classList.toggle("is-fast",n!==null&&n<2500);
}
function showMeasurements(data){
  const reports=Array.isArray(data.latest?.reports)?data.latest.reports:[];
  const get=(url,strategy)=>reports.find(x=>x.url===url&&x.strategy===strategy);
  metric("perf-home-mobile",get(PUBLIC,"mobile")?.lcpMs);
  metric("perf-home-desktop",get(PUBLIC,"desktop")?.lcpMs);
  metric("perf-poker-mobile",get(POKER,"mobile")?.lcpMs);
  $("performance-checked").textContent=data.latest?
    "Pomiar GitHub Actions: "+asDate(data.latest.createdAt)+" · commit "+(data.latest.commit||"nieznany"):
    "Brak potwierdzonych pomiarów Lighthouse.";
  const list=document.createDocumentFragment();
  for(const r of reports.filter(x=>x.strategy==="mobile")){
    const location=r.url===PUBLIC?"Strona główna":r.url===POKER?"Poker":"Podstrona";
    const item=create("li",location+": "+(Number.isInteger(r.lcpMs)?r.lcpMs+" ms":"brak pomiaru")+
      (r.element?" · Element LCP: "+r.element:""));
    list.append(item);
    for(const b of (r.blockers||[]).slice(0,4)){
      list.append(create("li","Zasób blokujący: "+b.path+
        (Number.isInteger(b.wastedMs)?" ("+b.wastedMs+" ms szacowanego opóźnienia)":"")));
    }
  }
  if(!list.childNodes.length)list.append(create("li","Brak szczegółowego raportu."));
  $("performance-diagnosis").replaceChildren(list);
}
function showHistory(data){
  const body=$("performance-history"),rows=document.createDocumentFragment();
  for(const run of (data.history||[]).slice(0,6)){
    const tr=document.createElement("tr");
    const td=document.createElement("td"),a=document.createElement("a");
    a.href=run.url;a.textContent="Uruchomienie #"+run.id;
    a.target="_blank";a.rel="noopener noreferrer";
    td.append(a);tr.append(td);
    tr.append(create("td",asDate(run.createdAt)));
    tr.append(create("td",run.conclusion==="success"?"PASS":run.conclusion==="failure"?"FAIL":
      run.conclusion==="cancelled"?"Anulowano":"W toku / brak wyniku"));
    const sample=run.reports?.find(x=>x.url===PUBLIC&&x.strategy==="mobile");
    tr.append(create("td",Number.isInteger(sample?.lcpMs)?sample.lcpMs+" ms":"—"));
    rows.append(tr);
  }
  if(!rows.childNodes.length){
    const tr=document.createElement("tr"),td=create("td","Brak zweryfikowanej historii GitHub Actions.");
    td.colSpan=4;tr.append(td);rows.append(tr);
  }
  body.replaceChildren(rows);
}
async function load(){
  const btn=$("performance-refresh");btn.disabled=true;statusLine("Pobieranie prywatnych raportów GitHub…");
  try{
    const r=await fetch("/owner/newsletter/performance/report",{
      method:"GET",credentials:"same-origin",cache:"no-store",
      headers:{"Accept":"application/json"}
    });
    if(r.status===401){location.assign("/owner/newsletter/login/systemadmin");return;}
    if(!r.ok)throw Error("unavailable");
    const data=await r.json();
    if(data.source!=="github_actions_private" || !["available","incomplete","unavailable","needs_configuration"].includes(data.state))
      throw Error("invalid_report");
    showMeasurements(data);showHistory(data);
    const rollback=$("performance-rollback");
    rollback.replaceChildren();
    if(data.rollback?.url){
      const a=create("a",data.rollback.conclusion==="success"?"PASS — staging":
        data.rollback.conclusion==="failure"?"FAIL — staging":"Weryfikacja w toku");
      a.href=data.rollback.url;a.target="_blank";a.rel="noopener noreferrer";
      rollback.append(a);
      rollback.append(document.createTextNode(" · "+asDate(data.rollback.checkedAt)));
    }else{rollback.textContent="Brak potwierdzenia w raportach GitHub";}
    statusLine(data.state==="available"?"Połączono — raporty GitHub Actions odczytane. Ostatnia kontrola: "+asDate(data.checkedAt):
      data.state==="needs_configuration"?
      "Wymagane uprawnienie GitHub Actions:read na serwerze (GRACZ_PERFORMANCE_GITHUB_TOKEN).":
      data.state==="incomplete"?"Połączono z GitHub, ale brak pełnych pomiarów Lighthouse.":
      "Nie można obecnie pobrać prywatnych raportów GitHub.");
  }catch{
    metric("perf-home-mobile",null);metric("perf-home-desktop",null);metric("perf-poker-mobile",null);
    statusLine("Raport jest niedostępny. Spróbuj ponownie bez zmieniania ustawień strony.");
  }finally{btn.disabled=false;}
}
$("performance-refresh").addEventListener("click",()=>void load());
void load();
