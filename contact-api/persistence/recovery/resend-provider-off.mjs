// Internal #282 provider-off adapter. Only a verified subject resolver may
// provide the address; never expose this module to a public HTTP route.
// The Resend team-wide suppression list is a durable stop to email delivery,
// even when a contact is inadvertently added back to a marketing segment.
function uncertain() {
  return Object.assign(new Error('WITHDRAWAL_PROVIDER_UNCERTAIN'),{
    code:'WITHDRAWAL_PROVIDER_UNCERTAIN',status:503
  });
}
const validEmail = email => typeof email==='string' && email.length<=254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email===email.trim() && email===email.toLowerCase();

export function createResendProviderOff({
  apiKey, baseUrl='https://api.resend.com', request=fetch,
  timeoutMs=10000, allowTestLoopback=false
}={}) {
  if(typeof apiKey!=='string'||!apiKey.trim()||typeof request!=='function')
    throw new TypeError('Resend provider configuration required');
  const base=String(baseUrl).replace(/\/$/,'');
  if(base!=='https://api.resend.com' &&
     !(allowTestLoopback && /^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(base)))
    throw new TypeError('Pinned Resend API origin required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
    throw new TypeError('Bounded request timeout required');

  async function call(method,path,body,allowed=[200]) {
    let response;
    try {
      response=await request(base+path,{
        method,
        headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
          'User-Agent':'gracz.pl-withdrawal/1.0'},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
        signal:AbortSignal.timeout(timeoutMs),redirect:'error'
      });
    }catch{throw uncertain();}
    if(!response||!allowed.includes(response.status))throw uncertain();
    let data;
    try {data=await response.json();}catch{throw uncertain();}
    if(!data||typeof data!=='object'||Array.isArray(data))throw uncertain();
    return {status:response.status,data};
  }
  async function suppression(email) {
    const answer=await call('GET','/suppressions/'+encodeURIComponent(email),undefined,[200,404]);
    if(answer.status===404)return false;
    if(answer.data.object!=='suppression'||answer.data.email!==email ||
       !['manual','bounce','complaint'].includes(answer.data.origin)||
       typeof answer.data.id!=='string'||!answer.data.id)throw uncertain();
    return true;
  }
  async function contact(email){
    const answer=await call('GET','/contacts/'+encodeURIComponent(email),undefined,[200,404]);
    if(answer.status===404)return null;
    if(answer.data.object!=='contact'||answer.data.email!==email||
       typeof answer.data.id!=='string'||!answer.data.id||
       typeof answer.data.unsubscribed!=='boolean')throw uncertain();
    return answer.data;
  }
  async function verify(email){
    if(!validEmail(email))throw new TypeError('Trusted normalized email required');
    // Both checks must succeed. Provider API outage or inconsistent payloads
    // are UNKNOWN, never confirmation.
    const [blocked,current]=await Promise.all([suppression(email),contact(email)]);
    return blocked && (current===null||current.unsubscribed===true);
  }
  return Object.freeze({
    async verifyOff(email) {
      return (await verify(email)) ? Object.freeze({off:true}) :
        Object.freeze({off:false});
    },
    async ensureOff(email) {
      if(!validEmail(email))throw new TypeError('Trusted normalized email required');
      // Idempotent reconciliation of UNKNOWN outcomes: inspect before writing.
      if(await verify(email))return Object.freeze({off:true});
      if(!await suppression(email)) {
        // One attempt; a transport error is UNKNOWN. An operator can retry by
        // inspecting provider state, never by blindly resending a mutation.
        await call('POST','/suppressions',{email},[200,201,409]);
      }
      const current=await contact(email);
      if(current && !current.unsubscribed) {
        await call('PATCH','/contacts/'+encodeURIComponent(current.id),{unsubscribed:true},[200]);
      }
      if(!await verify(email))throw uncertain();
      return Object.freeze({off:true});
    }
  });
}
