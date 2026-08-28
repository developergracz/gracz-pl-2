(() => {
  const style=document.createElement('style');
  style.textContent=`.gracz-confirm-overlay{position:fixed;inset:0;z-index:15000;display:none;place-items:center;padding:24px;background:rgba(2,7,11,.8);backdrop-filter:blur(6px)}.gracz-confirm-overlay.open{display:grid}.gracz-confirm-card{width:min(460px,94vw);border:1px solid #29454e;border-radius:14px;background:linear-gradient(180deg,#0d1a21,#081218);box-shadow:0 28px 90px #000c;color:#e5efeb;overflow:hidden}.gracz-confirm-card header{padding:18px 20px 10px}.gracz-confirm-card h3{margin:0;font-size:19px}.gracz-confirm-card p{margin:8px 0 0;color:#8ba09b;font-size:12px;line-height:1.5}.gracz-confirm-actions{display:flex;justify-content:flex-end;gap:8px;padding:10px 20px 18px}.gracz-confirm-actions button{padding:9px 15px;border:1px solid #29424a;border-radius:8px;background:#0b1820;color:#aebfba;font-weight:700;cursor:pointer}.gracz-confirm-actions .danger{border-color:#7b3139;background:#351419;color:#ff9da4}.gracz-confirm-actions button:disabled{opacity:.55;cursor:wait}`;
  document.head.appendChild(style);
  const overlay=document.createElement('div');
  overlay.className='gracz-confirm-overlay';
  overlay.innerHTML='<section class="gracz-confirm-card" role="dialog" aria-modal="true"><header><h3>Czy na pewno chcesz usunąć tę wiadomość?</h3><p>Wiadomość zostanie trwale usunięta z Twojej skrzynki. Tej operacji nie można cofnąć.</p></header><footer class="gracz-confirm-actions"><button class="danger" type="button">Usuń</button><button class="cancel" type="button">Anuluj</button></footer></section>';
  document.body.appendChild(overlay);
  const cancel=overlay.querySelector('.cancel'),danger=overlay.querySelector('.danger');
  let pendingId=null;
  const close=()=>{overlay.classList.remove('open');pendingId=null;};
  cancel.addEventListener('click',close); overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open')){e.preventDefault();close()}});
  danger.addEventListener('click',async()=>{
    if(!pendingId)return;
    danger.disabled=true;danger.textContent='Usuwanie…';
    try{
      const s=JSON.parse(sessionStorage.getItem('gracz-session')||'null');
      const r=await fetch(`/messages/${encodeURIComponent(pendingId)}`,{method:'DELETE',headers:{authorization:`Bearer ${s?.token||''}`,accept:'application/json'}});
      let data={};try{data=await r.json()}catch{}
      if(!r.ok)throw new Error(data.error?.message||`Błąd ${r.status}`);
      close();location.reload();
    }catch(err){
      const p=overlay.querySelector('p');p.textContent=err.message||'Nie udało się usunąć wiadomości.';
    }finally{danger.disabled=false;danger.textContent='Usuń';}
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#message-view [data-act="delete"]');
    if(!btn)return;
    const row=document.querySelector('#message-list .message-row.active');
    const id=row?.dataset.id;
    if(!id)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    pendingId=id;overlay.querySelector('p').textContent='Wiadomość zostanie trwale usunięta z Twojej skrzynki. Tej operacji nie można cofnąć.';overlay.classList.add('open');cancel.focus();
  },true);
})();