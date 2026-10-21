// Internal withdrawal adapter. Only a verified subject resolver may provide
// the address; never expose this module to a public HTTP route.
// First-party PostgreSQL revocations and the global marketing send fence
// enforce no-send. A voluntary opt-out must NEVER create a team-wide Resend
// suppression, which would also block a future fresh DOI confirmation.
// Provider contact preferences remain unsubscribed until later explicit consent.
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
    // An absent contact cannot receive Resend broadcasts. For an existing
    // contact, the provider's unsubscribe flag must be verified by readback.
    // The durable first-party revocation / global send fence are authoritative.
    const current=await contact(email);
    return current===null||current.unsubscribed===true;
  }
  return Object.freeze({
    // Read-only preflight. Never clears suppression or changes contact consent.
    async deliveryAllowed(email) {
      if(!validEmail(email))throw new TypeError('Trusted normalized email required');
      return !await suppression(email);
    },
    async verifyOff(email) {
      return (await verify(email)) ? Object.freeze({off:true}) :
        Object.freeze({off:false});
    },
    async ensureOff(email) {
      if(!validEmail(email))throw new TypeError('Trusted normalized email required');
      // No writes to /suppressions. Provider blocklists still protect genuine
      // bounces, complaints and independent operator safety decisions.
      const current=await contact(email);
      if(current===null||current.unsubscribed) return Object.freeze({off:true});
      // Reconcile only the contact's marketing preference, not delivery.
      await call('PATCH','/contacts/'+encodeURIComponent(current.id),
        {unsubscribed:true},[200]);
      if(!await verify(email))throw uncertain();
      return Object.freeze({off:true});
    }
  });
}
