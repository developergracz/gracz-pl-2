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
  ttlMs=60*60*1000
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
    clicks:Number.isFinite(row?.clicks)&&row.clicks>=0?Math.round(row.clicks):0,
    impressions:Number.isFinite(row?.impressions)&&row.impressions>=0?Math.round(row.impressions):0,
    ctr:Number.isFinite(row?.ctr)&&row.ctr>=0?Math.round(row.ctr*10000)/100:null,
    position:Number.isFinite(row?.position)&&row.position>=0?Math.round(row.position*100)/100:null
  });
  // Search Console dates and incomplete-date metadata use Pacific time, not UTC/Warsaw.
  const pacificToday=()=>{
    const parts=new Intl.DateTimeFormat("en-US",{
      timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date(now()));
    const part=x=>parts.find(y=>y.type===x)?.value;
    return part("year")+"-"+part("month")+"-"+part("day");
  };
  const shiftDay=(date,offset)=>{
    const d=new Date(date+"T12:00:00Z");
    d.setUTCDate(d.getUTCDate()+offset);
    return d.toISOString().slice(0,10);
  };
  const pctChange=(current,previous)=>{
    if(previous===0)return null; // no invented growth percentages from zero.
    return Math.round((current-previous)/previous*10000)/100;
  };
  const validPage=url=>{
    if(typeof url!=="string"||url.length>240)return false;
    try{
      const parsed=new URL(url);
      return parsed.origin==="https://gracz.pl"&&!parsed.username&&!parsed.password&&
        !parsed.search&&!parsed.hash&&parsed.href===url;
    }catch{return false;}
  };
  function compareTotals(current,previous){
    return {previous,clicksPercent:pctChange(current.clicks,previous.clicks),
      impressionsPercent:pctChange(current.impressions,previous.impressions),
      ctrPoints:current.ctr===null||previous.ctr===null?null:
        Math.round((current.ctr-previous.ctr)*100)/100,
      positionChange:current.position===null||previous.position===null?null:
        Math.round((current.position-previous.position)*100)/100};
  }
  function comparePages(current,previous){
    // Search Analytics returns top rows, not an exhaustive page inventory.
    // Compare only URLs actually returned in BOTH periods; never fill missing
    // pages with synthetic zeros or treat them as confirmed traffic losses.
    const prev=new Map(previous.map(r=>[r.url,r]));
    return current.filter(r=>prev.has(r.url)).map(r=>{
      const old=prev.get(r.url);
      const delta=r.impressions-old.impressions;
      return {url:r.url,clicks:r.clicks,impressions:r.impressions,position:r.position,
        previousClicks:old.clicks,previousImpressions:old.impressions,
        clickChange:r.clicks-old.clicks,impressionChange:delta,
        positionChange:r.position===null||old.position===null?null:
          Math.round((r.position-old.position)*100)/100,
        trend:delta>0?"up":delta<0?"down":"flat"};
    }).sort((a,b)=>Math.abs(b.impressionChange)-Math.abs(a.impressionChange)||
      b.impressions-a.impressions).slice(0,15);
  }
  function alerts(current,previous,brandCurrent,brandPrevious,changes){
    const all=[];
    if(previous.clicks>=20&&current.clicks<previous.clicks*.7)
      all.push({id:"clicks_drop",severity:"warning",
        text:"Spadek kliknięć z Google o co najmniej 30% względem poprzednich 28 dni."});
    if(previous.impressions>=100&&current.impressions<previous.impressions*.75)
      all.push({id:"impressions_drop",severity:"warning",
        text:"Spadek wyświetleń w Google o co najmniej 25% względem poprzednich 28 dni."});
    if(brandCurrent.found&&brandPrevious.found&&brandPrevious.impressions>=20&&
      brandCurrent.impressions<brandPrevious.impressions*.7)
      all.push({id:"gracz_drop",severity:"warning",
        text:"Spadek wyświetleń dla dokładnej frazy „gracz” o co najmniej 30%."});
    const weak=changes.filter(p=>p.previousImpressions>=50&&
      p.impressionChange<=-Math.max(20,p.previousImpressions*.3)).slice(0,3);
    for(const p of weak)all.push({id:"page_drop",severity:"notice",
      text:"Znaczny spadek wyświetleń podstrony: "+p.url});
    return all.slice(0,6);
  }
  async function collect(){
    const data={state:"unavailable",property,updatedAt:new Date(now()).toISOString(),
      startDate:null,endDate:null,totals:null,days:[],queries:[],pages:[],
      comparison:null,brand:null,pageChanges:[],alerts:[],
      freshness:{state:"unavailable",days:[],firstIncompleteDate:null,checkedAt:null},
      insights:{state:"unavailable",opportunities:[],devices:[],countries:[],
        trend90:[],dateRange:null,reason:"provider_unavailable"}};
    try{
      const today=pacificToday();
      const endDate=shiftDay(today,-3),startDate=shiftDay(today,-30);
      const previousEndDate=shiftDay(today,-31),previousStartDate=shiftDay(today,-58);
      const url=GSC_API+encodeURIComponent(property)+"/searchAnalytics/query";
      const query=(startDate,endDate,dimensions,rowLimit,extra={})=>googlePost(url,{
        startDate,endDate,dimensions,rowLimit,type:"web",...extra
      });
      const brandFilter={dimensionFilterGroups:[{groupType:"and",filters:[
        {dimension:"query",operator:"equals",expression:"gracz"}]}]};
      // Only finalized data participates in 28-day trends, changes and alerts.
      const [totals,days,queries,pages,previousTotals,previousPages,
        brandCurrent,brandPrevious]=await Promise.all([
        query(startDate,endDate,[],1),
        query(startDate,endDate,["date"],31),
        query(startDate,endDate,["query"],10),
        query(startDate,endDate,["page"],250),
        query(previousStartDate,previousEndDate,[],1),
        query(previousStartDate,previousEndDate,["page"],250),
        query(startDate,endDate,[],1,brandFilter),
        query(previousStartDate,previousEndDate,[],1,brandFilter)
      ]);
      if([totals,days,queries,pages,previousTotals,previousPages,brandCurrent,brandPrevious]
        .some(x=>!Array.isArray(x.rows??[])))throw Error("invalid_provider_data");
      const currentMetrics=metrics(totals.rows?.[0]),oldMetrics=metrics(previousTotals.rows?.[0]);
      const brandMetrics=(reply)=>({found:reply.rows.length>0,...metrics(reply.rows?.[0])});
      const branded=brandMetrics(brandCurrent),previousBranded=brandMetrics(brandPrevious);
      const makePages=rows=>rows.slice(0,250).map(row=>({
        url:safeText(row.keys?.[0],240),...metrics(row)
      })).filter(row=>validPage(row.url));
      const nowPages=makePages(pages.rows),priorPages=makePages(previousPages.rows);
      const pageChanges=comparePages(nowPages,priorPages);
      data.state="connected";data.startDate=startDate;data.endDate=endDate;
      data.totals=currentMetrics;
      data.days=days.rows.slice(0,31).map(row=>({
        date:safeText(row.keys?.[0],10),...metrics(row)
      })).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date||""));
      data.queries=queries.rows.slice(0,10).map(row=>({
        query:safeText(row.keys?.[0],120),...metrics(row)
      }));
      data.pages=nowPages.slice(0,10);
      data.comparison={
        startDate:previousStartDate,endDate:previousEndDate,
        ...compareTotals(currentMetrics,oldMetrics)
      };
      data.brand={query:"gracz",current:branded,previous:previousBranded,
        clicksPercent:pctChange(branded.clicks,previousBranded.clicks),
        impressionsPercent:pctChange(branded.impressions,previousBranded.impressions),
        positionChange:branded.position===null||previousBranded.position===null?null:
          Math.round((branded.position-previousBranded.position)*100)/100};
      data.pageChanges=pageChanges;
      data.alerts=alerts(currentMetrics,oldMetrics,branded,previousBranded,pageChanges);
      // Optional 90-day history and actionable SEO dimensions. Keep the
      // existing 28-day verified report usable if optional requests fail.
      // Query+page results are a truncated/top-row sample, not all searches.
      try{
        const first90=shiftDay(endDate,-89);
        const [series90,devices,countries,queryPages]=await Promise.all([
          query(first90,endDate,["date"],100),
          query(startDate,endDate,["device"],3),
          query(startDate,endDate,["country"],10),
          query(startDate,endDate,["query","page"],250)
        ]);
        if([series90,devices,countries,queryPages].some(x=>!Array.isArray(x.rows??[])))
          throw Error("invalid_google_insights");
        const keepDate=row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date||"")&&
          row.date>=first90&&row.date<=endDate;
        const trend90=series90.rows.slice(0,100).map(row=>({
          date:safeText(row.keys?.[0],10),...metrics(row)
        })).filter(keepDate).sort((x,y)=>x.date.localeCompare(y.date));
        const deviceTypes=new Set(["MOBILE","DESKTOP","TABLET"]);
        const deviceRows=devices.rows.slice(0,3).map(row=>({
          device:safeText(row.keys?.[0],12),...metrics(row)
        })).filter(x=>deviceTypes.has(x.device));
        const countriesRows=countries.rows.slice(0,10).map(row=>({
          country:safeText(row.keys?.[0],3),...metrics(row)
        })).filter(x=>/^[a-z]{3}$/.test(x.country||""));
        const opportunities=queryPages.rows.slice(0,250).map(row=>({
          query:safeText(row.keys?.[0],120),
          url:safeText(row.keys?.[1],240),...metrics(row)
        })).filter(row=>row.query&&validPage(row.url)&&
          row.impressions>=30&&row.position!==null&&
          row.position>=4&&row.position<=15&&
          row.ctr!==null&&row.ctr<5
        ).map(row=>({...row,priority:row.impressions>=100?"high":"medium",
          recommendation:"Zweryfikuj zgodność intencji zapytania z tytułem, opisem i treścią strony."}))
        .sort((x,y)=>y.impressions-x.impressions||x.position-y.position).slice(0,20);
        data.insights={state:"available",opportunities,devices:deviceRows,
          countries:countriesRows,trend90,dateRange:{startDate:first90,endDate},
          reason:null,topRowsLimited:true};
      }catch{
        data.insights={state:"unavailable",opportunities:[],devices:[],countries:[],
          trend90:[],dateRange:null,reason:"provider_unavailable"};
      }
      // Newer data is intentionally separate: never combine provisional daily
      // rows with finalized 28-day comparisons or ranking alerts.
      try{
        const fresh=await query(shiftDay(today,-5),today,["date"],7,{dataState:"all"});
        if(!Array.isArray(fresh.rows??[]))throw Error("invalid_fresh_response");
        const marker=fresh.metadata?.first_incomplete_date||
          fresh.metadata?.firstIncompleteDate||null;
        const firstIncompleteDate=typeof marker==="string"&&
          /^\d{4}-\d{2}-\d{2}$/.test(marker)?marker:null;
        const freshDays=fresh.rows.slice(0,7).map(row=>({
          date:safeText(row.keys?.[0],10),...metrics(row)
        })).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date||"")&&row.date<=today);
        data.freshness={state:"available",checkedAt:new Date(now()).toISOString(),
          timezone:"America/Los_Angeles",firstIncompleteDate,
          days:freshDays.map(x=>({...x,provisional:firstIncompleteDate?
            x.date>=firstIncompleteDate:true}))};
      }catch{
        data.freshness={state:"unavailable",days:[],
          firstIncompleteDate:null,checkedAt:new Date(now()).toISOString()};
      }
    }catch{ /* no secrets or provider internals in OWNER output */ }
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
