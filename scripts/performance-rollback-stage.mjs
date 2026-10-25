// Isolated LIVE Render API rollback rehearsal. This script is NEVER run on production.
// It may only mutate the dedicated gracz-performance-rollback-stage static site.
import {fileURLToPath} from "node:url";
import path from "node:path";

export const STAGE = Object.freeze({
  id:"srv-dbf3hp0473hc73bnjk9g",
  name:"gracz-performance-rollback-stage",
  repo:"https://github.com/developergracz/gracz-pl-2",
  branch:"test/perf-rollback-stage-20261025",
  origin:"https://gracz-performance-rollback-stage.onrender.com",
  stable:{deployId:"dep-dbf3i85g1s2s739tviqg",commit:"c2424c4980827245fde30a7e5e9a52ca786463be",marker:'data-release="A"'},
  faulty:{deployId:"dep-dbf3i1ijnfac73ebbcmg",commit:"28ec226cbbdd154cf24a1eb991df878ab59c854f",marker:'data-release="B"'}
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const api="https://api.render.com/v1/services/"+STAGE.id;

export function trustedStage(service) {
  // Render staging may run with autodeploy disabled. Keep it off when present;
  // never change deployment settings or permit a different service.
  const autoDeployOff = service?.autoDeploy==="no" &&
    (service?.autoDeployTrigger===undefined || service.autoDeployTrigger==="off");
  const autoDeployOn = service?.autoDeploy==="yes" &&
    (service?.autoDeployTrigger===undefined || service.autoDeployTrigger==="commit");
  return Boolean(service?.id===STAGE.id&&service?.name===STAGE.name&&
    service?.repo===STAGE.repo&&service?.branch===STAGE.branch&&
    service?.type==="static_site"&&(autoDeployOff||autoDeployOn)&&
    service?.rootDir===""&&
    service?.serviceDetails?.publishPath==="performance/staging"&&
    service?.serviceDetails?.url===STAGE.origin);
}
export async function rehearse({key,fetcher=fetch,sleeper=sleep,polls=40}={}) {
  if(typeof key!=="string"||!key)return {state:"disabled",reason:"missing_render_key"};
  let mutated=false;
  const json=async(endpoint,method="GET",body)=>{
    const response=await fetcher(api+endpoint,{method,
      headers:{authorization:"Bearer "+key,accept:"application/json",
        ...(body?{"content-type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw Error("render_http_"+response.status);
    return response.json();
  };
  // Render may report LIVE before its static CDN has propagated the release.
  // Each bounded probe uses a unique query string to avoid stale edge-cache hits.
  let probePhase=0;
  const marker=async(release)=>{
    const phase=probePhase++;
    for(let i=0;i<30;i++) {
      const url=STAGE.origin+"/?perf_rollback_probe="+
        encodeURIComponent(release.marker)+
        "&phase="+phase+"&attempt="+i;
      try {
        const r=await fetcher(url,{redirect:"error",signal:AbortSignal.timeout(15000),
          headers:{"cache-control":"no-store, no-cache","pragma":"no-cache"}});
        if(r.ok&&r.url===url&&(await r.text()).includes(release.marker))return true;
      }catch{ /* transient propagation failure: retry only the fixed staging origin */ }
      if(i<29)await sleeper(3000);
    }
    return false;
  };
  const rollback=async(deployId)=>{
    const r=await json("/rollback","POST",{deployId});
    if(!/^dep-[a-z0-9]+$/.test(r?.id||""))throw Error("rollback_deploy_id_missing");
    return r.id;
  };
  const awaitLive=async(id,expectedCommit)=>{
    for(let i=0;i<polls;i++){
      const d=await json("/deploys/"+encodeURIComponent(id));
      if(d.status==="live"&&d.commit?.id===expectedCommit)return true;
      if(["build_failed","update_failed","canceled","pre_deploy_failed","deactivated"].includes(d.status))
        throw Error("rollback_failed_"+d.status);
      await sleeper(5000);
    }
    throw Error("rollback_status_unverified");
  };
  try {
    const service=await json("");
    if(!trustedStage(service))return {state:"blocked",reason:"staging_identity_mismatch"};
    const rows=await json("/deploys?limit=10");
    if(!Array.isArray(rows))return {state:"blocked",reason:"invalid_deploy_history"};
    const ds=rows.map(row=>row.deploy||row);
    if(ds.some(d=>!["live","deactivated","build_failed","update_failed","canceled"].includes(d.status)))
      return {state:"blocked",reason:"concurrent_deploy"};
    const live=ds.find(d=>d.status==="live");
    if(live?.commit?.id!==STAGE.stable.commit||!(await marker(STAGE.stable)))
      return {state:"blocked",reason:"stable_baseline_not_live"};
    for(const release of [STAGE.faulty,STAGE.stable]){
      if(!ds.some(d=>d.id===release.deployId&&d.commit?.id===release.commit))
        return {state:"blocked",reason:"known_deploy_artifact_not_available"};
    }
    // Deliberate controlled regression on this isolated noindex staging site only.
    mutated=true;
    const faultyId=await rollback(STAGE.faulty.deployId);
    await awaitLive(faultyId,STAGE.faulty.commit);
    if(!(await marker(STAGE.faulty)))throw Error("faulty_stage_marker_unverified");
    const recoveredId=await rollback(STAGE.stable.deployId);
    await awaitLive(recoveredId,STAGE.stable.commit);
    if(!(await marker(STAGE.stable)))throw Error("stable_stage_marker_unverified");
    return {state:"rollback_verified",faultyId,recoveredId,site:STAGE.name};
  }catch(e){
    const reason=String(e?.message||"unknown").slice(0,100);
    // The first rollback could have been accepted despite a lost HTTP reply.
    // Always attempt recovery to the stable artifact following ANY mutation attempt.
    if(mutated) {
      try {
        const restoredId=await rollback(STAGE.stable.deployId);
        await awaitLive(restoredId,STAGE.stable.commit);
        const healthy=await marker(STAGE.stable);
        return {state:healthy?"recovered_after_test_failure":"recovery_unverified",
          reason,restoredId};
      }catch(e2){return {state:"recovery_unverified",reason,
        recoveryReason:String(e2?.message||"unknown").slice(0,100)};}
    }
    return {state:"blocked",reason};
  }
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) {
  const result=await rehearse({key:process.env.RENDER_AUTOPILOT_API_KEY||""});
  process.stdout.write(JSON.stringify(result)+"\n");
  if(result.state!=="rollback_verified")process.exitCode=1;
}
