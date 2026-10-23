// PageSpeed Insights homepage audit, fixed target, 24h cache, no arbitrary fetch URLs.
const API="https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const HOME="https://gracz.pl/";
const num=value=>Number.isFinite(value)?Math.round(value*100)/100:null;
export function createSeoSpeedReader({fetcher=fetch,now=Date.now,
  key=process.env.SEO_PAGESPEED_API_KEY,ttlMs=24*60*60*1000}={}) {
  const cache=new Map(),inFlight=new Map();
  async function read(strategy="mobile"){
    if(!["mobile","desktop"].includes(strategy))return {state:"invalid_strategy"};
    const saved=cache.get(strategy);
    if(saved&&now()-saved.at<ttlMs)return saved.data;
    if(inFlight.has(strategy))return inFlight.get(strategy);
    const task=(async()=>{
      const result={state:"unavailable",url:HOME,strategy,checkedAt:new Date(now()).toISOString(),
        score:null,lcpMs:null,cls:null,inpMs:null,source:"Lighthouse lab"};
      try{
        const url=new URL(API);
        url.searchParams.set("url",HOME);
        url.searchParams.set("strategy",strategy);
        url.searchParams.set("category","performance");
        if(typeof key==="string"&&key.length>0)url.searchParams.set("key",key);
        const response=await fetcher(url.href,{redirect:"error",signal:AbortSignal.timeout(25000)});
        if(!response.ok)throw Error("provider_failed");
        const size=Number(response.headers?.get?.("content-length"));
        if(Number.isFinite(size)&&size>800_000)throw Error("large");
        const body=await response.text();
        if(Buffer.byteLength(body)>800_000)throw Error("large");
        const data=JSON.parse(body);
        const lighthouse=data.lighthouseResult;
        if(!lighthouse?.categories?.performance)throw Error("invalid");
        result.score=Number.isFinite(lighthouse.categories.performance.score)
          ?Math.round(lighthouse.categories.performance.score*100):null;
        result.lcpMs=num(lighthouse.audits?.["largest-contentful-paint"]?.numericValue);
        result.cls=num(lighthouse.audits?.["cumulative-layout-shift"]?.numericValue);
        const inp=data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
        result.inpMs=num(inp); // field data; absent means unknown, not zero.
        result.state="available";
      }catch{ /* no guessed measurements, quota and errors remain unavailable */ }
      cache.set(strategy,{at:now(),data:result});
      return result;
    })().finally(()=>inFlight.delete(strategy));
    inFlight.set(strategy,task);
    return task;
  }
  return read;
}
