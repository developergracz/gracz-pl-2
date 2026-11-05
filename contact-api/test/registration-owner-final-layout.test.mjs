import test from 'node:test';
import assert from 'node:assert/strict';
import {serveIdentityPage} from '../auth/page.mjs';

// Owner-approved FINAL registration layout on /konto/: live HTML form, three final
// form changes, vector chip and red-back deck, uniform teal sides, unchanged contracts.
const BASE='https://gracz-contact-api.onrender.com';
const serve=path=>{
 const r={status:0,body:''};
 const res={writeHead(status){r.status=status;},end(body){r.body=String(body||'');}};
 assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,BASE)),true,path);
 assert.equal(r.status,200,path);
 return r.body;
};
const html=serve('/konto/'),css=serve('/konto/styl.css'),js=serve('/konto/app.js');
const form=html.slice(html.indexOf('<form id="register-form"'),html.indexOf('<form id="login-form"'));
const rule=selector=>{
 const at=css.indexOf('\n'+selector+'{'); // top-level rule, not a media-query override
 assert.ok(at>=0,selector);
 return css.slice(at,css.indexOf('}',at));
};

test('A: „Zarejestruj się” keeps gold gradient, user icon and centred label, without arrow',()=>{
 const button=form.match(/<button class="submit register-submit" type="submit">([\s\S]*?)<\/button>/);
 assert.ok(button,'live submit button');
 assert.match(button[1],/<svg class="submit-user"[^>]*aria-hidden="true"/);
 assert.match(button[1],/<span>Zarejestruj się<\/span>$/);
 assert.doesNotMatch(button[1],/→|&rarr;|arrow/i);
 const submit=rule('body[data-account-view="register"] #register-form>.submit');
 assert.match(submit,/justify-content:center/);
 assert.match(submit,/linear-gradient\(180deg,#ffe8a2,#ffca57 55%,#e5a328\)/);
 assert.match(css,/#register-form>\.submit::after\{content:"";flex:0 0 \.95em\}/,'icon balanced so the label stays centred');
});

test('B: „Zapomniałem hasła?” is a small glowing gold/teal Premium button that opens recovery',()=>{
 assert.match(form,/<button type="button" class="register-forgot" data-view="forgot"><svg class="forgot-key"[^>]*aria-hidden="true"[\s\S]*?<\/svg><span>Zapomniałem hasła\?<\/span><\/button>/);
 const button=rule('body[data-account-view="register"] .register-forgot');
 assert.match(button,/border:1px solid #e8bb5e/);
 assert.match(button,/background:linear-gradient\(180deg,#0a4d4b 0%,#033437 52%,#012a2e 100%\)/);
 assert.match(button,/box-shadow:[^;]*0 0 12px rgba\(255,190,80,\.3\)/);
 assert.match(css,/\.register-forgot:hover::before,\nbody\[data-account-view="register"\] \.register-forgot:focus-visible::before\{transform:translateX\(115%\)\}/);
 assert.match(js,/document\.querySelectorAll\('\[data-view\]'\)\.forEach/);
 assert.match(html,/<form id="forgot-form" hidden novalidate>/);
});

test('C: „Masz już konto? Zaloguj się” is centred with italic gold question, turquoise link and twin ornaments',()=>{
 const sw=form.match(/<p class="switch register-switch">([\s\S]*?)<\/p><\/form>\s*$/);
 assert.ok(sw,'switch line closes the registration form');
 assert.equal((sw[1].match(/class="switch-ornament/g)||[]).length,2);
 assert.match(sw[1],/<span class="switch-question">Masz już konto\?<\/span> <a class="switch-login" href="\/konto\/\?widok=login" data-view="login">Zaloguj się<\/a>/);
 assert.match(rule('body[data-account-view="register"] .register-switch'),/justify-content:center/);
 assert.match(rule('body[data-account-view="register"] .switch-question'),/font:italic 600 [^;]*Georgia/);
 assert.match(rule('body[data-account-view="register"] .switch-question'),/color:#f5cd78/);
 assert.match(rule('body[data-account-view="register"] .switch-login'),/color:#5eefe0/);
 assert.match(css,/\.switch-ornament--end\{transform:scaleX\(-1\)\}/);
 assert.match(js,/if\(button\.tagName==='A'\)event\.preventDefault\(\)/);
});

test('all existing registration fields, consents, providers and links stay wired',()=>{
 for(const field of ['name="nickname"','name="email"','name="password"','name="repeatPassword"',
  'name="terms" type="checkbox" required','name="privacy" type="checkbox" required','data-show="password"','data-show="repeatPassword"'])
  assert.ok(form.includes(field),field);
 assert.match(form,/<input type="checkbox" disabled><span>Chcę otrzymywać newsletter/);
 assert.match(form,/href="https:\/\/gracz\.pl\/regulamin\/"/);
 assert.match(form,/href="https:\/\/gracz\.pl\/polityka-prywatnosci\/"/);
 for(const provider of ['google','microsoft','discord'])
  assert.match(form,new RegExp('href="/auth/oauth/'+provider+'/start" data-oauth-provider="'+provider+'" aria-disabled="true"'));
 assert.match(js,/api\('register',\{nickname:d\.get\('nickname'\),email:d\.get\('email'\),password:d\.get\('password'\),repeatPassword:d\.get\('repeatPassword'\),terms:d\.get\('terms'\)==='on',privacy:d\.get\('privacy'\)==='on'\}\)/);
});

test('left side shows a sharp vector gracz.pl chip and red-back deck on uniform teal, right side is plain',()=>{
 const cards=html.slice(html.indexOf('<div class="cards" aria-hidden="true">'),html.indexOf('</aside>'));
 assert.match(cards,/<svg class="card-deck" viewBox="0 0 196 262"/);
 assert.match(cards,/<svg class="card-chip" viewBox="0 0 172 184"/);
 assert.equal((cards.match(/>gracz<tspan fill="#ff2b45">\.pl<\/tspan><\/text>/g)||[]).length,2,'original logo on chip and deck');
 assert.match(cards,/fill="#b10f1f"/,'red card back');
 assert.match(rule('body[data-account-view="register"] .card-chip'),/transform:rotate\(-14deg\)/);
 assert.match(rule('body[data-account-view="register"] .left'),/background:var\(--reg-teal\)!important/);
 assert.match(rule('body[data-account-view="register"] .right'),/background:var\(--reg-teal-green\)!important/);
 const register=css.slice(css.indexOf('/* Full Max Premium registration'));
 for(const scenery of ['cardback-premium','szachy.webp','chess-online','owner-layout'])
  assert.equal(register.includes(scenery),false,scenery);
 assert.equal(html.includes('🏆'),false,'benefit icons are vector line icons');
});

test('crown clears the frame and layout never clips: vertical scroll, no horizontal scroll',()=>{
 const panel=rule('body[data-account-view="register"] .panel');
 assert.match(panel,/overflow:visible!important/);
 assert.match(panel,/padding:calc\(clamp\(16px,2\.6dvh,30px\) \+ max\(0px,\(100dvh - 1024px\) \/ 2\)\)/);
 assert.match(panel,/justify-content:flex-start/);
 assert.match(rule('body[data-account-view="register"] .login-crown'),/aspect-ratio:60\/49/);
 assert.match(css,/body\[data-account-view="register"\]\{\n --reg-teal:[^}]*overflow-x:hidden\n\}/);
 assert.match(css,/body\[data-account-view="register"\] #register-form\{display:grid!important;grid-template-columns:minmax\(0,1fr\)/);
 for(const query of ['@media(max-width:1180px){','@media(max-width:779px){','@media(min-width:1181px) and (max-height:880px){'])
  assert.ok(css.includes(query),query);
});
