// Deterministic, order-preserving compaction of the approved homepage stylesheet.
// Never change selectors, declarations, cascade order or strings. Fail closed if stale.
import fs from "node:fs";
import assert from "node:assert/strict";
import {mobileCss} from "./build-home-mobile-css.mjs";

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
  // Exactly one selected stylesheet. No-JS visitors retain full approved CSS.
  const stylesheetTags=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)];
  assert.equal(stylesheetTags.length,1,"No-JS fallback must be the only static stylesheet");
  assert.ok(html.includes('<noscript><link rel="stylesheet" href="/assets/home-lcp-bundle-r1.css?v=css-lcp-20261106-unused-css-prune-r1"></noscript>'),
    "No-JS users must receive approved full stylesheet");
  assert.ok(html.includes('<script src="/assets/home-css-viewport.js?v=20261106-lcp-v1"></script>'),
    "Parser-early single stylesheet selector required");
  const selector=fs.readFileSync("maintenance-site/assets/home-css-viewport.js","utf8");
  assert.ok(selector.includes('matchMedia("(max-width:680px)")') &&
    selector.includes('/assets/home-lcp-bundle-r1-mobile.css?v=20261106-mobile-v1') &&
    selector.includes('/assets/home-lcp-bundle-r1.css?v=css-lcp-20261106-unused-css-prune-r1'),
    "Selector must request only one of the two approved files");
  const mobile=fs.readFileSync("maintenance-site/assets/home-lcp-bundle-r1-mobile.css","utf8");
  assert.equal(mobile,mobileCss(bundle).css,"Mobile stylesheet must preserve approved rule order");
  assert.ok(mobile.length<bundle.length*.80,"Mobile CSS must save at least 20%");
  assert.ok(html.indexOf("gracz-hero-gomoku-mobile-preview-r1.webp")<html.indexOf("home-lcp-bundle-r1.css"),
    "Preload mobile LCP image before requesting CSS bundle");
  assert.ok(html.includes('class="r4-hero-description"'),"Keep semantic hero copy");
  console.log(JSON.stringify({state:"PASS",sourceBytes:src.length,compactBytes:min.length}));
}
