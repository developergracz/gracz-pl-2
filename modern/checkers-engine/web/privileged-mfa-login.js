(()=>{
  let busy=false;
  function elements(){return{form:document.querySelector('#auth-form'),loginTab:document.querySelector('[data-mode="login"]'),errorBox:document.querySelector('#auth-error')};}
  function ensureMfaField(){
    let input=document.querySelector('#privileged-mfa-code');
    if(input)return input;
    const label=document.createElement('label');label.id='privileged-mfa-field';label.textContent='Kod MFA administratora / moderatora';
    input=document.createElement('input');input.id='privileged-mfa-code';input.name='mfaCode';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.placeholder='000000';input.required=true;
    const help=document.createElement('small');help.className='field-help';help.textContent='Konta moderatorów, administratorów i właściciela wymagają kodu TOTP.';
    label.append(input,help);document.querySelector('#auth-password')?.closest('label')?.after(label);return input;
  }
  document.addEventListener('submit',async event=>{
    const {form,loginTab,errorBox}=elements();
    if(!form||event.target!==form||!loginTab?.classList.contains('active')||busy)return;
    event.preventDefault();event.stopImmediatePropagation();
    const data=Object.fromEntries(new FormData(form));
    if(document.querySelector('#privileged-mfa-code'))data.mfaCode=String(data.mfaCode||'').trim();
    busy=true;const submit=document.querySelector('#auth-submit');if(submit)submit.disabled=true;
    try{
      const response=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        if(result.error?.code==='MFA_REQUIRED'||result.error?.code==='MFA_INVALID'){const input=ensureMfaField();errorBox.textContent=result.error?.message||'Wpisz kod MFA.';input.focus();return;}
        errorBox.textContent=result.error?.message||'Nie udało się zalogować.';return;
      }
      sessionStorage.setItem('gracz-session',JSON.stringify(result));location.reload();
    }catch{errorBox.textContent='Nie udało się połączyć z serwerem. Spróbuj ponownie.';}
    finally{busy=false;if(submit)submit.disabled=false;}
  },true);
})();
