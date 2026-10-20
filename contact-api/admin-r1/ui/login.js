"use strict";
const form=document.getElementById('login-form');
const status=document.getElementById('login-status');
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const password=document.getElementById('password');
  const code=document.getElementById('code');
  const username=document.getElementById('username');
  const button=document.getElementById('login-button');
  if(button.disabled)return;
  button.disabled=true;
  status.textContent='Sprawdzanie…';
  try{
    const result=await fetch('/owner/newsletter/login',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        password:password.value,
        ...(username?{username:username.value}:{code:code.value})
      })
    });
    password.value='';
    if(code)code.value='';
    if(username)username.value='';
    if(!result.ok)throw Error('login_failed');
    location.replace('/owner/newsletter/');
  }catch{
    status.textContent='Logowanie nie powiodło się. Sprawdź dane lub spróbuj później.';
  }finally{button.disabled=false;}
});
