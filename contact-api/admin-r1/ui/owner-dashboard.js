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

const premiumForms=['owner-change-password','owner-change-nick','owner-recovery-email-form','owner-recovery-code-form'];
for(const id of premiumForms){
  const form=document.getElementById(id);
  if(!form)continue;
  form.addEventListener('invalid',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement))return;
    event.preventDefault();
    const container=input.closest('.password-visibility')||input;
    const previous=container.nextElementSibling;
    if(previous?.classList.contains('premium-field-error'))previous.remove();
    const message=document.createElement('span');
    message.className='premium-field-error';
    message.setAttribute('role','alert');
    message.textContent=input.validity.valueMissing?'Wypełnij to pole.':
      input.validity.tooShort?'Wpisz wymaganą liczbę znaków.':
      input.validity.patternMismatch?'Sprawdź format wpisanych danych.':
      input.validity.typeMismatch?'Wpisz poprawną wartość.':'Sprawdź poprawność pola.';
    container.insertAdjacentElement('afterend',message);
    input.classList.add('premium-field-invalid');
    input.setAttribute('aria-invalid','true');
  },true);
  form.addEventListener('input',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement))return;
    input.classList.remove('premium-field-invalid');
    input.removeAttribute('aria-invalid');
    const container=input.closest('.password-visibility')||input;
    if(container.nextElementSibling?.classList.contains('premium-field-error'))
      container.nextElementSibling.remove();
  });
}

