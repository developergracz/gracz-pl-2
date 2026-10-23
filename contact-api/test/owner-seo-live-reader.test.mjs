import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createSeoLiveReader} from "../admin-r1/seo-live-reader.mjs";
import {privateHeaders} from "../admin-r1/deny.mjs";

const HOST="https://gracz.pl";
const root=HOST+"/";
const robots="User-agent: *\nAllow: /\nSitemap: https://gracz.pl/sitemap.xml";
const site=(urls)=>'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  urls.map(url=>"<url><loc>"+url+"</loc></url>").join("")+"</urlset>";
const page=(url,extra="")=>'<!doctype html><html><head><title>gracz.pl — gry</title>'+
  '<link rel="canonical" href="'+url+'"><meta name="robots" content="index,follow">'+
  '<meta name="description" content="Graj online w serwisie gracz.pl">'+
  extra+'</head><body><h1>Gry</h1></body></html>';
function fixture({urls=[root],pages={},status={}}={}) {
  const requested=[];
  const fetcher=async url=>{
    requested.push(url);
    const body=url===HOST+"/robots.txt"?robots:url===HOST+"/sitemap.xml"?site(urls):pages[url]??page(url);
    return new Response(body,{status:status[url]||200});
  };
  return {requested,fetcher};
}

test("healthy public site reports one verified page and no errors",async()=>{
  const {fetcher}=fixture();
  const result=await createSeoLiveReader({fetcher})();
  assert.equal(result.ok,true);
  assert.equal(result.total,1);
  assert.equal(result.passing,1);
  assert.deepEqual(result.issues,[]);
  assert.equal(result.scope,"public_live");
});

test("canonical mismatch is a hard problem",async()=>{
  const {fetcher}=fixture({pages:{[root]:page(HOST+"/wrong/")}});
  const report=await createSeoLiveReader({fetcher})();
  assert.equal(report.ok,false);
  assert.deepEqual(report.pages[0].problems,["canonical"]);
});

test("Googlebot noindex is detected despite default index",async()=>{
  const {fetcher}=fixture({pages:{[root]:page(root,'<meta name="googlebot" content="noindex">')}});
  const report=await createSeoLiveReader({fetcher})();
  assert.equal(report.ok,false);
  assert.ok(report.pages[0].problems.includes("noindex"));
});

test("failed public requests are reported unknown, never healthy",async()=>{
  const {fetcher}=fixture({status:{[root]:503}});
  const report=await createSeoLiveReader({fetcher})();
  assert.equal(report.ok,false);
  assert.ok(report.issues.some(item=>item.code==="unavailable"));
});

test("foreign sitemap URLs are never fetched",async()=>{
  const {fetcher,requested}=fixture({urls:["https://evil.invalid/path/"]});
  const report=await createSeoLiveReader({fetcher})();
  assert.equal(report.ok,false);
  assert.deepEqual(requested.slice().sort(),[HOST+"/robots.txt",HOST+"/sitemap.xml"].sort());
  assert.ok(report.issues.some(item=>item.code==="sitemap_invalid"));
});

test("overlong or empty sitemap fails closed",async()=>{
  const many=fixture({urls:Array.from({length:51},(_,i)=>HOST+"/game-"+i+"/")});
  const report=await createSeoLiveReader({fetcher:many.fetcher})();
  assert.equal(report.ok,false);
  assert.equal(report.pages.length,0);
  assert.equal(many.requested.length,2);
});

test("cached monitoring never makes duplicate network requests within TTL",async()=>{
  const {fetcher,requested}=fixture();
  let time=1_800_000_000_000;
  const reader=createSeoLiveReader({fetcher,now:()=>time,ttlMs:1000});
  const results=await Promise.all([reader(),reader(),reader()]);
  assert.equal(results[0],results[1]);
  assert.equal(results[1],results[2]);
  assert.equal(requested.length,3);
  await reader();
  assert.equal(requested.length,3);
  time+=1001;
  await reader();
  assert.equal(requested.length,6);
});

test("missing description and multiple H1 headings require SEO review",async()=>{
  const bad=page(root).replace(/<meta name="description"[^>]*>/,"")
    .replace("</body>","<h1>Duplikat</h1></body>");
  const report=await createSeoLiveReader({fetcher:fixture({pages:{[root]:bad}}).fetcher})();
  assert.equal(report.ok,false);
  assert.ok(report.pages[0].problems.includes("description"));
  assert.ok(report.pages[0].problems.includes("h1"));
});

test("dashboard is private noindex and reachable only through owner router",async()=>{
  const html=await readFile(new URL("../admin-r1/ui/seo.html",import.meta.url),"utf8");
  const source=await readFile(new URL("../admin-r1/owner-router.mjs",import.meta.url),"utf8");
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  assert.equal(privateHeaders["X-Robots-Tag"],"noindex, nofollow");
  const authIndex=source.indexOf("const session=await auth.session(cookie,kind)");
  const routeIndex=source.indexOf("path===PREFIX+'/seo/status'");
  assert.ok(authIndex>0 && routeIndex>authIndex);
});
