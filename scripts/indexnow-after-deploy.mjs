// IndexNow notification is gated by the exact public Render release.
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const HOST="https://gracz.pl", ROOT="maintenance-site";
export function keyFile(root=ROOT){
  const files=fs.readdirSync(root).filter(f=>/^[a-f0-9]{32}\.txt$/.test(f) &&
    fs.readFileSync(path.join(root,f),"utf8")===f.slice(0,-4));
  if(files.length!==1)throw Error("Expected exactly one IndexNow root key file");
  return {name:files[0],value:files[0].slice(0,-4)};
}
export function urlsForChangedFiles(files,sitemap,root=ROOT){
  const allowed=new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));
  const found=new Set();
  for(const file of files){
    if(!/^maintenance-site\/(?:[^/]+\/)*index\.html$/.test(file))continue;
    const relative=file.slice("maintenance-site/".length);
    const url=HOST+"/"+relative.slice(0,-"index.html".length);
    if(!allowed.has(url))continue;
    const local=path.join(root,relative);
    if(!fs.existsSync(local))continue;
    const html=fs.readFileSync(local,"utf8");
    if(!html.includes('<link rel="canonical" href="'+url+'">') ||
       !/<meta\s+name="robots"\s+content="index,follow/i.test(html))continue;
    found.add(url);
  }
  return [...found].sort();
}
function changedFiles(base,head){
  if(!/^[a-f0-9]{40}$/.test(base)||!/^[a-f0-9]{40}$/.test(head))throw Error("Invalid SHA range");
  const p=spawnSync("git",["diff","--name-only","--diff-filter=AM",base,head,"--","maintenance-site"],{
    encoding:"utf8",timeout:10000,maxBuffer:65536});
  if(p.status!==0||p.error)throw Error("Cannot verify deployment diff");
  return p.stdout.trim().split("\n").filter(Boolean);
}
export async function verifiedLive(urls,{fetcher=fetch,root=ROOT,key=keyFile(root)}={}){
  const keyUrl=HOST+"/"+key.name;
  try{
    const proof=await fetcher(keyUrl,{signal:AbortSignal.timeout(15000),cache:"no-store"});
    if(!proof.ok||proof.url!==keyUrl||(await proof.text()).trim()!==key.value)return false;
    for(const url of urls){
      const pathname=new URL(url).pathname;
      const relative=pathname==="/"?"index.html":pathname.slice(1)+"index.html";
      const expected=fs.readFileSync(path.join(root,relative),"utf8");
      const response=await fetcher(url,{signal:AbortSignal.timeout(15000),cache:"no-store"});
      if(!response.ok||response.url!==url||(await response.text())!==expected)return false;
    }
    return true;
  }catch{return false;}
}
export async function submit({base,head,root=ROOT,fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),tries=20}={}){
  const key=keyFile(root);
  const files=changedFiles(base,head);
  const urls=urlsForChangedFiles(files,fs.readFileSync(path.join(root,"sitemap.xml"),"utf8"),root);
  if(!urls.length)return {state:"no_changed_pages",count:0};
  if(urls.length>50)throw Error("Unexpected IndexNow batch size");
  let live=false;
  for(let i=0;i<tries;i++){
    if(await verifiedLive(urls,{fetcher,root,key})){live=true;break;}
    if(i+1<tries)await wait(15000);
  }
  if(!live)return {state:"not_published_yet",count:0};
  const response=await fetcher("https://api.indexnow.org/indexnow",{
    method:"POST",headers:{"content-type":"application/json; charset=utf-8"},
    body:JSON.stringify({host:"gracz.pl",key:key.value,keyLocation:HOST+"/"+key.name,urlList:urls}),
    signal:AbortSignal.timeout(18000)
  });
  if(![200,202].includes(response.status))return {state:"rejected",status:response.status,count:0};
  return {state:"accepted",status:response.status,count:urls.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv.includes("--notify"))throw Error("Explicit --notify required");
  const result=await submit({base:process.env.INDEXNOW_BEFORE_SHA,head:process.env.INDEXNOW_HEAD_SHA});
  process.stdout.write(JSON.stringify(result)+"\n");
  if(result.state==="rejected")process.exitCode=1;
}
