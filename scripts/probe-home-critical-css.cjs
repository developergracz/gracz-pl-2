'use strict';
// Disposable local benchmark only; no changes to deployed HTML/CSS.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const {chromium}=require('@playwright/test');
const source=path.resolve('maintenance-site'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'gracz-critical-'));
const candidate=path.join(temp,'candidate'),children=[];
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function serve(dir,port){
 const p=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','-d',dir],{stdio:'ignore'});
 children.push(p);
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:'+port+'/')).ok)return}catch{}await sleep(200)}
 throw Error('HTTP server unavailable: '+port);
}
async function main(){
 await serve(source,4311);
 const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
 const rules=new Map(),used=new Set(),expected=new Map();
 try{
  for(const width of [360,390,768,1366,1920]){
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.goto('http://127.0.0.1:4311/',{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   const r=await page.evaluate(()=>{
    const ss=[...document.styleSheets].find(s=>s.href?.includes('/home-premium-max.min.css?'));
    if(!ss)throw Error('Missing main premium CSS');
    const visible=(selector)=>{
     let els;try{els=document.querySelectorAll(selector.replace(/::(?:before|after|marker|placeholder|first-letter|first-line)/g,'').replace(/:(?:hover|focus-visible|focus-within|focus|active)\b/g,''))}
     catch{return true}
     return [...els].some(el=>{const b=el.getBoundingClientRect();return el===document.body||el===document.documentElement||(b.top<innerHeight+100&&b.bottom>=0&&b.width>0&&b.height>0)});
    };
    const leaves=[];
    const walk=(list,parent,key)=>{
     for(let i=0;i<list.length;i++){
      const r=list[i],k=key?key+'/'+i:String(i);
      if(r.cssRules)walk(r.cssRules,parent.concat(r.cssText.slice(0,r.cssText.indexOf('{')).trim()),k);
      else leaves.push({key:k,parent,css:r.cssText,used:r.selectorText?visible(r.selectorText):true});
     }
    };
    walk(ss.cssRules,[],'');
    const rect=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:b.x,y:b.y,w:b.width,h:b.height,color:st.color,font:st.fontSize}};
    return {leaves,geometry:['.home-hero-premium__title','.home-hero-premium__lead','.site-header','.home-hero-premium__shell'].map(rect)};
   });
   for(const x of r.leaves){rules.set(x.key,{parent:x.parent,css:x.css});if(x.used)used.add(x.key)}
   expected.set(width,r.geometry);
   await page.close();
  }
 }finally{await browser.close()}
 const critical=[...rules.entries()].filter(([key])=>used.has(key)).map(([_,r])=>{
  let value=r.css;for(let i=r.parent.length-1;i>=0;i--)value=r.parent[i]+'{'+value+'}';return value;
 }).join('\n')+'\n';
 const full=fs.readFileSync(path.join(source,'assets/home-premium-max.min.css'),'utf8');
 if(critical.length>full.length*.73||critical.length<1500)throw Error('Unsafe extracted size '+critical.length);
 fs.cpSync(source,candidate,{recursive:true});
 fs.writeFileSync(path.join(candidate,'assets/home-critical-probe.css'),critical);
 const file=path.join(candidate,'index.html'),html=fs.readFileSync(file,'utf8');
 const orig='<link rel="stylesheet" href="/assets/home-premium-max.min.css?v=compact-r1">';
 if(html.split(orig).length!==2)throw Error('Expected a single original CSS tag');
 const replace='<link rel="stylesheet" href="/assets/home-critical-probe.css">'+
  '\n  <link rel="stylesheet" href="/assets/home-premium-max.min.css?v=compact-r1" media="print" id="deferred-premium-css">'+
  '\n  <script src="/assets/release-deferred-premium.js" defer></script>';
 fs.writeFileSync(file,html.replace(orig,replace));
 fs.writeFileSync(path.join(candidate,'assets/release-deferred-premium.js'),
  '(function(){const e=document.getElementById("deferred-premium-css");if(!e)return;const done=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>e.media="all"));if(e.sheet)done();else e.addEventListener("load",done,{once:true});})();');
 await serve(candidate,4312);
 const browser2=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
 try{
  for(const width of [360,390,768,1366,1920]){
   const page=await browser2.newPage({viewport:{width,height:850}});
   await page.goto('http://127.0.0.1:4312/',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#deferred-premium-css')?.media==='all',{timeout:15000});
   await page.evaluate(()=>document.fonts.ready);
   const x=await page.evaluate(()=>{
    const rect=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:b.x,y:b.y,w:b.width,h:b.height,color:st.color,font:st.fontSize}};
    return {width:document.documentElement.scrollWidth,geometry:['.home-hero-premium__title','.home-hero-premium__lead','.site-header','.home-hero-premium__shell'].map(rect)};
   });
   if(x.width>width+2)throw Error('Horizontal overflow at '+width);
   for(let i=0;i<x.geometry.length;i++){
    const before=expected.get(width)[i],after=x.geometry[i];
    for(const key of ['x','y','w','h'])if(Math.abs(before[key]-after[key])>1.1)throw Error('Visual geometry mismatch at '+width+' '+i+' '+key+': '+before[key]+' / '+after[key]);
    for(const key of ['font','color'])if(before[key]!==after[key])throw Error('Style mismatch '+width+' '+i+' '+key);
   }
   await page.close();
  }
 }finally{await browser2.close()}
 const out={criticalBytes:critical.length,fullBytes:full.length};
 for(const [name,port] of [['baseline',4311],['candidate',4312]]){
  const file=path.join(temp,name+'.json');
  const r=spawnSync('npx',['--yes','lighthouse@12.8.2','http://127.0.0.1:'+port+'/',
   '--quiet','--only-categories=performance','--output=json','--output-path='+file,
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage','--max-wait-for-load=20000'],{encoding:'utf8',timeout:150000});
  if(r.status!==0)throw Error('Lighthouse failed '+name+': '+r.stderr.slice(-1000));
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  out[name]={lcp:d.audits['largest-contentful-paint']?.numericValue,cls:d.audits['cumulative-layout-shift']?.numericValue,
   performance:d.categories.performance.score*100};
 }
 out.deltaMs=out.candidate.lcp-out.baseline.lcp;
 console.log('CRITICAL_CSS_PROBE '+JSON.stringify(out));
 console.log(out.deltaMs<=-200&&out.candidate.cls<=.05?'CRITICAL_CSS_DECISION PROMISING':'CRITICAL_CSS_DECISION REJECT');
}
main().catch(e=>{console.error('CRITICAL_CSS_PROBE_ERROR '+(e.stack||e));process.exitCode=1}).finally(()=>{
 for(const p of children)p.kill();fs.rmSync(temp,{recursive:true,force:true});
});
