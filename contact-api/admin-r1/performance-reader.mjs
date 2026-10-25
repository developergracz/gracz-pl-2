// Read-only OWNER view of the existing private GitHub Actions Performance Guardian.
// A dedicated token with repository Actions:read permission is optional; never
// render tokens, raw logs, arbitrary GitHub URLs, or user-supplied repository names.
const REPO="developergracz/gracz-pl-2";
const API="https://api.github.com/repos/"+REPO;
const RUN_URL="https://github.com/"+REPO+"/actions/runs/";
const TRUSTED_REDIRECTS=["pipelines.actions.githubusercontent.com","productionresultssa0.blob.core.windows.net"];
const TARGETS=new Set(["https://gracz.pl/","https://gracz.pl/gry/poker-treningowy/"]);
const MAX_BYTES=1500000;
const TTL_MS=300000;
const fixedPath="/actions/workflows/performance-autopilot.yml/runs?branch=main&per_page=6";

function boundedInteger(n){return Number.isSafeInteger(n)&&n>=0?n:null;}
function allowedRedirect(value){
  try{
    const u=new URL(value);
    return u.protocol==="https:" && !u.username && !u.password &&
      (TRUSTED_REDIRECTS.includes(u.hostname)||u.hostname.endsWith(".actions.githubusercontent.com"));
  }catch{return false;}
}
async function boundedText(response,limit=MAX_BYTES){
  const rawLength=response.headers?.get?.("content-length");
  if(rawLength && Number(rawLength)>limit)throw Error("too_large");
  if(!response.body?.getReader){
    const s=await response.text();
    if(Buffer.byteLength(s)>limit)throw Error("too_large");
    return s;
  }
  const reader=response.body.getReader(),parts=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>limit)throw Error("too_large");
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  return Buffer.concat(parts.map(x=>Buffer.from(x))).toString("utf8");
}
export function parseGuardianLog(log){
  if(typeof log!=="string")return null;
  const lines=log.split("\n");
  for(let i=lines.length-1;i>=0;i--){
    const start=lines[i].indexOf('{"state":');
    if(start<0 || lines[i].length-start>20000)continue;
    try{
      const data=JSON.parse(lines[i].slice(start).replace(/\x1b\[[0-9;]*m/g,"").trim());
      if(data.paidAiUsed!==false || !Array.isArray(data.reports))continue;
      const reports=[];
      for(const entry of data.reports.slice(0,4)){
        if(!entry || !TARGETS.has(entry.url) ||
           !["mobile","desktop"].includes(entry.strategy))continue;
        const lcpMs=boundedInteger(entry.lcpMs);
        const element=entry.lcpElement?.selector;
        reports.push({
          url:entry.url,strategy:entry.strategy,
          lcpMs, state:lcpMs===null?"unknown":lcpMs<2500?"good":"attention",
          element:typeof element==="string"?element.slice(0,160):null,
          fcpMs:boundedInteger(entry.timings?.fcpMs),
          ttfbMs:boundedInteger(entry.timings?.ttfbMs),
          blockers:Array.isArray(entry.renderBlockers)?entry.renderBlockers
            .filter(x=>typeof x?.path==="string" && /^\/assets\/[A-Za-z0-9_.\/-]+$/.test(x.path))
            .slice(0,6).map(x=>({path:x.path,wastedMs:boundedInteger(x.wastedMs)})):[]
        });
      }
      if(reports.length)return reports;
    }catch{ /* Ignore non-Guardian output and malformed logs. */ }
  }
  return null;
}
export function createPerformanceReader({
 token=process.env.GRACZ_PERFORMANCE_GITHUB_TOKEN||"",
 fetcher=fetch,now=Date.now
}={}){
  let cached=null,expiresAt=0,inFlight=null;
  const headers={
    Accept:"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"gracz-performance-owner-read-only",
    ...(token?{Authorization:"Bearer "+token}:{})
  };
  async function api(path,log=false){
    const url="https://api.github.com/repos/"+REPO+path;
    const response=await fetcher(url,{
      headers,redirect:"manual",signal:AbortSignal.timeout(12000)
    });
    if(log && [301,302,303,307,308].includes(response.status)){
      const location=response.headers?.get?.("location");
      if(!allowedRedirect(location))throw Error("untrusted_redirect");
      const result=await fetcher(location,{
        headers:{"User-Agent":"gracz-performance-owner-read-only"},
        redirect:"error",signal:AbortSignal.timeout(12000)
      });
      if(!result.ok)throw Error("log_unavailable");
      return boundedText(result);
    }
    if(!response.ok)throw Error("github_unavailable");
    const text=await boundedText(response,log?MAX_BYTES:200000);
    return log?text:JSON.parse(text);
  }
  function runShape(r){
    if(!r||!Number.isSafeInteger(r.id)||r.id<1||r.head_branch!=="main")return null;
    return {
      id:r.id,url:RUN_URL+r.id,
      status:r.status==="completed"?"completed":"in_progress",
      conclusion:["success","failure","cancelled","timed_out","skipped"].includes(r.conclusion)
        ?r.conclusion:null,
      createdAt:typeof r.created_at==="string"?r.created_at:null,
      commit:typeof r.head_sha==="string"&&/^[a-f0-9]{40}$/.test(r.head_sha)
        ?r.head_sha.slice(0,12):null
    };
  }
  async function collect(){
    if(!token)return {
      ok:false,state:"needs_configuration",checkedAt:new Date(now()).toISOString(),
      source:"github_actions_private",history:[],latest:null,rollback:null
    };
    try{
      const data=await api(fixedPath);
      if(!Array.isArray(data.workflow_runs))throw Error("unexpected_shape");
      const history=data.workflow_runs.map(runShape).filter(Boolean).slice(0,6);
      const completed=history.filter(r=>r.conclusion==="success").slice(0,3);
      await Promise.all(completed.map(async r=>{
        try{
          const jobs=await api("/actions/runs/"+r.id+"/jobs?per_page=40");
          const job=jobs.jobs?.find(j=>j.name===
            "Observe LCP and self-repair only approved regressions" &&
            j.status==="completed"&&j.conclusion==="success");
          if(!Number.isSafeInteger(job?.id))return;
          r.reports=parseGuardianLog(await api("/actions/jobs/"+job.id+"/logs",true));
        }catch{r.reports=null;}
      }));
      let rollback=null;
      try{
        const x=await api("/actions/workflows/performance-rollback-stage.yml/runs?per_page=1");
        const r=x.workflow_runs?.[0];
        if(Number.isSafeInteger(r?.id) && r.id>0)rollback={
          url:RUN_URL+r.id,
          conclusion:["success","failure","cancelled","timed_out"].includes(r.conclusion)?r.conclusion:null,
          checkedAt:typeof r.updated_at==="string"?r.updated_at:null
        };
      }catch{ /* Rollback evidence remains unknown if GitHub is unavailable. */ }
      const latest=completed.find(r=>Array.isArray(r.reports))||null;
      return {ok:true,state:latest?"available":"incomplete",
        checkedAt:new Date(now()).toISOString(),
        source:"github_actions_private",history,latest,rollback};
    }catch{return {ok:false,state:"unavailable",checkedAt:new Date(now()).toISOString(),
      source:"github_actions_private",history:[],latest:null,rollback:null};}
  }
  return async function read(){
    if(cached&&now()<expiresAt)return cached;
    if(inFlight)return inFlight;
    inFlight=collect().then(result=>{
      cached=result;expiresAt=now()+TTL_MS;return result;
    }).finally(()=>{inFlight=null;});
    return inFlight;
  };
}
