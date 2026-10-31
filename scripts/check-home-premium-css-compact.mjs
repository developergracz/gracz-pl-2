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
  // The homepage's CSS is now a deterministic, order-preserving single bundle.
  const files=[
    "cookie-consent.css","home.css","home-premium-max.min.css",
    "global-header-r1.css","home-reference-r4.css","hero-owner-exact.css",
    "home-reference-r5-precision.css","home-r5-final-alignment.css",
    "home-community-fullmax-r1.css","home-lower-reference-r6.css"
  ];
  const assembled=files.map(f=>fs.readFileSync("maintenance-site/assets/"+f,"utf8")).join("\n");
  const bundle=fs.readFileSync("maintenance-site/assets/home-lcp-bundle-r1.css","utf8");
  assert.equal(bundle,compact(assembled),"LCP CSS bundle must exactly preserve the approved cascade");
  const stylesheetTags=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)];
  assert.equal(stylesheetTags.length,1,"Homepage must have one render-blocking CSS request");
  assert.equal(stylesheetTags[0][1],"/assets/home-lcp-bundle-r1.css?v=css-lcp-20261031-academy-wide-r10");
  assert.ok(html.indexOf("gracz-hero-mobile-art-r14.webp")<html.indexOf("home-lcp-bundle-r1.css"),
    "Preload mobile LCP image before requesting CSS bundle");
  assert.ok(html.includes('class="r4-hero-description"'),"Keep semantic hero copy");
  console.log(JSON.stringify({state:"PASS",sourceBytes:src.length,compactBytes:min.length}));
}
