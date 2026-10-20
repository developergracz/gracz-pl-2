"use strict";

// Show/hide controls for every owner-dashboard password field.
document.querySelectorAll('input[type="password"]').forEach(input=>{
  const wrapper=document.createElement('span');
  wrapper.className='password-visibility';
  input.parentNode.insertBefore(wrapper,input);
  wrapper.append(input);
  const button=document.createElement('button');
  button.type='button';
  button.className='password-visibility__toggle';
  button.textContent='Pokaż';
  button.setAttribute('aria-label','Pokaż hasło');
  button.setAttribute('aria-pressed','false');
  wrapper.append(button);
  button.addEventListener('click',()=>{
    const visible=input.type==='password';
    input.type=visible?'text':'password';
    button.textContent=visible?'Ukryj':'Pokaż';
    button.setAttribute('aria-label',visible?'Ukryj hasło':'Pokaż hasło');
    button.setAttribute('aria-pressed',String(visible));
  });
});

let ownerCsrf = null;
const $ = (id) => document.getElementById(id);
const labels = {
  active: "Aktywna",
  unsubscribed: "Wypisana",
  suppressed: "Zablokowana",
  outside_segment: "Poza segmentem",
  unknown: "Niezweryfikowana",
  pending: "Oczekuje na DOI",
  subscribed: "Potwierdzona",
};
const warsawFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  timeZoneName: "short"
});
function warsawTime(value) {
  if (typeof value !== "string" || !value) return "Brak danych";
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime())
    ? `${warsawFormatter.format(timestamp)} (Europe/Warsaw)`
    : "Brak danych";
}
const sourceLabel = code => code === "newsletter_page"
  ? "Strona newslettera" : code ? `Kod: ${code}` : "Nieznane";
const eventLabel = {
  opt_in_requested: "Zgłoszenie", opt_in_confirmed: "Potwierdzenie DOI",
  unsubscribed: "Wycofanie zgody"
};
let next = null,
  loading = false,
  query = "",
  state = "all",
  generation = 0,
  detailGeneration = 0,
  listController,
  detailController,
  summaryController,
  summaryGeneration = 0,
  summaryBusy = false;
const summaryIds = ["total","active","pending","withdrawn","today","week","month","doi"];
function clearSummary(message="Dane niedostępne") {
  for (const id of summaryIds) $("m4-"+id).textContent = "—";
  $("m4-trend").replaceChildren();
  $("m4-monthly").replaceChildren();
  $("m4-sources").replaceChildren();
  $("m4-status").textContent = message;
  $("m4-asof").textContent = "Dane pobrano: —";
}
function makeCell(content) {
  const cell=document.createElement("td");
  cell.textContent=String(content);
  return cell;
}
async function loadSummary() {
  if(summaryBusy || !ownerCsrf)return;
  summaryBusy=true;
  const generation=++summaryGeneration;
  summaryController?.abort();
  summaryController=new AbortController();
  clearSummary("Pobieranie globalnych statystyk…");
  $("m4-refresh").disabled=true;
  try {
    const result=await request("/owner/newsletter/summary",{
      method:"POST",signal:summaryController.signal,
      headers:{"Content-Type":"application/json"},
      body:"{}"
    });
    if(generation!==summaryGeneration)return;
    if(!result.ok || result.scope!=="new_only_global")throw Error("unavailable");
    const ids={total:"total",active:"active",pending:"pending",withdrawn:"withdrawn",
      today:"today",week:"last7",month:"last30"};
    for(const [element,key] of Object.entries(ids)){
      $("m4-"+element).textContent=String(result.counts[key]);
    }
    $("m4-doi").textContent=result.doiRate30===null?"—":result.doiRate30+"%";
    $("m4-asof").textContent="Dane pobrano: "+warsawTime(result.fetchedAt);
    const max=Math.max(1,...result.trend.map(day=>day.requested));
    const fragment=document.createDocumentFragment();
    for(const day of result.trend){
      const tr=document.createElement("tr");
      tr.append(makeCell(day.day),makeCell(day.requested));
      const confirmed=makeCell(day.confirmed);
      const meter=document.createElement("meter");
      meter.min=0;meter.max=max;meter.value=day.requested;
      meter.setAttribute("aria-label","Zgłoszenia "+day.day);
      tr.children[1].append(" ",meter);
      tr.append(confirmed);
      fragment.append(tr);
    }
    $("m4-trend").replaceChildren(fragment);
    if(!Array.isArray(result.monthlyTrend)||result.monthlyTrend.length!==12)
      throw Error("unavailable");
    const monthly=document.createDocumentFragment();
    for(const month of result.monthlyTrend){
      const tr=document.createElement("tr");
      tr.append(makeCell(month.month),makeCell(month.requested),makeCell(month.confirmed));
      monthly.append(tr);
    }
    $("m4-monthly").replaceChildren(monthly);
    const sources=document.createDocumentFragment();
    for(const item of result.sources){
      const tr=document.createElement("tr");
      tr.append(makeCell(sourceLabel(item.source)),makeCell(item.count));
      sources.append(tr);
    }
    $("m4-sources").replaceChildren(sources);
    $("m4-status").textContent="Dane całego nowego rejestru · stan potwierdzony przez PostgreSQL.";
  } catch(error) {
    if(generation===summaryGeneration)
      clearSummary("Statystyki niedostępne — spróbuj ponownie za chwilę. Nie zastępujemy błędów zerami.");
  } finally {
    if(generation===summaryGeneration){
      summaryBusy=false;
      $("m4-refresh").disabled=false;
    }
  }
}

