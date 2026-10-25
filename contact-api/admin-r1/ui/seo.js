"use strict";
const $ = id => document.getElementById(id);
const pagesToggle=$("seo-pages-toggle");
const pagesList=$("seo-pages-list");
pagesToggle.addEventListener("click",()=>{
  const open=pagesList.hidden;
  pagesList.hidden=!open;
  pagesToggle.textContent=open?"ZWIŃ":"POKAŻ";
  pagesToggle.setAttribute("aria-expanded",String(open));
});
const terms={
  canonical:"Nieprawidłowy adres kanoniczny",
  noindex:"Indeksacja zablokowana lub brak poprawnych dyrektyw robots",
  title:"Brak tytułu strony",
  unavailable:"Strona niedostępna lub przekierowana",
  description:"Brak opisu SEO", h1:"Nieprawidłowy nagłówek H1",
  sitemap_invalid:"Nieprawidłowa mapa witryny",
  robots_invalid:"Nieprawidłowy plik robots.txt",
  robots_or_sitemap_unavailable:"Nie można odczytać robots.txt lub sitemap.xml"
};
const text=(id,value)=>{$(id).textContent=String(value);};
const label=code=>terms[code]||"Problem techniczny";
const asDate=s=>new Intl.DateTimeFormat("pl-PL",{
  timeZone:"Europe/Warsaw",dateStyle:"medium",timeStyle:"medium"
}).format(new Date(s));
function cell(row,value) {
  const td=document.createElement("td");td.textContent=String(value);row.append(td);
}
async function load() {
  $("seo-refresh").disabled=true;
  text("seo-status","Sprawdzanie publicznej witryny…");
  try {
    const response=await fetch("/owner/newsletter/seo/status",{
      credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}
    });
    if(response.status===401){location.assign("/owner/newsletter/login");return;}
    if(!response.ok)throw Error("unavailable");
    const data=await response.json();
    if(data.scope!=="public_live" || !Array.isArray(data.pages) || !Array.isArray(data.issues))
      throw Error("invalid");
    text("seo-health",data.ok?"OK":"UWAGA");
    text("seo-total",data.total);
    text("seo-passing",data.passing);
    text("seo-count",data.issues.length);
    text("seo-time","Ostatni odczyt: "+asDate(data.checkedAt));
    text("seo-pill",data.ok?"SEO BEZ BŁĘDÓW":"WYMAGA KONTROLI");
    text("seo-status",data.ok?"Wszystkie sprawdzone podstrony poprawne.":"Wykryto problem lub niekompletny wynik kontroli.");
    const rows=document.createDocumentFragment();
    for(const item of data.pages) {
      const tr=document.createElement("tr");
      cell(tr,item.url);cell(tr,item.ok?"OK":"BŁĄD");
      cell(tr,item.problems.length?item.problems.map(label).join(", "):"Bez błędów");
      rows.append(tr);
    }
    $("seo-rows").replaceChildren(rows);
    const choice=$("seo-inspect-url"),current=choice.value;
    choice.replaceChildren(new Option("Wybierz podstronę",""));
    for(const page of data.pages)choice.append(new Option(page.url,page.url));
    if(data.pages.some(x=>x.url===current))choice.value=current;
    renderAdvice(data);
    const issues=document.createDocumentFragment();
    for(const item of data.issues) {
      const li=document.createElement("li");
      li.textContent=label(item.code)+" — "+item.url;
      issues.append(li);
    }
    $("seo-issue-list").replaceChildren(issues);
    text("seo-issue-info",data.issues.length?"Wykryto "+data.issues.length+" problemów.":"Brak zgłoszonych problemów.");
  } catch {
    text("seo-health","—");text("seo-total","—");text("seo-passing","—");
    text("seo-count","—");text("seo-time","Ostatni odczyt: —");
    text("seo-pill","BRAK DANYCH");
    text("seo-status","Stan SEO jest nieznany — nie udało się pobrać wyniku.");
    $("seo-rows").replaceChildren();$("seo-issue-list").replaceChildren();
    text("seo-issue-info","Nie można potwierdzić stanu witryny.");
  } finally { $("seo-refresh").disabled=false;void loadHistory(); }
}
$("seo-refresh").addEventListener("click",()=>void load());
void load();


