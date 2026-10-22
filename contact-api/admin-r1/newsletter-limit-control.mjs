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
  const since=new Date(now()).toISOString(),events=[],active=new Map();
  function inspect(raw){
    const email=clean(raw),entry=getBucket(email),ts=now();
    const live=entry&&Number.isFinite(entry.startedAt)&&Number.isFinite(entry.count)&&
      ts>=entry.startedAt&&ts-entry.startedAt<WINDOW;
    const used=live?Math.max(0,Math.floor(entry.count)):0;
    const blocked=used>=MAX,known=blocked?active.get(email):null;
    return {email,used,limit:MAX,blocked,remaining:Math.max(0,MAX-used),
      startedAt:live?new Date(entry.startedAt).toISOString():null,
      blockedAt:known?.startedAt===entry?.startedAt?new Date(known.blockedAt).toISOString():null,
      expiresAt:live?new Date(entry.startedAt+WINDOW).toISOString():null};
  }
  // Only exhausted status buckets are indexed. Raw addresses never enter logs or
  // a persistent table; this registry lasts no longer than the API instance.
  function observe(raw){
    const current=inspect(raw);
    if(!current.blocked){active.delete(current.email);return;}
    const startedAt=Date.parse(current.startedAt),existing=active.get(current.email);
    if(existing?.startedAt===startedAt)return;
    active.set(current.email,{startedAt,blockedAt:now()});
    if(active.size>5000)active.delete(active.keys().next().value);
  }
  function listActive(){
    const entries=[];
    for(const [email,record] of active){
      const current=inspect(email);
      if(!current.blocked||Date.parse(current.startedAt)!==record.startedAt){
        active.delete(email);continue;
      }
      entries.push({...current,reason:'Limit sprawdzenia statusu newslettera'});
    }
    entries.sort((a,b)=>Date.parse(b.blockedAt)-Date.parse(a.blockedAt));
    return {since,asOf:new Date(now()).toISOString(),retention:'current_api_instance',
      scope:'status_email',total:entries.length,entries};
  }
  function unlock(raw){
    const before=inspect(raw);
    if(!before.blocked){active.delete(before.email);return {...before,changed:false};}
    if(!clearBucket(before.email))throw Error('changed');
    active.delete(before.email);
    const [local,domain]=before.email.split('@');
    events.unshift({at:new Date(now()).toISOString(),action:'Odblokowano limit statusu',
      recipient:local.slice(0,2)+'***@'+domain,actor:'OWNER'});
    if(events.length>80)events.length=80;
    try{logger.info?.('[owner] newsletter status limit cleared',{action:'status_limit_clear'});}catch{}
    return {...inspect(before.email),changed:true};
  }
  return Object.freeze({inspect,observe,listActive,unlock,
    history:()=>({since,retention:'current_api_instance',events:events.map(x=>({...x}))})});
}