let recentBusy=false,recentGeneration=0,recentController;
function clearRecent(message="Dane chwilowo niedostępne"){
  $("recent-banner-title").textContent=message;
  $("recent-banner-detail").textContent=
    "Brak aktualnego odczytu — nie oznacza to braku zapisów.";
  $("recent-check").hidden=true;
  $("recent-counts").textContent="";
  $("recent-rows").replaceChildren();
  $("recent-status").textContent=message;
}
const countName=(count,one,many,five)=>{
  const end=count%10,dec=count%100;
  return count===1?one:(end>=2&&end<=4&&(dec<12||dec>14))?many:five;
};
async function loadRecent(){
  if(recentBusy||!ownerCsrf)return;
  recentBusy=true;
  const generation=++recentGeneration;
  recentController?.abort();
  recentController=new AbortController();
  $("recent-refresh").disabled=true;
  $("recent-status").textContent="Pobieranie nowych zgłoszeń…";
  try{
    const data=await request("/owner/newsletter/recent-subscribers",{
      method:"POST",signal:recentController.signal,
      headers:{"Content-Type":"application/json"},body:"{}"
    });
    if(generation!==recentGeneration)return;
    if(!data.ok||data.scope!=="new_only_global"||
      !Number.isSafeInteger(data.total24)||data.total24<0||
      !Number.isSafeInteger(data.total2)||data.total2<0||
      data.total2>data.total24||
      !Array.isArray(data.items)||data.items.length>50)
      throw Error("invalid_recent_data");
    const moment=Date.parse(data.fetchedAt);
    if(!Number.isFinite(moment))throw Error("invalid_recent_time");
    const rows=document.createDocumentFragment();
    for(const item of data.items){
      if(typeof item.email!=="string"||typeof item.requestedAt!=="string"||
        typeof item.source!=="string"||!labels[item.state])
        throw Error("invalid_recent_item");
      const requested=Date.parse(item.requestedAt);
      if(!Number.isFinite(requested))throw Error("invalid_recent_time");
      const isTwoHours=requested>moment-2*60*60*1000&&requested<=moment;
      const tr=document.createElement("tr");
      for(const val of [item.email,labels[item.state],
        warsawTime(item.requestedAt),sourceLabel(item.source),
        isTwoHours?"Ostatnie 2 godz.":"Ostatnie 24 godz."])
        tr.append(makeCell(val));
      if(isTwoHours)tr.className="recent-new-row";
      rows.append(tr);
    }
    $("recent-rows").replaceChildren(rows);
    const dayCount=data.total24,twoCount=data.total2;
    if(dayCount===0){
      $("recent-banner-title").textContent=
        "W ostatnich 24 godzinach nie ma nowych zgłoszeń do newslettera gracz.pl.";
      $("recent-banner-detail").textContent=
        "Brak nowych wpisów w bieżącym rejestrze newslettera.";
    }else{
      $("recent-banner-title").textContent=
        "W ostatnich 24 godzinach: "+dayCount+" "+
        countName(dayCount,"nowe zgłoszenie","nowe zgłoszenia","nowych zgłoszeń")+
        " do newslettera gracz.pl.";
      $("recent-banner-detail").textContent=twoCount?
        "W ostatnich 2 godzinach: "+twoCount+" "+
          countName(twoCount,"zgłoszenie","zgłoszenia","zgłoszeń")+".":
        "W ostatnich 2 godzinach nie odnotowano nowych zgłoszeń.";
    }
    $("recent-check").hidden=twoCount===0;
    $("recent-counts").textContent="Ostatnie 24 godziny: "+dayCount+
      " · Ostatnie 2 godziny: "+twoCount+".";
    $("recent-status").textContent=dayCount?
      "Najnowsze zgłoszenia · "+Math.min(dayCount,50)+" z "+dayCount+
      (data.hasMore?" (pozostałe poza limitem widoku).":"."):
      "Brak zgłoszeń z ostatnich 24 godzin.";
  }catch{
    if(generation===recentGeneration)
      clearRecent("Nie można odczytać najnowszych zgłoszeń. Spróbuj ponownie.");
  }finally{
    if(generation===recentGeneration){
      recentBusy=false;
      $("recent-refresh").disabled=false;
    }
  }
}
function openRecentSubscribers(){
  const section=$("recent-subscribers");
  section.scrollIntoView({block:"start",behavior:"auto"});
  // Both actions lead to the same anchored section without a new API request.
  history.replaceState(null,"","#recent-subscribers");
}
$("recent-show").addEventListener("click",openRecentSubscribers);
$("recent-check").addEventListener("click",openRecentSubscribers);
$("recent-refresh").addEventListener("click",loadRecent);
// Update only while the authenticated dashboard is actively viewed.
setInterval(()=>{if(!document.hidden&&ownerCsrf)loadRecent();},5*60*1000);

