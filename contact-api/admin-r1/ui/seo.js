"use strict";
const $ = id => document.getElementById(id);
const terms={
  canonical:"Nieprawidłowy adres kanoniczny",
  noindex:"Indeksacja zablokowana lub brak poprawnych dyrektyw robots",
  title:"Brak tytułu strony",
  unavailable:"Strona niedostępna lub przekierowana",
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
  } finally { $("seo-refresh").disabled=false; }
}
$("seo-refresh").addEventListener("click",()=>void load());
void load();
