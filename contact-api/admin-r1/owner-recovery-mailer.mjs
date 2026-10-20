// Transactional OWNER-only mail; no tracking, links, logging or marketing audiences.
// A one-time secret is delivered only to the mailbox chosen and confirmed by OWNER.
export function createOwnerRecoveryMailer({apiKey,emailFrom,request=fetch}={}){
  if(typeof apiKey!=='string'||apiKey.trim().length<10||
    typeof emailFrom!=='string'||!/@gracz\.pl>?$/i.test(emailFrom)||
    typeof request!=='function')return null;
  return Object.freeze({
    async send({email,code,purpose}={}){
      if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
        !/^[A-Za-z0-9_-]{24}$/.test(code||'')||
        !['verify','reset'].includes(purpose))throw Error('Invalid OWNER mail');
      const verify=purpose==='verify';
      const text=verify
        ?'Potwierdzenie adresu odzyskiwania konta gracz.pl.\n\n'
          +'Jednorazowe hasło weryfikacyjne: '+code+'\n\n'
          +'Wpisz je w ustawieniach konta administratora w ciągu 10 minut.\n'
          +'Jeśli nie zlecano tej operacji, zignoruj wiadomość.'
        :'Odzyskiwanie hasła administratora gracz.pl.\n\n'
          +'Hasło tymczasowe (jednorazowe): '+code+'\n\n'
          +'Wpisz je w oknie „Zapomniałem hasła?” i ustaw nowe hasło (minimum 9 znaków).\n'
          +'Hasło tymczasowe traci ważność po 10 minutach.\n'
          +'Jeśli nie proszono o odzyskanie hasła, zignoruj wiadomość.';
      const response=await request('https://api.resend.com/emails',{
        method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+apiKey.trim(),'Content-Type':'application/json'},
        body:JSON.stringify({from:emailFrom,to:[email],
          subject:verify?'gracz.pl — potwierdź e-mail odzyskiwania':
            'gracz.pl — jednorazowe hasło tymczasowe',text}),
        signal:AbortSignal.timeout(10000)
      });
      if(response?.status!==200&&response?.status!==201)
        throw Error('OWNER_MAIL_UNCERTAIN');
      const data=await response.json();
      if(typeof data?.id!=='string'||!data.id)throw Error('OWNER_MAIL_UNCERTAIN');
      return true;
    }
  });
}
