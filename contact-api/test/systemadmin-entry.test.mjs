import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public gracz.pl/systemadmin entry has private noindex and only a backend login handoff",async()=>{
  const html=await read("../../maintenance-site/systemadmin/index.html");
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html,/<meta name="referrer" content="strict-origin">/);
  assert.doesNotMatch(html,/<meta http-equiv="refresh"/i);
  assert.match(html,/action="https:\/\/gracz-contact-api\.onrender\.com\/owner\/newsletter\/login\/public-form"/);
  assert.match(html,/<form class="admin-login-form" method="post"/);
  assert.match(html,/name="username" autocomplete="username"/);
  assert.match(html,/name="password" autocomplete="current-password"/);
  assert.match(html,/type="submit">Zaloguj się/);
  assert.match(html,/Zapomniałem hasła<\/a>/);
  assert.match(html,/login\/systemadmin#forgot/);
  assert.match(html,/href="\/systemadmin\/systemadmin\.css"/);
  assert.match(html,/Logowanie administratora/);
  assert.doesNotMatch(html,/<script\b/i);
  assert.match(css,/\.access-button/);
  assert.match(css,/\.admin-login-field input:focus-visible/);
  assert.match(css,/\.admin-login-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Full Max Premium form permits only trusted backend and keeps other pages locked",async()=>{
  const page=await read("../../maintenance-site/systemadmin/index.html");
  const headers=await read("../../maintenance-site/render.yaml");
  const gate=await read("../../scripts/check-security-headers.mjs");
  const router=await read("../admin-r1/owner-router.mjs");
  const client=await read("../admin-r1/ui/login.js");
  assert.match(page,/form-action https:\/\/gracz-contact-api\.onrender\.com/);
  assert.match(headers,/form-action https:\/\/gracz-contact-api\.onrender\.com/);
  assert.match(gate,/rel === 'maintenance-site\/systemadmin\/index.html'/);
  assert.match(router,/PUBLIC_OWNER_FORM_ORIGIN='https:\/\/gracz.pl'/);
  assert.match(router,/req.headers.origin!==PUBLIC_OWNER_FORM_ORIGIN/);
  assert.match(router,/publicOwnerFormInput\(req\)/);
  assert.match(router,/Set-Cookie':newCookie\(outcome.token\)/);
  assert.match(router,/if\(!passwordOnly \|\|/);
  assert.match(client,/location.hash==='#forgot'/);
});

test("Full Max Premium complete login fits laptop view without clipping smaller screens",async()=>{
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  assert.match(css,/\.public-admin-shell\{min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:auto minmax\(0,1fr\) auto\}/);
  assert.match(css,/\.public-admin-main\{margin:auto;padding:10px 0;/);
  assert.match(css,/\.public-admin-main \.admin-login-field input\{min-height:44px;/);
  assert.match(css,/@media\(max-height:670px\) and \(min-width:541px\)/);
  assert.doesNotMatch(css,/overflow:hidden/);
});

test("System Admin removes decorative spade and fits desktop viewport while mobile can scroll",async()=>{
  const entry=await read("../../maintenance-site/systemadmin/index.html");
  const entryCss=await read("../../maintenance-site/systemadmin/systemadmin.css");
  const dashboard=await read("../admin-r1/ui/systemadmin.html");
  const css=await read("../admin-r1/ui/systemadmin.css");
  assert.doesNotMatch(entry,/♠|class="signet"/);
  assert.doesNotMatch(dashboard,/♠|class="systemadmin-symbol"/);
  assert.doesNotMatch(css,/\.systemadmin-symbol\{/);
  assert.doesNotMatch(entryCss,/\.signet\{/);
  assert.match(css,/\.systemadmin-center\{[^}]*min-height:0/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.systemadmin-tiles\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
  assert.match(router,/System Admin — logowanie/);
  assert.match(router,/replaceAll\('Prywatny panel admina newslettera serwisu gracz.pl'/);
  assert.match(router,/path===OWNER_HUB\?OWNER_HUB_LOGIN:PREFIX\+'\/login'/);
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
