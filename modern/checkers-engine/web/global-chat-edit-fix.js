(() => {
  const style = document.createElement('style');
  style.textContent = `
    .gracz-edit-overlay{position:fixed;inset:0;z-index:12000;display:none;place-items:center;padding:24px;background:rgba(2,7,11,.78);backdrop-filter:blur(6px)}
    .gracz-edit-overlay.open{display:grid}
    .gracz-edit-card{width:min(560px,94vw);border:1px solid #29454e;border-radius:14px;background:linear-gradient(180deg,#0d1a21,#081218);box-shadow:0 28px 90px #000c;color:#e5efeb;overflow:hidden}
    .gracz-edit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 12px;border-bottom:1px solid #1f363e}
    .gracz-edit-head h3{margin:0;font-size:19px}.gracz-edit-head p{margin:5px 0 0;color:#78908a;font-size:11px}
    .gracz-edit-x{border:0;background:transparent;color:#91a59f;font-size:25px;line-height:1;cursor:pointer}
    .gracz-edit-body{padding:18px 20px}.gracz-edit-body textarea{width:100%;min-height:118px;resize:vertical;box-sizing:border-box;padding:12px 13px;border:1px solid #2a4650;border-radius:9px;background:#071218;color:#eef6f3;font:inherit;line-height:1.5;outline:none}.gracz-edit-body textarea:focus{border-color:#20b96a;box-shadow:0 0 0 3px #20b96a18}
    .gracz-edit-meta{display:flex;justify-content:space-between;gap:12px;margin-top:7px;color:#718781;font-size:10px}
    .gracz-edit-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 20px 18px}.gracz-edit-actions button{padding:9px 15px;border:1px solid #29424a;border-radius:8px;background:#0b1820;color:#aebfba;font-weight:700;cursor:pointer}.gracz-edit-actions .save{border-color:#23804e;background:linear-gradient(180deg,#1bc96c,#10934d);color:white}.gracz-edit-actions .save:disabled{opacity:.55;cursor:wait}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'gracz-edit-overlay';
  overlay.innerHTML = `<section class="gracz-edit-card" role="dialog" aria-modal="true" aria-labelledby="gracz-edit-title"><header class="gracz-edit-head"><div><h3 id="gracz-edit-title">Edytuj wiadomość</h3><p>Zmień treść swojej wiadomości bez opuszczania chatu.</p></div><button class="gracz-edit-x" type="button" aria-label="Zamknij">×</button></header><div class="gracz-edit-body"><textarea maxlength="600" aria-label="Treść wiadomości"></textarea><div class="gracz-edit-meta"><span>Zmiana zostanie oznaczona jako edytowana.</span><span><b>0</b>/600</span></div></div><footer class="gracz-edit-actions"><button class="cancel" type="button">Anuluj</button><button class="save" type="button">Zapisz zmiany</button></footer></section>`;
  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('textarea');
  const count = overlay.querySelector('.gracz-edit-meta b');
  const save = overlay.querySelector('.save');
  let activeId = null;
  let original = '';

  function close(){ overlay.classList.remove('open'); activeId=null; original=''; }
  function open(id, body){ activeId=id; original=body; textarea.value=body; count.textContent=String(body.length); overlay.classList.add('open'); requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(textarea.value.length,textarea.value.length)}); }
  textarea.addEventListener('input',()=>{count.textContent=String(textarea.value.length)});
  overlay.querySelector('.cancel').addEventListener('click',close);
  overlay.querySelector('.gracz-edit-x').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open')){e.preventDefault();close()}});

  save.addEventListener('click', async () => {
    const body = textarea.value.trim();
    if (!activeId || !body || body === original.trim()) return close();
    save.disabled = true; save.textContent = 'Zapisywanie…';
    try {
      const response = await fetch(`/global-chat/messages/${encodeURIComponent(activeId)}`, {method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({body})});
      let result={}; try{result=await response.json()}catch{}
      if(!response.ok) throw new Error(result.error?.message || `Błąd ${response.status}`);
      const article=document.querySelector(`.message[data-id="${CSS.escape(String(activeId))}"]`);
      if(article){const bodyNode=article.querySelector('.message-body');if(bodyNode)bodyNode.textContent=body;const head=article.querySelector('.message-head');if(head&&!head.querySelector('.edited')){const ed=document.createElement('span');ed.className='edited';ed.textContent='edytowano';head.append(ed)}}
      close();
    } catch (error) {
      const toast=document.querySelector('#toast');
      if(toast){toast.textContent=error.message||'Nie udało się zapisać zmiany.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}
    } finally {
      save.disabled=false; save.textContent='Zapisz zmiany';
    }
  });

  function interceptEdit(event){
    const button = event.target.closest('#context-menu button');
    if (!button || !/Edytuj/i.test(button.textContent || '')) return;
    const menu = document.querySelector('#context-menu');
    const messages=[...document.querySelectorAll('.message[data-id]')];
    if(!messages.length) return;
    const menuRect=menu?.getBoundingClientRect();
    let article=null,best=Infinity;
    for(const item of messages){
      const r=item.getBoundingClientRect();
      const px=menuRect ? menuRect.left : event.clientX;
      const py=menuRect ? menuRect.top : event.clientY;
      const cx=Math.max(r.left,Math.min(px,r.right));
      const cy=Math.max(r.top,Math.min(py,r.bottom));
      const d=(cx-px)*(cx-px)+(cy-py)*(cy-py);
      if(d<best){best=d;article=item}
    }
    if(!article) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(menu) menu.hidden=true;
    open(article.dataset.id, article.querySelector('.message-body')?.textContent || '');
  }

  document.addEventListener('click', interceptEdit, true);
  const menu=document.querySelector('#context-menu');
  if(menu) menu.addEventListener('click', interceptEdit, true);
  new MutationObserver(()=>{
    const m=document.querySelector('#context-menu');
    if(m && !m.dataset.editFixBound){m.dataset.editFixBound='1';m.addEventListener('click',interceptEdit,true)}
  }).observe(document.body,{childList:true,subtree:true});
})();
