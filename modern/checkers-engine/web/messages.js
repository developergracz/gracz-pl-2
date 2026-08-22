const session = (() => { try { return JSON.parse(sessionStorage.getItem('gracz-session') || 'null'); } catch { return null; } })();
if (!session?.token || !session?.user) location.replace('/');

const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(['image/png','image/jpeg']);
const state = { folder: 'inbox', messages: [], unreadCount: 0, selected: null, search: '' };
const els = {
  user: document.querySelector('#mail-user'), list: document.querySelector('#message-list'), view: document.querySelector('#message-view'),
  folderTitle: document.querySelector('#folder-title'), folderSubtitle: document.querySelector('#folder-subtitle'), inboxBadge: document.querySelector('#inbox-badge'), unreadBadge: document.querySelector('#unread-badge'),
  search: document.querySelector('#message-search'), refresh: document.querySelector('#refresh-btn'), compose: document.querySelector('#compose-overlay'), composeBtn: document.querySelector('#compose-btn'),
  composeClose: document.querySelector('#compose-close'), composeCancel: document.querySelector('#compose-cancel'), composeForm: document.querySelector('#compose-form'), composeStatus: document.querySelector('#compose-status'),
  recipientSearch: document.querySelector('#recipient-search'), recipientId: document.querySelector('#recipient-id'), recipientResults: document.querySelector('#recipient-results'), recipientSelected: document.querySelector('#recipient-selected'), bodyCount: document.querySelector('#body-count'),
  attachment: document.querySelector('#message-attachment'), attachmentHelp: document.querySelector('#attachment-help')
};
els.user.textContent = `${session.user.displayName || session.user.userId} (@${session.user.userId})`;