function clearDetail() {
  detailGeneration++;
  detailController?.abort();
  $("detail-body").replaceChildren();
}
function clear() {
  $("rows").replaceChildren();
  for (const id of ["active", "pending", "unsubscribed", "total"]) $(id).textContent = "—";
  next = null;
  $("next").disabled = true;
  clearDetail();
  $("detail").close();
}
async function request(path, options) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: { ...options?.headers, "X-Owner-CSRF": ownerCsrf },
  });
  if (response.status === 401) { clear(); clearSummary(); clearRecent("Sesja wygasła."); location.replace("/owner/newsletter/login"); throw new Error("unauthorized"); }
  if (!response.ok) throw new Error("unavailable");
  return response.json();
}
async function load(cursor = null) {
  if (loading) return;
  loading = true;
  const current = ++generation;
  listController?.abort();
  listController = new AbortController();
  clear();
  $("status").textContent = "Pobieranie danych…";
  $("refresh").disabled = true;
  try {
    const data = await request("/owner/newsletter/list", {
      signal: listController.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cursor, query, state }),
    });
    if (current !== generation) return;
    if (!data.ok) throw new Error(data.error);
    $("active").textContent = data.counts.active;
    $("pending").textContent = data.counts.pending;
    $("unsubscribed").textContent = data.counts.unsubscribed;
    $("total").textContent = data.total ?? "—";
    $("total-note").textContent =
      data.total === null
        ? "Pełny licznik niedostępny"
        : "Pełny odczyt jednej strony";
    for (const item of data.items) {
      const tr = document.createElement("tr");
      const email = document.createElement("td");
      email.textContent = item.email;
      const status = document.createElement("td");
      status.textContent = labels[item.state];
      status.className = "badge";
      const signup = document.createElement("td");
      signup.textContent = warsawTime(item.requestedAt);
      const source = document.createElement("td");
      source.textContent = sourceLabel(item.source);
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Szczegóły";
      button.setAttribute("aria-label", `Szczegóły: ${item.email}`);
      button.addEventListener("click", () => detail(item.handle));
      action.append(button);
      tr.append(email, status, signup, source, action);
      $("rows").append(tr);
    }
    next = data.nextCursor;
    $("next").disabled = !next;
    $("status").textContent = data.items.length
      ? `Wyświetlono ${data.items.length} kontaktów na tej stronie.`
      : "Brak dopasowań na tej stronie.";
    $("health").textContent = data.quality.includes(
      "incomplete_provider_evidence",
    )
      ? "Rejestr odpowiada · część stanów niezweryfikowana"
      : "Rejestr odpowiada · dane bieżącej strony odczytane";
    $("fetched").textContent =
      `Ostatnie pobranie: ${warsawTime(data.fetchedAt)}`;
  } catch (error) {
    if (current !== generation) return;
    clear();
    $("status").textContent =
      error.message === "rate_limited"
        ? "Limit odczytów. Odczekaj chwilę i odśwież."
        : error.message === "timeout"
          ? "Rejestr nie odpowiedział na czas. Dane niedostępne."
          : "Integracja niedostępna. Nie można ustalić liczby subskrybentów.";
    $("health").textContent = "Degradacja · brak aktualnych danych";
    $("fetched").textContent = "Ostatnie pobranie: —";
  } finally {
    if (current === generation) {
      loading = false;
      $("refresh").disabled = false;
    }
  }
}
async function detail(handle) {
  clearDetail();
  const current = detailGeneration;
  detailController = new AbortController();
  $("detail-body").textContent = "Pobieranie dowodów…";
  $("detail").showModal();
  try {
    const data = await request("/owner/newsletter/detail", {
      signal: detailController.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    if (current !== detailGeneration || !$("detail").open) return;
    if (!data.ok) throw new Error();
    $("detail-body").replaceChildren();
    const lines = [
      data.email,
      `Stan subskrypcji: ${labels[data.state]}`,
      `Zgłoszenie (zapis w bazie): ${warsawTime(data.requestedAt)}`,
      `Potwierdzenie DOI: ${warsawTime(data.confirmedAt)}`,
      ...(data.revokedAt?[`Wycofanie zgody: ${warsawTime(data.revokedAt)}`]:[]),
      `Źródło zapisu: ${sourceLabel(data.source)}`,
      `Wersja zgody: ${data.consentVersion || "Brak danych"}`,
      `Status próby wysyłki DOI: ${data.deliveryState==="sent"?"Oznaczona jako wysłana":data.deliveryState==="uncertain"?"Niepewny — nie potwierdza doręczenia":"Niedostępny"}`,
      `Stan odczytany: ${warsawTime(data.observedAt)}`,
      `Dowód zgody: ${data.consent ? labels[data.consent.state] || "Nieznany" : "Niedostępny — nie odtwarzamy historii"}`,
      `Jakość: ${data.quality.length ? "Wymaga weryfikacji" : "Brak wykrytych rozbieżności"}`,
    ];
    for (const event of data.consent?.events || [])
      lines.push(`${warsawTime(event.at)} · ${eventLabel[event.type] || "Nieznane zdarzenie"}` +
        (event.source?` · ${sourceLabel(event.source)}`:"") +
        (event.consentVersion?` · zgoda ${event.consentVersion}`:""));
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      $("detail-body").append(p);
    }
  } catch {
    if (current === detailGeneration && $("detail").open)
      $("detail-body").textContent = "Dowody niedostępne. Spróbuj ponownie.";
  }
}
$("filters").addEventListener("submit", (e) => {
  e.preventDefault();
  if (loading) return;
  query = $("query").value;
  state = $("state").value;
  load();
});
$("next").addEventListener("click", () => load(next));
$("first").addEventListener("click", () => load());
$("refresh").addEventListener("click", () => load());
$("close").addEventListener("click", () => {
  clearDetail();
  $("detail").close();
});
$("detail").addEventListener("close", () => {
  if (!$("detail").open) clearDetail();
});
$("detail").addEventListener("cancel", clearDetail);
window.addEventListener("pagehide", () => {
  generation++;
  summaryGeneration++;
  recentGeneration++;
  recentController?.abort();
  recentBusy=false;
  clearRecent("Widok zamknięty.");
  $("recent-refresh").disabled=false;
  trendDetailGeneration++;
  trendDetailController?.abort();
  trendDetailBusy=false;
  $("trend-search-button").disabled=false;
  summaryController?.abort();
  summaryBusy=false;
  listController?.abort();
  loading = false;
  clear();
  clearSummary("Widok zamknięty.");
  $("query").value = "";
  query = "";
  $("health").textContent = "Nie sprawdzono";
  $("fetched").textContent = "Ostatnie pobranie: —";
  $("status").textContent = "Widok zamknięty. Odśwież, aby pobrać dane.";
  $("refresh").disabled = false;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {loadSummary();load();loadRecent();}
});


async function loadOwnerSettings(){
  try{
    const response=await fetch("/owner/newsletter/settings",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
      body:"{}"
    });
    if(!response.ok)return; // Hide account controls in legacy TOTP mode.
    const data=await response.json();
    if(!data.ok||typeof data.username!=="string")return;
    $("account-current-nick").textContent=data.username;
    $("owner-new-nick").value=data.username;
    $("account-last-login").textContent=data.lastLoginAt?warsawTime(data.lastLoginAt):"Brak historii";
    $("owner-recovery-settings").hidden=data.recoveryAvailable!==true;
    $("owner-recovery-current").textContent=data.recoveryEmailMasked||"Nie ustawiono";
    $("account-settings-link").hidden=false;
    $("account-settings").hidden=false;
    $("owner-account-nav").hidden=false;
    $("owner-recovery-link").hidden=data.recoveryAvailable!==true;
  }catch{ /* fail closed: never render a nonfunctional settings form */ }
}
let changingCredentials=false;
async function changeOwnerCredentials(form,payload){
  if(changingCredentials||!ownerCsrf)return;
  const status=$("account-settings-status");
  const button=form.querySelector('button[type="submit"]');
  changingCredentials=true;
  button.disabled=true;
  status.textContent="Trwa bezpieczna zmiana danych logowania…";
  try{
    const response=await fetch("/owner/newsletter/change-credentials",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
      body:JSON.stringify(payload)
    });
    if(!response.ok)throw Error("not_changed");
    const answer=await response.json();
    if(!answer.ok||answer.relogin!==true)throw Error("not_changed");
    status.textContent="Dane logowania zmienione. Zaloguj się ponownie.";
    form.reset();
    ownerCsrf=null;
    location.replace("/owner/newsletter/login");
  }catch{
    status.textContent="Nie zmieniono danych. Sprawdź obecne hasło i wymagania pól lub spróbuj za chwilę.";
    form.querySelectorAll('input[type="password"]').forEach(input=>{input.value="";});
    button.disabled=false;
    changingCredentials=false;
  }
}
$("owner-change-password").addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const oldPassword=$("owner-old-password").value;
  const newPassword=$("owner-new-password").value;
  if(newPassword!==$("owner-repeat-password").value){
    $("account-settings-status").textContent="Nowe hasła muszą być identyczne.";
    $("owner-repeat-password").focus();
    return;
  }
  changeOwnerCredentials(form,{oldPassword,newPassword});
});
$("owner-change-nick").addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const username=$("owner-new-nick").value;
  if(username===$("account-current-nick").textContent){
    $("account-settings-status").textContent="Nowy nick musi różnić się od obecnego.";
    return;
  }
  changeOwnerCredentials(form,{username,oldPassword:$("owner-nick-password").value});
});

