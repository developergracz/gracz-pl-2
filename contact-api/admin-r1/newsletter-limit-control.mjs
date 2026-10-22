// OWNER-only management of the existing in-memory status e-mail bucket.
// Never changes IP protection, provider suppression, sending quotas or consent.
const WINDOW=3600000, MAX=4;
function clean(value){
  if(typeof value!=='string')throw new TypeError('email');
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]+$/.test(email))throw new TypeError('email');
  return email;
}
export function createNewsletterLimitControl({getBucket,clearBucket,now=Date.now,logger=console}){
  const since=new Date(now()).toISOString(),events=[];
  function inspect(raw){
    const email=clean(raw),entry=getBucket(email),ts=now();
    const live=entry&&Number.isFinite(entry.startedAt)&&Number.isFinite(entry.count)&&
      ts>=entry.startedAt&&ts-entry.startedAt<WINDOW;
    const used=live?Math.max(0,Math.floor(entry.count)):0;
    return {email,used,limit:MAX,blocked:used>=MAX,remaining:Math.max(0,MAX-used),
      expiresAt:live?new Date(entry.startedAt+WINDOW).toISOString():null};
  }
  function unlock(raw){
    const before=inspect(raw);
    if(!before.blocked)return {...before,changed:false};
    if(!clearBucket(before.email))throw Error('changed');
    const [local,domain]=before.email.split('@');
    events.unshift({at:new Date(now()).toISOString(),action:'Odblokowano limit statusu',
      recipient:local.slice(0,2)+'***@'+domain,actor:'OWNER'});
    if(events.length>80)events.length=80;
    try{logger.info?.('[owner] newsletter status limit cleared',{action:'status_limit_clear'});}catch{}
    return {...inspect(before.email),changed:true};
  }
  return Object.freeze({inspect,unlock,
    history:()=>({since,retention:'current_api_instance',events:events.map(x=>({...x}))})});
}
