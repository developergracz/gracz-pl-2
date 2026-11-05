import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {serveIdentityPage} from '../auth/page.mjs';

const host='https://gracz-contact-api.onrender.com';
function serve(path){
 const r={status:0,headers:{},body:Buffer.alloc(0)};
 const res={writeHead(status,headers){r.status=status;r.headers=headers;},end(body){r.body=Buffer.from(body);}};
 assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,host)),true,path);
 assert.equal(r.status,200,path);
 return r;
}
const repoFile=path=>readFile(new URL('../../'+path,import.meta.url));

test('login top bar matches the approved gracz.pl header (pattern B)',()=>{
 const html=serve('/konto/').body.toString();
 const bar=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
 const menu=[...bar.matchAll(/<a class="bar-link[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map(m=>[m[2],m[1]]);
 assert.deepEqual(menu,[
  ['Gry','https://gracz.pl/gry/'],['Gry karciane','https://gracz.pl/gry-karciane/'],
  ['Poradniki','https://gracz.pl/poradniki/'],['Blog','https://gracz.pl/#aktualnosci'],
  ['Społeczność','https://gracz.pl/#spolecznosc'],['Newsletter','https://gracz.pl/newsletter/'],
 ]);
 for(const removed of ['Forum','Aktualności','Gracz Next','☼','⌕','Zarejestruj się'])assert.equal(bar.includes(removed),false,removed);
 assert.match(bar,/class="site-bar-logo" href="https:\/\/gracz\.pl\/"[^>]*>gracz<span>\.pl<\/span>/);
 assert.match(bar,/class="bar-search" href="https:\/\/gracz\.pl\/szukaj\/"/);
 assert.match(bar,/class="bar-btn bar-btn--outline" href="\/konto\/\?widok=login" data-view="login">Zaloguj się</);
 assert.match(bar,/class="bar-btn bar-btn--gold" href="\/konto\/" data-view="register">Załóż konto</);
 const css=serve('/konto/styl.css').body.toString();
 assert.match(css,/\.site-bar\{[^}]*height:68px/);
 assert.match(css,/font:800 36px\/1 Montserrat/);
});

test('login panel shows exactly one original gold SVG crown above the heading',async()=>{
 const html=serve('/konto/').body.toString();
 assert.equal(html.includes('♛'),false);
 assert.equal(html.match(/class="login-crown"/g).length,1);
 const crownAt=html.indexOf('<img class="login-crown" src="/konto/korona.svg" width="60" height="49"');
 assert.ok(crownAt>0&&crownAt<html.indexOf('id="page-title"'));
 const crown=serve('/konto/korona.svg');
 assert.equal(crown.headers['Content-Type'],'image/svg+xml');
 assert.deepEqual(crown.body,await repoFile('maintenance-site/assets/gracz-crown-premium.svg'));
 assert.match(serve('/konto/styl.css').body.toString(),/\.login-crown\{[^}]*aspect-ratio:60\/49/);
});

test('top bar fonts come from the same origin and auth calls stay unchanged',async()=>{
 for(const name of ['montserrat-latin.woff2','montserrat-latin-ext.woff2']){
  const font=serve('/konto/fonts/'+name);
  assert.equal(font.headers['Content-Type'],'font/woff2');
  assert.deepEqual(font.body,await repoFile('maintenance-site/assets/fonts/'+name));
 }
 const csp=serve('/konto/').headers['Content-Security-Policy'];
 assert.equal(csp,"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https://gracz.pl; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 const js=serve('/konto/app.js').body.toString();
 assert.match(js,/api\('login',\{login:d\.get\('login'\),password:d\.get\('password'\)\}\)/);
 assert.match(js,/location\.assign\('\/konto\/panel\/'\)/);
});