function headers(json = false) { const h = { authorization: `Bearer ${session.token}`, accept: 'application/json' }; if (json) h['content-type'] = 'application/json'; return h; }
async function api(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) } });
  let data = {}; try { data = await r.json(); } catch {}
  if (r.status === 401) { sessionStorage.clear(); location.replace('/'); throw new Error('Sesja wygasła.'); }
  if (!r.ok) throw new Error(data.error?.message || `Błąd ${r.status}`);
  return data;
}
function esc(s) { return String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }
function formatDate(v) { const d = new Date(v); const now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}) : d.toLocaleDateString('pl-PL',{day:'2-digit',month:'short'}); }
function fullDate(v) { return new Date(v).toLocaleString('pl-PL',{dateStyle:'long',timeStyle:'short'}); }
function formatBytes(value) { const n=Number(value)||0; return n<1024?`${n} B`:n<1024*1024?`${Math.round(n/1024)} KB`:`${(n/1024/1024).toFixed(1)} MB`; }
function folderMeta(folder) {
  return {
    inbox:['Odebrane','Twoje prywatne wiadomości od innych graczy.'], unread:['Nieprzeczytane','Wiadomości, których jeszcze nie otworzyłeś.'],
    sent:['Wysłane','Wiadomości wysłane przez Ciebie do graczy.'], archive:['Archiwum','Wiadomości odłożone do późniejszego przeglądania.']
  }[folder];
}
async function load(folder = state.folder) {
  state.folder = folder; state.selected = null;
  const meta = folderMeta(folder); els.folderTitle.textContent = meta[0]; els.folderSubtitle.textContent = meta[1];
  document.querySelectorAll('[data-folder]').forEach(b => b.classList.toggle('active', b.dataset.folder === folder));
  els.list.innerHTML = '<div class="list-empty">Ładowanie wiadomości…</div>'; emptyView();
  try {
    const data = await api(`/messages?folder=${encodeURIComponent(folder)}`);
    state.messages = data.messages || []; state.unreadCount = data.unreadCount || 0; els.unreadBadge.textContent = state.unreadCount; els.inboxBadge.textContent = state.unreadCount;
    renderList();
  } catch (e) { els.list.innerHTML = `<div class="list-empty">${esc(e.message)}</div>`; }
}
function filteredMessages() {
  const q = state.search.trim().toLowerCase(); if (!q) return state.messages;
  return state.messages.filter(m => [m.subject,m.body,m.senderName,m.senderId,m.recipientName,m.recipientId,m.attachment?.fileName].some(v => String(v||'').toLowerCase().includes(q)));
}
function renderList() {
  const items = filteredMessages();
  if (!items.length) { els.list.innerHTML = '<div class="list-empty">Brak wiadomości w tym folderze.</div>'; return; }
  els.list.replaceChildren();
  for (const m of items) {
    const sent = state.folder === 'sent';
    const personName = sent ? (m.recipientName || m.recipientId) : (m.senderName || m.senderId);
    const personId = sent ? m.recipientId : m.senderId;
    const unread = !sent && !m.readAt;
    const row = document.createElement('article'); row.className = `message-row${unread?' unread':''}${state.selected?.messageId===m.messageId?' active':''}`; row.dataset.id = m.messageId;
    row.innerHTML = `<div class="avatar">${esc(String(personName).charAt(0).toUpperCase())}</div><div class="message-meta"><div class="message-topline"><span class="message-name">${sent?'Do: ':''}${esc(personName)} <small>(@${esc(personId)})</small></span>${unread?'<i class="unread-dot"></i>':''}</div><div class="message-subject">${m.attachment?'📎 ':''}${esc(m.subject)}</div><div class="message-preview">${esc(m.body.replace(/\s+/g,' ').slice(0,110))}</div></div><time class="message-time">${esc(formatDate(m.createdAt))}</time>`;
    row.addEventListener('click', () => openMessage(m)); els.list.append(row);
  }
}
function emptyView() { els.view.classList.remove('open'); els.view.innerHTML = '<div class="empty-state"><div>✉</div><h2>Wybierz wiadomość</h2><p>Treść wybranej wiadomości pojawi się tutaj.</p></div>'; }
async function openMessage(m) {
  state.selected = m; if (state.folder !== 'sent' && !m.readAt) { try { await api(`/messages/${m.messageId}`, { method:'PATCH', body:JSON.stringify({action:'read'}) }); m.readAt = new Date().toISOString(); state.unreadCount = Math.max(0,state.unreadCount-1); els.unreadBadge.textContent=state.unreadCount; els.inboxBadge.textContent=state.unreadCount; } catch {} }
  renderList(); const sent = state.folder === 'sent'; const personName = sent ? (m.recipientName || m.recipientId) : (m.senderName || m.senderId); const personId = sent ? m.recipientId : m.senderId;
  const attachment = m.attachment ? `<div class="detail-attachment"><button type="button" data-act="attachment">📎 ${esc(m.attachment.fileName)} · ${esc(formatBytes(m.attachment.fileSize))}</button><small>Zrzut z partii — ${esc(m.attachment.mimeType==='image/png'?'PNG':'JPG')}</small></div>` : '';
  els.view.classList.add('open');
  els.view.innerHTML = `<article class="message-detail"><header class="detail-head"><div><h2>${esc(m.subject)}</h2><div class="detail-person"><span class="avatar">${esc(String(personName).charAt(0).toUpperCase())}</span><div><strong>${sent?'Do: ':'Od: '}${esc(personName)} (@${esc(personId)})</strong><div class="detail-date">${esc(fullDate(m.createdAt))}</div></div></div></div></header><div class="detail-actions">${!sent?'<button class="primary" data-act="reply">↩ Odpowiedz</button>':''}${!sent?`<button data-act="${state.folder==='archive'?'unarchive':'archive'}">${state.folder==='archive'?'Przenieś do odebranych':'▤ Archiwizuj'}</button>`:''}<button class="danger" data-act="delete">Usuń</button><button data-act="close">Zamknij</button></div><div class="detail-body">${esc(m.body)}</div>${attachment}</article>`;
  els.view.querySelector('[data-act="close"]').addEventListener('click', emptyView);
  const reply = els.view.querySelector('[data-act="reply"]'); if (reply) reply.addEventListener('click',()=>openCompose({recipientId:m.senderId,recipientName:m.senderName||m.senderId,subject:m.subject.startsWith('Re:')?m.subject:`Re: ${m.subject}`}));
  const archive = els.view.querySelector('[data-act="archive"],[data-act="unarchive"]'); if (archive) archive.addEventListener('click',async()=>{ await api(`/messages/${m.messageId}`,{method:'PATCH',body:JSON.stringify({action:archive.dataset.act})}); await load(state.folder); });
  const attachmentButton = els.view.querySelector('[data-act="attachment"]'); if (attachmentButton) attachmentButton.addEventListener('click',()=>openAttachment(m));
  els.view.querySelector('[data-act="delete"]').addEventListener('click',async()=>{ if (!confirm('Usunąć tę wiadomość z Twojej skrzynki?')) return; await api(`/messages/${m.messageId}`,{method:'DELETE'}); await load(state.folder); });
}
async function openAttachment(m) {
  try {
    const result = await api(`/messages/${m.messageId}/attachment`); const a=result.attachment;
    const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0)); const blob=new Blob([bytes],{type:a.mimeType}); const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank','noopener'); if(!win){ const link=document.createElement('a');link.href=url;link.download=a.fileName;link.click(); }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch (e) { alert(e.message); }
}
function openCompose(prefill = {}) {
  els.compose.hidden = false; els.composeStatus.textContent=''; els.composeForm.reset(); els.recipientId.value=''; els.recipientResults.hidden=true; els.bodyCount.textContent='0'; resetAttachmentHelp();
  if (prefill.recipientId) selectRecipient({userId:prefill.recipientId,displayName:prefill.recipientName||prefill.recipientId,allowMessages:true});
  if (prefill.subject) els.composeForm.elements.subject.value = prefill.subject;
  setTimeout(()=>els.recipientSearch.focus(),0);
}
function closeCompose(){ els.compose.hidden=true; els.recipientResults.hidden=true; }
function selectRecipient(p){
  els.recipientId.value=p.userId;
  els.recipientSearch.value=p.displayName;
  els.recipientSelected.textContent=`Wybrany odbiorca: ${p.displayName}`;
  els.recipientResults.hidden=true;
}
function resetAttachmentHelp(){ if(els.attachmentHelp){els.attachmentHelp.textContent='Dozwolone formaty: PNG i JPG/JPEG. Maksymalny rozmiar: 1 MB. Załączaj wyłącznie zrzuty związane z partią lub rozgrywką.';els.attachmentHelp.style.color='';} }
function validateAttachment(file){
  if(!file)return null;
  if(!ALLOWED_ATTACHMENT_TYPES.has(file.type))return 'Dozwolone są tylko zrzuty ekranu w formacie PNG lub JPG/JPEG.';
  if(file.size>MAX_ATTACHMENT_BYTES)return 'Zrzut ekranu może mieć maksymalnie 1 MB.';
  return null;
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Nie udało się odczytać załącznika.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(file);});}
let searchTimer;
els.recipientSearch.addEventListener('input',()=>{
  els.recipientId.value=''; els.recipientSelected.textContent='Wybierz gracza z listy wyników.'; clearTimeout(searchTimer); const q=els.recipientSearch.value.trim(); if(q.length<1){els.recipientResults.hidden=true;return}
  searchTimer=setTimeout(async()=>{ try{ const data=await api(`/players/search?q=${encodeURIComponent(q)}`); els.recipientResults.replaceChildren(); if(!data.players?.length){els.recipientResults.innerHTML='<button type="button" disabled>Nie znaleziono graczy</button>';els.recipientResults.hidden=false;return} data.players.forEach(p=>{const b=document.createElement('button');b.type='button';b.disabled=!p.allowMessages;b.innerHTML=`<span><strong>${esc(p.displayName)}</strong></span><small>${p.allowMessages?'wybierz gracza':'wiadomości wyłączone'}</small>`;b.addEventListener('click',()=>selectRecipient(p));els.recipientResults.append(b)});els.recipientResults.hidden=false;}catch(e){els.composeStatus.textContent=e.message}},200);
});
els.composeForm.elements.body.addEventListener('input',()=>els.bodyCount.textContent=String(els.composeForm.elements.body.value.length));
els.attachment?.addEventListener('change',()=>{resetAttachmentHelp();const file=els.attachment.files?.[0];const problem=validateAttachment(file);if(problem){els.attachmentHelp.textContent=problem;els.attachmentHelp.style.color='#b42318';els.attachment.value='';}else if(file){els.attachmentHelp.textContent=`Wybrano: ${file.name} · ${formatBytes(file.size)}. Plik zostanie zaszyfrowany na serwerze.`;els.attachmentHelp.style.color='#287a43';}});
els.composeForm.addEventListener('submit',async e=>{
  e.preventDefault(); els.composeStatus.className='';
  if(!els.recipientId.value){els.composeStatus.textContent='Wybierz odbiorcę z listy graczy.';return}
  const file=els.attachment?.files?.[0]||null; const attachmentProblem=validateAttachment(file); if(attachmentProblem){els.composeStatus.textContent=attachmentProblem;return}
  const payload={recipientId:els.recipientId.value,subject:els.composeForm.elements.subject.value,body:els.composeForm.elements.body.value}; const btn=els.composeForm.querySelector('.send-btn'); btn.disabled=true; btn.textContent='Wysyłanie…';
  try{
    const result=await api('/messages',{method:'POST',body:JSON.stringify(payload)});
    if(file){
      btn.textContent='Wysyłanie załącznika…';
      const data=await fileToBase64(file);
      await api(`/messages/${result.message.messageId}/attachment`,{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:file.type,data})});
    }
    els.composeStatus.textContent=file?'Wiadomość i zrzut ekranu zostały wysłane.':'Wiadomość została wysłana.'; els.composeStatus.className='ok'; setTimeout(async()=>{closeCompose();await load('sent')},700);
  }catch(err){els.composeStatus.textContent=err.message}finally{btn.disabled=false;btn.textContent='Wyślij wiadomość ➤'}
});

document.querySelectorAll('[data-folder]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.folder)));
els.composeBtn.addEventListener('click',()=>openCompose()); els.composeClose.addEventListener('click',closeCompose); els.composeCancel.addEventListener('click',closeCompose); els.compose.addEventListener('click',e=>{if(e.target===els.compose)closeCompose()});
els.refresh.addEventListener('click',()=>load(state.folder)); els.search.addEventListener('input',()=>{state.search=els.search.value;renderList()}); document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!els.compose.hidden)closeCompose();else if(els.view.classList.contains('open'))emptyView()}});
load();
