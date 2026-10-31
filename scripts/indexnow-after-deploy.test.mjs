import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {keyFile,urlsForChangedFiles,verifiedLive} from "./indexnow-after-deploy.mjs";
test("public file equals its IndexNow filename and uses supported hex format",()=>{
  const key=keyFile();
  assert.match(key.name,/^[a-f0-9]{32}\.txt$/);
  assert.equal(fs.readFileSync(path.join("maintenance-site",key.name),"utf8"),key.value);
});
test("only published indexable changed canonical HTML is sent",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"indexnow-"));
  try{
    fs.mkdirSync(path.join(dir,"gry"),{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),'<link rel="canonical" href="https://gracz.pl/"><meta name="robots" content="index,follow">');
    fs.writeFileSync(path.join(dir,"gry/index.html"),'<link rel="canonical" href="https://gracz.pl/gry/"><meta name="robots" content="noindex">');
    assert.deepEqual(urlsForChangedFiles(["maintenance-site/index.html","maintenance-site/gry/index.html",
      "maintenance-site/assets/foo.webp","other/index.html"],"<loc>https://gracz.pl/</loc><loc>https://gracz.pl/gry/</loc>",dir),["https://gracz.pl/"]);
    assert.deepEqual(urlsForChangedFiles(["maintenance-site/index.html"],"<loc>https://wrong.example/</loc>",dir),[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test("exact public content and key required before notification",async()=>{
  const key=keyFile();
  const html=fs.readFileSync("maintenance-site/index.html","utf8");
  const good=async url=>({ok:true,url,text:async()=>url.endsWith(".txt")?key.value:html});
  assert.equal(await verifiedLive(["https://gracz.pl/"],{fetcher:good,key}),true);
  const bad=async url=>({ok:true,url,text:async()=>url.endsWith(".txt")?key.value:"stale"});
  assert.equal(await verifiedLive(["https://gracz.pl/"],{fetcher:bad,key}),false);
  const forged=async url=>({ok:true,url,text:async()=>url.endsWith(".txt")?"bad":html});
  assert.equal(await verifiedLive(["https://gracz.pl/"],{fetcher:forged,key}),false);
});