async function ownerRecoveryPost(path,payload){
  const result=await fetch("/owner/newsletter/recover/"+path,{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
    body:JSON.stringify(payload)
  });
  if(!result.ok)throw Error("not_confirmed");
  return result.json();
}
$("owner-recovery-email-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget,status=$("owner-recovery-status");
  const button=form.querySelector('button[type="submit"]');
  if(button.disabled||!ownerCsrf)return;
  button.disabled=true;
  status.textContent="Wysyłanie kodu weryfikacyjnego…";
  try{
    await ownerRecoveryPost("email",{
      email:$("owner-recovery-email").value,
      password:$("owner-recovery-password").value
    });
    status.textContent="Kod wysłany. Wprowadź go w polu „Potwierdź adres e-mail” w ciągu 10 minut.";
    $("owner-recovery-code").focus();
  }catch{
    status.textContent="Nie wysłano kodu. Sprawdź obecne hasło i adres lub spróbuj później.";
  }finally{
    $("owner-recovery-password").value="";
    button.disabled=false;
  }
});
$("owner-recovery-code-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget,status=$("owner-recovery-status");
  const button=form.querySelector('button[type="submit"]');
  if(button.disabled||!ownerCsrf)return;
  button.disabled=true;
  status.textContent="Sprawdzanie kodu…";
  try{
    await ownerRecoveryPost("verify",{code:$("owner-recovery-code").value.trim()});
    form.reset();
    $("owner-recovery-email-form").reset();
    await loadOwnerSettings();
    status.textContent="Adres odzyskiwania potwierdzony i aktywny.";
  }catch{
    status.textContent="Kod jest nieprawidłowy lub wygasł. Nie zmieniono adresu odzyskiwania.";
  }finally{button.disabled=false;}
});


