import test from "node:test";
import assert from "node:assert/strict";
import {STAGE,trustedStage,rehearse} from "./performance-rollback-stage.mjs";

const SERVICE={id:STAGE.id,name:STAGE.name,repo:STAGE.repo,branch:STAGE.branch,
 type:"static_site",autoDeploy:"yes",autoDeployTrigger:"commit",rootDir:"",
 serviceDetails:{url:STAGE.origin,publishPath:"performance/staging"}};
const response=(status,payload)=>({ok:status<400,status,json:async()=>payload});
function fake({wrongService=false,badStageMarker=false,lostReply=false,staleStageReads=0}={}) {
  let version="A",posts=0,remainingStale=staleStageReads;
  const calls=[];
  async function fetcher(url,opts={}) {
    const method=opts.method||"GET";calls.push({url,method});
    if(url.startsWith(STAGE.origin+"/?perf_rollback_probe=")) {
      assert.equal(new URL(url).origin,STAGE.origin);
      assert.equal(new URL(url).pathname,"/");
      assert.equal(opts.headers["cache-control"],"no-store, no-cache");
      const stale=version==="B"&&remainingStale-->0;
      const marker=version==="B"&&badStageMarker?'data-release="C"':
        stale?'data-release="A"':`data-release="${version}"`;
      return {...response(200,{}),url,text:async()=>"<h1>Staging</h1><p "+marker+">ok</p>"};
    }
    const root="https://api.render.com/v1/services/"+STAGE.id;
    if(url===root)return response(200,wrongService?{...SERVICE,name:"gracz-pl-maintenance"}:SERVICE);
    if(url===root+"/deploys?limit=10")return response(200,[
      {deploy:{id:STAGE.stable.deployId,commit:{id:STAGE.stable.commit},status:"live"}},
      {deploy:{id:STAGE.faulty.deployId,commit:{id:STAGE.faulty.commit},status:"deactivated"}}
    ]);
    if(url===root+"/rollback"&&method==="POST"){
      posts++;
      const target=JSON.parse(opts.body).deployId;
      assert.ok([STAGE.stable.deployId,STAGE.faulty.deployId].includes(target));
      version=target===STAGE.stable.deployId?"A":"B";
      if(lostReply&&posts===1)throw Error("lost_provider_response");
      return response(201,{id:"dep-test"+posts});
    }
    if(url.startsWith(root+"/deploys/")){
      return response(200,{id:url.split("/").at(-1),status:"live",
        commit:{id:version==="A"?STAGE.stable.commit:STAGE.faulty.commit}});
    }
    throw Error("unexpected_url "+url);
  }
  return {fetcher,calls,get posts(){return posts},get version(){return version}};
}
test("service identity is hardcoded to isolated noindex staging service",()=>{
  assert.equal(trustedStage(SERVICE),true);
  assert.equal(trustedStage({...SERVICE,autoDeploy:"no",autoDeployTrigger:"off"}),true);
  assert.equal(trustedStage({...SERVICE,autoDeploy:"no"}),false); // mismatch with commit
  assert.equal(trustedStage({...SERVICE,autoDeploy:"no",autoDeployTrigger:"commit"}),false);
  assert.equal(trustedStage({...SERVICE,rootDir:"maintenance-site"}),false);
  assert.equal(trustedStage({...SERVICE,serviceDetails:{...SERVICE.serviceDetails,publishPath:"."}}),false);
  assert.equal(trustedStage({...SERVICE,name:"gracz-pl-maintenance"}),false);
  assert.equal(trustedStage({...SERVICE,branch:"main"}),false);
  assert.equal(trustedStage({...SERVICE,id:"srv-da9m8rhsrm7s73co2780"}),false);
});
test("missing key and unexpected Render identity never mutate",async()=>{
  assert.equal((await rehearse({key:""})).state,"disabled");
  const m=fake({wrongService:true});
  const result=await rehearse({key:"dummy",fetcher:m.fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"blocked");
  assert.equal(m.posts,0);
});
test("real API contract uses two rollbacks, first B then stable A",async()=>{
  const m=fake();
  const result=await rehearse({key:"dummy",fetcher:m.fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"rollback_verified");
  assert.equal(m.posts,2);
  assert.equal(m.version,"A");
  assert.ok(m.calls.every(x=>x.url.startsWith(STAGE.origin)||x.url.startsWith("https://api.render.com/v1/services/"+STAGE.id)));
});
test("bad staging artifact forces recovery to known good A",async()=>{
  const m=fake({badStageMarker:true});
  const result=await rehearse({key:"dummy",fetcher:m.fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"recovered_after_test_failure");
  assert.equal(m.posts,2);
  assert.equal(m.version,"A");
});
test("lost response after B activation also triggers safe recovery",async()=>{
  const m=fake({lostReply:true});
  const result=await rehearse({key:"dummy",fetcher:m.fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"recovered_after_test_failure");
  assert.equal(m.posts,2);
  assert.equal(m.version,"A");
});

test("rollback marker retries stale CDN pages using unique cache-busting probes",async()=>{
  const m=fake({staleStageReads:6});
  const result=await rehearse({key:"dummy",fetcher:m.fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"rollback_verified");
  assert.equal(result.site,STAGE.name);
  assert.equal(m.posts,2);
  assert.equal(m.version,"A");
  const probes=m.calls.filter(x=>x.url.startsWith(STAGE.origin+"/?perf_rollback_probe="));
  assert.ok(probes.length>=9);
  assert.equal(new Set(probes.map(x=>x.url)).size,probes.length);
});

test("safe API rollback rehearsal accepts autodeploy disabled on verified staging",async()=>{
  const m=fake();
  const fetcher=async(url,opts)=>{
    if(url==="https://api.render.com/v1/services/"+STAGE.id)
      return response(200,{...SERVICE,autoDeploy:"no",autoDeployTrigger:"off"});
    return m.fetcher(url,opts);
  };
  const result=await rehearse({key:"dummy",fetcher,sleeper:async()=>{}});
  assert.equal(result.state,"rollback_verified");
  assert.equal(m.posts,2);
  assert.equal(m.version,"A");
});