const labels = {
  active: "Aktywna",
  unsubscribed: "Wypisana",
  suppressed: "Zablokowana",
  outside_segment: "Poza segmentem",
  unknown: "Niezweryfikowana",
  pending: "Oczekuje na DOI",
  subscribed: "Potwierdzona",
};
// DOI expires 30 minutes after the request. Display-only: no consent is created.
function consentStateLabel(item, observedAt=Date.now()) {
  const current=labels[item.state] || "Nieznana";
  if(item.state!=="pending")return current;
  const requested=Date.parse(item.requestedAt);
  return Number.isFinite(requested)&&Number.isFinite(observedAt)&&
    observedAt-requested>=30*60*1000
    ? "DOI wygasło — brak potwierdzenia" : current;
}
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
  dateFrom = "",dateTo = "",
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
  $("recent-registered-total").textContent="—";
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
    $("recent-registered-total").textContent=String(result.counts.total);
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
      for(const val of [item.email,consentStateLabel(item,moment),
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
  visibleActive=[];
  refreshTargetedButton();
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

// OWNER messaging — one explicit Send click, no extra typed phrases.
// Keep the existing OWNER session/CSRF and server-side consent, withdrawal,
// delivery-fence and durable no-retry controls intact.
let targetedReady=false,visibleActive=[],selectedHandles=[],selectedRecipientEmails=[],
  targetedStarted=false,targetedBusy=false;
const targetedDialog=$("targeted-dialog");
const targetedSuccessDialog=$("targeted-success-dialog");
$("targeted-success-close").addEventListener("click",()=>targetedSuccessDialog.close());
function refreshTargetedButton(){
  $("send-found").textContent="Wyślij do znalezionych ("+visibleActive.length+")";
  $("send-found").disabled=!targetedReady||visibleActive.length===0;
}
function renderAttachmentCapabilities(verified=false){
  // Backend is authoritative. Even a successful lab run is not production AV.
  $("targeted-antivirus-state").textContent=verified
    ?"◇ ClamAV: interfejs podłączony · skanowanie wyłączone"
    :"◇ Skan antywirusowy: niedostępny · integracja niepotwierdzona";
  $("targeted-converter-state").textContent=verified
    ?"⚙ Konwerter: interfejs podłączony · konwersja wyłączona"
    :"⚙ Konwersja: oczekuje na konfigurację · integracja niepotwierdzona";
  $("targeted-threat-state").textContent="◇ Kontrola zagrożeń: niedostępna · wysyłka wyłączona";
}
async function refreshAttachmentCapabilities(){
  renderAttachmentCapabilities(false);
  try{
    const info=await request("/owner/newsletter/attachment-capabilities");
    // Never infer availability from an incomplete or unexpectedly enabled reply.
    const confirmed=info?.ok===true && info?.mode==="prepared_disabled"
      && info?.uploadsEnabled===false && info?.scanningEnabled===false
      && info?.conversionEnabled===false && info?.sendingEnabled===false
      && info?.scanner?.engine==="clamav" && info?.scanner?.enabled===false
      && info?.converter?.enabled===false;
    if(targetedDialog.open)renderAttachmentCapabilities(confirmed);
  }catch{
    if(targetedDialog.open)renderAttachmentCapabilities(false);
  }
}
function openTargeted(items){
  if(!targetedReady||targetedBusy||targetedDialog.open||!Array.isArray(items)||
     items.length<1||items.length>10||
     items.some(x=>x.state!=="active"||typeof x.handle!=="string"))return;
  selectedHandles=items.map(x=>x.handle);
  selectedRecipientEmails=items.map(x=>x.email);
  targetedStarted=false;
  $("targeted-compose").reset();
  $("targeted-send").disabled=false;
  $("targeted-compose-close").disabled=false;
  $("targeted-preview-subject").textContent="Podgląd tematu";
  $("targeted-preview-body").textContent="Podgląd wiadomości będzie widoczny tutaj.";
  $("targeted-body-count").textContent="0 / 20 000 znaków";
  $("targeted-attachment").value="";
  $("targeted-attachment-remove").hidden=true;
  $("targeted-attachment-status").textContent="Załączniki wymagają aktywnego skanera antywirusowego. Obecnie wysyłanie plików jest wyłączone.";
  $("targeted-status").textContent="";
  $("targeted-recipients").textContent=items.length===1
    ?"Odbiorca: "+items[0].email
    :"Wybrano "+items.length+" aktywnych osób z bieżącej strony.";
  targetedDialog.showModal();$("targeted-subject").focus();
  // No uploads or processing; one authenticated status read when dialog opens.
  void refreshAttachmentCapabilities();
}
const postTargeted=(path,payload)=>request("/owner/newsletter/"+path,{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
});
$("send-found").addEventListener("click",()=>openTargeted(visibleActive));
$("targeted-compose-close").addEventListener("click",()=>{
  if(!targetedBusy)targetedDialog.close();
});
targetedDialog.addEventListener("cancel",event=>{
  if(targetedBusy)event.preventDefault();
});
$("targeted-subject").addEventListener("input",()=>{
  $("targeted-preview-subject").textContent=$("targeted-subject").value.trim()||"Podgląd tematu";
});
const targetedBody=$("targeted-body");
targetedBody.addEventListener("input",()=>{
  $("targeted-body-count").textContent=targetedBody.value.length+" / 20 000 znaków";
  if(targetedBody.value.trim()) campaignRenderPreview(targetedBody.value,$("targeted-preview-body"));
  else $("targeted-preview-body").textContent="Podgląd wiadomości będzie widoczny tutaj.";
});
// Selecting a file is local-only. Never send bytes, names or paths to the API
// until server-side malware scanning, conversion and durable storage exist.
// Text-only delivery continues to use the existing consent-checked endpoint.
const targetedAttachment=$("targeted-attachment");
targetedAttachment.addEventListener("change",()=>{
  const file=targetedAttachment.files?.[0];
  const note=$("targeted-attachment-status");
  $("targeted-attachment-remove").hidden=!file;
  if(!file){
    note.textContent="Załączniki wymagają aktywnego skanera antywirusowego. Obecnie wysyłanie plików jest wyłączone.";
    return;
  }
  const allowed=/\.(?:pdf|docx|xlsx|png|jpe?g|zip)$/i.test(file.name);
  if(!allowed || file.size<1 || file.size>10*1024*1024){
    note.textContent="Nieprawidłowy załącznik. Limit: 10 MB; dozwolone rozszerzenia PDF, DOCX, XLSX, PNG, JPG, ZIP. Nie wysłano pliku.";
    return;
  }
  note.textContent="Wybrano plik: "+file.name+". Nie przesłano go na serwer. Skaner antywirusowy nie jest skonfigurowany; wysyłka z załącznikiem jest zablokowana.";
});
$("targeted-attachment-remove").addEventListener("click",()=>{
  if(targetedBusy)return;
  targetedAttachment.value="";
  targetedAttachment.dispatchEvent(new Event("change",{bubbles:true}));
});
function targetedReplace(text,start,end,selectFrom,selectTo){
  if(targetedBody.value.length-(end-start)+text.length>targetedBody.maxLength){
    $("targeted-status").textContent="Limit wiadomości: 20 000 znaków.";return;
  }
  targetedBody.focus();
  targetedBody.setRangeText(text,start,end,"select");
  targetedBody.setSelectionRange(selectFrom,selectTo);
  targetedBody.dispatchEvent(new Event("input",{bubbles:true}));
}
function targetedFormat(type){
  if(targetedBusy||targetedStarted)return;
  const start=targetedBody.selectionStart,end=targetedBody.selectionEnd;
  const before=targetedBody.value;
  if(["bold","italic","underline"].includes(type)){
    const mark=type==="bold"?"**":type==="italic"?"*":"++";
    const value=before.slice(start,end)||"tekst";
    targetedReplace(mark+value+mark,start,end,start+mark.length,start+mark.length+value.length);
    return;
  }
  if(type==="bullet"||type==="number"){
    const from=before.lastIndexOf("\n",Math.max(0,start-1))+1;
    const next=before.indexOf("\n",end),to=next<0?before.length:next;
    const replacement=before.slice(from,to).split("\n").map((line,index)=>
      (type==="bullet"?"- ":(index+1)+". ")+
      line.replace(/^(?:\s*[-*]|\s*\d+[.)])\s+/u,"")
    ).join("\n");
    targetedReplace(replacement,from,to,from,from+replacement.length);
    return;
  }
  if(type==="link"){
    const entered=window.prompt("Podaj pełny adres HTTPS:","https://");
    if(entered===null)return;
    const href=campaignHttpsLink(entered.trim());
    if(!href){$("targeted-status").textContent="Link musi być poprawnym adresem HTTPS.";return;}
    const label=(before.slice(start,end)||"tekst linku").replace(/[\[\]\r\n]/g," ").trim();
    const text="["+label+"]("+href+")";
    targetedReplace(text,start,end,start,start+text.length);
  }
}
$("targeted-dialog").querySelectorAll("[data-targeted-format]").forEach(button=>{
  button.addEventListener("click",()=>targetedFormat(button.dataset.targetedFormat));
});
targetedBody.addEventListener("keydown",event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  if(event.key.toLowerCase()==="b"||event.key.toLowerCase()==="i"){
    event.preventDefault();
    targetedFormat(event.key.toLowerCase()==="b"?"bold":"italic");
  }
});
$("targeted-compose").addEventListener("submit",async event=>{
  event.preventDefault();
  if(targetedBusy||targetedStarted||!targetedReady||!selectedHandles.length)return;
  if(targetedAttachment.files?.length){
    $("targeted-status").textContent="Nie można wysłać załącznika bez aktywnego skanera i kontroli bezpieczeństwa. Usuń plik, aby wysłać wiadomość tekstową.";
    return;
  }
  if(!$("targeted-compose").reportValidity())return;
  targetedBusy=true;targetedStarted=true;
  $("targeted-send").disabled=true;
  $("targeted-compose-close").disabled=true;
  targetedDialog.setAttribute("aria-busy","true");
  $("targeted-status").textContent="Trwa przygotowanie i wysyłanie. Nie ponawiaj.";
  let stage="prepare";
  try{
    const draft={subject:$("targeted-subject").value.trim(),
      body:$("targeted-body").value.trim(),audience:"confirmed_active_new_only"};
    // Prepare and approve the immutable recipient scope using existing APIs.
    // These fixed protocol fields are not extra OWNER authentication.
    const saved=await postTargeted("campaign-targeted/save",{
      ...draft,handles:selectedHandles});
    if(!saved?.id)throw Error("missing_draft");
    const approved=await postTargeted("campaign-drafts/approve",{
      ...draft,id:saved.id,confirmation:"ZATWIERDZAM TREŚĆ"});
    if(approved?.state!=="approved")throw Error("not_approved");
    stage="send";
    const result=await postTargeted("campaign-targeted/send",{
      id:saved.id,confirmation:"WYSYŁAM DO WYBRANYCH"});
    const accepted=result?.accepted;
    const suppressed=result?.suppressed;
    if(result?.state==="finished"&&Number.isSafeInteger(accepted)&&accepted>0&&
       accepted<=selectedRecipientEmails.length&&Number.isSafeInteger(suppressed)&&suppressed>=0){
      const single=selectedRecipientEmails.length===1&&accepted===1&&suppressed===0;
      $("targeted-success-title").textContent=single
        ?"Wiadomość została wysłana na adres "+selectedRecipientEmails[0]
        :"Wiadomości zostały przyjęte do wysyłki";
      $("targeted-success-description").textContent=
        "Resend przyjął wiadomość do wysyłki. To nie jest jeszcze potwierdzenie jej doręczenia.";
      $("targeted-success-count").textContent=single
        ?"Odbiorca: "+selectedRecipientEmails[0]
        :"Przyjęte: "+accepted+". Pominięte: "+suppressed+".";
      $("targeted-status").textContent="Resend przyjął: "+accepted+", pominięto: "+
        suppressed+". Przyjęcie nie oznacza doręczenia.";
      targetedDialog.close();
      targetedSuccessDialog.showModal();
    }else{
      $("targeted-status").textContent=result?.state==="finished"&&accepted===0
        ?"Żadna wiadomość nie została przyjęta do wysyłki. Pominięto: "+suppressed+"."
        :"Wynik niepewny. Nie ponawiaj wysyłki.";
    }
  }catch{
    $("targeted-status").textContent=stage==="send"
      ?"Nie można potwierdzić wyniku wysyłki. Nie ponawiaj wysyłki."
      :"Nie udało się potwierdzić przygotowania wiadomości. Nie rozpoczęto wysyłki.";
  }finally{
    targetedBusy=false;
    targetedDialog.removeAttribute("aria-busy");
    $("targeted-compose-close").disabled=false;
  }
});
$("last-month").addEventListener("click",()=>{
  const format=d=>new Intl.DateTimeFormat("sv-SE",{
    timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(d);
  $("date-from").value=format(new Date(Date.now()-30*86400000));
  $("date-to").value=format(new Date());
  $("filters").requestSubmit();
});

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
      body: JSON.stringify({ cursor, query, state, from:dateFrom, to:dateTo }),
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
    visibleActive=data.items.filter(x=>x.state==="active");
    const observed=Date.parse(data.fetchedAt);
    const observedAt=Number.isFinite(observed)?observed:Date.now();
    refreshTargetedButton();
    for (const item of data.items) {
      const tr = document.createElement("tr");
      const email = document.createElement("td");
      email.textContent = item.email;
      const status = document.createElement("td");
      status.textContent = consentStateLabel(item,observedAt);
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
      const send=document.createElement("button");
      send.type="button";send.textContent="Wyślij wiadomość";
      send.className="subscriber-send";
      send.disabled=!targetedReady||item.state!=="active";
      send.addEventListener("click",()=>openTargeted([item]));
      action.className="subscriber-actions";
      action.append(button,send);
      tr.append(email,status,signup,source,action);
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
      `Stan subskrypcji: ${consentStateLabel(data,Date.parse(data.observedAt))}`,
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
  dateFrom=$("date-from").value;dateTo=$("date-to").value;
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
    await checkCampaignDraftAvailability();
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


// Safe rich-Markdown campaign editing. Drafts remain plaintext; no script
// or pasted HTML executes. All preview elements are created as DOM nodes.
const campaignBody=$("campaign-body");
const campaignSubject=$("campaign-subject");
const campaignHistory=[];
let campaignHistoryPosition=-1;
function campaignRefreshCounts(){
  $("campaign-subject-count").textContent=campaignSubject.value.length+" / 160 znaków";
  const value=campaignBody.value;
  const words=value.trim()?value.trim().split(/\s+/u).length:0;
  $("campaign-body-count").textContent=words+" słów · "+value.length+" / 20 000 znaków";
}
function campaignRemember(){
  const value=campaignBody.value;
  if(campaignHistory[campaignHistoryPosition]===value)return;
  campaignHistory.splice(campaignHistoryPosition+1);
  campaignHistory.push(value);
  if(campaignHistory.length>60)campaignHistory.shift();
  campaignHistoryPosition=campaignHistory.length-1;
}
function campaignResetHistory(){
  campaignHistory.length=0;campaignHistoryPosition=-1;
  campaignRemember();campaignRefreshCounts();
}
function campaignHttpsLink(value){
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&!url.username&&!url.password&&url.hostname
      ?url.href:null;
  }catch{return null;}
}
function campaignRenderInline(parent,text){
  const pattern=/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\+\+([^+\n]+)\+\+|~~([^~\n]+)~~|\x60([^\x60\n]+)\x60|\*([^*\n]+)\*/g;
  let offset=0,match;
  while((match=pattern.exec(text))!==null){
    if(match.index>offset)
      parent.append(document.createTextNode(text.slice(offset,match.index)));
    let element=null,value="";
    if(match[1]!==undefined){
      const href=campaignHttpsLink(match[2]);
      if(href){
        element=document.createElement("a");
        element.href=href;element.target="_blank";element.rel="noopener noreferrer";
        value=match[1];
      }
    }else if(match[3]!==undefined){element=document.createElement("strong");value=match[3];}
    else if(match[4]!==undefined){element=document.createElement("u");value=match[4];}
    else if(match[5]!==undefined){element=document.createElement("s");value=match[5];}
    else if(match[6]!==undefined){element=document.createElement("code");value=match[6];}
    else if(match[7]!==undefined){element=document.createElement("em");value=match[7];}
    if(element){element.textContent=value;parent.append(element);}
    else parent.append(document.createTextNode(match[0]));
    offset=pattern.lastIndex;
  }
  if(offset<text.length)parent.append(document.createTextNode(text.slice(offset)));
}
function campaignRenderPreview(body,output=$("campaign-preview-body")){
  output.replaceChildren();
  if(!body.trim()){
    output.textContent="Wpisz treść i wybierz „Pokaż podgląd”.";
    return;
  }
  let list=null,listType="";
  for(const line of body.replace(/\r\n/g,"\n").split("\n")){
    if(!line.trim()){list=null;listType="";continue;}
    const h=line.match(/^(#{1,3})\s+(.+)$/u);
    const ul=line.match(/^\s*[-*]\s+(.+)$/u);
    const ol=line.match(/^\s*\d+[.)]\s+(.+)$/u);
    if(ul||ol){
      const type=ul?"ul":"ol";
      if(type!==listType){list=document.createElement(type);output.append(list);listType=type;}
      const li=document.createElement("li");campaignRenderInline(li,(ul||ol)[1]);list.append(li);
      continue;
    }
    list=null;listType="";
    if(/^\s*---\s*$/u.test(line)){output.append(document.createElement("hr"));continue;}
    const type=h?"h"+h[1].length:line.startsWith("> ")?"blockquote":"p";
    const value=h?h[2]:type==="blockquote"?line.slice(2):line;
    const block=document.createElement(type);campaignRenderInline(block,value);output.append(block);
  }
}
function campaignPreviewCurrent(){
  $("campaign-preview-subject").textContent=campaignSubject.value.trim()||"Temat kampanii";
  campaignRenderPreview(campaignBody.value);
}
function campaignChangeBody(replacement,start,end,selectionStart,selectionEnd){
  const max=Number(campaignBody.maxLength)||20000;
  if(campaignBody.value.length-(end-start)+replacement.length>max){
    $("campaign-preview-status").textContent="Limit treści: 20 000 znaków.";
    return;
  }
  campaignBody.focus();
  campaignBody.setRangeText(replacement,start,end,"select");
  campaignBody.setSelectionRange(selectionStart,selectionEnd);
  campaignBody.dispatchEvent(new Event("input",{bubbles:true}));
}
function campaignSurround(before,after,sample){
  const start=campaignBody.selectionStart,end=campaignBody.selectionEnd;
  const value=campaignBody.value.slice(start,end)||sample;
  campaignChangeBody(before+value+after,start,end,
    start+before.length,start+before.length+value.length);
}
function campaignPrefix(prefix,numbered=false){
  const start=campaignBody.selectionStart,end=campaignBody.selectionEnd;
  const source=campaignBody.value;
  const from=source.lastIndexOf("\n",start-1)+1;
  const foundEnd=source.indexOf("\n",end);
  const to=foundEnd<0?source.length:foundEnd;
  const lines=source.slice(from,to).split("\n");
  const replacement=lines.map((line,i)=>{
    const clean=line.replace(/^(?:#{1,3}|>|\s*[-*]|\s*\d+[.)])\s+/u,"");
    return (numbered?(i+1)+". ":prefix)+clean;
  }).join("\n");
  campaignChangeBody(replacement,from,to,from,from+replacement.length);
}
function campaignDoFormat(type){
  if(type==="undo"||type==="redo"){
    const next=campaignHistoryPosition+(type==="undo"?-1:1);
    if(next<0||next>=campaignHistory.length)return;
    campaignHistoryPosition=next;campaignBody.value=campaignHistory[next];campaignBody.focus();
    campaignRefreshCounts();campaignPreviewCurrent();return;
  }
  if(type==="bold")return campaignSurround("**","**","pogrubiony tekst");
  if(type==="italic")return campaignSurround("*","*","kursywa");
  if(type==="underline")return campaignSurround("++","++","podkreślony tekst");
  if(type==="strike")return campaignSurround("~~","~~","przekreślony tekst");
  if(type==="code")return campaignSurround(String.fromCharCode(96),String.fromCharCode(96),"fragment kodu");
  if(type==="bullet")return campaignPrefix("- ");
  if(type==="number")return campaignPrefix("",true);
  if(type==="quote")return campaignPrefix("> ");
  if(type==="rule"){
    const start=campaignBody.selectionStart;
    return campaignChangeBody("\n\n---\n\n",start,start,start+7,start+7);
  }
  if(type==="link"){
    const raw=window.prompt("Podaj pełny adres HTTPS (bezpieczny link):","https://");
    if(raw===null)return;
    const url=campaignHttpsLink(raw.trim());
    if(!url){$("campaign-preview-status").textContent="Link musi mieć poprawny adres HTTPS.";return;}
    const start=campaignBody.selectionStart,end=campaignBody.selectionEnd;
    const label=(campaignBody.value.slice(start,end)||"tekst linku")
      .replace(/[\]\[\r\n]/g," ").trim();
    const replacement="["+label+"]("+url+")";
    return campaignChangeBody(replacement,start,end,start,start+replacement.length);
  }
}
$("campaign-drafts")?.querySelectorAll("[data-campaign-format]").forEach(button=>{
  button.addEventListener("click",()=>campaignDoFormat(button.dataset.campaignFormat));
});
$("campaign-style")?.addEventListener("change",event=>{
  const style=event.target.value;
  if(style==="plain")campaignPrefix("");
  else if(["h1","h2","h3"].includes(style))
    campaignPrefix("#".repeat(Number(style.slice(1)))+" ");
  event.target.value="plain";
});
campaignBody?.addEventListener("keydown",event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  const key=event.key.toLowerCase();
  if(key==="b"||key==="i"){
    event.preventDefault();campaignDoFormat(key==="b"?"bold":"italic");
  }
});
campaignBody?.addEventListener("input",()=>{
  campaignRemember();campaignRefreshCounts();campaignPreviewCurrent();
});
campaignSubject?.addEventListener("input",()=>{
  campaignRefreshCounts();campaignPreviewCurrent();
});
campaignResetHistory();

// Draft-only campaign preview. No API requests, storage writes or mail delivery.
const campaignPreviewForm=$("campaign-preview-form");
campaignPreviewForm?.addEventListener("submit",event=>{
  event.preventDefault();
  const subject=$("campaign-subject").value.trim();
  const body=$("campaign-body").value.trim();
  const status=$("campaign-preview-status");
  if(subject.length<3||subject.length>160||/[\r\n\x00-\x1f\x7f]/.test(subject)||
     body.length<10||body.length>20000){
    status.textContent="Uzupełnij poprawny temat i treść kampanii.";
    return;
  }
  // textContent preserves newlines without interpreting supplied HTML or scripts.
  $("campaign-preview-subject").textContent=subject;
  campaignRenderPreview(body);
  status.textContent="Podgląd przygotowany lokalnie. Nie zapisano ani nie wysłano wiadomości.";
});


// OWNER draft API: server retains the release gate; UI unlocks only when explicitly enabled.
// One deliberate OWNER Send click is sufficient; existing backend safety gates stay mandatory.
const draftSaveButton=$("campaign-save-draft");
const draftRefreshButton=$("campaign-refresh-drafts");
const campaignTestButton=$("campaign-send-test");
const campaignApproveButton=$("campaign-approve-content");
const campaignSendNowButton=$("campaign-send-now");
let campaignSending=false,campaignAttempted=false;
let campaignTestReady=false;
let campaignSendReady=false;
const draftStatus=$("campaign-preview-status");
async function draftRequest(route,payload){
  const response=await fetch("/owner/newsletter/campaign-drafts/"+route,{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
    body:JSON.stringify(payload)
  });
  if(!response.ok)throw Error("draft_unavailable");
  return response.json();
}
let editingCampaignId=null;
let savedCampaignSnapshot=null;
const newDraftButton=$("campaign-new-draft");
function selectCampaignDraft(id){
  editingCampaignId=id;
  if(draftSaveButton)draftSaveButton.textContent=id?"Zapisz zmiany":"Zapisz wersję roboczą";
  if(newDraftButton)newDraftButton.hidden=!id;
  if(campaignTestButton)campaignTestButton.disabled=!(id&&campaignTestReady);
  if(campaignApproveButton)campaignApproveButton.disabled=!id;
}
newDraftButton?.addEventListener("click",()=>{
  selectCampaignDraft(null);
  savedCampaignSnapshot=null;
  $("campaign-subject").value="";
  $("campaign-body").value="";
  campaignResetHistory();
  $("campaign-preview-subject").textContent="Temat kampanii";
  campaignRenderPreview("");
  draftStatus.textContent="Nowa wersja robocza. Nie wysłano wiadomości.";
});
async function openCampaignDraft(id){
  const response=await draftRequest("get",{id});
  const draft=response.draft;
  if(!draft||draft.id!==id||draft.audience!=="confirmed_active_new_only")
    throw Error("draft_unavailable");
  $("campaign-subject").value=draft.subject;
  $("campaign-body").value=draft.body;
  campaignResetHistory();
  $("campaign-preview-subject").textContent=draft.subject;
  campaignRenderPreview(draft.body);
  selectCampaignDraft(id);
  savedCampaignSnapshot={id,subject:draft.subject,body:draft.body};
  draftStatus.textContent="Wczytano wersję roboczą do edycji. Nie wysłano wiadomości.";
  $("campaign-subject").focus();
}
async function refreshApproved(){
  const result=await draftRequest("approved",{});
  const list=$("campaign-approved-list");
  list.replaceChildren();
  for(const campaign of result.campaigns||[]){
    const li=document.createElement("li");
    li.textContent=String(campaign.subject||"")+ " — zatwierdzono, bez wysyłki";
    const send=document.createElement("button");
    send.type="button";
    send.textContent="Wyślij zatwierdzoną kampanię";
    send.disabled=!campaignSendReady;
    send.addEventListener("click",async()=>{
      // The button click is the explicit send intent; no extra phrase is required.
      if(send.disabled||!campaignSendReady)return;
      send.disabled=true;
      const status=$("campaign-send-status");
      status.textContent="Trwa ręczna wysyłka kampanii. Nie ponawiaj żądania.";
      try{
        const response=await fetch("/owner/newsletter/campaigns/send",{
          method:"POST",credentials:"same-origin",headers:{
            "Content-Type":"application/json","X-Owner-CSRF":ownerCsrf
          },body:JSON.stringify({id:campaign.id,confirmation:"WYSYŁAM KAMPANIĘ"})
        });
        const result=await response.json();
        if(!response.ok||result?.ok!==true)throw Error("campaign_send_failed");
        status.textContent=result.state==="finished"
          ?"Zakończono próbę. Przyjęte przez dostawcę: "+result.accepted+
            ". Pominięte: "+result.suppressed+". Przyjęcie nie oznacza doręczenia."
          :"Wynik niepewny. Nie ponawiaj wysyłki; wymagane sprawdzenie przez operatora.";
      }catch{
        status.textContent="Brak potwierdzenia wyniku. Nie ponawiaj wysyłki; sprawdź blokady i trwały rejestr prób.";
      }
    });
    li.append(send);
    list.append(li);
  }
}
async function refreshDrafts({notify=true}={}){
  const result=await draftRequest("list",{});
  const list=$("campaign-drafts-list");
  list.replaceChildren();
  for(const draft of result.drafts||[]){
    const li=document.createElement("li");
    const button=document.createElement("button");
    button.type="button";
    button.className="campaign-draft-open";
    button.textContent=String(draft.subject||"");
    button.setAttribute("aria-label","Otwórz wersję roboczą: "+String(draft.subject||""));
    button.addEventListener("click",async()=>{
      button.disabled=true;
      try{await openCampaignDraft(draft.id);}
      catch{draftStatus.textContent="Nie można wczytać tej wersji roboczej.";}
      finally{button.disabled=false;}
    });
    li.append(button);
    list.append(li);
  }
  await refreshApproved();
  if(notify)draftStatus.textContent="Odczytano zapisane wersje robocze i zatwierdzone treści.";
}
draftSaveButton?.addEventListener("click",async()=>{
  if(!campaignPreviewForm?.reportValidity())return;
  draftSaveButton.disabled=true;
  try{
    const draft={
      subject:$("campaign-subject").value.trim(),
      body:$("campaign-body").value.trim(),
      audience:"confirmed_active_new_only"
    };
    const result=editingCampaignId
      ?await draftRequest("update",{id:editingCampaignId,...draft})
      :await draftRequest("save",draft);
    if(result?.state!=="draft"||typeof result.id!=="string")
      throw Error("draft_unavailable");
    selectCampaignDraft(result.id);
    savedCampaignSnapshot={id:result.id,...draft};
    $("campaign-preview-subject").textContent=draft.subject;
    campaignRenderPreview(draft.body);
    draftStatus.textContent="Wersja robocza zapisana w PostgreSQL. Nie wysłano wiadomości.";
    try{await refreshDrafts({notify:false});}catch{
      draftStatus.textContent="Zapisano wersję roboczą, ale nie udało się odświeżyć listy.";
    }
  }catch{
    draftStatus.textContent="Nie udało się zapisać zmian. Sprawdź dane i spróbuj ponownie.";
  }finally{draftSaveButton.disabled=false;}
});
campaignApproveButton?.addEventListener("click",async()=>{
  if(!editingCampaignId||!savedCampaignSnapshot)return;
  const subject=$("campaign-subject").value.trim();
  const body=$("campaign-body").value.trim();
  if(savedCampaignSnapshot.id!==editingCampaignId||
     subject!==savedCampaignSnapshot.subject||
     body!==savedCampaignSnapshot.body){
    $("campaign-approval-status").textContent=
      "Najpierw zapisz zmiany. Zatwierdzenie dotyczy dokładnie zapisanej treści.";
    return;
  }
  // Explicit content-approval click: no typed phrase or extra browser dialog.
  campaignApproveButton.disabled=true;
  const status=$("campaign-approval-status");
  try{
    const result=await draftRequest("approve",{
      id:editingCampaignId,subject,body,
      audience:"confirmed_active_new_only",
      confirmation:"ZATWIERDZAM TREŚĆ"
    });
    if(result?.ok!==true||result?.state!=="approved"||
       result?.sendingEnabled!==false)
      throw Error("approval_not_confirmed");
    // An approved campaign can no longer be edited in the draft-only store.
    selectCampaignDraft(null);
    savedCampaignSnapshot=null;
    $("campaign-subject").value="";
    $("campaign-body").value="";
    campaignResetHistory();
    campaignPreviewCurrent();
    status.textContent="Treść zatwierdzona. Wysyłka nie została uruchomiona.";
    await refreshDrafts({notify:false});
  }catch{
    status.textContent="Zatwierdzenie nie zostało potwierdzone. "+
      "Treść mogła zostać zmieniona. Odśwież zapisane kampanie.";
  }finally{
    campaignApproveButton.disabled=!editingCampaignId;
  }
});
// Single-click campaign send from the current editor. Saves and approves the
// exact content before sending; the server still enforces authenticated OWNER,
// CSRF, verified DOI, suppression, global HOLD and durable no-retry fences.
campaignSendNowButton?.addEventListener("click",async()=>{
  if(!campaignSendReady||campaignSending||campaignAttempted)return;
  if(!campaignPreviewForm?.reportValidity())return;
  const draft={subject:campaignSubject.value.trim(),
    body:campaignBody.value.trim(),audience:"confirmed_active_new_only"};
  campaignSending=true;
  campaignAttempted=true;
  campaignSendNowButton.disabled=true;
  if(draftSaveButton)draftSaveButton.disabled=true;
  if(campaignApproveButton)campaignApproveButton.disabled=true;
  if(newDraftButton)newDraftButton.disabled=true;
  const status=$("campaign-send-status");
  let stage="prepare";
  status.textContent="Przygotowywanie wiadomości i odbiorców…";
  try{
    let id=editingCampaignId;
    if(id){
      if(savedCampaignSnapshot?.id!==id||
         savedCampaignSnapshot.subject!==draft.subject||
         savedCampaignSnapshot.body!==draft.body){
        const updated=await draftRequest("update",{id,...draft});
        if(updated?.state!=="draft")throw Error("update_failed");
      }
    }else{
      const saved=await draftRequest("save",draft);
      if(saved?.state!=="draft"||typeof saved.id!=="string")
        throw Error("save_failed");
      id=saved.id;
    }
    // Approval remains a content-only operation; it does not authorize egress.
    const approved=await draftRequest("approve",{
      id,...draft,confirmation:"ZATWIERDZAM TREŚĆ"});
    if(approved?.state!=="approved"||approved.sendingEnabled!==false)
      throw Error("approve_failed");
    stage="send";
    status.textContent="Trwa wysyłka. Nie ponawiaj operacji.";
    const response=await fetch("/owner/newsletter/campaigns/send",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
      body:JSON.stringify({id,confirmation:"WYSYŁAM KAMPANIĘ"})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.ok!==true)throw Error("send_unconfirmed");
    if(result.state==="finished"&&Number.isSafeInteger(result.accepted)&&
       Number.isSafeInteger(result.suppressed)){
      status.textContent="Resend przyjął: "+result.accepted+
        ". Pominięto: "+result.suppressed+
        ". Przyjęcie nie jest potwierdzeniem doręczenia.";
    }else{
      status.textContent="Wynik wysyłki niepewny. Nie ponawiaj; sprawdź rejestr prób.";
    }
    // Once the server returned a final outcome, clear the composer so another
    // message requires deliberate new content instead of a duplicate click.
    if(result.state==="finished"){
      campaignSubject.value="";
      campaignBody.value="";
      campaignResetHistory();
      campaignPreviewCurrent();
      campaignAttempted=false;
    }
    selectCampaignDraft(null);
    savedCampaignSnapshot=null;
    try{await refreshDrafts({notify:false});}catch{/* Send result stays visible. */}
  }catch{
    status.textContent=stage==="send"
      ?"Nie potwierdzono wyniku wysyłki. Nie ponawiaj jej; sprawdź rejestr prób."
      :"Nie udało się przygotować wiadomości. Wysyłki nie rozpoczęto.";
    if(stage==="prepare")campaignAttempted=false;
  }finally{
    campaignSending=false;
    if(draftSaveButton)draftSaveButton.disabled=false;
    if(campaignApproveButton)campaignApproveButton.disabled=!editingCampaignId;
    if(newDraftButton)newDraftButton.disabled=false;
    campaignSendNowButton.disabled=!campaignSendReady||campaignAttempted;
  }
});
// Native modal stays centred in the viewport, traps focus and supports Escape.
// A cancelled or dismissed modal never triggers a request to Resend.
const campaignTestDialog=$("campaign-test-dialog");
function confirmCampaignTestSend(){
  if(!campaignTestDialog||campaignTestDialog.open)return Promise.resolve(false);
  campaignTestDialog.returnValue="cancel";
  return new Promise(resolve=>{
    campaignTestDialog.addEventListener("close",()=>{
      resolve(campaignTestDialog.returnValue==="confirm");
    },{once:true});
    campaignTestDialog.showModal();
  });
}
campaignTestButton?.addEventListener("click",async()=>{
  if(!campaignTestReady||!editingCampaignId)return;
  if(savedCampaignSnapshot?.id!==editingCampaignId||
     $("campaign-subject").value.trim()!==savedCampaignSnapshot.subject||
     $("campaign-body").value.trim()!==savedCampaignSnapshot.body){
    $("campaign-test-status").textContent="Najpierw zapisz zmiany, aby test odpowiadał zapisanej treści.";
    return;
  }
  if(!await confirmCampaignTestSend())return;
  campaignTestButton.disabled=true;
  const status=$("campaign-test-status");
  try{
    const response=await fetch("/owner/newsletter/campaign-tests/send",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Owner-CSRF":ownerCsrf},
      body:JSON.stringify({id:editingCampaignId})
    });
    if(!response.ok)throw Error("test_send_unavailable");
    const data=await response.json();
    const messages={
      accepted:"Resend przyjął jedną wiadomość testową. To jeszcze nie potwierdza jej doręczenia.",
      uncertain:"Niepewny wynik Resend. Nie ponawiaj tej próby automatycznie.",
      already_attempted:"Próba dla tej wersji kampanii została już zarejestrowana. Nie wysłano ponownie.",
      limit_reached:"Osiągnięto limit 5 prób testowych w ciągu 24 godzin. Nie wysłano wiadomości.",
      not_found:"Nie znaleziono tej wersji roboczej. Nie wysłano wiadomości."
    };
    status.textContent=messages[data?.state]||"Nie udało się potwierdzić wyniku próby.";
  }catch{
    status.textContent="Próba testowa niedostępna lub wynik niepewny. Nie ponawiaj bez sprawdzenia stanu.";
  }finally{
    campaignTestButton.disabled=!(campaignTestReady&&editingCampaignId);
  }
});
draftRefreshButton?.addEventListener("click",async()=>{
  try{await refreshDrafts();}
  catch{draftStatus.textContent="Lista wersji roboczych jest niedostępna.";}
});
// Authenticated server handshake only: production stays disabled until an
// explicitly configured, verified draft store is supplied at release time.
async function loadCampaignConsentProofCount(){
  const status=$("campaign-consent-evidence");
  const withdrawalStatus=$("campaign-withdrawal-readiness");
  const egressStatus=$("campaign-egress-readiness");
  if(!status||!withdrawalStatus||!egressStatus)return;
  try{
    const result=await draftRequest("audience",{});
    if(result?.ok!==true||result?.advisoryOnly!==true||
       !Number.isSafeInteger(result.confirmed)||result.confirmed<0||
       result.scope!=="new_only_doi_evidence_no_revocation")
      throw Error("audience_evidence_invalid");
    if(typeof result.withdrawalReady!=="boolean"||
       typeof result.globalEgressReady!=="boolean")
      throw Error("withdrawal_readiness_invalid");
    status.textContent="Potwierdzone zgody DOI bez wypisania (nowy rejestr): "+
      result.confirmed+". Wynik orientacyjny — nie upoważnia do wysyłki.";
    withdrawalStatus.textContent=result.withdrawalReady
      ?"Obsługa wypisań: podstawowa gotowość serwera potwierdzona. Przed wysyłką wymagane osobne testy."
      :"Obsługa wypisań: niegotowa. Wysyłanie kampanii pozostaje zablokowane.";
    egressStatus.textContent=result.globalEgressReady
      ?"Globalna blokada marketingowa: brak aktywnego wstrzymania w rejestrze. Nie upoważnia to do wysyłki."
      :"Globalna blokada marketingowa: WSTRZYMANE. Wcześniejsze żądania wypisania lub brak gotowości wymagają wyjaśnienia przed wysyłką.";
  }catch{
    status.textContent="Nie udało się potwierdzić dowodów zgód. "+
      "Nie można ustalić liczby odbiorców. Wysyłka jest wyłączona.";
    withdrawalStatus.textContent="Nie można potwierdzić gotowości obsługi wypisań. Wysyłka jest wyłączona.";
    egressStatus.textContent="Globalna blokada marketingowa: stan nieznany — wysyłka pozostaje wstrzymana.";
  }
}
async function checkCampaignDraftAvailability(){
  if(draftSaveButton)draftSaveButton.disabled=true;
  if(draftRefreshButton)draftRefreshButton.disabled=true;
  campaignTestReady=false;
  campaignSendReady=false;
  if(campaignSendNowButton)campaignSendNowButton.disabled=true;
  if(campaignTestButton)campaignTestButton.disabled=true;
  if(campaignApproveButton)campaignApproveButton.disabled=!editingCampaignId;
  const availabilityDescription=$("campaign-drafts-description");
  try{
    const response=await fetch("/owner/newsletter/campaign-drafts/availability",{
      credentials:"same-origin",cache:"no-store"
    });
    if(!response.ok)return;
    const data=await response.json();
    if(data.ok===true&&data.enabled===true){
      if(draftSaveButton)draftSaveButton.disabled=false;
      if(draftRefreshButton)draftRefreshButton.disabled=false;
      if(availabilityDescription)availabilityDescription.textContent=
        "Możesz przygotowywać i zapisywać wersje robocze w PostgreSQL. Wysyłka wymaga gotowej usługi kampanii.";
      campaignTestReady=data.testSendEnabled===true;
      campaignSendReady=data.campaignSendEnabled===true;
      if(campaignSendNowButton)campaignSendNowButton.disabled=!campaignSendReady||campaignAttempted;
      targetedReady=data.targetedSendEnabled===true;
      refreshTargetedButton();
      if(campaignTestButton)campaignTestButton.disabled=!(campaignTestReady&&editingCampaignId);
      const description=$("campaign-test-description");
      if(description)description.textContent=campaignTestReady
        ?"Wysyłka próbna dostępna tylko po otwarciu zapisanej wersji roboczej. Odbiorca: skonfigurowany adres obsługi gracz.pl."
        :"Wysyłka testowa jeszcze nieaktywna. Nie wysyłamy do subskrybentów.";
      void loadCampaignConsentProofCount();
    }
  }catch{ /* release remains disabled */ }
}


// OWNER status e-mail limit management: one scoped counter, no consent mutation.
let verifiedLimitEmail=null,limitsSaving=false;
async function ownerLimitInspect(){
  if(!ownerCsrf||limitsSaving)return;
  if(!$("limit-email").reportValidity())return;
  limitsSaving=true;verifiedLimitEmail=null;
  $("limit-clear").disabled=true;$("limit-inspect").disabled=true;
  $("limit-message").textContent="Sprawdzanie…";
  try{
    const result=await request("/owner/newsletter/limits/inspect",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:$("limit-email").value.trim()})
    });
    verifiedLimitEmail=result.email;
    $("limit-result").hidden=false;
    $("limit-state").textContent=result.blocked?"Limit adresu wykorzystany":"Brak aktywnej blokady adresu";
    $("limit-count").textContent="Zapytania: "+result.used+" / "+result.limit+
      " · Pozostało: "+result.remaining;
    $("limit-expiry").textContent=result.expiresAt
      ?"Odblokowanie automatyczne: "+warsawTime(result.expiresAt):"Brak aktywnego okna";
    $("limit-clear").disabled=!result.blocked;
    $("limit-message").textContent=result.blocked?"Można wyzerować wyłącznie ten licznik.":"Brak blokady do usunięcia.";
  }catch{
    $("limit-result").hidden=true;$("limit-message").textContent="Odczyt niedostępny.";
  }finally{limitsSaving=false;$("limit-inspect").disabled=false;}
}
let activeLimitLoading=false;
async function ownerLimitActive(){
  if(!ownerCsrf||activeLimitLoading)return;
  activeLimitLoading=true;
  $("limit-active-refresh").disabled=true;
  const rows=$("limit-active-rows");
  rows.replaceChildren();
  $("limit-active-info").textContent="Pobieranie aktywnych blokad…";
  try{
    const result=await request("/owner/newsletter/limits/active",{
      method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
    });
    if(!result.ok||!Array.isArray(result.entries))throw Error("unavailable");
    for(const item of result.entries){
      const tr=document.createElement("tr");
      tr.append(makeCell(item.email),makeCell(warsawTime(item.startedAt)),
        makeCell(warsawTime(item.blockedAt)),makeCell(warsawTime(item.expiresAt)),
        makeCell(item.used+" / "+item.limit),makeCell(item.reason));
      const cell=document.createElement("td");
      const button=document.createElement("button");
      button.type="button";button.textContent="Odblokuj adres";
      button.setAttribute("aria-label","Odblokuj "+item.email);
      button.addEventListener("click",()=>void ownerLimitUnlock(item.email));
      cell.append(button);tr.append(cell);rows.append(tr);
    }
    if(!result.entries.length){
      const tr=document.createElement("tr"),cell=document.createElement("td");
      cell.colSpan=7;cell.textContent="Brak aktywnych blokad adresów e-mail.";
      tr.append(cell);rows.append(tr);
    }
    $("limit-active-info").textContent="Aktywne blokady: "+result.total+
      " · Aktualizacja: "+warsawTime(result.asOf);
  }catch{
    $("limit-active-info").textContent="Nie udało się pobrać listy blokad. Spróbuj ponownie.";
  }finally{
    activeLimitLoading=false;$("limit-active-refresh").disabled=false;
  }
}
async function ownerLimitUnlock(email){
  if(!ownerCsrf||limitsSaving)return;
  limitsSaving=true;$("limit-clear").disabled=true;
  $("limit-message").textContent="Odblokowywanie wskazanego adresu…";
  try{
    const result=await request("/owner/newsletter/limits/unlock",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email,confirmation:"ODBLOKUJ ADRES"})
    });
    $("limit-message").textContent=result.changed
      ?"Odblokowano licznik adresu "+email+". Inne zabezpieczenia pozostają aktywne."
      :"Blokada adresu "+email+" już wygasła.";
  }catch{
    $("limit-message").textContent="Nie potwierdzono odblokowania. Sprawdź ponownie stan.";
  }finally{
    verifiedLimitEmail=null;$("limit-result").hidden=true;limitsSaving=false;
    await ownerLimitActive();
    await ownerLimitHistory();
  }
}
async function ownerLimitHistory(){
  if(!ownerCsrf)return;
  try{
    const r=await request("/owner/newsletter/limits/history",{
      method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
    });
    const list=$("limit-history-list");list.replaceChildren();
    for(const ev of r.events){
      const item=document.createElement("li");
      item.textContent=warsawTime(ev.at)+" — "+ev.action+" ("+ev.recipient+") · "+ev.actor;
      list.append(item);
    }
    if(!r.events.length){
      const item=document.createElement("li");
      item.textContent="Brak odblokowań od uruchomienia API.";list.append(item);
    }
    $("limit-history-info").textContent="Historia bieżącej instancji od "+warsawTime(r.since)+
      ". Dziennik techniczny jest w logach Render.";
  }catch{$("limit-history-info").textContent="Historia chwilowo niedostępna.";}
}
$("limit-form").addEventListener("submit",event=>{
  event.preventDefault();void ownerLimitInspect();
});
$("limit-email").addEventListener("input",()=>{
  verifiedLimitEmail=null;$("limit-clear").disabled=true;$("limit-result").hidden=true;
});
$("limit-clear").addEventListener("click",()=>{
  if(!verifiedLimitEmail||
     $("limit-email").value.trim().toLowerCase()!==verifiedLimitEmail)return;
  void ownerLimitUnlock(verifiedLimitEmail);
});
$("limit-history-refresh").addEventListener("click",ownerLimitHistory);
$("limit-active-refresh").addEventListener("click",ownerLimitActive);
document.querySelector('a[href="#owner-limits"]').addEventListener("click",()=>{
  if(ownerCsrf)void (async()=>{
    await ownerLimitActive();
    await ownerLimitHistory();
  })();
});
setInterval(()=>{
  if(ownerCsrf&&location.hash==="#owner-limits"&&document.visibilityState==="visible")
    void ownerLimitActive();
},60000);
