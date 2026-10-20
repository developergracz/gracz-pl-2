// A new-consent-only surface. Legacy newsletter routes stay unconditionally held.
export function createFreshNewsletterRoute({allowedOrigins,manager,ready,rateLimit,
  ipBuckets,hashValue,clientIp,readJson,json,setCors,normalizeEmail}={}) {
  if(!(allowedOrigins instanceof Set)||typeof ready!=='function'||
    !(ipBuckets instanceof Map)||typeof rateLimit!=='function'||
    typeof readJson!=='function'||typeof json!=='function'||
    typeof normalizeEmail!=='function')throw new TypeError('Fresh-only route requires security controls');
  return async function route(req,res,url) {
    const origin=String(req.headers.origin||'');
    if(!allowedOrigins.has(origin))
      return json(res,403,{error:{code:'ORIGIN_NOT_ALLOWED'}});
    setCors(res,origin);
    if(req.method==='OPTIONS') {
      res.writeHead(204,{'Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600',Vary:'Origin'});
      return res.end();
    }
    if(url.pathname==='/newsletter/fresh-ready') {
      if(req.method!=='GET')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
      const available=Boolean(manager&&await ready());
      return json(res,available?200:503,
        {ready:available,configured:available,schemaReady:available,
          intakePaused:!available,legacyHeld:true});
    }
    if(req.method!=='POST')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
    if(!manager||!await ready())return json(res,503,{error:{code:'FRESH_NEWSLETTER_UNAVAILABLE'}});
    const ip=clientIp(req)||'unknown';
    rateLimit(ipBuckets,hashValue('fresh:'+ip),15*60*1000,
      url.pathname==='/newsletter/fresh-request'?5:20,'Spróbuj później.');
    const body=await readJson(req,2048);
    if(!body||typeof body!=='object'||Array.isArray(body))
      return json(res,400,{error:{code:'INVALID_PAYLOAD'}});
    if(url.pathname==='/newsletter/fresh-request') {
      if(body.website)return json(res,200,{ok:true,state:'request_received'});
      if(body.consent!==true)return json(res,400,{error:{code:'CONSENT_REQUIRED'}});
      const email=normalizeEmail(body.email);
      if(typeof email!=='string'||email.length>254||
         !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json(res,400,{error:{code:'INVALID_EMAIL'}});
      // Status is neutral even if an address is already held or suppressed.
      await manager.request({email:email.toLowerCase(),source:body.source==='footer'?'footer':'newsletter_page'});
      return json(res,200,{ok:true,state:'request_received'});
    }
    if(url.pathname==='/newsletter/fresh-confirm') {
      const result=await manager.confirm({id:body.id,token:body.token}).catch(err=>{
        if(err?.code==='FRESH_PROOF_REJECTED')return null;
        throw err;
      });
      if(!result)return json(res,400,{error:{code:'FRESH_PROOF_REJECTED'}});
      return json(res,200,{ok:true,state:result.state,confirmed:result.confirmed===true});
    }
    return json(res,404,{error:{code:'NOT_FOUND'}});
  };
}
