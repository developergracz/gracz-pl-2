import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>readFile(new URL(path,import.meta.url),'utf8');

test('logout confirmation is a standalone Polish Full Max Premium page without credentials or scripts',async()=>{
  const html=await read('../admin-r1/ui/logout.html');
  assert.match(html,/<html lang="pl">/);
  assert.match(html,/<h2 id="logout-title">Wylogowano pomyślnie<\/h2>/);
  assert.match(html,/<link rel="stylesheet" href="\/owner\/newsletter\/logout.css">/);
  assert.match(html,/gracz<span>\.pl<\/span>/);
  assert.match(html,/Sesja została zakończona/);
  assert.doesNotMatch(html,/<form\b|<script\b|<input\b|password|session_token/i);
});

test('all five actions use fixed safe destinations; protected panels do not bypass login',async()=>{
  const html=await read('../admin-r1/ui/logout.html');
  for(const target of [
    '/owner/newsletter/login',
    'https://gracz.pl/',
    '/owner/newsletter/',
    '/owner/newsletter/seo'
  ])assert.ok(html.includes('href="'+target+'"'),target);
  const links=[...html.matchAll(/<a class="logout-action[^"]*" href="([^"]+)"/g)];
  assert.equal(links.length,5);
  assert.ok(links.every(match=>match[1].startsWith('/owner/newsletter/')||
    match[1]==='https://gracz.pl/'));
  assert.ok(html.includes('Po zalogowaniu: subskrybenci i kampanie'));
  assert.ok(html.includes('Po zalogowaniu: indeksacja i wydajność'));
});

test('logout page CSS fits a typical laptop viewport and gracefully scrolls on phones',async()=>{
  const css=await read('../admin-r1/ui/logout.css');
  assert.match(css,/min-height:100dvh/);
  assert.match(css,/justify-content:center/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/\.logout-actions\{grid-template-columns:1fr/);
  assert.doesNotMatch(css,/overflow:hidden|height:100dvh/);
});

test('logout success navigates to confirmation only after 200; expired sessions keep login flow',async()=>{
  const js=await read('../admin-r1/ui/systemadmin-logout.js');
  const result=js.indexOf('if(!result.ok)throw Error("logout_failed");');
  const go=js.indexOf('location.replace("/owner/newsletter/logged-out");');
  assert.ok(result>0&&go>result);
  assert.match(js,/if\(active.status===401\)\{\s*location.replace\("\/owner\/newsletter\/login"\)/);
  assert.match(js,/method:"POST",credentials:"same-origin"/);
  assert.match(js,/"X-Owner-CSRF":details.csrf/);
});

test('logout page is served with existing private headers and before session access checks',async()=>{
  const router=await read('../admin-r1/owner-router.mjs');
  const headers=await read('../admin-r1/deny.mjs');
  const loggedOut=router.indexOf("path===PREFIX+'/logged-out'");
  const css=router.indexOf("path===PREFIX+'/logout.css'");
  const session=router.indexOf('const session=await auth.session(cookie,kind)');
  const host=router.indexOf("req.headers.host!==new URL(origin).host");
  assert.ok(host>=0&&loggedOut>host&&loggedOut<session);
  assert.ok(css>host&&css<session);
  assert.match(router,/if\(req.method==='POST'&&path===PREFIX\+'\/logout'\)\{[\s\S]*?auth\.checkCsrf\(session,req\.headers\['x-owner-csrf'\]\)[\s\S]*?await auth\.logout\(cookie\)/);
  assert.match(router,/new URL\('\.\/ui\/logout.html',import\.meta\.url\)/);
  assert.match(router,/new URL\('\.\/ui\/logout.css',import\.meta\.url\)/);
  assert.match(headers,/"Cache-Control": "no-store"/);
  assert.match(headers,/"X-Robots-Tag": "noindex, nofollow"/);
  assert.match(headers,/"X-Frame-Options": "DENY"/);
});
