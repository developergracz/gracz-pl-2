import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer,request as httpRequest} from 'node:http';
import {randomBytes,createCipheriv,createHmac,randomUUID} from 'node:crypto';
import {createDatabase} from '../../persistence/database.mjs';
import {createOwnerAuth,codeAt,encodeTotp,newVerifier,parseOwnerCookie} from '../owner-auth.mjs';
import {createOwnerRouter} from '../owner-router.mjs';
import {createNewOnlyTrendDetail} from '../trend-detail.mjs';
import {createNewOnlyAdminReader} from '../new-only-reader.mjs';
import {createOwnerRecoveryMailer} from '../owner-recovery-mailer.mjs';
const url=process.env.OWNER_TEST_DATABASE_URL;
if(!url)throw Error('Disposable OWNER_TEST_DATABASE_URL required');
const db=createDatabase({connectionString:url});
const secret=Buffer.from('12345678901234567890');
const totpBase32=encodeTotp(secret);
const enc=Buffer.alloc(32,11),subject=Buffer.alloc(32,22);
const password='a-temporary-long-synthetic-password';
test('OWNER premium sent confirmation names one recipient and never claims delivery',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../ui/admin.css',import.meta.url),'utf8');
  assert.match(html,/<dialog id="targeted-success-dialog" aria-labelledby="targeted-success-title" aria-describedby="targeted-success-description">/);
  assert.match(html,/id="targeted-success-close" autofocus>Zrozumiałem<\/button>/);
  assert.match(js,/selectedRecipientEmails=items\.map\(x=>x\.email\)/);
  assert.match(js,/result\?\.state==="finished"&&Number\.isSafeInteger\(accepted\)&&accepted>0/);
  assert.match(js,/selectedRecipientEmails\.length===1&&accepted===1&&suppressed===0/);
  assert.match(js,/"Wiadomość została wysłana na adres "\+selectedRecipientEmails\[0\]/);
  assert.match(js,/targetedDialog\.close\(\);\s*targetedSuccessDialog\.showModal\(\)/);
  assert.match(js,/targetedSuccessDialog\.close\(\)/);
  assert.match(js,/To nie jest jeszcze potwierdzenie jej doręczenia/);
  assert.match(js,/Żadna wiadomość nie została przyjęta do wysyłki/);
  assert.match(js,/Wynik niepewny\. Nie ponawiaj wysyłki/);
  assert.match(css,/#targeted-success-dialog\{[^}]*position:fixed;inset:0;margin:auto/s);
  assert.match(css,/#targeted-success-dialog::backdrop/);
});

test('OWNER one-click Premium send preserves recipient consent and durable dispatch guards',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  const ui=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../ui/admin.css',import.meta.url),'utf8');
  const router=await readFile(new URL('../owner-router.mjs',import.meta.url),'utf8');
  const sender=await readFile(new URL('../../campaigns/owner-send.mjs',import.meta.url),'utf8');
  for(const id of ['date-from','date-to','last-month','send-found','targeted-dialog',
    'targeted-subject','targeted-body','targeted-send','targeted-compose-close'])
    assert.ok(html.includes('id="'+id+'"'),'missing '+id);
  assert.match(html,/<button type="submit" id="targeted-send"><span aria-hidden="true">➤<\/span> Wyślij wiadomość<\/button>/);
  assert.match(html,/role="toolbar" aria-label="Formatowanie treści wiadomości"/);
  assert.match(html,/data-targeted-format="bold"/);
  assert.match(html,/id="targeted-preview-body"/);
  assert.match(html,/id="targeted-attachment"/);
  assert.match(html,/id="targeted-attachment-remove"/);
  assert.match(html,/Skan antywirusowy: niedostępny/);
  assert.match(ui,/if\(targetedAttachment.files\?\.length\)\{/);
  assert.match(ui,/nie jest skonfigurowany; wysyłka z załącznikiem jest zablokowana/);
  assert.match(css,/#targeted-dialog \.targeted-preview-heading/);
  assert.match(css,/#targeted-dialog \.targeted-editor:focus-within\{/);
  assert.match(ui,/campaignRenderPreview\(targetedBody.value,\$\("targeted-preview-body"\)\)/);
  assert.match(sender,/markdown:targeted/);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions button\{flex:0 0 auto!important;width:auto!important/);
  assert.doesNotMatch(html,/id="targeted-approval"|id="targeted-confirmation"|id="targeted-final"/);
  assert.match(ui,/send\.textContent="Wyślij wiadomość"/);
  assert.match(ui,/send\.disabled=!targetedReady\|\|item\.state!=="active"/);
  assert.match(ui,/targetedReady=data\.targetedSendEnabled===true/);
  assert.match(ui,/if\(targetedBusy\|\|targetedStarted\|\|!targetedReady\|\|!selectedHandles\.length\)return/);
  assert.match(ui,/targetedStarted=true/);
  assert.match(ui,/targetedDialog\.addEventListener\("cancel",event=>\{/);
  const submit=ui.slice(ui.indexOf('$("targeted-compose").addEventListener("submit",async event=>{'),
                        ui.indexOf('$("last-month").addEventListener("click"'));
  assert.ok(submit.includes('reportValidity()'));
  assert.ok(submit.includes('campaign-targeted/save'));
  assert.ok(submit.includes('campaign-drafts/approve'));
  assert.ok(submit.includes('campaign-targeted/send'));
  assert.ok(submit.indexOf('campaign-targeted/save')<submit.indexOf('campaign-drafts/approve'));
  assert.ok(submit.indexOf('campaign-drafts/approve')<submit.indexOf('campaign-targeted/send'));
  assert.match(ui,/confirmation:"ZATWIERDZAM TREŚĆ"/);
  assert.match(ui,/confirmation:"WYSYŁAM DO WYBRANYCH"/);
  assert.match(router,/resolveTargetHandles\(data\.handles\)/);
  assert.match(router,/auth\.checkCsrf\(session,req\.headers\['x-owner-csrf'\]\)/);
  assert.match(sender,/if\(!targeted\)throw deny\(\)/);
  assert.match(css,/#targeted-dialog\{box-sizing:border-box;position:fixed;inset:0;margin:auto/);
  assert.match(css,/max-height:calc\(100dvh - 24px\)/);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions\{grid-area:actions;/);
  // The modal itself never scrolls the send/close controls out of sight.
  assert.match(html,/<form id="targeted-compose">\s*<div class="targeted-compose-fields">/);
  assert.match(html,/<\/div>\s*<div class="targeted-compose-actions">\s*<p id="targeted-status" role="status" aria-live="polite"><\/p>\s*<button type="submit" id="targeted-send">/);
  assert.doesNotMatch(html,/<\/form>\s*<p id="targeted-status"/);
  assert.match(css,/#targeted-dialog #targeted-status:empty\{display:none;\}/);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions\{[^}]*margin-top:4px;[^}]*padding:7px 0 1px;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions button\{[^}]*height:42px;[^}]*min-height:42px;/s);
  assert.match(css,/#targeted-dialog \.targeted-attachments\{[^}]*padding:7px 8px;[^}]*gap:5px;/s);
  assert.match(css,/#targeted-dialog \.targeted-editor #targeted-body\{[^}]*min-height:205px;/s);
  assert.match(css,/#targeted-dialog\[open\]\{[^}]*height:min\(860px,calc\(100dvh - 24px\)\);[^}]*overflow:hidden;/s);
  assert.match(css,/#targeted-dialog #targeted-compose\{[^}]*display:flex;[^}]*overflow:hidden;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-fields\{[^}]*overflow-y:auto;/s);
  assert.match(css,/#targeted-dialog \.targeted-editor #targeted-body\{[^}]*display:block;[^}]*height:clamp\(205px,25dvh,250px\);[^}]*min-height:205px;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-fields\{[^}]*grid-template-rows:repeat\(5,max-content\);/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-fields \.targeted-editor\{[^}]*height:max-content;[^}]*min-height:290px;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-fields \.targeted-preview\{[^}]*height:auto;[^}]*min-height:290px;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-fields\{[^}]*grid-template-rows:repeat\(6,max-content\);/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions\{[^}]*flex:0 0 auto;/s);
  assert.match(css,/#targeted-dialog \.targeted-compose-actions\{[^}]*flex:0 0 auto;[^}]*border-top:/s);
  assert.match(css,/#targeted-dialog #targeted-send\{[^}]*background:linear-gradient\(115deg,/s);
  assert.match(css,/#targeted-dialog #targeted-compose-close\{[^}]*background:linear-gradient\(135deg,/s);
  assert.match(css,/@media\(max-width:650px\)\{\s*#targeted-dialog\[open\]/);
  assert.match(css,/"body-label preview"\s+"body preview"\s+"actions actions"/);
  assert.match(css,/@media\(max-height:760px\)/);
  assert.match(css,/@media\(max-width:650px\)/);
});

test('OWNER single-test confirmation uses centred premium dialog and cancels without sending',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  const css=await readFile(new URL('../ui/admin.css',import.meta.url),'utf8');
  const js=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  assert.match(html,/<dialog id="campaign-test-dialog" aria-labelledby="campaign-test-title" aria-describedby="campaign-test-description">/);
  assert.match(html,/<form method="dialog" class="campaign-test-dialog-actions">/);
  assert.match(html,/<button type="submit" value="cancel" autofocus>Anuluj<\/button>/);
  assert.match(html,/<button type="submit" value="confirm">Wyślij jeden test<\/button>/);
  assert.match(html,/Ta czynność nie wysyła wiadomości do subskrybentów/);
  assert.match(css,/#campaign-test-dialog\{[^}]*position:fixed;inset:0;margin:auto/s);
  assert.match(css,/#campaign-test-dialog::backdrop/);
  assert.match(js,/campaignTestDialog\.returnValue="cancel"/);
  assert.match(js,/campaignTestDialog\.showModal\(\)/);
  assert.match(js,/campaignTestDialog\.returnValue==="confirm"/);
  assert.match(js,/if\(!await confirmCampaignTestSend\(\)\)return;/);
  assert.doesNotMatch(js,/window\.confirm\(/);
  const clickHandler=js.slice(js.indexOf('campaignTestButton?.addEventListener("click"'),
                               js.indexOf('draftRefreshButton?.addEventListener("click"'));
  assert.ok(clickHandler.indexOf('if(!await confirmCampaignTestSend())return;')<
            clickHandler.indexOf('fetch("/owner/newsletter/campaign-tests/send"'),
            'do not send without explicit modal confirmation');
});

test('OWNER copyright notice has legal scope, full dialog, sticky navigation and close controls',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  const css=await readFile(new URL('../ui/admin.css',import.meta.url),'utf8');
  const js=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  assert.match(html,/Wszystkie prawa zastrzeżone/);
  assert.match(html,/<button id="rights-open"[^>]+>Zobacz szczegóły<\/button>/);
  assert.match(html,/<dialog id="rights-dialog"[^>]+aria-labelledby="rights-title"/);
  assert.match(html,/<button id="rights-understood" type="button">Zrozumiałem<\/button>/);
  assert.match(html,/https:\/\/eli.gov.pl\/eli\/DU\/1994\/83\/ogl/);
  assert.match(html,/dozwolonego użytku osobistego/);
  assert.match(html,/Prawa do elementów dostarczonych przez użytkowników/);
  const targets=[...html.matchAll(/data-rights-target="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(targets.length,8);
  assert.equal(new Set(targets).size,8,'Do not duplicate menu items');
  for(const id of targets){
    assert.ok(html.includes('<section id="'+id+'"'),'Missing legal section '+id);
  }
  assert.match(css,/#rights-dialog \.rights-copy\{[^}]*overflow-y:auto/s);
  assert.match(css,/#rights-dialog \.rights-nav\{[^}]*position:sticky/s);
  assert.match(js,/rightsDialog\.showModal\(\)/);
  assert.match(js,/\$\("rights-understood"\)\.addEventListener\("click",closeRights\)/);
  assert.match(js,/rightsCopy\.scrollTo\(/);
});

test('premium campaign editor formats draft text without expanding send permissions',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../ui/admin.css',import.meta.url),'utf8');
  const buttons=[...html.matchAll(/data-campaign-format="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(buttons,[
    'bold','italic','underline','strike','code','bullet',
    'number','quote','link','rule','undo','redo'
  ]);
  assert.match(html,/id="campaign-style"/);
  assert.match(html,/id="campaign-body-count"/);
  assert.match(html,/id="campaign-subject-count"/);
  assert.match(html,/<div id="campaign-preview-body"/);
  assert.match(html,/Wysyłka wiadomości HTML wymaga oddzielnego wdrożenia/);
  assert.match(js,/campaignBody\.setRangeText\(/);
  assert.match(js,/campaignBody\.dispatchEvent\(new Event\("input"/);
  assert.match(js,/campaignRenderPreview\(draft\.body\)/);
  assert.match(js,/campaignRenderPreview\(body\)/);
  assert.match(js,/output\.replaceChildren\(\)/);
  assert.match(js,/parent\.append\(document\.createTextNode\(/);
  assert.match(js,/url\.protocol==="https:"/);
  assert.doesNotMatch(js,/campaign-preview-body"\)\.innerHTML\s*=/);
  assert.match(css,/\.campaign-editor-toolbar/);
  // Rendering and editing must not alter POST payload, delivery or server gates.
  assert.match(js,/body:\$\("campaign-body"\)\.value\.trim\(\)/);
  assert.match(js,/campaignSendReady=false/);
});

test('RFC6238 TOTP, high-entropy verifier and absent auth configuration fail closed',async()=>{
  assert.equal(codeAt(secret,1),'287082');
  assert.equal(totpBase32.length,32);
  assert.equal(parseOwnerCookie('__Host-gracz_owner=not-a-token'),null);
  const s=await newVerifier(password);
  assert.match(s,/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/);
  await assert.rejects(newVerifier('12345678'),/9\.\.128/);
  assert.equal(createOwnerAuth({database:db,passwordSpec:'plaintext',totpBase32}),null);
  const disabled=createOwnerRouter({database:db,enabled:false});
  assert.equal(disabled.configured,false);
});

test('M5 form requires 9 characters and allows an existing 9-character password',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  assert.match(html,/Nowe hasło \(minimum 9 znaków\)/);
  for(const id of ['owner-old-password','owner-new-password','owner-repeat-password','owner-nick-password']){
    const tag=html.match(new RegExp('<input\\s+id="'+id+'"[^>]*>'))?.[0];
    assert.ok(tag,'Missing password field '+id);
    assert.match(tag,/minlength="9"/);
  }
});

test('OWNER session: password, one-use TOTP, lockout, durable token, idle expiration, logout',async()=>{
  const verifier=await newVerifier(password);
  let now=Date.now(); // Relative session tests must not precede PostgreSQL wall-clock creation.
  const auth=createOwnerAuth({database:db,passwordSpec:verifier,totpBase32,now:()=>now});
  assert.ok(auth);
  assert.equal(await auth.login({password:'incorrect-password',code:codeAt(secret,Math.floor(now/30000))}),null);
  const good=await auth.login({password,code:codeAt(secret,Math.floor(now/30000))});
  assert.ok(good);
  assert.equal(good.token.length,43);
  assert.equal(good.csrf.length,43);
  assert.equal(await auth.login({password,code:codeAt(secret,Math.floor(now/30000))}),null);
  let session=await auth.session(good.token);
  assert.ok(session);
  assert.equal(session.csrf,good.csrf);
  const rotatedAuth=createOwnerAuth({database:db,passwordSpec:verifier,
    totpBase32:encodeTotp(Buffer.alloc(20,7)),now:()=>now});
  assert.equal(await rotatedAuth.session(good.token),null,
    'changing the authenticator must revoke older credentials');
  assert.equal(auth.checkCsrf(session,'wrong'),false);
  assert.equal(auth.checkCsrf(session,good.csrf),true);
  const dbRows=await db.query('SELECT token_hash FROM newsletter_owner.sessions');
  assert.equal(dbRows.rows.length,1);
  assert.notEqual(dbRows.rows[0].token_hash,good.token);
  now+=16*60*1000;
  assert.equal(await auth.session(good.token),null,'idle timeout must deny');
  await auth.logout(good.token);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_owner.sessions')).rows[0].n,0);

  for(let i=0;i<5;i++){
    now+=30000;
    assert.equal(await auth.login({password:'invalid',code:codeAt(secret,Math.floor(now/30000))}),null);
  }
  assert.equal(await auth.login({password,code:codeAt(secret,Math.floor(now/30000))}),null);
  now+=16*60*1000;
  assert.ok(await auth.login({password,code:codeAt(secret,Math.floor(now/30000))}));
  assert.ok((await db.query('SELECT count(*)::int AS n FROM newsletter_owner.audit')).rows[0].n>=7);
});

test('OWNER login uses compact Premium field warnings and one aligned action row',async()=>{
  const [router,login,css]=await Promise.all([
    readFile(new URL('../owner-router.mjs',import.meta.url),'utf8'),
    readFile(new URL('../ui/login.js',import.meta.url),'utf8'),
    readFile(new URL('../ui/admin.css',import.meta.url),'utf8')
  ]);
  assert.match(router,/minlength="3" maxlength="32" required>/);
  assert.match(router,/id="login-nick-validation"[^>]+role="alert" hidden/);
  assert.match(router,/id="login-password-validation"[^>]+role="alert" hidden/);
  assert.match(router,/id="login-password-validation-message"/);
  assert.match(router,/<div class="owner-login-actions">/);
  assert.match(router,/<button id="login-button" type="submit">Zaloguj się<\/button>/);
  assert.match(router,/passwordOnly&&recoveryReady\?'<button id="forgot-open" type="button">Zapomniałem hasła\?<\/button>'/);
  assert.match(router,/passwordOnly&&recoveryReady\?`<dialog id="forgot-dialog"/);
  assert.match(login,/nickname\.addEventListener\('invalid',event=>\{\s*event\.preventDefault\(\)/);
  assert.match(login,/nickNotice\.hidden=false/);
  assert.match(login,/nickname\.addEventListener\('input'/);
  assert.match(login,/if\(nickname\.validity\.valid\)hideNotice\(\)/);
  assert.match(login,/Wydłuż ten tekst do co najmniej 3 znaków/);
  assert.match(login,/passwordInput\.addEventListener\('invalid',event=>\{\s*event\.preventDefault\(\)/);
  assert.match(login,/passwordNotice\.hidden=false/);
  assert.match(login,/Wpisz hasło\./);
  assert.match(login,/if\(passwordInput\.validity\.valid\)hidePasswordNotice\(\)/);
  assert.match(css,/width:max-content;max-width:100%/);
  assert.match(css,/#login-nick-validation\[hidden\],[\s\S]*?#login-password-validation\[hidden\]\{display:none;\}/);
  assert.match(css,/#login-form \.owner-login-actions\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/#login-form #login-button\{/);
  assert.match(css,/#login-form #forgot-open\{/);
});

test('phone-free OWNER login requires valid nick, locks out guessing and rotates session',async(t)=>{
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  await db.query('DELETE FROM newsletter_owner.sessions');
  const verifier=await newVerifier(password);
  const options={database:db,passwordSpec:verifier,passwordOnly:true};
  assert.equal(createOwnerAuth({...options}),null,'missing nickname must deny');
  assert.equal(createOwnerAuth({...options,username:'<bad>'}),null,'invalid nickname must deny');
  assert.equal(createOwnerRouter({
    ...options,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url')
  }).configured,false,'bad configuration cannot expose the panel');
  const nick='owner_2026';
  const auth=createOwnerAuth({...options,username:nick});
  assert.ok(auth,'valid nickname and verifier must configure auth');
  assert.equal(await auth.login({username:'unknown',password}),null);
  const good=await auth.login({username:nick,password});
  assert.ok(good,'correct nickname and password should work without phone');
  assert.ok(await auth.session(good.token));
  assert.equal(await createOwnerAuth({database:db,passwordSpec:verifier,totpBase32}).session(good.token),null,
    'phone-free sessions must never validate in TOTP mode');
  assert.equal(await createOwnerAuth({...options,username:'other_owner'}).session(good.token),null,
    'nickname change invalidates sessions');
  assert.equal(await createOwnerAuth({
    ...options,username:nick,passwordSpec:await newVerifier(password)
  }).session(good.token),null,'password verifier rotation invalidates sessions');
  await auth.logout(good.token);
  for(let i=0;i<5;i++){
    assert.equal(await auth.login({username:'unknown',password}),null);
  }
  assert.equal(await auth.login({username:nick,password}),null,'durable lockout applies');
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  const router=createOwnerRouter({
    ...options,username:nick,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url')
  });
  assert.equal(router.configured,true);
  const srv=createServer((req,res)=>router.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  try {
    const loginPage=await new Promise((resolve,reject)=>{
      const req=httpRequest({
        hostname:'127.0.0.1',port:srv.address().port,path:'/owner/newsletter/login',
        headers:{host:'gracz-contact-api.onrender.com','x-forwarded-proto':'https'}
      },res=>{
        let body='';
        res.on('data',chunk=>{body+=chunk;});
        res.on('end',()=>resolve({status:res.statusCode,body}));
        res.on('error',reject);
      });
      req.on('error',reject);req.end();
    });
    assert.equal(loginPage.status,200);
    assert.match(loginPage.body,/id="username"/);
    assert.match(loginPage.body,/<input id="password"[^>]*minlength="9"/);
    assert.doesNotMatch(loginPage.body,/id="code"/);
    assert.doesNotMatch(loginPage.body,/id="forgot-open"/,
      'Recovery is not visible before the dedicated schema and feature flag are enabled');
    // A ChatGPT-added attribution must not lock the OWNER out of the entry
    // page. Redirect without cookies or credentials; keep private APIs strict.
    const probe=(path,method='GET',headers={})=>new Promise((resolve,reject)=>{
      const req=httpRequest({
        hostname:'127.0.0.1',port:srv.address().port,path,method,
        headers:{host:'gracz-contact-api.onrender.com','x-forwarded-proto':'https',...headers}
      },res=>{
        res.resume();
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));
        res.on('error',reject);
      });
      req.on('error',reject);req.end();
    });
    const redirected=await probe('/owner/newsletter/?utm_source=chatgpt.com');
    assert.equal(redirected.status,302);
    assert.equal(redirected.headers.location,'/owner/newsletter/');
    assert.equal(redirected.headers['cache-control'],'no-store');
    assert.equal(redirected.headers['set-cookie'],undefined);
    const loginRedirect=await probe('/owner/newsletter/login?utm_source=chatgpt.com');
    assert.equal(loginRedirect.status,302);
    assert.equal(loginRedirect.headers.location,'/owner/newsletter/login');
    assert.equal(loginRedirect.headers['set-cookie'],undefined);
    assert.equal(loginRedirect.headers['cache-control'],'no-store');
    const seoRedirect=await probe('/owner/newsletter/seo?utm_source=chatgpt.com');
    assert.equal(seoRedirect.status,302);
    assert.equal(seoRedirect.headers.location,'/owner/newsletter/seo');
    assert.equal(seoRedirect.headers['cache-control'],'no-store');
    assert.equal(seoRedirect.headers['set-cookie'],undefined);
    const seoUnauthenticated=await probe('/owner/newsletter/seo');
    assert.equal(seoUnauthenticated.status,302);
    assert.equal(seoUnauthenticated.headers.location,'/owner/newsletter/login');
    assert.equal((await probe('/owner/newsletter/seo?utm_source=unknown')).status,403);
    assert.equal((await probe('/owner/newsletter/seo?utm_source=chatgpt.com','POST')).status,403);
    assert.equal((await probe('/owner/newsletter/seo/status?utm_source=chatgpt.com')).status,403);
    assert.equal((await probe('/owner/newsletter/login?utm_source=unknown')).status,403);
    assert.equal((await probe('/owner/newsletter/login?utm_source=chatgpt.com','POST')).status,403);
    const hubTracking=await probe('/owner/newsletter/systemadmin?utm_source=chatgpt.com');
    assert.equal(hubTracking.status,302);
    assert.equal(hubTracking.headers.location,'/owner/newsletter/systemadmin');
    assert.equal(hubTracking.headers['set-cookie'],undefined);
    const anonymousHub=await probe('/owner/newsletter/systemadmin');
    assert.equal(anonymousHub.status,302);
    assert.equal(anonymousHub.headers.location,'/owner/newsletter/login/systemadmin');
    const anonymousHubLogin=await probe('/owner/newsletter/login/systemadmin');
    assert.equal(anonymousHubLogin.status,200);
    assert.equal((await probe('/owner/newsletter/systemadmin.css')).status,401);
    assert.equal((await probe('/owner/newsletter/systemadmin?utm_source=other')).status,403);
    assert.equal((await probe('/owner/newsletter/systemadmin?utm_source=chatgpt.com','POST')).status,403);
    const anonymous=await probe('/owner/newsletter/');
    assert.equal(anonymous.status,302);
    assert.equal(anonymous.headers.location,'/owner/newsletter/login');
    assert.equal(anonymous.headers['set-cookie'],undefined,
      'anonymous entry cannot create a session');
    const expired=await probe('/owner/newsletter/','GET',{
      cookie:'__Host-gracz_owner='+Buffer.alloc(32,99).toString('base64url')
    });
    assert.equal(expired.status,302);
    assert.equal(expired.headers.location,'/owner/newsletter/login');
    assert.match(expired.headers['set-cookie']?.[0]||'',/Max-Age=0/,
      'invalid OWNER session must be cleared');
    assert.equal((await probe('/owner/newsletter/session')).status,401,
      'private JSON endpoints must continue denying unauthenticated clients');
    assert.equal((await probe('/owner/newsletter/?utm_source=untrusted')).status,403);
    assert.equal((await probe('/owner/newsletter/session?utm_source=chatgpt.com')).status,403);
    assert.equal((await probe('/owner/newsletter/?utm_source=chatgpt.com','POST')).status,403);
  } finally {await new Promise(resolve=>srv.close(resolve));}
});


test('M5 account settings: password and nickname rotation survive auth recreation',async()=>{
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  await db.query('DELETE FROM newsletter_owner.sessions');
  await db.query('DELETE FROM newsletter_owner.credentials');
  const verifier=await newVerifier(password);
  const config={database:db,passwordSpec:verifier,passwordOnly:true,username:'graczowner'};
  const auth=createOwnerAuth(config);
  const first=await auth.login({username:'graczowner',password});
  assert.ok(first);
  const info=await auth.settings(first.token);
  assert.equal(info.username,'graczowner');
  assert.match(info.lastLoginAt,/^\d{4}-/);
  assert.equal(await auth.changeCredentials(first.token,{
    oldPassword:'not-the-correct-password',newPassword:'a-new-secure-owner-password-2026'
  }),false);
  assert.equal(await auth.changeCredentials(first.token,{
    oldPassword:password,username:'bad name!'
  }),false);
  assert.equal(await auth.changeCredentials(first.token,{
    oldPassword:password,username:'newowner'
  }),true);
  assert.equal(await auth.session(first.token),null,'all prior sessions revoked on nickname rotation');
  const restarted=createOwnerAuth(config);
  assert.equal(await restarted.login({username:'graczowner',password}),null,
    'environment nickname is no longer valid after durable change');
  const second=await restarted.login({username:'newowner',password});
  assert.ok(second);
  // Boundary regression: 8 characters rejected, exactly 9 accepted.
  const updatedPassword='NineChar9';
  assert.equal(updatedPassword.length,9);
  assert.equal(await restarted.changeCredentials(second.token,{
    oldPassword:password,newPassword:'Eight888'
  }),false,'new password shorter than nine characters rejected');
  assert.equal(await restarted.changeCredentials(second.token,{
    oldPassword:password,newPassword:password
  }),false,'unchanged password rejected');
  assert.equal(await restarted.changeCredentials(second.token,{
    oldPassword:password,newPassword:updatedPassword
  }),true);
  assert.equal(await restarted.session(second.token),null,'password rotation revokes session');
  const final=createOwnerAuth(config);
  assert.equal(await final.login({username:'newowner',password}),null);
  const third=await final.login({username:'newowner',password:updatedPassword});
  assert.ok(third,'durable password works with a new OWNER auth instance');
  assert.equal((await final.settings(third.token)).username,'newowner');
  assert.ok((await db.query(
    "SELECT count(*)::int AS n FROM newsletter_owner.audit WHERE action='credentials_changed'"
  )).rows[0].n>=2);
  await final.logout(third.token);
  // Synthetic HTTP on loopback: only a live OWNER session + same-origin CSRF
  // can read or mutate credentials. No real administrator values are involved.
  const router=createOwnerRouter({
    ...config,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url')
  });
  const server=createServer((req,res)=>router.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const send=(path,{data,cookie,csrf,origin='https://gracz-contact-api.onrender.com'}={})=>
    new Promise((resolve,reject)=>{
      const method='POST';
      const req=httpRequest({
        hostname:'127.0.0.1',port:server.address().port,path,method,
        headers:{host:'gracz-contact-api.onrender.com',
          'x-forwarded-proto':'https',origin,
          'sec-fetch-site':'same-origin','content-type':'application/json',
          ...(cookie?{cookie}:{}),...(csrf?{'x-owner-csrf':csrf}:{})}
      },res=>{
        let body='';
        res.on('data',chunk=>body+=chunk);
        res.on('end',()=>resolve({status:res.statusCode,
          cookie:res.headers['set-cookie']?.[0]||'',
          body:JSON.parse(body)}));
        res.on('error',reject);
      });
      req.on('error',reject);
      req.end(JSON.stringify(data||{}));
    });
  try {
    const signed=await send('/owner/newsletter/login',{
      data:{username:'newowner',password:updatedPassword}
    });
    assert.equal(signed.status,200);
    const cookie=signed.cookie.split(';')[0];
    const csrf=signed.body.csrf;
    assert.equal((await send('/owner/newsletter/settings',{data:{}})).status,401);
    assert.equal((await send('/owner/newsletter/settings',{cookie})).status,403);
    assert.equal((await send('/owner/newsletter/settings',{
      cookie,csrf,origin:'https://attacker.example'
    })).status,403);
    const account=await send('/owner/newsletter/settings',{cookie,csrf});
    assert.equal(account.status,200);
    assert.equal(account.body.username,'newowner');
    assert.equal(Object.hasOwn(account.body,'password_verifier'),false);
    const denied=await send('/owner/newsletter/change-credentials',{
      cookie,csrf,data:{oldPassword:'invalid-old-owner-password',username:'changedowner'}
    });
    assert.equal(denied.status,400);
    // M5 deliberately throttles credential attempts to once every 2 seconds.
    const tooSoon=await send('/owner/newsletter/change-credentials',{
      cookie,csrf,data:{oldPassword:updatedPassword,username:'changedowner'}
    });
    assert.equal(tooSoon.status,429);
    await new Promise(resolve=>setTimeout(resolve,2100));
    const changed=await send('/owner/newsletter/change-credentials',{
      cookie,csrf,data:{oldPassword:updatedPassword,username:'changedowner'}
    });
    assert.equal(changed.status,200);
    assert.equal(changed.body.relogin,true);
    assert.match(changed.cookie,/Max-Age=0/);
    assert.equal((await send('/owner/newsletter/settings',{cookie,csrf})).status,401);
    // Browser form is a top-level HTTPS navigation from gracz.pl to
    // onrender.com; never a credentialed cross-site XHR or iframe.
    const formPost=({origin='https://gracz.pl',body,contentType='application/x-www-form-urlencoded'}={})=>
      new Promise((resolve,reject)=>{
        const formBody=body??new URLSearchParams({
          username:'changedowner',password:updatedPassword
        }).toString();
        const request=httpRequest({
          hostname:'127.0.0.1',port:server.address().port,
          path:'/owner/newsletter/login/public-form',method:'POST',
          headers:{
            host:'gracz-contact-api.onrender.com',
            'x-forwarded-proto':'https',
            origin,'sec-fetch-site':'cross-site',
            'sec-fetch-mode':'navigate','sec-fetch-dest':'document',
            'content-type':contentType
          }
        },response=>{
          let html='';
          response.on('data',chunk=>html+=chunk);
          response.on('end',()=>resolve({status:response.statusCode,html,
            cookie:response.headers['set-cookie']?.[0]||'',
            headers:response.headers}));
          response.on('error',reject);
        });
        request.on('error',reject);
        request.end(formBody);
      });
    assert.equal((await formPost({origin:'https://untrusted.example'})).status,403,
      'untrusted form origins are rejected');
    assert.equal((await formPost({contentType:'application/json'})).status,400,
      'the public form never accepts JSON');
    assert.equal((await formPost({body:'username=x&username=y&password=anything'})).status,400,
      'duplicate form fields are rejected without password verification');
    const premium=await formPost();
    assert.equal(premium.status,200);
    assert.match(premium.cookie,/^__Host-gracz_owner=/);
    assert.match(premium.cookie,/Secure; HttpOnly; SameSite=Strict/);
    // Successful cross-site login must render the final panel immediately.
    // A forced refresh/redirect can lose a Strict cookie before first navigation.
    assert.match(premium.html,/SEO Control Center/);
    assert.match(premium.html,/Panel administracyjny Newslettera/);
    assert.match(premium.html,/href="\/owner\/newsletter\/seo"/);
    assert.match(premium.html,/href="\/owner\/newsletter\/"/);
    assert.doesNotMatch(premium.html,/http-equiv="refresh"/);
    assert.match(premium.headers['content-security-policy'],/form-action 'none'/);
    assert.equal(premium.headers['cache-control'],'no-store');
    const authenticated=await new Promise((resolve,reject)=>{
      const request=httpRequest({
        hostname:'127.0.0.1',port:server.address().port,
        path:'/owner/newsletter/systemadmin',
        headers:{host:'gracz-contact-api.onrender.com',
          'x-forwarded-proto':'https',
          cookie:premium.cookie.split(';')[0]}
      },res=>{
        let html='';
        res.on('data',chunk=>html+=chunk);
        res.on('end',()=>resolve({status:res.statusCode,html}));
        res.on('error',reject);
      });
      request.on('error',reject);request.end();
    });
    assert.equal(authenticated.status,200);
    assert.match(authenticated.html,/SEO Control Center/);
    assert.match(authenticated.html,/Panel administracyjny Newslettera/);
    // Failed credentials must NEVER open a second OWNER login screen at Render.
    // Fixed redirect keeps the only credential form on gracz.pl/systemadmin.
    const failed=await formPost({body:new URLSearchParams({
      username:'changedowner',password:'wrong-owner-password-test'
    }).toString()});
    assert.equal(failed.status,303);
    assert.equal(failed.headers.location,'https://gracz.pl/systemadmin/#login-failed');
    assert.equal(failed.cookie,'');
    assert.doesNotMatch(failed.html,/Logowanie właściciela|password|changedowner/);
  } finally {await new Promise(resolve=>server.close(resolve));}
  // Disposable test database only; restore environment bootstrap for other tests.
  await db.query('DELETE FROM newsletter_owner.credentials');
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
});



test('OWNER recovery uses one click and stored encrypted recovery mailbox',async()=>{
  const [router,script,css,auth]=await Promise.all([
    readFile(new URL('../owner-router.mjs',import.meta.url),'utf8'),
    readFile(new URL('../ui/login.js',import.meta.url),'utf8'),
    readFile(new URL('../ui/admin.css',import.meta.url),'utf8'),
    readFile(new URL('../owner-auth.mjs',import.meta.url),'utf8')
  ]);
  assert.ok(router.includes('id="forgot-dialog" class="owner-recovery-premium"'));
  assert.ok(router.includes('id="forgot-request-form"'));
  assert.ok(router.includes('id="forgot-mailbox-note"'));
  assert.ok(router.includes('Wyślij kod odzyskiwania'));
  assert.ok(router.includes('id="forgot-complete-form"'));
  assert.ok(router.includes('id="forgot-code"'));
  assert.ok(!router.includes('id="forgot-email"'));
  assert.ok(router.includes('await auth.requestPasswordRecovery()'));
  assert.ok(script.includes('body:JSON.stringify({})'));
  assert.ok(!script.includes("getElementById('forgot-email')"));
  assert.ok(script.includes("requestStatus.setAttribute('data-state','processed')"));
  assert.ok(script.includes('Ten komunikat nie potwierdza doręczenia'));
  assert.ok(auth.includes('recoveryCrypto.decrypt(row.email_ciphertext'));
  assert.ok(auth.includes('row.email_tag!==tagEmail(mailbox)'));
  assert.ok(auth.includes('reset_daily_count>=5'));
  assert.ok(auth.includes('async function completePasswordRecovery({code,newPassword}={})'));
  assert.ok(css.includes('#forgot-dialog .forgot-mailbox-note{'));
  assert.ok(css.includes('#forgot-dialog.owner-recovery-premium{'));
});

test('M6 recovery mailer sends transactional code only to the verified mailbox',async()=>{
  const captured=[];
  const mailer=createOwnerRecoveryMailer({
    apiKey:'synthetic-resend-test-key',
    emailFrom:'gracz.pl <kontakt@gracz.pl>',
    request:async(url,options)=>{
      captured.push({url,options});
      return {status:200,json:async()=>({id:'synthetic-message-id'})};
    }
  });
  assert.ok(mailer);
  const email='mailbox-recovery@example.test',code='AbCdEfGhIj';
  await mailer.send({email,code,purpose:'reset'});
  assert.equal(captured.length,1);
  assert.equal(captured[0].url,'https://api.resend.com/emails');
  const body=JSON.parse(captured[0].options.body);
  assert.deepEqual(body.to,[email]);
  assert.match(body.text,/Hasło tymczasowe/);
  assert.ok(body.text.includes(code));
  await mailer.send({email,code:'X'.repeat(24),purpose:'verify'});
  assert.equal(captured.length,2,'24-character mailbox verification remains supported');
  assert.equal(Object.hasOwn(body,'reply_to'),false);
  assert.equal(createOwnerRecoveryMailer({apiKey:'',emailFrom:'kontakt@gracz.pl'}),null);
  await assert.rejects(mailer.send({email,code:'invalid',purpose:'reset'}));
});

test('M6 recovery: verified mailbox, private temporary code, one-use reset, replay denial',async()=>{
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  await db.query('DELETE FROM newsletter_owner.sessions');
  await db.query('DELETE FROM newsletter_owner.credentials');
  await db.query(
    'UPDATE newsletter_owner.recovery SET email_ciphertext=NULL,email_tag=NULL,'+
    'pending_ciphertext=NULL,pending_tag=NULL,pending_code_hash=NULL,pending_expires=NULL,'+
    'pending_attempts=0,pending_last_sent=NULL,reset_code_hash=NULL,reset_expires=NULL,'+
    'reset_attempts=0,reset_last_sent=NULL,reset_day=NULL,reset_daily_count=0 WHERE id=1');
  const sent=[];
  const mailbox='test-owner-recovery@example.test';
  const bootstrap=await newVerifier(password);
  const config={database:db,passwordSpec:bootstrap,passwordOnly:true,
    username:'graczowner',recoveryEnabled:true,
    recoverySecret:['m6','synthetic','test','key','material','only','not','real'].join(':'),
    recoveryMailer:{send:async message=>{sent.push(message);return true;}}};
  const auth=createOwnerAuth(config);
  const initial=await auth.login({username:'graczowner',password});
  assert.ok(initial);
  assert.equal((await auth.settings(initial.token)).recoveryEmailMasked,null);
  assert.equal(await auth.beginRecoveryEmail(initial.token,{email:mailbox,
    password:'wrong-password'}),false);
  assert.equal(sent.length,0);
  assert.equal(await auth.beginRecoveryEmail(initial.token,{email:mailbox,password}),true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].purpose,'verify');
  assert.equal(sent[0].code.length,24,'mailbox ownership proof unchanged');
  assert.equal((await auth.settings(initial.token)).recoveryEmailMasked,null,
    'Email is inactive until mailbox proof succeeds');
  assert.equal(await auth.requestPasswordRecovery(),true);
  assert.equal(sent.length,1,'No reset mail is sent before mailbox confirmation');
  assert.equal(await auth.confirmRecoveryEmail(initial.token,'A'.repeat(24)),false);
  assert.equal(await auth.confirmRecoveryEmail(initial.token,sent[0].code),true);
  assert.equal(await auth.confirmRecoveryEmail(initial.token,sent[0].code),false,
    'Email verification is single use');
  assert.match((await auth.settings(initial.token)).recoveryEmailMasked,/\*\*\*@example\.test/);
  const row=await db.query('SELECT email_ciphertext,email_tag FROM newsletter_owner.recovery WHERE id=1');
  assert.ok(row.rows[0].email_ciphertext.startsWith('c1.'));
  assert.ok(!JSON.stringify(row.rows[0]).includes(mailbox),
    'Recovery address encrypted at rest');
  assert.equal(await auth.requestPasswordRecovery(),true);
  assert.equal(sent.length,2,'Stored verified mailbox receives reset without user input');
  assert.equal(sent[1].purpose,'reset');
  assert.equal(sent[1].email,mailbox);
  assert.match(sent[1].code,/^[A-Za-z]{10}$/,'10 cryptographically random letters for recovery');
  assert.equal(await auth.requestPasswordRecovery(),true);
  assert.equal(sent.length,2,'Durable recovery request throttled');
  assert.equal(await auth.completePasswordRecovery({
    code:'B'.repeat(24),newPassword:'NineChar9'
  }),false);
  assert.equal(await auth.completePasswordRecovery({
    code:sent[1].code,newPassword:'Eight888'
  }),false,'Eight-character passwords are rejected');
  assert.equal(await auth.completePasswordRecovery({
    code:sent[1].code,newPassword:'NineChar9'
  }),true);
  assert.equal(await auth.session(initial.token),null,'Password recovery invalidates prior sessions');
  assert.equal(await auth.completePasswordRecovery({
    code:sent[1].code,newPassword:'Another99'
  }),false,'Temporary password cannot be reused');
  const afterRestart=createOwnerAuth(config);
  const restored=await afterRestart.login({username:'graczowner',password:'NineChar9'});
  assert.ok(restored,'Nine-character recovery password works after auth recreation');
  await afterRestart.logout(restored.token);
  await db.query('DELETE FROM newsletter_owner.credentials');
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  await db.query(
    'UPDATE newsletter_owner.recovery SET email_ciphertext=NULL,email_tag=NULL,'+
    'pending_ciphertext=NULL,pending_tag=NULL,pending_code_hash=NULL,pending_expires=NULL,'+
    'pending_attempts=0,pending_last_sent=NULL,reset_code_hash=NULL,reset_expires=NULL,'+
    'reset_attempts=0,reset_last_sent=NULL,reset_day=NULL,reset_daily_count=0 WHERE id=1');
});

test('protected HTTP exposes no subscriber data before OWNER login and CSRF',async(t)=>{
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL,last_totp_step=-1 WHERE id=1');
  await db.query('DELETE FROM newsletter_owner.sessions');
  const verifier=await newVerifier(password);
  const router=createOwnerRouter({
    database:db,enabled:true,passwordSpec:verifier,totpBase32,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url')
  });
  assert.equal(router.configured,true);
  const email='private-owner-fixture@example.test';
  const emailTag=createHmac('sha256',subject)
    .update('gracz-new-only:email\n'+email).digest('hex');
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',enc,nonce);
  cipher.setAAD(Buffer.from('gracz-newsletter-new:'+emailTag));
  const ciphertext=Buffer.concat([cipher.update(email),cipher.final()]);
  await db.query(`INSERT INTO newsletter_new.subscribers
    (email_tag,ciphertext,nonce,auth_tag,challenge_id,token_tag,state,
    delivery_state,source,consent_version,expires_at,confirmed_at)
    VALUES ($1,$2,$3,$4,$5,NULL,'active','sent','newsletter_page','test-owner',now()+interval '30 minutes',now())`,
    [emailTag,ciphertext,nonce,cipher.getAuthTag(),randomUUID()]);
  const srv=createServer((req,res)=>router.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>srv.close(resolve));await db.close();});
  const h={'host':'gracz-contact-api.onrender.com','x-forwarded-proto':'https',
    'origin':'https://gracz-contact-api.onrender.com',
    'sec-fetch-site':'same-origin'};
  const call=(path,{method='GET',data,cookie,csrf,origin}={})=>new Promise((resolve,reject)=>{
    const request=httpRequest({
      hostname:'127.0.0.1',port:srv.address().port,path,method,
      headers:{...h,...(origin===undefined?{}:{origin}),
        ...(cookie?{'cookie':cookie}:{}),
        ...(csrf?{'x-owner-csrf':csrf}:{}),
        ...(data?{'content-type':'application/json'}:{})}
    },response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('error',reject);
      response.on('end',()=>{
        const body=Buffer.concat(chunks).toString('utf8');
        resolve({status:response.statusCode,
          headers:{get:(name)=>{const value=response.headers[name.toLowerCase()];return Array.isArray(value)?value.join('; '):value??null;}},
          json:async()=>JSON.parse(body),text:async()=>body});
      });
    });
    request.on('error',reject);
    request.end(data?JSON.stringify(data):undefined);
  });
  let result=await call('/owner/newsletter/');
  assert.equal(result.status,302);
  assert.equal(result.headers.get('location'),'/owner/newsletter/login');
  result=await call('/owner/newsletter/list',{method:'POST',data:{}});
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/summary',{method:'POST',data:{}});
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/login',{method:'POST',
    origin:'https://evil.example',data:{password,code:codeAt(secret,Math.floor(Date.now()/30000))}});
  assert.equal(result.status,403);
  result=await call('/owner/newsletter/login',{method:'POST',
    data:{password,code:codeAt(secret,Math.floor(Date.now()/30000))}});
  assert.equal(result.status,200);
  const login=await result.json();
  const cookie=result.headers.get('set-cookie');
  assert.match(cookie,/__Host-gracz_owner=/);
  assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  assert.equal(typeof login.csrf,'string');
  result=await call('/owner/newsletter/systemadmin',{cookie});
  assert.equal(result.status,200);
  assert.match(await result.text(),/SEO Control Center/);
  assert.match(await result.text(),/Panel administracyjny Newslettera/);
  assert.equal(result.headers.get('x-robots-tag'),'noindex, nofollow');
  result=await call('/owner/newsletter/seo',{cookie});
  assert.equal(result.status,200);
  assert.match(await result.text(),/Przełączanie paneli administracyjnych/);
  result=await call('/owner/newsletter/',{cookie});
  assert.equal(result.status,200);
  assert.match(await result.text(),/Przełączanie paneli administracyjnych/);
  result=await call('/owner/newsletter/systemadmin.css',{cookie});
  assert.equal(result.status,200);
  assert.match(result.headers.get('content-type'),/text\/css/);
  result=await call('/owner/newsletter/list',{method:'POST',cookie,data:{}});
  assert.equal(result.status,403);
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,data:{}});
  assert.equal(result.status,403);
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,csrf:login.csrf,
    origin:'https://evil.example',data:{}});
  assert.equal(result.status,403);
  result=await call('/owner/newsletter/list',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,200);
  const listing=await result.json();
  assert.equal(listing.ok,true);
  assert.equal(listing.items.length,1);
  assert.equal(listing.items[0].email,email);
  assert.equal(listing.items[0].source,'newsletter_page');
  assert.match(listing.items[0].requestedAt,/^\d{4}-\d{2}-\d{2}T/);
  assert.equal(listing.items[0].confirmedAt!==null,true);
  const tokenHandle=listing.items[0].handle;
  result=await call('/owner/newsletter/detail',{method:'POST',cookie,
    csrf:login.csrf,data:{handle:tokenHandle}});
  assert.equal(result.status,200);
  const detail=await result.json();
  assert.equal(detail.email,email);
  assert.equal(detail.source,'newsletter_page');
  assert.equal(detail.consentVersion,'test-owner');
  assert.equal(detail.deliveryState,'sent');
  assert.ok(detail.requestedAt&&detail.confirmedAt);
  assert.equal(detail.revokedAt,null);
  assert.equal(detail.consent?.consentVersion,'test-owner');
  assert.equal(detail.consent?.source,'newsletter_page');
  // Synthetic additional rows in the disposable PG18 test DB only:
  // one pending and one verified withdrawal; public newsletter remains untouched.
  async function seed(email,state,sourceCode,revoked=false){
    const tag=createHmac('sha256',subject)
      .update('gracz-new-only:email\n'+email).digest('hex');
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',enc,nonce);
    cipher.setAAD(Buffer.from('gracz-newsletter-new:'+tag));
    const ciphertext=Buffer.concat([cipher.update(email),cipher.final()]);
    await db.query(`INSERT INTO newsletter_new.subscribers
      (email_tag,ciphertext,nonce,auth_tag,challenge_id,token_tag,state,
       delivery_state,source,consent_version,expires_at,confirmed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,'sent',$8,'test-owner',now()+interval '30 minutes',$9)`,
       [tag,ciphertext,nonce,cipher.getAuthTag(),randomUUID(),
        state==='pending'?'a'.repeat(64):null,state,sourceCode,
        state==='active'?new Date():null]);
    if(revoked)await db.query(
      'INSERT INTO newsletter_new.revocations(email_tag,challenge_id) VALUES($1,$2)',
      [tag,randomUUID()]);
    return tag;
  }
  await seed('pending-owner-fixture@example.test','pending','footer');
  await seed('withdrawn-owner-fixture@example.test','active','auth_modal',true);
  const oldTag=await seed('older-owner-fixture@example.test','active','footer');
  await db.query(`UPDATE newsletter_new.subscribers SET requested_at=(
      date_trunc('month',now() AT TIME ZONE 'Europe/Warsaw')
      - interval '2 months' + interval '15 days') AT TIME ZONE 'Europe/Warsaw'
      WHERE email_tag=$1`,[oldTag]);
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,csrf:login.csrf,
    data:{unexpected:true}});
  assert.equal(result.status,403,'summary rejects unnecessary input');
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,csrf:login.csrf,
    data:{}});
  assert.equal(result.status,200,'M4 private summary works with authorized session');
  const m4=await result.json();
  assert.equal(m4.scope,'new_only_global');
  assert.deepEqual(
    {total:m4.counts.total,active:m4.counts.active,
      pending:m4.counts.pending,withdrawn:m4.counts.withdrawn},
    {total:4,active:2,pending:1,withdrawn:1});
  assert.equal(m4.counts.last30,3);
  assert.equal(m4.counts.confirmed30,2);
  assert.equal(m4.doiRate30,66.7);
  assert.equal(m4.trend.length,30);
  assert.equal(m4.trend.reduce((n,x)=>n+x.requested,0),3);
  assert.equal(m4.trend.reduce((n,x)=>n+x.confirmed,0),2);
  assert.equal(m4.sources.reduce((n,x)=>n+x.count,0),3);
  assert.equal(m4.monthlyTrend.length,12);
  assert.equal(m4.monthlyTrend.reduce((n,x)=>n+x.requested,0),4);
  assert.equal(m4.monthlyTrend.reduce((n,x)=>n+x.confirmed,0),3);
  assert.equal(m4.monthlyTrend.at(-1).requested,3);
  assert.equal(m4.monthlyTrend.at(-2).requested,0);
  assert.equal(m4.monthlyTrend.at(-3).requested,1);
  assert.ok(m4.monthlyTrend.every((m,i,a)=>
    /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(m.month)&&
    (i===0||a[i-1].month<m.month)));
  assert.ok(!JSON.stringify(m4).includes('private-owner-fixture@example.test'));
  assert.match(m4.fetchedAt,/^\d{4}-\d{2}-\d{2}T/);

  // M7: private trend explorer is guarded by the same durable OWNER session,
  // same-origin origin/CSRF and bounded, read-only date/source input.
  const today=new Intl.DateTimeFormat('sv-SE',{
    timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date());
  const previous29=new Date(Date.parse(today+'T00:00:00Z')-29*86_400_000)
    .toISOString().slice(0,10);
  const getTrends=(data,csrf=login.csrf)=>call('/owner/newsletter/trend-detail',{
    method:'POST',cookie,csrf,data
  });
  result=await call('/owner/newsletter/trend-detail',{
    method:'POST',data:{from:previous29,to:today}});
  assert.equal(result.status,401,'Anonymous trend access denied');
  result=await getTrends({from:previous29,to:today},null);
  assert.equal(result.status,403,'Trend access without CSRF denied');
  result=await getTrends({from:previous29,to:today,source:"x' OR 1=1 --"});
  assert.equal(result.status,400,'SQL injection-like source denied');
  result=await getTrends({from:'2026-02-29',to:today});
  assert.equal(result.status,429,'Owner trend endpoint rate-limits rapid consecutive requests');
  const readTrend=createNewOnlyTrendDetail({database:db});
  assert.equal(await readTrend({from:'2026-02-29',to:today}),null,'Invalid date denied');
  assert.equal(await readTrend({from:'2024-01-01',to:today}),null,'Oversized date window denied');
  assert.equal(await readTrend({from:today,to:previous29}),null,'Inverted window denied');
  await new Promise(resolve=>setTimeout(resolve,1300));
  result=await getTrends({from:previous29,to:today,source:''});
  assert.equal(result.status,200);
  const trendDetail=await result.json();
  assert.equal(trendDetail.scope,'new_only_global');
  assert.equal(trendDetail.timezone,'Europe/Warsaw');
  assert.equal(trendDetail.days,30);
  assert.equal(trendDetail.rows.length,30);
  assert.deepEqual(trendDetail.totals,{
    requested:3,confirmed:2,pending:1,withdrawn:1
  });
  assert.deepEqual(trendDetail.rows.map(row=>row.day).slice(0,1),[previous29]);
  assert.equal(trendDetail.rows.at(-1).day,today);
  assert.ok(!JSON.stringify(trendDetail).includes(email),
    'Detailed trends must not disclose subscriber mailbox');
  await new Promise(resolve=>setTimeout(resolve,1300));
  result=await getTrends({from:previous29,to:today,source:'footer'});
  assert.equal(result.status,200);
  const footerTrend=await result.json();
  assert.deepEqual(footerTrend.totals,{
    requested:1,confirmed:0,pending:1,withdrawn:0
  });

  // Ensure all right-side anchors point to real panel sections.
  result=await call('/owner/newsletter/',{cookie});
  assert.equal(result.status,200);
  const html=await result.text();
  for(const id of ['statistics','m4-global','trend-daily','trend-details',
    'trend-monthly','trend-sources','subscribers','subscriber-overview',
    'filters','quality','account-settings','owner-change-password',
    'owner-change-nick','owner-recovery-settings']){
    assert.ok(html.includes('id="'+id+'"'),'Missing section anchor '+id);
    assert.ok(html.includes('href="#'+id+'"'),'Missing menu link '+id);
  }

  // M8: an independent private endpoint supplies the 24-hour banner,
  // two-hour conditional CTA and a bounded newest-first subscriber tab.
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',data:{}});
  assert.equal(result.status,401,'Anonymous recent subscribers unavailable');
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',cookie,data:{}});
  assert.equal(result.status,403,'Recent subscribers require CSRF');
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',cookie,csrf:login.csrf,data:{unexpected:true}});
  assert.equal(result.status,403,'Recent subscribers reject extraneous input');
  // Invalid requests consume the OWNER endpoint's anti-flood cooldown.
  await new Promise(resolve=>setTimeout(resolve,3100));
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,200);
  const fresh=await result.json();
  assert.equal(fresh.scope,'new_only_global');
  assert.equal(fresh.total24,3);
  assert.equal(fresh.total2,3);
  assert.equal(fresh.items.length,3);
  assert.equal(fresh.hasMore,false);
  assert.ok(fresh.items.every(item=>/^[0-9]{4}-/.test(item.requestedAt)));
  assert.ok(!fresh.items.some(item=>item.email==='older-owner-fixture@example.test'));
  assert.ok(fresh.items.some(item=>item.email==='private-owner-fixture@example.test'));
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,429,'Recent snapshots are rate-limited');
  const recentReader=createNewOnlyAdminReader({
    database:db,encryptionKey:enc,subjectKey:subject
  });
  const pendingTag=createHmac('sha256',subject)
    .update('gracz-new-only:email\npending-owner-fixture@example.test').digest('hex');
  await db.query(
    "UPDATE newsletter_new.subscribers SET requested_at=now()-interval '3 hours' WHERE email_tag=$1",
    [pendingTag]);
  const mid=await recentReader.readRecent();
  assert.equal(mid.total24,3);
  assert.equal(mid.total2,2,'Two-hour CTA only when requests fall within the window');
  await db.query(
    "UPDATE newsletter_new.subscribers SET requested_at=now()-interval '25 hours'");
  const empty=await recentReader.readRecent();
  assert.equal(empty.total24,0);
  assert.equal(empty.total2,0);
  assert.deepEqual(empty.items,[]);
  assert.equal(empty.hasMore,false);
  assert.ok(html.includes('id="recent-banner-title"'));
  assert.ok(html.includes('id="recent-check"'));
  assert.match(html,/<button type="button" id="recent-show">POKAŻ<\/button>/,
    'POKAŻ is always visible in the top banner');
  assert.ok(html.includes('id="recent-subscribers"'));
  assert.match(html,/<a href="#recent-subscribers">Nowi subskrybenci<\/a>/,
    'The right-hand navigation links to the existing recent subscribers tab');
  assert.equal((html.match(/href="#recent-subscribers"/g)||[]).length,1,
    'Do not duplicate the recent subscribers menu item');
  const dashboardJs=await readFile(new URL('../ui/owner-dashboard.js',import.meta.url),'utf8');
  assert.match(dashboardJs,/\$\("recent-show"\)\.addEventListener\("click",openRecentSubscribers\)/);
  assert.match(dashboardJs,/\$\("recent-check"\)\.addEventListener\("click",openRecentSubscribers\)/);

  result=await call('/owner/newsletter/logout',{method:'POST',cookie,csrf:login.csrf});
  assert.equal(result.status,200);
  result=await call('/owner/newsletter/list',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/trend-detail',{
    method:'POST',cookie,csrf:login.csrf,data:{from:previous29,to:today}
  });
  assert.equal(result.status,401,'Logged-out trend access denied');
  result=await call('/owner/newsletter/recent-subscribers',{
    method:'POST',cookie,csrf:login.csrf,data:{}
  });
  assert.equal(result.status,401,'Logged-out recent subscribers denied');
  assert.ok(!(await result.text()).includes(email));
});

test('campaign send requires OWNER session, Origin, CSRF and explicit confirmation',async t=>{
  t.after(()=>db.close());
  await db.query('DELETE FROM newsletter_owner.credentials');
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
  const config={database:db,passwordSpec:await newVerifier(password),passwordOnly:true,username:'campaignowner'};
  const auth=createOwnerAuth(config);
  const login=await auth.login({username:'campaignowner',password});
  assert.ok(login);
  let calls=0;
  const router=createOwnerRouter({...config,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url'),
    campaignDraftsEnabled:true,campaignSender:{send:async()=>{
      calls++;return {state:'finished',accepted:1,suppressed:0,retryAllowed:false};
    }}});
  const server=createServer((req,res)=>router.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const send=({cookie=true,csrf=login.csrf,origin='https://gracz-contact-api.onrender.com',confirmation='WYSYŁAM KAMPANIĘ'}={})=>new Promise((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,
      path:'/owner/newsletter/campaigns/send',method:'POST',
      headers:{host:'gracz-contact-api.onrender.com','x-forwarded-proto':'https',origin,
        'sec-fetch-site':'same-origin','content-type':'application/json','x-owner-csrf':csrf,
        ...(cookie?{cookie:'__Host-gracz_owner='+login.token}:{})}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);
      res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));
      res.on('error',reject);
    });
    req.on('error',reject);req.end(JSON.stringify({id:randomUUID(),confirmation}));
  });
  assert.equal((await send({cookie:false})).status,401);
  assert.equal((await send({csrf:'invalid'})).status,403);
  assert.equal((await send({origin:'https://attacker.example'})).status,403);
  assert.equal((await send({confirmation:'yes'})).status,403);
  assert.equal(calls,0);
  const success=await send();
  assert.equal(success.status,200);
  assert.deepEqual(success.body,{ok:true,state:'finished',accepted:1,suppressed:0,retryAllowed:false});
  assert.equal(calls,1);
});
