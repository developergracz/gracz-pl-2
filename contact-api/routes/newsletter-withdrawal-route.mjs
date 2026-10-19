// Isolated recipient opt-out route. Does NOT enable newsletter opt-in,
// restore compromised n1/ns1 bearer tokens or require an operator identity.
export function createNewsletterWithdrawalRoute({
  allowedOrigins,withdrawal,checkReady,ipBuckets,rateLimit,hashValue,
  clientIp,readJson,json,setCors,normalizeEmail
}={}) {
  if(!(allowedOrigins instanceof Set)||typeof checkReady!=='function'||
     !(ipBuckets instanceof Map)||typeof rateLimit!=='function'||
     typeof clientIp!=='function'||typeof readJson!=='function'||
     typeof json!=='function'||typeof setCors!=='function'||
     typeof hashValue!=='function'||typeof normalizeEmail!=='function')
    throw new TypeError('Withdrawal route requires existing secure API controls');
  return async function handle(req,res,url) {
    const origin=String(req.headers.origin||'');
    if(!allowedOrigins.has(origin))
      return json(res,403,{error:{code:'ORIGIN_NOT_ALLOWED',message:'Niedozwolone źródło żądania.'}});
    setCors(res,origin);
    if(req.method==='OPTIONS') {
      res.writeHead(204,{
        'Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type',
        'Access-Control-Max-Age':'600','Cache-Control':'no-store',
        Vary:'Origin'
      });
      return res.end();
    }
    if(url.pathname==='/newsletter/withdrawal-ready') {
      if(req.method!=='GET')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
      let ready=false;
      try {ready=Boolean(withdrawal&&await checkReady());}catch{}
      return json(res,ready?200:503,{
        ready,configured:ready,withdrawalOnly:true,
        newsletterIntakeEnabled:false
      });
    }
    if(!['/newsletter/withdrawal-request','/newsletter/withdrawal-confirm'].includes(url.pathname))
      return json(res,404,{error:{code:'NOT_FOUND'}});
    if(req.method!=='POST')
      return json(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
    if(!withdrawal||!await checkReady())
      return json(res,503,{error:{code:'WITHDRAWAL_NOT_READY',
        message:'Wypisanie przez link jest chwilowo niedostępne.'}});
    const ip=clientIp(req)||'unknown';
    rateLimit(ipBuckets,hashValue('withdrawal:'+ip),
      15*60*1000,url.pathname.endsWith('-request')?8:25,
      'Zbyt wiele prób. Spróbuj później.');
    const body=await readJson(req,2048);
    if(!body||typeof body!=='object'||Array.isArray(body))
      return json(res,400,{error:{code:'INVALID_PAYLOAD'}});
    if(url.pathname.endsWith('-request')){
      // A honeypot gets the same neutral answer. Existing recipient status
      // and mail-send outcome are never returned to the caller.
      if(typeof body.website==='string'&&body.website.trim())
        return json(res,200,{ok:true,state:'request_received'});
      let email;
      try {email=normalizeEmail(body.email);}catch {
        return json(res,400,{error:{code:'INVALID_EMAIL'}});
      }
      if(typeof email!=='string'||email.length>254||
         !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json(res,400,{error:{code:'INVALID_EMAIL'}});
      await withdrawal.requestChallenge({email:email.toLowerCase()});
      return json(res,200,{ok:true,state:'request_received'});
    }
    const id=body.challengeId,token=body.token;
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||
       typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))
      return json(res,400,{error:{code:'WITHDRAWAL_CHALLENGE_REJECTED',
        message:'Link jest nieprawidłowy lub wygasł.'}});
    let result;
    try {
      result=await withdrawal.confirmChallenge({challengeId:id,token});
    } catch (e) {
      if(e?.code==='WITHDRAWAL_CHALLENGE_REJECTED')
        return json(res,400,{error:{code:'WITHDRAWAL_CHALLENGE_REJECTED',
          message:'Link jest nieprawidłowy, wygasł lub został wykorzystany.'}});
      throw e;
    }
    // provider_off_verified != historical first-party consent CONFIRMED.
    return json(res,200,{ok:true,state:result.state,confirmed:false});
  };
}
