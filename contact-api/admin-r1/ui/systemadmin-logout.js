"use strict";
// Shared OWNER logout for the protected hub, SEO and newsletter screens.
// The backend validates the existing Strict session and CSRF token.
(() => {
  const button=document.getElementById("systemadmin-logout");
  const status=document.getElementById("systemadmin-logout-status");
  if(!button || !status)return;
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    button.disabled=true;
    status.textContent="";
    try {
      const active=await fetch("/owner/newsletter/session",{
        credentials:"same-origin",cache:"no-store"
      });
      if(active.status===401){
        location.replace("/owner/newsletter/login");
        return;
      }
      if(!active.ok)throw Error("session_unavailable");
      const details=await active.json();
      if(!details.ok || typeof details.csrf!=="string")throw Error("csrf_unavailable");
      const result=await fetch("/owner/newsletter/logout",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"X-Owner-CSRF":details.csrf}
      });
      if(!result.ok)throw Error("logout_failed");
      location.replace("/owner/newsletter/login");
    }catch{
      status.textContent="Nie udało się wylogować. Spróbuj ponownie.";
    }finally{
      button.disabled=false;
    }
  });
})();
