// Private, read-only SEO status probe. No user-controlled URLs, credentials or writes.
const ORIGIN = "https://gracz.pl";
const MAX_PAGES = 50;
const MAX_BODY = 512 * 1024;

function links(html, rel) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0])
    .filter(tag=>new RegExp("\\brel\\s*=\\s*([\"'])" + rel + "\\1","i").test(tag))
    .map(tag=>tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "");
}
function directives(html, name) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0])
    .filter(tag=>new RegExp("\\bname\\s*=\\s*([\"'])" + name + "\\1","i").test(tag))
    .map(tag=>tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2]?.toLowerCase() ?? "");
}
function isNoindex(value) {
  return /(?:^|,)\s*noindex\s*(?:,|$)/i.test(value);
}
function validUrl(url) {
  try {
    const x=new URL(url);
    return x.origin===ORIGIN && x.href===url && !x.search && !x.hash &&
      !x.username && !x.password && x.pathname.startsWith("/");
  } catch {return false;}
}
async function fetchText(fetcher,url) {
  const response=await fetcher(url,{
    redirect:"manual",
    signal:AbortSignal.timeout(8000),
    headers:{"User-Agent":"gracz-seo-owner-r2/1.0"}
  });
  if(response.status!==200 || (response.url && response.url!==url))
    throw Error("HTTP_OR_REDIRECT");
  const length=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(length) && length>MAX_BODY)throw Error("BODY_TOO_LARGE");
  if(!response.body || typeof response.body.getReader!=="function") {
    const text=await response.text();
    if(Buffer.byteLength(text)>MAX_BODY)throw Error("BODY_TOO_LARGE");
    return text;
  }
  const reader=response.body.getReader();
  const chunks=[];let total=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY)throw Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))).toString("utf8");
}

export function createSeoLiveReader({fetcher=fetch,now=Date.now,ttlMs=15*60_000}={}) {
  let cached=null,at=0,inFlight=null;
  async function measure() {
    const result={checkedAt:new Date(now()).toISOString(),scope:"public_live",
      ok:false,total:0,passing:0,issues:[],pages:[]};
    function issue(url,code){result.issues.push({url,code});}
    let robots,sitemap;
    try {
      [robots,sitemap]=await Promise.all([
        fetchText(fetcher,ORIGIN+"/robots.txt"),
        fetchText(fetcher,ORIGIN+"/sitemap.xml")
      ]);
    } catch {
      issue(ORIGIN,"robots_or_sitemap_unavailable");
      return result;
    }
    if(!/^\s*Sitemap:\s*https:\/\/gracz\.pl\/sitemap\.xml\s*$/im.test(robots) ||
       /^\s*Disallow:\s*\/\s*$/im.test(robots))issue(ORIGIN+"/robots.txt","robots_invalid");
    if(!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(sitemap))
      issue(ORIGIN+"/sitemap.xml","sitemap_invalid");
    const blocks=[...sitemap.matchAll(/<url>\s*([\s\S]*?)<\/url>/gi)];
    const rawLocs=[...sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)];
    if(!blocks.length || blocks.length>MAX_PAGES || rawLocs.length!==blocks.length){
      issue(ORIGIN+"/sitemap.xml","sitemap_invalid");
      return result;
    }
    const seen=new Set(),urls=[];
    for(const block of blocks) {
      const matches=[...block[1].matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)];
      const url=matches.length===1?matches[0][1].trim():"";
      if(!validUrl(url)||seen.has(url)){
        issue(ORIGIN+"/sitemap.xml","sitemap_invalid");
        continue;
      }
      seen.add(url);urls.push(url);
    }
    result.total=urls.length;
    // Maximum four parallel requests; malformed sitemap links are never fetched.
    for(let i=0;i<urls.length;i+=4) {
      await Promise.all(urls.slice(i,i+4).map(async url=>{
        const faults=[];
        try {
          const html=await fetchText(fetcher,url);
          const head=html.split(/<\/head\s*>/i)[0];
          const canonical=links(head,"canonical");
          const robotsMeta=directives(head,"robots");
          const googlebot=directives(head,"googlebot");
          if(canonical.length!==1 || canonical[0]!==url)faults.push("canonical");
          if(robotsMeta.length!==1 || robotsMeta.some(isNoindex) ||
             googlebot.some(isNoindex))faults.push("noindex");
          if(!/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(head))
            faults.push("title");
          const desc=directives(head,"description");
          if(desc.length!==1 || !desc[0]?.trim())faults.push("description");
          if((html.match(/<h1\b/gi)??[]).length!==1)faults.push("h1");
        } catch {faults.push("unavailable");}
        if(!faults.length)result.passing++;
        else for(const fault of faults)issue(url,fault);
        result.pages.push({url,ok:faults.length===0,problems:faults});
      }));
    }
    result.pages.sort((a,b)=>a.url.localeCompare(b.url));
    result.ok=result.issues.length===0 && result.total>0 && result.passing===result.total;
    return result;
  }
  return async function read() {
    const time=now();
    if(cached && time-at<ttlMs)return cached;
    if(inFlight)return inFlight;
    inFlight=measure().then(result=>{cached=result;at=now();return result;})
      .finally(()=>{inFlight=null;});
    return inFlight;
  };
}
