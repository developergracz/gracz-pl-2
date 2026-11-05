import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {serveIdentityPage} from '../auth/page.mjs';

// Owner reference R2 for the /konto/ registration view: live HTML form inside the gold
// frame, the three final form elements, the approved chip + deck artwork on the teal
// stage, reference proportions on desktop and unchanged registration contracts.
const BASE='https://gracz-contact-api.onrender.com';
const serve=path=>{
 const r={status:0,headers:{},body:Buffer.alloc(0)};
 const res={writeHead(status,headers){r.status=status;r.headers=headers||{};},end(body){r.body=Buffer.from(body||'');}};
 assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,BASE)),true,path);
 assert.equal(r.status,200,path);
 return r;
};
const html=serve('/konto/').body.toString(),css=serve('/konto/styl.css').body.toString(),js=serve('/konto/app.js').body.toString();
const form=html.slice(html.indexOf('<form id="register-form"'),html.indexOf('<form id="login-form"'));
const rule=selector=>{
 const at=css.indexOf('\n'+selector+'{'); // top-level rule, not a media-query override
 assert.ok(at>=0,selector);
 return css.slice(at,css.indexOf('\n}',at));
};

test('A: „Zarejestruj się” keeps gold gradient, user icon and centred label, without arrow',()=>{
 const button=form.match(/<button class="submit register-submit" type="submit">([\s\S]*?)<\/button>/);
 assert.ok(button,'live submit button');
 assert.match(button[1],/<svg class="submit-user"[^>]*aria-hidden="true"/);
 assert.match(button[1],/<span>Zarejestruj się<\/span>$/);
 assert.doesNotMatch(button[1],/→|&rarr;|arrow/i);
 const submit=rule('body[data-account-view="register"] #register-form>.submit');
 assert.match(submit,/justify-content:center/);
 assert.match(submit,/linear-gradient\(180deg,#ffe57f 0%,#ffcf5e 46%,#fbb02c 100%\)/);
 assert.match(css,/#register-form>\.submit::after\{content:"";flex:0 0 calc\(22\*var\(--u\)\)\}/,'icon balanced so the label stays centred');
});

test('B: „Zapomniałem hasła?” is a glowing gold Premium button on the newsletter row that opens recovery',()=>{
 const checks=form.slice(form.indexOf('<div class="checks">'),form.indexOf('<button class="submit'));
 assert.match(checks,/Chcę otrzymywać newsletter[\s\S]*?<\/label><button type="button" class="register-forgot" data-view="forgot"><svg class="forgot-key"[^>]*aria-hidden="true"[\s\S]*?<\/svg><span>Zapomniałem hasła\?<\/span><\/button><\/div>/);
 const button=rule('body[data-account-view="register"] .register-forgot');
 assert.match(button,/grid-column:2;grid-row:3/);
 assert.match(button,/solid #f6c445/);
 assert.match(button,/linear-gradient\(180deg,#0e2421 0%,#06110f 100%\)/);
 assert.match(button,/0 0 calc\(8\*var\(--u\)\) rgba\(255,196,64,\.75\)/);
 assert.match(rule('body[data-account-view="register"] .register-forgot::after'),/radial-gradient\(circle,#fff/,'gold glint');
 assert.match(js,/document\.querySelectorAll\('\[data-view\]'\)\.forEach/);
 assert.match(html,/<form id="forgot-form" hidden novalidate>/);
});

test('C: „Masz już konto? Zaloguj się” is centred with italic gold question, turquoise link and twin ornaments',()=>{
 const sw=form.match(/<p class="switch register-switch">([\s\S]*?)<\/p><\/form>\s*$/);
 assert.ok(sw,'switch line closes the registration form');
 assert.equal((sw[1].match(/class="switch-ornament/g)||[]).length,2);
 assert.match(sw[1],/<span class="switch-question">Masz już konto\?<\/span> <a class="switch-login" href="\/konto\/\?widok=login" data-view="login">Zaloguj się<\/a>/);
 assert.match(rule('body[data-account-view="register"] .register-switch'),/justify-content:center/);
 assert.match(rule('body[data-account-view="register"] .switch-question'),/font:italic 700 [^;]*Georgia/);
 assert.match(rule('body[data-account-view="register"] .switch-question'),/color:#f6dca4/);
 assert.match(rule('body[data-account-view="register"] .switch-login'),/color:#25e8e8/);
 assert.match(css,/\.switch-ornament--end\{transform:scaleX\(-1\);/);
 assert.match(js,/if\(button\.tagName==='A'\)event\.preventDefault\(\)/);
});

test('all existing registration fields, consents, providers and links stay wired',()=>{
 for(const field of ['name="nickname"','name="email"','name="password"','name="repeatPassword"',
  'name="terms" type="checkbox" required','name="privacy" type="checkbox" required','data-show="password"','data-show="repeatPassword"'])
  assert.ok(form.includes(field),field);
 assert.match(form,/<input type="checkbox" disabled><span>Chcę otrzymywać newsletter/);
 assert.match(form,/href="https:\/\/gracz\.pl\/regulamin\/"/);
 assert.match(form,/href="https:\/\/gracz\.pl\/polityka-prywatnosci\/"/);
 for(const provider of ['google','microsoft','discord']){
  assert.match(form,new RegExp('href="/auth/oauth/'+provider+'/start" data-oauth-provider="'+provider+'" aria-disabled="true" tabindex="-1"'));
  assert.match(form,new RegExp('<svg class="oauth-logo '+provider+'-logo"'));
 }
 assert.match(js,/if\(data\.providers\[name\]\)\{link\.removeAttribute\('aria-disabled'\)/,'providers stay gated by real configuration');
 assert.match(js,/api\('register',\{nickname:d\.get\('nickname'\),email:d\.get\('email'\),password:d\.get\('password'\),repeatPassword:d\.get\('repeatPassword'\),terms:d\.get\('terms'\)==='on',privacy:d\.get\('privacy'\)==='on'\}\)/);
});

test('left side uses the approved chip + deck artwork and gold icons on one teal stage',async()=>{
 const cards=html.slice(html.indexOf('<div class="cards" aria-hidden="true">'),html.indexOf('</aside>'));
 assert.match(cards,/<img class="cards-art" src="\/konto\/zeton-talia\.webp" width="1186" height="628" alt=""/);
 const art=serve('/konto/zeton-talia.webp');
 assert.equal(art.headers['Content-Type'],'image/webp');
 assert.deepEqual(art.body,await readFile(new URL('../auth/assets/konto-zeton-talia.webp',import.meta.url)));
 assert.equal(art.body.subarray(12,16).toString(),'VP8X','alpha WebP: sits directly on the stage, no table surface');
 assert.equal((html.match(/<b aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"/g)||[]).length,4,'four filled gold benefit icons');
 assert.equal((form.match(/<span class="field-icon" aria-hidden="true"><svg/g)||[]).length,4,'gold field icons');
 assert.match(rule('body[data-account-view="register"] .benefits b'),/border-radius:50%!important/);
 assert.match(rule('body[data-account-view="register"] .right'),/background:none!important/);
 const register=css.slice(css.indexOf('/* Full Max Premium registration'));
 for(const scenery of ['cardback-premium','szachy.webp','chess-online','owner-layout'])
  assert.equal(register.includes(scenery),false,scenery);
});

test('desktop keeps reference proportions; crown clears the frame; nothing is clipped',()=>{
 assert.match(css,/@media\(min-width:1181px\)\{\n body\[data-account-view="register"\]\{--u:min\(calc\(100vw \/ 1493\),calc\(\(100dvh - 68px\) \/ 772\)\)\}/);
 assert.match(rule('body[data-account-view="register"] .scene'),/grid-template-columns:minmax\(0,1fr\) calc\(595\*var\(--u\)\) calc\(638\*var\(--u\)\) calc\(260\*var\(--u\)\) minmax\(0,1fr\)/);
 const panel=rule('body[data-account-view="register"] .panel');
 assert.match(panel,/overflow:visible!important/);
 assert.match(panel,/align-self:start!important/);
 assert.match(rule('body[data-account-view="register"] .login-crown'),/aspect-ratio:60\/49/);
 assert.match(css,/body\[data-account-view="register"\]\{\n --u:1\.12px;[\s\S]*?overflow-x:hidden\n\}/);
 assert.match(css,/body\[data-account-view="register"\] #register-form\{display:grid!important;grid-template-columns:minmax\(0,1fr\)/);
 for(const query of ['@media(max-width:1180px){','@media(max-width:779px){'])assert.ok(css.includes(query),query);
});
