// Transactional proof-only email, not marketing. The single-use challenge
// is never sent in a URL query, API response, log or contact property.
export function createWithdrawalChallengeMailer({
  apiKey,emailFrom,request=fetch,timeoutMs=10000
}={}) {
  if(typeof apiKey!=='string'||apiKey.trim().length<10||
     typeof emailFrom!=='string'||!/^([^<>]*<)?[A-Za-z0-9._%+-]+@gracz\.pl>?$/.test(emailFrom.trim())||
     typeof request!=='function'||!Number.isInteger(timeoutMs)||
     timeoutMs<100||timeoutMs>20000)
    throw new TypeError('Pinned Resend challenge mail configuration required');
  return Object.freeze({
    async sendChallenge({challengeId,token,email}={}) {
      if(!/^[0-9a-f-]{36}$/i.test(challengeId||'')||
         !/^[A-Za-z0-9_-]{43}$/.test(token||'')||
         typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new TypeError('Valid private withdrawal challenge required');
      const link='https://gracz.pl/newsletter/#withdrawal='+challengeId+'.'+token;
      const body={
        from:emailFrom.trim(),to:[email],
        subject:'gracz.pl — potwierdź wypisanie z newslettera',
        text:'Otrzymaliśmy prośbę o wypisanie z newslettera gracz.pl.\n'+
          'Aby potwierdzić, otwórz link i kliknij przycisk wypisania:\n'+link+
          '\n\nLink jest ważny przez 15 minut. Jeśli to nie Ty, zignoruj wiadomość.\n'+
          'To wiadomość dotycząca zarządzania zgodą, nie reklama.'
      };
      let reply;
      try {
        reply=await request('https://api.resend.com/emails',{
          method:'POST',redirect:'error',
          headers:{'Authorization':'Bearer '+apiKey.trim(),
            'Content-Type':'application/json',
            'Idempotency-Key':'gracz-withdrawal-'+challengeId},
          body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)
        });
      } catch {
        throw Object.assign(new Error('WITHDRAWAL_MAIL_UNCERTAIN'),{code:'WITHDRAWAL_MAIL_UNCERTAIN'});
      }
      if(reply?.status!==200&&reply?.status!==201)
        throw Object.assign(new Error('WITHDRAWAL_MAIL_UNCERTAIN'),{code:'WITHDRAWAL_MAIL_UNCERTAIN'});
      // Provider ACK alone is not proof of delivery. Never auto-resend
      // when the ACK is missing or malformed.
      let result;
      try {result=await reply.json();} catch {
        throw Object.assign(new Error('WITHDRAWAL_MAIL_UNCERTAIN'),{code:'WITHDRAWAL_MAIL_UNCERTAIN'});
      }
      if(typeof result?.id!=='string'||!result.id)
        throw Object.assign(new Error('WITHDRAWAL_MAIL_UNCERTAIN'),{code:'WITHDRAWAL_MAIL_UNCERTAIN'});
      return true;
    }
  });
}
