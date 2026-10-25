// Render static-site deploy + rollback gate. No action without explicit token and opt-in.
const SERVICE_ID="srv-da9m8rhsrm7s73co2780";
const REPO="https://github.com/developergracz/gracz-pl-2";
const API="https://api.render.com/v1/services/"+SERVICE_ID;
const LIVE="https://gracz.pl";
const PAGES=["/","/gry-karciane/","/o-gracz-pl/"];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function trustedService(s) {
  return Boolean(s&&s.id===SERVICE_ID&&s.name==="gracz-pl-maintenance"&&
    s.type==="static_site"&&s.autoDeploy==="no"&&s.branch==="main"&&
    s.rootDir==="maintenance-site"&&s.repo===REPO);
}
export function validatePublicPage(pathname,html) {
  if(typeof html!=="string"||html.length<500)return false;
  const canonical=LIVE+pathname;
  return html.includes('<link rel="canonical" href="'+canonical+'">')&&
    !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html) &&
    /<h1\b/i.test(html);
}
export async function checkPages({fetcher=fetch,origin=LIVE}={}) {
  for(const pathname of PAGES) {
    try {
      const url=origin+pathname;
      const response=await fetcher(url,{signal:AbortSignal.timeout(15000),
        headers:{"cache-control":"no-cache"}});
      if(!response.ok||response.url!==url||!validatePublicPage(pathname,await response.text()))
        return {ok:false,pathname};
    }catch{return {ok:false,pathname};}
  }
  return {ok:true};
}
export async function publish({commitId,key,fetcher=fetch,sleeper=sleep,maxPolls=48}={}) {
  if(!/^[a-f0-9]{40}$/.test(commitId||"")||!key)return {state:"disabled"};
  const call=async(endpoint,method="GET",body)=>{
    const response=await fetcher(API+endpoint,{method,
      headers:{"authorization":"Bearer "+key,"accept":"application/json",
        ...(body?{"content-type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw Error("render_http_"+response.status);
    return response.json();
  };
  let target=null,previous=null,rollback=null;
  try{
    const service=await call("");
    if(!trustedService(service))return {state:"blocked",reason:"unexpected_service_configuration"};
    const rows=await call("/deploys?limit=5");
    if(!Array.isArray(rows))return {state:"blocked",reason:"invalid_deploy_history"};
    const deploys=rows.map(row=>row.deploy||row);
    if(deploys.some(d=>d.status!=="live"&&d.status!=="deactivated"&&
      d.status!=="build_failed"&&d.status!=="update_failed"&&d.status!=="canceled"))
      return {state:"blocked",reason:"concurrent_render_deploy"};
    previous=deploys.find(d=>d.status==="live");
    if(!previous?.id||!/^[a-f0-9]{40}$/.test(previous.commit?.id||""))
      return {state:"blocked",reason:"no_verified_rollback_target"};
    if(previous.commit.id===commitId)return {state:"already_live",commitId};
    const before=await checkPages({fetcher});
    if(!before.ok)return {state:"blocked",reason:"baseline_not_healthy",pathname:before.pathname};
    const started=await call("/deploys","POST",{commitId});
    target=started.deploy||started;
    if(!target?.id)throw Error("deploy_id_missing");
    let status="unknown";
    for(let i=0;i<maxPolls;i++){
      const data=await call("/deploys/"+encodeURIComponent(target.id));
      status=data.status;
      if(status==="live"){
        if(data.commit?.id!==commitId)throw Error("wrong_deployed_commit");
        const after=await checkPages({fetcher});
        if(after.ok)return {state:"live_verified",commitId,deployId:target.id};
        break; // Roll back a deployed version only if public smoke checks fail.
      }
      if(["build_failed","update_failed","canceled","pre_deploy_failed"].includes(status))
        return {state:"failed",reason:status,deployId:target.id};
      await sleeper(5000);
    }
    rollback=await call("/rollback","POST",{deployId:previous.id});
    return {state:"rollback_triggered",commitId,failedDeploy:target.id,
      rollbackDeployId:(rollback.deploy||rollback)?.id||null,previousCommit:previous.commit.id};
  }catch(error){
    // Never roll back in ambiguous state unless the newly created deploy was
    // confirmed live and failed the checks above. Otherwise leave service untouched.
    return {state:"unverified",reason:String(error.message||error).slice(0,100),
      deployId:target?.id||null};
  }
}
if(process.argv[1]&&process.argv[1].endsWith("/performance-render-deploy.mjs")){
  const authorized=process.env.PERF_AUTOPILOT_AUTO_PUBLISH==="enabled";
  const commitId=process.env.PERF_AUTOPILOT_COMMIT_SHA||"";
  const key=process.env.RENDER_AUTOPILOT_API_KEY||"";
  if(!authorized||!key){
    process.stdout.write('{"state":"disabled","reason":"missing_opt_in_or_secret"}\n');
    process.exit(0);
  }
  const result=await publish({commitId,key});
  process.stdout.write(JSON.stringify(result)+"\n");
  if(!["live_verified","already_live"].includes(result.state))process.exitCode=1;
}
