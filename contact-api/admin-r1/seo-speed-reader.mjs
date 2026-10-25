// PageSpeed Insights audit of the fixed public homepage; never accept user-supplied URLs.
const API="https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const HOME="https://gracz.pl/";
const MAX_REPORT_BYTES=12_000_000; // Lighthouse JSON routinely exceeds 800 KB.
const num=value=>Number.isFinite(value)?Math.round(value*100)/100:null;

async function boundedText(response) {
  const size=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(size)&&size>MAX_REPORT_BYTES)throw Error("response_too_large");
  if(!response.body?.getReader){
    const text=await response.text();
    if(Buffer.byteLength(text)>MAX_REPORT_BYTES)throw Error("response_too_large");
    return text;
  }
  const chunks=[];
  let total=0;
  const reader=response.body.getReader();
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_REPORT_BYTES)throw Error("response_too_large");
      chunks.push(value);
    }
  }catch(error){
    await reader.cancel().catch(()=>{});
    throw error;
  }finally{reader.releaseLock();}
  return Buffer.concat(chunks,total).toString("utf8");
}
const statusReason=status=>{
  if(status===429)return "rate_limited";
  if(status===401||status===403)return "access_denied";
  if(status===400)return "invalid_request";
  if(status>=500)return "provider_unavailable";
  return "provider_failed";
};
export function createSeoSpeedReader({fetcher=fetch,now=Date.now,
  key=process.env.SEO_PAGESPEED_API_KEY,ttlMs=24*60*60*1000}={}) {
  const cache=new Map(),inFlight=new Map(),lastAttempts=new Map();
  const MIN_REFRESH_INTERVAL_MS=60_000; // Avoid exhausting the Google API quota.
  async function read(strategy="mobile",{refresh=false}={}){
    if(!["mobile","desktop"].includes(strategy))return {state:"invalid_strategy"};
    if(inFlight.has(strategy))return inFlight.get(strategy);
    const saved=cache.get(strategy);
    if(!refresh&&saved&&now()-saved.at<ttlMs)return saved.data;
    const last=lastAttempts.get(strategy);
    if(refresh&&last!==undefined&&now()-last<MIN_REFRESH_INTERVAL_MS){
      return {state:"rate_guard",strategy,
        retryAfterSeconds:Math.ceil((MIN_REFRESH_INTERVAL_MS-(now()-last))/1000)};
    }
    lastAttempts.set(strategy,now());
    const task=(async()=>{
      const result={state:"unavailable",reason:"provider_failed",
        url:HOME,strategy,checkedAt:new Date(now()).toISOString(),
        score:null,lcpMs:null,cls:null,inpMs:null,source:"Lighthouse lab"};
      try{
        const url=new URL(API);
        url.searchParams.set("url",HOME);
        url.searchParams.set("strategy",strategy);
        url.searchParams.set("category","performance");
        if(typeof key==="string"&&key.trim())url.searchParams.set("key",key.trim());
        const response=await fetcher(url.href,{redirect:"error",signal:AbortSignal.timeout(80_000)});
        if(!response.ok){
          result.reason=statusReason(response.status);
          return result;
        }
        const body=await boundedText(response);
        let data;
        try{data=JSON.parse(body);}
        catch{result.reason="invalid_response";return result;}
        const lighthouse=data.lighthouseResult;
        const score=lighthouse?.categories?.performance?.score;
        if(!Number.isFinite(score)||score<0||score>1){
          result.reason="invalid_response";
          return result;
        }
        result.score=Math.round(score*100);
        result.lcpMs=num(lighthouse.audits?.["largest-contentful-paint"]?.numericValue);
        result.cls=num(lighthouse.audits?.["cumulative-layout-shift"]?.numericValue);
        const inp=data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
        result.inpMs=num(inp); // Field data; missing means unknown, not zero.
        result.state="available";
        delete result.reason;
        cache.set(strategy,{at:now(),data:result}); // Only successful measurements cached for 24 h.
      }catch(error){
        result.reason=error?.message==="response_too_large"?"response_too_large":
          error?.name==="TimeoutError"||error?.name==="AbortError"?"timeout":
          "network_error";
      }
      return result;
    })().finally(()=>inFlight.delete(strategy));
    inFlight.set(strategy,task);
    return task;
  }
  return read;
}
