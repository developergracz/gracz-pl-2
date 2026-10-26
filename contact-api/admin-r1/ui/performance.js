"use strict";
const $=id=>document.getElementById(id);
const PUBLIC="https://gracz.pl/";
const POKER="https://gracz.pl/gry/poker-treningowy/";
const asDate=value=>{
  if(!value)return "—";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pl-PL",{
    timeZone:"Europe/Warsaw",dateStyle:"medium",timeStyle:"medium"
  }).format(d);
};
const statusLine=message=>{$("performance-status").textContent=message;};
const create=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
function metric(id,value){
  const el=$(id),n=Number.isInteger(value)?value:null;
  el.textContent=n===null?"—":(n/1000).toLocaleString("pl-PL",{minimumFractionDigits:3,maximumFractionDigits:3})+" s";
  el.classList.toggle("is-slow",n!==null&&n>=2500);
  el.classList.toggle("is-fast",n!==null&&n<2500);
}
// Server-side triage contains only validated public findings; do not copy
// credentials, private raw logs or browser session data.
let findings=[];
let findingsContext=null;
const categories={lcp:"LCP — największy element",css:"CSS blokujący renderowanie",
  fcp:"FCP — pierwsze wyświetlenie",ttfb:"TTFB — odpowiedź serwera"};
