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
  } finally {await new Promise(resolve=>server.close(resolve));}
  // Disposable test database only; restore environment bootstrap for other tests.
  await db.query('DELETE FROM newsletter_owner.credentials');
  await db.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
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
  const email='mailbox-recovery@example.test',code='X'.repeat(24);
  await mailer.send({email,code,purpose:'reset'});
  assert.equal(captured.length,1);
  assert.equal(captured[0].url,'https://api.resend.com/emails');
  const body=JSON.parse(captured[0].options.body);
  assert.deepEqual(body.to,[email]);
  assert.match(body.text,/Hasło tymczasowe/);
  assert.ok(body.text.includes(code));
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
  assert.equal(sent[0].code.length,24);
  assert.equal((await auth.settings(initial.token)).recoveryEmailMasked,null,
    'Email is inactive until mailbox proof succeeds');
  assert.equal(await auth.confirmRecoveryEmail(initial.token,'A'.repeat(24)),false);
  assert.equal(await auth.confirmRecoveryEmail(initial.token,sent[0].code),true);
  assert.equal(await auth.confirmRecoveryEmail(initial.token,sent[0].code),false,
    'Email verification is single use');
  assert.match((await auth.settings(initial.token)).recoveryEmailMasked,/\*\*\*@example\.test/);
  const row=await db.query('SELECT email_ciphertext,email_tag FROM newsletter_owner.recovery WHERE id=1');
  assert.ok(row.rows[0].email_ciphertext.startsWith('c1.'));
  assert.ok(!JSON.stringify(row.rows[0]).includes(mailbox),
    'Recovery address encrypted at rest');
  assert.equal(await auth.requestPasswordRecovery('unknown-owner@example.test'),true);
  assert.equal(sent.length,1,'Unknown email must not trigger outbound email');
  assert.equal(await auth.requestPasswordRecovery(mailbox),true);
  assert.equal(sent.length,2);
  assert.equal(sent[1].purpose,'reset');
  assert.equal(sent[1].email,mailbox);
  assert.equal(await auth.requestPasswordRecovery(mailbox),true);
  assert.equal(sent.length,2,'Durable recovery request throttled');
  assert.equal(await auth.completePasswordRecovery({
    email:mailbox,code:'B'.repeat(24),newPassword:'NineChar9'
  }),false);
  assert.equal(await auth.completePasswordRecovery({
    email:mailbox,code:sent[1].code,newPassword:'Eight888'
  }),false,'Eight-character passwords are rejected');
  assert.equal(await auth.completePasswordRecovery({
    email:mailbox,code:sent[1].code,newPassword:'NineChar9'
  }),true);
  assert.equal(await auth.session(initial.token),null,'Password recovery invalidates prior sessions');
  assert.equal(await auth.completePasswordRecovery({
    email:mailbox,code:sent[1].code,newPassword:'Another99'
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
  assert.equal(result.status,401);
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
