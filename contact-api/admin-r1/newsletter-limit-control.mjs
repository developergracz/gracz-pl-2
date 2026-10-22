// Owner-only current-instance visibility and reset of the status-request e-mail counter.
// Provider suppression, global send budget, IP limits and consents are independent.
const WINDOW_MS=3600000, MAX=4, MAX_TRACKED=5000;
function address(value){
  if(typeof value!=='string')throw new TypeError('email');
  const normalized=value.trim().toLowerCase();
  if(normalized.length>254||!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]+$/.test(normalized))throw new TypeError('email');
  return normalized;
}
export function createNewsletterLimitControl({getBucket,clearBucket,now=Date.now,logger=console}){
  if(typeof getBucket!=='function'||typeof clearBucket!=='function')throw new TypeError('adapters');
  const since=new Date(now()).toISOString(),events=[],blocked=new Map();
  function inspect(raw){
    const email=address(raw),entry=getBucket(email),clock=now();
    const live=entry&&Number.isFinite(entry.startedAt)&&Number.isFinite(entry.count)&&
      clock>=entry.startedAt&&clock-entry.startedAt<WINDOW_MS;
    const used=live?Math.max(0,Math.floor(entry.count)):0;
    return {email,used,limit:MAX,blocked:used>=MAX,remaining:Math.max(0,MAX-used),
      firstRequestAt:live?new Date(entry.startedAt).toISOString():null,
      expiresAt:live?new Date(entry.startedAt+WINDOW_MS).toISOString():null};
  }
  function cleanup(){
    for(const [email,record] of blocked){
      const state=inspect(email);
      if(!state.blocked||record.firstRequestAt!==state.firstRequestAt)blocked.delete(email);
    }
  }
  function observe(raw){
    const state=inspect(raw);
    // At the fourth accepted request the quota is exhausted; attempt five is 429.
    if(!state.blocked){blocked.delete(state.email);return;}
    cleanup();
    const stamp=new Date(now()).toISOString();
    let record=blocked.get(state.email);
    if(!record){
      if(blocked.size>=MAX_TRACKED)blocked.delete(blocked.keys().next().value);
      record={firstRequestAt:state.firstRequestAt,blockedAt:stamp};
      blocked.set(state.email,record);
    }
    record.lastAttemptAt=stamp;
  }
  function listBlocked(){
    cleanup();
    const entries=[];
    for(const [email,record] of blocked){
      const state=inspect(email);
      entries.push({...state,blockedAt:record.blockedAt,lastAttemptAt:record.lastAttemptAt,
        deniedAttempts:Math.max(0,state.used-MAX),
        reason:'Wykorzystano limit 4 zapytań o status w ciągu 60 minut'});
    }
    entries.sort((a,b)=>b.blockedAt.localeCompare(a.blockedAt)||a.email.localeCompare(b.email));
    return {since,observedAt:new Date(now()).toISOString(),scope:'status_email',
      retention:'current_api_instance',total:entries.length,entries};
  }
  function unlock(raw){
    const before=inspect(raw);
    if(!before.blocked){blocked.delete(before.email);return {...before,changed:false};}
    if(!clearBucket(before.email))throw Error('changed');
    blocked.delete(before.email);
    const [local,domain]=before.email.split('@');
    events.unshift({at:new Date(now()).toISOString(),action:'Odblokowano limit statusu',
      recipient:local.slice(0,2)+'***@'+domain,actor:'OWNER'});
    if(events.length>80)events.length=80;
    try{logger.info?.('[owner] newsletter status limit cleared',{action:'status_limit_clear'});}catch{}
    return {...inspect(before.email),changed:true};
  }
  return Object.freeze({inspect,unlock,observe,listBlocked,
    history:()=>({since,retention:'current_api_instance',events:events.map(x=>({...x}))})});
}
