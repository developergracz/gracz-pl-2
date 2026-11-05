import test from 'node:test';
import assert from 'node:assert/strict';
import {serveIdentityPage} from '../auth/page.mjs';
import {createOAuthRegistrationRouter} from '../auth/oauth-registration.mjs';

const BASE='https://gracz-contact-api.onrender.com';
const serve=path=>{
 const r={status:0,headers:{},body:''};
 const res={writeHead(status,headers){r.status=status;r.headers=headers||{};},end(body){r.body=String(body||'');}};
 assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,BASE)),true);
 assert.equal(r.status,200);
 return r.body;
};
test('approved premium registration renders live fields, branding and provider controls',()=>{
 const html=serve('/konto/'),css=serve('/konto/styl.css'),script=serve('/konto/app.js');
 for(const id of ['nickname','email','password','repeatPassword','register-form']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const provider of ['google','microsoft','discord']){
  assert.match(html,new RegExp('data-oauth-provider="'+provider+'"'));
  assert.match(html,new RegExp('/auth/oauth/'+provider+'/start'));
 }
 assert.match(html,/Załóż konto w /);
 assert.match(html,/Zapomniałem hasła/);
 assert.match(css,/Full Max Premium registration/);
 assert.match(css,/body\[data-account-view="register"\]/);
 assert.match(css,/\.login-crown/);
 assert.match(script,/auth\/oauth\/providers/);
 assert.match(script,/oauth_error/);
 assert.match(html,/name="terms" type="checkbox" required/);
 assert.match(html,/name="privacy" type="checkbox" required/);
});
test('OAuth start fails safely when no provider credentials are configured',async()=>{
 // No credentials should be supplied in CI. When they are, this test still
 // verifies that configuration status is boolean and does not leak secrets.
 const db={enabled:true,async query(){return {rows:[]};}};
 const oauth=createOAuthRegistrationRouter({database:db,ready:async()=>{}});
 const request={method:'GET',headers:{cookie:''},socket:{remoteAddress:'127.0.0.1'}};
 let code=0,headers={},body='';
 const response={writeHead(s,h){code=s;headers=h||{};},end(data){body=String(data||'');}};
 assert.equal(await oauth.handle(request,response,new URL('/auth/oauth/providers',BASE)),true);
 assert.equal(code,200);
 const result=JSON.parse(body);
 assert.deepEqual(Object.keys(result.providers).sort(),['discord','google','microsoft']);
 assert.ok(Object.values(result.providers).every(v=>typeof v==='boolean'));
 assert.doesNotMatch(body,/secret|clientId|token/i);
 const blocked=Object.entries(result.providers).find(([,value])=>!value);
 if(blocked){
  assert.equal(await oauth.handle(request,response,new URL('/auth/oauth/'+blocked[0]+'/start',BASE)),true);
  assert.equal(code,303);
  assert.match(headers.Location,/oauth_error=not-configured/);
  assert.match(headers['Set-Cookie'][0],/SameSite=Lax/);
 }
});
test('OAuth endpoints have distinct origin, provider and callback and do not accept POST',async()=>{
 const db={enabled:true,async query(){return {rows:[]};}};
 const oauth=createOAuthRegistrationRouter({database:db,ready:async()=>{}});
 const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'}};
 const response={writeHead(s){assert.equal(s,405);},end(){}};
 assert.equal(await oauth.handle(req,response,new URL('/auth/oauth/google/callback',BASE)),true);
 assert.equal(await oauth.handle(req,response,new URL('/auth/oauth/google/start',BASE)),true);
 assert.equal(await oauth.handle(req,response,new URL('/auth/oauth/not-a-provider/start',BASE)),false);
});

test('login query pre-renders the LOGIN form before session API can respond',()=>{
 const loginHtml=serve('/konto/?widok=login');
 assert.match(loginHtml,/<body class="auth-login-mode" data-account-view="login">/);
 assert.match(loginHtml,/<form id="register-form" autocomplete="on" novalidate hidden>/);
 assert.match(loginHtml,/<form id="login-form" novalidate>/);
 assert.match(loginHtml,/Zaloguj się do <span class="form-logo">/);
 const registerHtml=serve('/konto/');
 assert.match(registerHtml,/<body data-account-view="register">/);
 assert.match(registerHtml,/<form id="login-form" hidden novalidate>/);
});
test('login navigation stays in URL and initial view is applied before asynchronous session fetch',()=>{
 const script=serve('/konto/app.js');
 const css=serve('/konto/styl.css');
 assert.match(script,/history\.replaceState\(null,'',requested==='login'\?'\/konto\/\?widok=login':'\/konto\/'\)/);
 assert.match(script,/window\.scrollTo\(0,0\)/);
 const position=script.indexOf("view(qp.get('widok')==='login'?'login':'register');");
 const session=script.lastIndexOf("try{const s=await api('session')");
 assert.ok(position>=0&&session>position,'requested view must precede session request');
 assert.match(css,/Owner screenshot R5/);
 assert.match(css,/body\[data-account-view="register"\] \.right::after\{content:none!important\}/);
});
