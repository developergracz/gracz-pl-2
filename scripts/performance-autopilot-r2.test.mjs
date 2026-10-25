import test from "node:test";
import assert from "node:assert/strict";
import {advise} from "./performance-ai-advisor.mjs";
import {trustedService,validatePublicPage,publish} from "./performance-render-deploy.mjs";

const oldsha="a".repeat(40),newsha="b".repeat(40);
const config={id:"srv-da9m8rhsrm7s73co2780",name:"gracz-pl-maintenance",type:"static_site",
  autoDeploy:"no",branch:"main",rootDir:"maintenance-site",repo:"https://github.com/developergracz/gracz-pl-2"};
function createFetcher({badPage=false,badService=false}={}){
  const calls=[];let deployed=false;
  const request=async (url,options={})=>{
    const method=options.method||"GET";calls.push({url,method});
    const data=(status,obj)=>({ok:status>=200&&status<300,status,json:async()=>obj});
    if(url==="https://api.render.com/v1/services/srv-da9m8rhsrm7s73co2780")
      return data(200,badService?{...config,autoDeploy:"yes"}:config);
    if(url.includes("/deploys?limit=5"))
      return data(200,[{deploy:{id:"dep-old",status:"live",commit:{id:oldsha}}}]);
    if(url.endsWith("/deploys")&&method==="POST"){deployed=true;return data(201,{id:"dep-new"});}
    if(url.endsWith("/deploys/dep-new"))
      return data(200,{id:"dep-new",status:"live",commit:{id:newsha}});
    if(url.endsWith("/rollback")&&method==="POST"){deployed=false;return data(201,{id:"dep-rollback"});}
    if(url.endsWith("/deploys/dep-rollback"))return data(200,{id:"dep-rollback",status:"live",commit:{id:oldsha}});
    if(url.startsWith("https://gracz.pl/")){
      const pathname=new URL(url).pathname;
      const valid='<link rel="canonical" href="https://gracz.pl'+pathname+'"><h1>GRACZ.PL</h1>'+"z".repeat(700);
      const content=badPage&&deployed&&pathname==="/o-gracz-pl/"?"unhealthy":valid;
      return {...data(200,{}),url,text:async()=>content};
    }
    throw Error("unexpected_mock_request: "+url);
  };
  return {request,calls};
}
test("Render gate permits only the preapproved static-site service",()=>{
  assert.equal(trustedService(config),true);
  assert.equal(trustedService({...config,autoDeploy:"yes"}),false);
  assert.equal(trustedService({...config,name:"gracz-contact-api"}),false);
  assert.equal(trustedService({...config,rootDir:"contact-api"}),false);
  assert.equal(validatePublicPage("/",'<link rel="canonical" href="https://gracz.pl/"><h1>title</h1>'+"x".repeat(700)),true);
  assert.equal(validatePublicPage("/","<meta name='robots' content='noindex'>"),false);
});
test("Render deploy refuses missing secret or untrusted service, zero mutations",async()=>{
  const f=createFetcher({badService:true});
  assert.equal((await publish({commitId:newsha,key:""})).state,"disabled");
  const out=await publish({commitId:newsha,key:"dummy",fetcher:f.request});
  assert.equal(out.state,"blocked");
  assert.equal(f.calls.some(x=>x.method==="POST"),false);
});
test("Render deploy pins commit and checks public HTML before accepting live",async()=>{
  const f=createFetcher();
  const result=await publish({commitId:newsha,key:"dummy",fetcher:f.request,sleeper:async()=>{}});
  assert.equal(result.state,"live_verified");
  assert.equal(f.calls.filter(x=>x.method==="POST").length,1);
  assert.equal(f.calls.some(x=>x.url.endsWith("/rollback")),false);
});
test("Render deploy explicitly triggers rollback if newly-live public page fails",async()=>{
  const f=createFetcher({badPage:true});
  const result=await publish({commitId:newsha,key:"dummy",fetcher:f.request,sleeper:async()=>{}});
  assert.equal(result.state,"rollback_verified");
  assert.equal(result.previousCommit,oldsha);
  assert.equal(f.calls.some(x=>x.url.endsWith("/rollback")&&x.method==="POST"),true);
});
test("AI only receives metrics for a verified slowdown and never emits deploy instructions",async()=>{
 const good={url:"https://gracz.pl/",strategy:"mobile",state:"available",lcpMs:700,score:99};
 const bad={...good,lcpMs:3200,score:80};
 const idle=await advise({reports:[good],key:"dummy",fetcher:async()=>{throw Error("should not call");}});
 assert.equal(idle.state,"no_verified_regression");
 const disabled=await advise({reports:[bad],key:""});
 assert.equal(disabled.state,"disabled");
 let modelCalls=0;
 const diagnosis=await advise({reports:[bad],key:"dummy",fetcher:async (url,opts)=>{
   modelCalls++;
   assert.equal(url,"https://api.openai.com/v1/responses");
   assert.match(opts.body,/Lighthouse lab/);
   return {ok:true,json:async()=>({output:[{content:[{type:"output_text",text:"Sprawdź obraz LCP."}]}]})};
 }});
 assert.equal(modelCalls,1);
 assert.equal(diagnosis.state,"advisory_only");
 assert.match(diagnosis.recommendation,/Sprawdź obraz/);
 assert.equal(diagnosis.execute,undefined);
});
