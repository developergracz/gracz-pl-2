"use strict";
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
  detailController;
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
  if (response.status === 401) { clear(); location.replace("/owner/newsletter/login"); throw new Error("unauthorized"); }
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
  listController?.abort();
  loading = false;
  clear();
  $("query").value = "";
  query = "";
  $("health").textContent = "Nie sprawdzono";
  $("fetched").textContent = "Ostatnie pobranie: —";
  $("status").textContent = "Widok zamknięty. Odśwież, aby pobrać dane.";
  $("refresh").disabled = false;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) load();
});

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
    await load();
  }catch{
    clear();location.replace("/owner/newsletter/login");
  }
}
$("logout").addEventListener("click",async()=>{
  const button=$("logout");button.disabled=true;
  generation++;listController?.abort();clear();
  try{
    await fetch("/owner/newsletter/logout",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"X-Owner-CSRF":ownerCsrf}
    });
  }finally{
    ownerCsrf=null;location.replace("/owner/newsletter/login");
  }
});
startOwnerDashboard();
