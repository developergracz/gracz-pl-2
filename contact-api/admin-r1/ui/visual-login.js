"use strict";
// The premium form is hosted on the OWNER backend. Only same-origin JSON
// authentication is allowed: no cross-site form POST or second credential store.
const form=document.querySelector('.admin-login-form');
const feedback=document.getElementById('admin-login-validation');
const passwordInput=document.getElementById('admin-password');
const toggle=document.getElementById('toggle-admin-password');
const submit=form?.querySelector('button[type="submit"]');
if(toggle&&passwordInput){
  toggle.addEventListener('click',()=>{
    const shown=passwordInput.type==='password';
    passwordInput.type=shown?'text':'password';
    toggle.textContent=shown?'Ukryj':'Pokaż';
    toggle.setAttribute('aria-pressed',String(shown));
  });
}
if(form&&feedback&&passwordInput&&submit){
  const show=message=>{feedback.textContent=message;feedback.hidden=false;};
  form.addEventListener('invalid',event=>{
    const field=event.target;
    show(field.name==='username'?'Wpisz prawidłowy login administratora.':
      'Hasło musi zawierać co najmniej 9 znaków.');
  },true);
  form.addEventListener('input',()=>{feedback.hidden=true;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity()||submit.disabled)return;
    submit.disabled=true;
    show('Sprawdzanie danych logowania…');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch('/owner/newsletter/login',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        signal:controller.signal,
        body:JSON.stringify({
          username:form.elements.username.value,
          password:passwordInput.value
        })
      });
      if(response.ok){
        location.replace('/owner/newsletter/systemadmin');
        return;
      }
      show(response.status===429
        ?'Zbyt wiele prób. Poczekaj chwilę przed ponownym logowaniem.'
        :response.status===401
          ?'Nie udało się zalogować. Sprawdź login i hasło. Po pięciu nieudanych próbach konto jest blokowane na 15 minut.'
          :'Logowanie jest teraz niedostępne. Spróbuj później.');
    }catch{
      show('Serwer nie odpowiedział. Sprawdź połączenie i spróbuj ponownie.');
    }finally{
      clearTimeout(timeout);
      passwordInput.value='';
      submit.disabled=false;
    }
  });
}
