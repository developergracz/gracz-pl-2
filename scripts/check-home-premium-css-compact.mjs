// Deterministic, order-preserving compaction of the approved homepage stylesheet.
// Never change selectors, declarations, cascade order or strings. Fail closed if stale.
import fs from "node:fs";
import assert from "node:assert/strict";

export function compact(css) {
  let out="",quote=null,escaped=false,pendingSpace=false;
  for(let i=0;i<css.length;i++){
    const c=css[i],n=css[i+1];
    if(quote!==null){
      out+=c;
      if(escaped)escaped=false;
      else if(c==="\\")escaped=true;
      else if(c===quote)quote=null;
      continue;
    }
    if(c==="/"&&n==="*"){
      const preserve=css[i+2]==="!",start=i;
      i+=2;
      while(i<css.length && !(css[i]==="*"&&css[i+1]==="/"))i++;
      if(i>=css.length)throw Error("CSS comment unclosed");
      if(preserve){
        if(pendingSpace&&out&&!"{;}, ".includes(out.at(-1)))out+=" ";
        out+=css.slice(start,i+2);
      }
      i++;pendingSpace=false;continue;
    }
    if(c==="'"||c==='"'){
      if(pendingSpace&&out&&!"{;}, ".includes(out.at(-1)))out+=" ";
      pendingSpace=false;out+=c;quote=c;continue;
    }
    if(c==="\\"){
      if(pendingSpace&&out&&!"{;}, ".includes(out.at(-1)))out+=" ";
      pendingSpace=false;out+=c;
      if(n){out+=n;i++;}
      continue;
    }
    if(/\s/.test(c)){pendingSpace=true;continue;}
    if(pendingSpace&&out&&!"{;}, ".includes(out.at(-1))&&!"{;}, ".includes(c))out+=" ";
    pendingSpace=false;out+=c;
  }
  if(quote!==null)throw Error("CSS string unclosed");
  return out.trim()+"\n";
}
if(process.argv[1]?.endsWith("check-home-premium-css-compact.mjs")){
  const src=fs.readFileSync("maintenance-site/assets/home-premium-max.css","utf8");
  const min=fs.readFileSync("maintenance-site/assets/home-premium-max.min.css","utf8");
  const html=fs.readFileSync("maintenance-site/index.html","utf8");
  assert.equal(min,compact(src),"Compact stylesheet must be a deterministic reduction of the approved source");
  assert.ok(min.length<=src.length*.95,"Minified CSS must have a meaningful size reduction");
  assert.equal((html.match(/href="\/assets\/home-premium-max\.min\.css\?v=compact-r1"/g)||[]).length,1,
    "Homepage must use exactly one compact stylesheet");
  assert.ok(!/href="\/assets\/home-premium-max\.css/.test(html),
    "Do not load full source stylesheet alongside compact asset");
  assert.ok(html.includes('<link rel="stylesheet" href="/assets/home.css?v=forum-nav-r1">') &&
    html.indexOf("href=\"/assets/home.css?v=forum-nav-r1\"")<
      html.indexOf("href=\"/assets/home-premium-max.min.css?v=compact-r1\""),
    "Keep the exact approved stylesheet cascade order");
  // Guard against accidentally moving the highest-impact hero and the cookie module.
  assert.ok((html.includes('class="home-hero-premium__lead"') ||
    html.includes('class="r4-hero-description"') ||
    html.includes('class="ref-hero__desc"')) &&
    html.includes('href="/assets/cookie-consent.css?v=r3"'),
    "Preserve homepage hero text and the cookie module");
  console.log(JSON.stringify({state:"PASS",sourceBytes:src.length,compactBytes:min.length}));
}
