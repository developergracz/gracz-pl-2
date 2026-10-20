"use strict";
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
  for (const id of ["active", "unsubscribed", "total"]) $(id).textContent = "—";
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
  });
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
    const data = await request("/fixture/list", {
      signal: listController.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cursor, query, state }),
    });
    if (current !== generation) return;
    if (!data.ok) throw new Error(data.error);
    $("active").textContent = data.counts.active;
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
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Szczegóły";
      button.setAttribute("aria-label", `Szczegóły: ${item.email}`);
      button.addEventListener("click", () => detail(item.handle));
      action.append(button);
      tr.append(email, status, action);
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
      ? "Dostawca odpowiada · część stanów niezweryfikowana"
      : "Dostawca odpowiada · dane strony zweryfikowane";
    $("fetched").textContent =
      `Ostatnie pobranie: ${new Date(data.fetchedAt).toLocaleString("pl-PL")}`;
  } catch (error) {
    if (current !== generation) return;
    clear();
    $("status").textContent =
      error.message === "rate_limited"
        ? "Limit odczytów. Odczekaj chwilę i odśwież."
        : error.message === "timeout"
          ? "Dostawca nie odpowiedział na czas. Dane niedostępne."
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
    const data = await request("/fixture/detail", {
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
      ...(data.requestedAt?[ `Zgłoszenie: ${new Date(data.requestedAt).toLocaleString("pl-PL")}` ]:[]),
      ...(data.confirmedAt?[ `Potwierdzenie: ${new Date(data.confirmedAt).toLocaleString("pl-PL")}` ]:[]),
      ...(data.source?[ `Źródło zapisu: ${data.source}` ]:[]),
      `Stan zaobserwowany: ${new Date(data.observedAt).toLocaleString("pl-PL")}`,
      `Dowód zgody: ${data.consent ? labels[data.consent.state] || "Nieznany" : "Niedostępny — nie odtwarzamy historii"}`,
      `Jakość: ${data.quality.length ? "Wymaga weryfikacji" : "Brak wykrytych rozbieżności"}`,
    ];
    for (const event of data.consent?.events || [])
      lines.push(`${event.at || "Brak daty"} · ${event.type}`);
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
load();