function rowsInto(id,items,keys) {
  const fragment=document.createDocumentFragment();
  for(const item of items){
    const tr=document.createElement("tr");
    for(const key of keys)cell(tr,item[key]??"—");
    fragment.append(tr);
  }
  $(id).replaceChildren(fragment);
}
function renderAdvice(data){
  const tips={
    unavailable:"Sprawdź dostępność serwera i odpowiedź HTTP.",
    canonical:"Popraw canonical tak, aby wskazywał kanoniczny adres podstrony.",
    noindex:"Sprawdź dyrektywy robots i blokady indeksowania.",
    sitemap_invalid:"Napraw mapę witryny i usuń błędne adresy.",
    robots_invalid:"Sprawdź plik robots.txt oraz deklarację mapy witryny.",
    robots_or_sitemap_unavailable:"Przywróć dostępność robots.txt i sitemap.xml.",
    title:"Uzupełnij unikalny tytuł SEO.",
    description:"Dodaj czytelny i unikalny opis podstrony.",
    h1:"Zapewnij jeden poprawny nagłówek H1."
  };
  const list=document.createDocumentFragment();
  const codes=[...new Set(data.issues.map(x=>x.code))];
  for(const code of codes){
    const item=document.createElement("li");
    item.textContent=tips[code]||"Zweryfikuj problem techniczny strony.";
    list.append(item);
  }
  if(codes.length===0){
    const item=document.createElement("li");
    item.textContent="Brak pilnych problemów technicznych w bieżącym odczycie. To nie jest gwarancja pozycji w Google.";
    list.append(item);
  }
  $("seo-recommendations").replaceChildren(list);
}
async function readPrivate(endpoint){
  const res=await fetch("/owner/newsletter/seo/"+endpoint,{
    credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}
  });
  if(res.status===401){location.assign("/owner/newsletter/login");throw Error("login");}
  if(!res.ok)throw Error("unavailable");
  return res.json();
}
async function loadGoogle(){
  $("google-refresh").disabled=true;
  text("google-state","Pobieranie statystyk Google…");
  try{
    const data=await readPrivate("google");
    if(data.state==="needs_configuration"){
      text("google-state","Search Console: oczekuje na przyznanie dostępu kontu technicznemu Google w Renderze.");
      text("google-period","Dane Google nie są jeszcze podłączone.");
      return;
    }
    if(data.state!=="connected"||!data.totals)throw Error("unavailable");
    text("google-state","Search Console połączone · raport tylko do odczytu");
    text("google-period","Okres: "+data.startDate+" — "+data.endDate+
      " · aktualizacja: "+asDate(data.updatedAt)+". Dane Google pojawiają się z opóźnieniem.");
    text("google-clicks",data.totals.clicks);
    text("google-impressions",data.totals.impressions);
    text("google-ctr",data.totals.ctr===null?"—":data.totals.ctr+"%");
    text("google-position",data.totals.position??"—");
    rowsInto("google-days",data.days.map(x=>({
      date:x.date,clicks:x.clicks,impressions:x.impressions,
      ctr:x.ctr===null?"—":x.ctr+"%"
    })),["date","clicks","impressions","ctr"]);
    rowsInto("google-queries",data.queries.map(x=>({
      query:x.query,clicks:x.clicks,position:x.position
    })),["query","clicks","position"]);
    rowsInto("google-pages",data.pages.map(x=>({
      url:x.url,clicks:x.clicks,position:x.position
    })),["url","clicks","position"]);
  }catch{
    text("google-state","Google Search Console: brak potwierdzonych danych. Sprawdź uprawnienia konta lub połączenie API.");
    text("google-period","Dane Google niedostępne.");
    for(const id of ["google-clicks","google-impressions","google-ctr","google-position"])text(id,"—");
    $("google-queries").replaceChildren();$("google-pages").replaceChildren();$("google-days").replaceChildren();
  }finally{$("google-refresh").disabled=false;}
}
async function loadHistory(){
  try{
    const data=await readPrivate("history");
    if(!Array.isArray(data.entries)||data.storage!=="process_memory")throw Error("invalid");
    rowsInto("seo-history-rows",data.entries.slice().reverse().map(x=>({
      time:asDate(x.checkedAt),status:x.ok?"OK":"UWAGA",issues:x.issues
    })),["time","status","issues"]);
  }catch{$("seo-history-rows").replaceChildren();}
}
async function loadSpeed(){
  $("seo-speed-refresh").disabled=true;
  text("seo-speed-state","Pobieranie danych PageSpeed (mobile)…");
  try{
    const data=await readPrivate("speed");
    if(data.state!=="available")throw Error("not_available");
    text("speed-score",data.score??"—");
    text("speed-lcp",data.lcpMs??"—");
    text("speed-cls",data.cls??"—");
    text("speed-inp",data.inpMs??"—");
    text("seo-speed-state","PageSpeed / Lighthouse · "+asDate(data.checkedAt)+
      ". Raport laboratoryjny, przechowywany w pamięci do 24 godzin.");
  }catch{
    for(const id of ["speed-score","speed-lcp","speed-cls","speed-inp"])text(id,"—");
    text("seo-speed-state","PageSpeed: pomiar niedostępny. Nie pokazujemy fikcyjnych wyników.");
  }finally{$("seo-speed-refresh").disabled=false;}
}
async function inspectGoogle(event){
  event.preventDefault();
  const url=$("seo-inspect-url").value;
  if(!url)return;
  const button=$("seo-inspect-form").querySelector("button");
  button.disabled=true;
  $("seo-inspect-details").hidden=true;
  text("seo-inspect-state","Sprawdzanie indeksu Google…");
  try{
    const auth=await fetch("/owner/newsletter/session",{credentials:"same-origin",cache:"no-store"});
    if(!auth.ok)throw Error("missing_session");
    const session=await auth.json();
    if(typeof session.csrf!=="string")throw Error("missing_csrf");
    const res=await fetch("/owner/newsletter/seo/inspect",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Owner-Csrf":session.csrf},
      body:JSON.stringify({url})
    });
    if(!res.ok)throw Error("unavailable");
    const data=await res.json();
    if(data.state==="needs_configuration"){
      text("seo-inspect-state","Najpierw połącz Google Search Console w konfiguracji Rendera.");
      return;
    }
    if(data.state!=="connected")throw Error("provider_unavailable");
    text("seo-inspect-state","Dane zapisane w indeksie Google dla "+url);
    text("inspect-verdict",data.verdict??"Brak danych");
    text("inspect-coverage",data.coverageState??"Brak danych");
    text("inspect-rules",data.indexingState??"Brak danych");
    text("inspect-canonical",data.googleCanonical??"Brak danych");
    text("inspect-crawl",data.lastCrawlTime??"Brak danych");
    $("seo-inspect-details").hidden=false;
  }catch{
    text("seo-inspect-state","Nie udało się pobrać stanu indeksacji. Sprawdź konfigurację i uprawnienia Search Console.");
  }finally{button.disabled=false;}
}
$("google-refresh").addEventListener("click",()=>void loadGoogle());
$("seo-speed-refresh").addEventListener("click",()=>void loadSpeed());
$("seo-inspect-form").addEventListener("submit",event=>void inspectGoogle(event));
void loadGoogle();
void loadHistory();
