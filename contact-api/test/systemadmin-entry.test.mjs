import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public gracz.pl/systemadmin entry has private noindex and only a backend login handoff",async()=>{
  const html=await read("../../maintenance-site/systemadmin/index.html");
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html,/<meta name="referrer" content="no-referrer">/);
  assert.match(html,/href="https:\/\/gracz-contact-api\.onrender\.com\/owner\/newsletter\/systemadmin"/);
  assert.match(html,/href="\/systemadmin\/systemadmin\.css"/);
  assert.match(html,/Logowanie administratora/);
  assert.doesNotMatch(html,/<input\b[^>]*type="password"|<form\b|<script\b/i);
  assert.match(css,/\.access-button/);
});

test("protected hub contains exactly the two OWNER target panels",async()=>{
  const html=await read("../admin-r1/ui/systemadmin.html");
  assert.match(html,/SEO Control Center/);
  assert.match(html,/Panel administracyjny Newslettera/);
  assert.match(html,/href="\/owner\/newsletter\/seo"/);
  assert.match(html,/href="\/owner\/newsletter\/"/);
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.doesNotMatch(html,/<form|<input|data-demo/i);
});

test("login redirect is allowlisted to the server-owned hub path, not user input",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const login=await read("../admin-r1/ui/login.js");
  const session=router.indexOf("const session=await auth.session(cookie,kind)");
  const hub=router.indexOf("path===OWNER_HUB)",session);
  assert.ok(session>0&&hub>session,"hub HTML is authenticated");
  assert.match(router,/data-after-login/);
  assert.match(login,/form\.dataset\.afterLogin==='\/owner\/newsletter\/systemadmin'/);
  assert.match(login,/location\.replace\('\/owner\/newsletter\/'\)/);
  assert.match(router,/url\.search\)return denyAdmin\(req,res\)/);
  assert.match(router,/X-Robots-Tag|privateHeaders/);
});

test("switch navigation routes to hub, SEO, and newsletter without a second login",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const css=await read("../admin-r1/ui/systemadmin.css");
  assert.match(router,/Przełączanie paneli administracyjnych/);
  assert.match(router,/withAdminSwitchBar\(html,'newsletter'\)/);
  assert.match(router,/withAdminSwitchBar\([\s\S]*?'seo'\)/);
  assert.match(css,/\.systemadmin-topnav/);
});