const priorities={high:"Wysoki",medium:"Średni",info:"Informacyjny"};
const allowedLink=raw=>{
  if(typeof raw!=="string"||raw.length>500)return null;
  try{
    const u=new URL(raw);
    if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)return null;
    if(u.origin==="https://gracz.pl" &&
       (u.pathname==="/"||u.pathname==="/gry/poker-treningowy/"||
        /^\/assets\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)))return u.href;
    if(u.origin==="https://github.com" &&
       u.pathname.startsWith("/developergracz/gracz-pl-2/blob/main/maintenance-site/"))
      return u.href;
  }catch{}
  return null;
};
function filteredFindings(){
  const category=$("performance-filter-category").value;
  const page=$("performance-filter-page").value;
  const priority=$("performance-filter-priority").value;
  const query=$("performance-filter-query").value.trim().toLocaleLowerCase("pl-PL");
  return findings.filter(x=>(category==="all"||x.category===category)&&
    (page==="all"||x.page===page)&&(priority==="all"||x.priority===priority)&&
    (!query||[x.title,x.metric,x.selector,x.resourceUrl,x.pageName,x.codeUrl]
      .some(y=>typeof y==="string"&&y.toLocaleLowerCase("pl-PL").includes(query))));
}
function copyPayload(items){
  const ctx=findingsContext;
  const date=ctx?.reports?.find(x=>x.reportLoggedAt)?.reportLoggedAt;
  const lines=[
    "GRACZ.PL — DIAGNOZA WYDAJNOŚCI DO WERYFIKACJI I BEZPIECZNEJ NAPRAWY",
    "Repozytorium: developergracz/gracz-pl-2 (gałąź main).",
    "Źródło: Performance Guardian R3 / GitHub Actions / lokalny Chrome Lighthouse (mobile).",
    "Zapis raportu: "+(date?asDate(date):"brak potwierdzonego czasu")+
      " (Europe/Warsaw).",
    "Start uruchomienia: "+asDate(ctx?.createdAt)+".",
    "Proszę przeanalizować wskazane problemy, zweryfikować aktualny kod i dobrać najmniejszą bezpieczną poprawkę. "+
      "Nie zmieniaj działania cookies, logowania, newslettera ani wyglądu hero. "+
      "Przed wdrożeniem wykonaj testy SEO, bezpieczeństwa i Lighthouse. "+
      "Wyniki CSS są szacunkami diagnostycznymi i nie sumują się; priorytet NIE jest pomiarem pozycji Google.",
    ""
  ];
  items.forEach((x,i)=>{
    lines.push((i+1)+". "+x.title,
      "   Kategoria: "+(categories[x.category]||x.category)+
        "; priorytet techniczny: "+(priorities[x.priority]||x.priority),
      "   Wynik: "+x.metric,
      "   Badana strona: "+x.pageUrl);
    if(x.resourceUrl)lines.push("   Zasób: "+x.resourceUrl);
    if(x.codeUrl)lines.push("   Plik w GitHub: "+x.codeUrl);
    if(x.selector)lines.push("   Element LCP: "+x.selector);
  });
  return lines.join("\\n");
}
async function putOnClipboard(value,description){
  if(!value)return;
  let ok=false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(value);ok=true;
    }
  }catch{ /* Use the browser's legacy copy fallback on secure admin pages. */ }
  if(!ok){
    const field=document.createElement("textarea");
    field.value=value;field.setAttribute("readonly","");
    field.style.position="fixed";field.style.left="-9999px";
    document.body.append(field);
    field.select();
    try{ok=document.execCommand("copy")===true;}catch{ok=false;}
    field.remove();
  }
  $("performance-copy-status").textContent=ok?
    "Skopiowano: "+description+". Wklej tekst w ChatGPT (Ctrl + V).":
    "Nie udało się automatycznie skopiować. Sprawdź uprawnienia schowka w przeglądarce.";
}
const addIssueLink=(parent,label,value)=>{
  const link=allowedLink(value);
  if(!link)return;
  const a=create("a",label);a.href=link;a.target="_blank";a.rel="noopener noreferrer";
  parent.append(a);
};
function renderFindings(){
  const visible=filteredFindings();
  const list=document.createDocumentFragment();
  for(const x of visible){
    const li=document.createElement("li");li.className="performance-issue";
    const head=document.createElement("div");head.className="performance-issue-heading";
    const title=create("strong",x.title);title.className="performance-issue-title";
    const priority=create("span",priorities[x.priority]||"Informacyjny");
    priority.className="performance-issue-priority";priority.dataset.priority=x.priority;
    head.append(title,priority);li.append(head);
    const detail=create("p",(categories[x.category]||x.category)+
      " · "+x.metric+(x.selector?" · Element: "+x.selector:""));
    detail.className="performance-issue-meta";li.append(detail);
    const links=document.createElement("div");links.className="performance-issue-links";
    addIssueLink(links,"Strona",x.pageUrl);
    addIssueLink(links,"Zasób publiczny",x.resourceUrl);
    addIssueLink(links,"Plik w GitHub",x.codeUrl);
    li.append(links);
    const actions=document.createElement("div");actions.className="performance-issue-buttons";
    const one=create("button","Kopiuj do ChatGPT");one.type="button";
    one.addEventListener("click",()=>void putOnClipboard(copyPayload([x]),"opis jednego problemu"));
    actions.append(one);
    const target=allowedLink(x.codeUrl)||allowedLink(x.resourceUrl)||allowedLink(x.pageUrl);
    if(target){
      const linkButton=create("button","Kopiuj link");linkButton.type="button";
      linkButton.addEventListener("click",()=>void putOnClipboard(target,"link do pliku lub strony"));
      actions.append(linkButton);
    }
    li.append(actions);list.append(li);
  }
  if(visible.length===0)list.append(create("li",
    findings.length?"Brak wyników dla wybranych filtrów.":"Brak potwierdzonych danych diagnostycznych."));
  $("performance-diagnosis").replaceChildren(list);
  $("performance-findings-count").textContent=
    "Widoczne: "+visible.length+" / "+findings.length+
    " · Wysoki priorytet: "+findings.filter(x=>x.priority==="high").length+
    ". Priorytet oznacza wielkość problemu wydajnościowego, nie pozycję w Google.";
  $("performance-copy-visible").disabled=visible.length===0;
  $("performance-copy-all").disabled=findings.length===0;
  $("performance-copy-priority").disabled=!findings.some(x=>x.priority==="high");
}
function showFindings(data){
  findings=Array.isArray(data?.issues)?data.issues.filter(x=>
    x && Object.hasOwn(categories,x.category)&&
    Object.hasOwn(priorities,x.priority)&&["home","poker"].includes(x.page)&&
    typeof x.title==="string"&&typeof x.metric==="string"&&
    allowedLink(x.pageUrl)).slice(0,30):[];
  findingsContext={reports:data.latest?.reports,createdAt:data.latest?.createdAt};
  renderFindings();
}
function showMeasurements(data){
  const reports=Array.isArray(data.latest?.reports)?data.latest.reports:[];
  const get=(url,strategy)=>reports.find(x=>x.url===url&&x.strategy===strategy);
  metric("perf-home-mobile",get(PUBLIC,"mobile")?.lcpMs);
  metric("perf-home-desktop",get(PUBLIC,"desktop")?.lcpMs);
  metric("perf-poker-mobile",get(POKER,"mobile")?.lcpMs);
  const reportTime=reports.find(r=>r.reportLoggedAt)?.reportLoggedAt;
  $("performance-checked").textContent=data.latest?
    "Źródło: GitHub Actions → lokalny Lighthouse (Chrome, laboratorium). "+
    (reportTime?"Raport pomiarów zapisano: "+asDate(reportTime)+". ":
      "Czas zapisu raportu niedostępny. ")+
    "Uruchomienie zadania: "+asDate(data.latest.createdAt)+
    " · commit "+(data.latest.commit||"nieznany")+". "+
    "Godziny: Europe/Warsaw.":
    "Źródło: GitHub Actions → lokalny Lighthouse (Chrome). Brak potwierdzonych pomiarów.";
  showFindings(data);
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
    showFindings(null);
    statusLine("Raport jest niedostępny. Spróbuj ponownie bez zmieniania ustawień strony.");
  }finally{btn.disabled=false;}
}
$("performance-refresh").addEventListener("click",()=>void load());
for(const id of ["performance-filter-category","performance-filter-page",
  "performance-filter-priority","performance-filter-query"]){
  $(id).addEventListener(id==="performance-filter-query"?"input":"change",renderFindings);
}
$("performance-copy-visible").addEventListener("click",()=>
  void putOnClipboard(copyPayload(filteredFindings()),"widoczne wyniki"));
$("performance-copy-priority").addEventListener("click",()=>
  void putOnClipboard(copyPayload(findings.filter(x=>x.priority==="high")),"problemy o wysokim priorytecie"));
$("performance-copy-all").addEventListener("click",()=>
  void putOnClipboard(copyPayload(findings),"wszystkie wyniki"));
// Mirror SEO's highlighted navigation while visiting real report anchors.
const performanceNav=document.querySelector(".performance-side nav");
function updatePerformanceNav(){
  const selected=location.hash||"#main";
  for(const link of performanceNav.querySelectorAll('a[href^="#"]')){
    if(link.getAttribute("href")===selected)link.setAttribute("aria-current","location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange",updatePerformanceNav);
updatePerformanceNav();
void load();