let trendDetailController,trendDetailGeneration=0,trendDetailBusy=false;
const calendarDate=()=>new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const dateBack=(date,offset)=>{
  const ms=Date.parse(date+'T00:00:00Z');
  return new Date(ms-offset*86_400_000).toISOString().slice(0,10);
};
function setTrendPeriod(days){
  const today=calendarDate();
  $("trend-to").value=today;
  $("trend-from").value=dateBack(today,days-1);
}
setTrendPeriod(30);
$("trend-period").addEventListener("change",event=>{
  if(event.currentTarget.value!=="custom")
    setTrendPeriod(Number(event.currentTarget.value));
});
for(const id of ["trend-from","trend-to"]){
  $(id).addEventListener("change",()=>{$("trend-period").value="custom";});
}
async function searchTrendDetails(){
  if(trendDetailBusy||!ownerCsrf)return;
  const from=$("trend-from").value,to=$("trend-to").value,
    source=$("trend-source").value.trim();
  const fromTime=Date.parse(from+'T00:00:00Z'),
    toTime=Date.parse(to+'T00:00:00Z'),
    days=1+(toTime-fromTime)/86_400_000;
  if(!Number.isInteger(days)||days<1||days>366||
    (source!==""&&!/^[a-z_]{1,40}$/.test(source))){
    $("trend-detail-status").textContent=
      "Podaj prawidłowy zakres od 1 do 366 dni i opcjonalnie kod źródła (małe litery oraz _).";
    return;
  }
  const current=++trendDetailGeneration;
  trendDetailController?.abort();
  trendDetailController=new AbortController();
  trendDetailBusy=true;
  const button=$("trend-search-button");
  button.disabled=true;
  $("trend-detail-result").hidden=true;
  $("trend-detail-rows").replaceChildren();
  $("trend-detail-status").textContent="Wyszukiwanie szczegółów w rejestrze…";
  try{
    const data=await request("/owner/newsletter/trend-detail",{
      method:"POST",signal:trendDetailController.signal,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({from,to,source})
    });
    if(current!==trendDetailGeneration)return;
    if(!data.ok||data.scope!=="new_only_global"||
      !Array.isArray(data.rows)||data.rows.length!==days)
      throw Error("invalid_detail");
    const fragment=document.createDocumentFragment();
    for(const row of data.rows){
      const tr=document.createElement("tr");
      for(const value of [row.day,row.requested,row.confirmed,
        row.pending,row.withdrawn,row.doiRate===null?"—":row.doiRate+"%"])
        tr.append(makeCell(value));
      fragment.append(tr);
    }
    $("trend-detail-rows").replaceChildren(fragment);
    const t=data.totals;
    $("trend-detail-totals").textContent=
      "Zakres: "+from+" – "+to+" · źródło: "+(source||"wszystkie")+
      " · zgłoszenia: "+t.requested+" · potwierdzeni DOI: "+t.confirmed+
      " · oczekujący: "+t.pending+" · wycofani: "+t.withdrawn;
    $("trend-detail-result").hidden=false;
    $("trend-detail-status").textContent="Wyniki dzienne · "+days+
      " dni · strefa Europe/Warsaw. Dane zagregowane, bez adresów e-mail.";
  }catch{
    if(current===trendDetailGeneration)
      $("trend-detail-status").textContent=
        "Szczegóły niedostępne — spróbuj ponownie. Brak danych nie jest traktowany jako zero.";
  }finally{
    if(current===trendDetailGeneration){
      trendDetailBusy=false;
      button.disabled=false;
    }
  }
}
$("trend-search").addEventListener("submit",event=>{
  event.preventDefault();
  searchTrendDetails();
});

