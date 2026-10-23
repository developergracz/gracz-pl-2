// Google Search Console read-only adapter. No browser credentials or writable Google scopes.
import {sign} from "node:crypto";
const SCOPE="https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const GSC_API="https://www.googleapis.com/webmasters/v3/sites/";
const INSPECT_API="https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const day=ms=>new Date(ms).toISOString().slice(0,10);
const safeText=(value,length=180)=>typeof value==="string"?value.slice(0,length):null;

function validProperty(site){
  return site==="sc-domain:gracz.pl" || site==="https://gracz.pl/";
}
function validIdentity(email,key,site) {
  return typeof email==="string" && /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(email) &&
    typeof key==="string" && key.includes("-----BEGIN PRIVATE KEY-----") &&
    key.includes("-----END PRIVATE KEY-----") && validProperty(site);
}
async function postJson(fetcher,url,options,limit=200_000) {
  const response=await fetcher(url,{...options,redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("provider_unavailable");
  const size=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(size)&&size>limit)throw Error("provider_large_response");
  const body=await response.text();
  if(Buffer.byteLength(body,"utf8")>limit)throw Error("provider_large_response");
  return JSON.parse(body);
}
export function createSeoGoogleReader({
  fetcher=fetch,now=Date.now,
  email=process.env.SEO_GSC_CLIENT_EMAIL,
  privateKey=process.env.SEO_GSC_PRIVATE_KEY,
  property=process.env.SEO_GSC_PROPERTY,
  ttlMs=6*60*60*1000
}={}) {
  const key=typeof privateKey==="string"?privateKey.replace(/\\n/g,"\n"):null;
  const enabled=validIdentity(email,key,property);
  let token=null,tokenExpires=0,tokenBusy=null,report=null,reportAt=0,reportBusy=null;
  const inspections=new Map();
  async function accessToken(){
    if(token&&now()<tokenExpires-60_000)return token;
    if(tokenBusy)return tokenBusy;
    tokenBusy=(async()=>{
      const time=Math.floor(now()/1000);
      const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
      const payload=encode({iss:email,scope:SCOPE,aud:TOKEN_URL,iat:time,exp:time+3600});
      const head=encode({alg:"RS256",typ:"JWT"});
      const unsigned=head+"."+payload;
      const signature=sign("RSA-SHA256",Buffer.from(unsigned),key).toString("base64url");
      const form=new URLSearchParams({
        grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:unsigned+"."+signature
      });
      const data=await postJson(fetcher,TOKEN_URL,{
        method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:form.toString()
      },12_000);
      if(typeof data.access_token!=="string" || data.access_token.length<16 ||
         !Number.isFinite(Number(data.expires_in)))throw Error("token_unavailable");
      token=data.access_token;
      tokenExpires=now()+Math.min(3600,Number(data.expires_in))*1000;
      return token;
    })().finally(()=>{tokenBusy=null;});
    return tokenBusy;
  }
  async function googlePost(url,body){
    const bearer=await accessToken();
    return postJson(fetcher,url,{
      method:"POST",
      headers:{"Authorization":"Bearer "+bearer,"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
  }
  const metrics=row=>({
    clicks:Number.isFinite(row?.clicks)?row.clicks:0,
    impressions:Number.isFinite(row?.impressions)?row.impressions:0,
    ctr:Number.isFinite(row?.ctr)?Math.round(row.ctr*10000)/100:null,
    position:Number.isFinite(row?.position)?Math.round(row.position*100)/100:null
  });
  async function collect(){
    const data={state:"unavailable",property,updatedAt:new Date(now()).toISOString(),
      startDate:null,endDate:null,totals:null,days:[],queries:[],pages:[]};
    try{
      const endDate=day(now()-3*86400000),startDate=day(now()-30*86400000);
      const url=GSC_API+encodeURIComponent(property)+"/searchAnalytics/query";
      const query=(dimensions,rowLimit)=>googlePost(url,{
        startDate,endDate,dimensions,rowLimit,type:"web"
      });
      const [totals,days,queries,pages]=await Promise.all([
        query([],1),query(["date"],31),query(["query"],10),query(["page"],10)
      ]);
      if(!Array.isArray(totals.rows??[])||!Array.isArray(days.rows??[])||
         !Array.isArray(queries.rows??[])||!Array.isArray(pages.rows??[]))
        throw Error("invalid_provider_data");
      data.state="connected";data.startDate=startDate;data.endDate=endDate;
      data.totals=totals.rows?.length?metrics(totals.rows[0]):metrics(null);
      data.days=days.rows.slice(0,31).map(row=>({date:safeText(row.keys?.[0],10),...metrics(row)}));
      data.queries=queries.rows.slice(0,10).map(row=>({query:safeText(row.keys?.[0],120),...metrics(row)}));
      data.pages=pages.rows.slice(0,10).map(row=>({url:safeText(row.keys?.[0],240),...metrics(row)}));
    }catch{ /* no secrets or Google error details in OWNER response */ }
    return data;
  }
  async function read(){
    if(!enabled)return {state:"needs_configuration",property:null,
      required:["SEO_GSC_CLIENT_EMAIL","SEO_GSC_PRIVATE_KEY","SEO_GSC_PROPERTY"]};
    if(report&&now()-reportAt<ttlMs)return report;
    if(reportBusy)return reportBusy;
    reportBusy=collect().then(value=>{report=value;reportAt=now();return value;})
      .finally(()=>{reportBusy=null;});
    return reportBusy;
  }
  async function inspect(url){
    if(!enabled)return {state:"needs_configuration"};
    if(typeof url!=="string"||url.length>240)
      return {state:"invalid_url"};
    try {
      const parsed=new URL(url);
      if(parsed.origin!=="https://gracz.pl" || parsed.href!==url ||
         parsed.search || parsed.hash || parsed.username || parsed.password)
        return {state:"invalid_url"};
    } catch {return {state:"invalid_url"};}
    const saved=inspections.get(url);
    if(saved&&now()-saved.at<12*60*60*1000)return saved.result;
    // A single explicit inspection per window; no crawler-wide bulk requests.
    if(inspections.size>=50)inspections.clear();
    let result={state:"unavailable",url};
    try {
      const data=await googlePost(INSPECT_API,{inspectionUrl:url,siteUrl:property,languageCode:"pl-PL"});
      const info=data?.inspectionResult?.indexStatusResult;
      if(!info||typeof info!=="object")throw Error("invalid_inspection");
      result={state:"connected",url,
        verdict:safeText(info.verdict,24),
        coverageState:safeText(info.coverageState,180),
        indexingState:safeText(info.indexingState,60),
        robotsTxtState:safeText(info.robotsTxtState,60),
        lastCrawlTime:safeText(info.lastCrawlTime,60),
        googleCanonical:safeText(info.googleCanonical,240)};
    } catch { /* fail closed; no false "indexed" claims */ }
    inspections.set(url,{at:now(),result});
    return result;
  }
  return {read,inspect};
}
