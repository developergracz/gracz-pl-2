(()=>{
  let busy=false;
  function elements(){return{form:document.querySelector('#auth-form'),loginTab:document.querySelector('[data-mode="login"]'),registerTab:document.querySelector('[data-mode="register"]'),errorBox:document.querySelector('#auth-error')};}

  function installRichRegistration(){
    const {form,registerTab}=elements();
    const emailField=document.querySelector('#email-field');
    if(!form||!registerTab||!emailField)return;

    let phoneField=document.querySelector('#phone-field');
    let channelField=document.querySelector('#verification-channel-field');
    if(!phoneField){
      phoneField=document.createElement('label');
      phoneField.id='phone-field';
      phoneField.className='rich-register-field';
      phoneField.hidden=true;
      phoneField.append(document.createTextNode('Wpisz Twój numer telefonu'));
      const phone=document.createElement('input');
      phone.name='phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.maxLength=24;phone.placeholder='np. +48 500 600 700';
      const help=document.createElement('small');help.className='field-help';help.textContent='Numer telefonu może służyć do kodów SMS i odzyskiwania dostępu.';
      phoneField.append(phone,help);
    }
    if(!channelField){
      channelField=document.createElement('fieldset');
      channelField.id='verification-channel-field';
      channelField.className='rich-register-field';
      channelField.hidden=true;
      channelField.style.cssText='margin:0;padding:12px 14px;border:1px solid #29414e;border-radius:8px;background:#08131a';
      const legend=document.createElement('legend');legend.textContent='Gdzie chcesz otrzymać kod aktywacyjny?';legend.style.cssText='padding:0 6px;font-weight:700;color:#dce7ed';
      const makeOption=(value,text,checked=false)=>{const label=document.createElement('label');label.style.cssText='display:flex;grid-template-columns:auto 1fr;align-items:center;gap:9px;margin:7px 0;font-weight:500;color:#b9c7cf';const input=document.createElement('input');input.type='radio';input.name='verificationChannel';input.value=value;input.checked=checked;label.append(input,document.createTextNode(text));return label;};
      const emailOption=makeOption('email','Kod aktywacyjny na adres e-mail',true);
      const smsOption=makeOption('sms','Kod aktywacyjny SMS na numer telefonu');
      const help=document.createElement('small');help.className='field-help';help.textContent='Wybrany kanał może być później używany także do odzyskiwania hasła.';
      channelField.append(legend,emailOption,smsOption,help);
    }
    if(!phoneField.isConnected||!channelField.isConnected)emailField.after(phoneField,channelField);

    if(!document.querySelector('#rich-registration-style')){
      const style=document.createElement('style');style.id='rich-registration-style';style.textContent=`
        .auth-dialog.rich-register-mode{width:min(640px,96vw);max-height:calc(100vh - 36px);overflow:auto}
        .auth-dialog.rich-register-mode #auth-form{gap:12px}
        .auth-dialog.rich-register-mode #phone-field input{width:100%;padding:12px;border:1px solid #394956;border-radius:7px;background:#080e13;color:#fff;outline:none}
        .auth-dialog.rich-register-mode #phone-field input:focus{border-color:#20db72;box-shadow:0 0 0 3px #20db7218}
        .auth-dialog.rich-register-mode #guest-thousand-demo,.auth-dialog.rich-register-mode #guest-thousand-note{display:none!important}
      `;document.head.append(style);
    }

    const dialog=document.querySelector('.auth-dialog');
    const phoneInput=phoneField.querySelector('input[name="phone"]');
    const smsRadio=channelField.querySelector('input[value="sms"]');
    const sync=()=>{
      const registering=registerTab.classList.contains('active');
      phoneField.hidden=!registering;
      channelField.hidden=!registering;
      dialog?.classList.toggle('rich-register-mode',registering);
      if(phoneInput)phoneInput.required=registering&&Boolean(smsRadio?.checked);
    };
    channelField.addEventListener('change',sync);
    new MutationObserver(sync).observe(registerTab,{attributes:true,attributeFilter:['class']});
    sync();
  }

  function ensureMfaField(){
    let input=document.querySelector('#privileged-mfa-code');
    if(input)return input;
    const label=document.createElement('label');label.id='privileged-mfa-field';label.textContent='Kod MFA administratora / moderatora';
    input=document.createElement('input');input.id='privileged-mfa-code';input.name='mfaCode';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.placeholder='000000';input.required=true;
    const help=document.createElement('small');help.className='field-help';help.textContent='Konta moderatorów, administratorów i właściciela wymagają kodu TOTP.';
    label.append(input,help);document.querySelector('#auth-password')?.closest('label')?.after(label);return input;
  }

  document.addEventListener('DOMContentLoaded',installRichRegistration,{once:true});
  if(document.readyState!=='loading')installRichRegistration();

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