// Full Max Premium legal notice is informative, not a consent or license grant.
const rightsDialog=$("rights-dialog");
const rightsCopy=$("rights-copy");
function openRights(){
  if(!rightsDialog.open){
    rightsCopy.scrollTop=0;
    rightsDialog.showModal();
    $("rights-close").focus();
  }
}
function closeRights(){
  if(rightsDialog.open)rightsDialog.close();
}
$("rights-open").addEventListener("click",openRights);
$("rights-close").addEventListener("click",closeRights);
$("rights-understood").addEventListener("click",closeRights);
rightsDialog.addEventListener("close",()=>{
  $("rights-open").focus({preventScroll:true});
});
for(const button of rightsDialog.querySelectorAll("[data-rights-target]")){
  button.addEventListener("click",()=>{
    const target=rightsDialog.querySelector("#"+button.dataset.rightsTarget);
    if(!target)return;
    const relativeTop=target.getBoundingClientRect().top-
      rightsCopy.getBoundingClientRect().top+rightsCopy.scrollTop;
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rightsCopy.scrollTo({top:relativeTop,behavior:reducedMotion?"auto":"smooth"});
  });
}

async function startOwnerDashboard(){
  try{
    const response=await fetch("/owner/newsletter/session",{
      credentials:"same-origin",cache:"no-store"
    });
    if(!response.ok)throw Error("unauthorized");
    const result=await response.json();
    if(!result.ok||typeof result.csrf!=="string")throw Error("unauthorized");
    ownerCsrf=result.csrf;
    const pending=document.createElement("option");
    pending.value="pending";pending.textContent="Oczekujące";
    $("state").insertBefore(pending,$("state").options[2]);
    await Promise.all([loadSummary(),load(),loadOwnerSettings(),loadRecent()]);
  }catch{
    clear();location.replace("/owner/newsletter/login");
  }
}
$("logout").addEventListener("click",async()=>{
  const button=$("logout");button.disabled=true;
  generation++;summaryGeneration++;
  listController?.abort();summaryController?.abort();clear();clearSummary();
  try{
    await fetch("/owner/newsletter/logout",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"X-Owner-CSRF":ownerCsrf}
    });
  }finally{
    ownerCsrf=null;location.replace("/owner/newsletter/login");
  }
});
$("m4-refresh").addEventListener("click",loadSummary);
startOwnerDashboard();
