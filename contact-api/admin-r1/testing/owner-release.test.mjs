import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {randomBytes,createCipheriv,createHmac,randomUUID} from 'node:crypto';
import {createDatabase} from '../../persistence/database.mjs';
import {createOwnerAuth,codeAt,encodeTotp,newVerifier,parseOwnerCookie} from '../owner-auth.mjs';
import {createOwnerRouter} from '../owner-router.mjs';
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
  assert.equal(createOwnerAuth({database:db,passwordSpec:'plaintext',totpBase32}),null);
  const disabled=createOwnerRouter({database:db,enabled:false});
  assert.equal(disabled.configured,false);
});

test('OWNER session: password, one-use TOTP, lockout, durable token, idle expiration, logout',async()=>{
  const verifier=await newVerifier(password);
  let now=Date.parse('2026-10-20T11:00:00.000Z');
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
    assert.doesNotMatch(loginPage.body,/id="code"/);
  } finally {await new Promise(resolve=>srv.close(resolve));}
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
      .update('gracz-new-only:email\\n'+email).digest('hex');
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
  }
  await seed('pending-owner-fixture@example.test','pending','footer');
  await seed('withdrawn-owner-fixture@example.test','active','auth_modal',true);
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
    {total:3,active:1,pending:1,withdrawn:1});
  assert.equal(m4.counts.last30,3);
  assert.equal(m4.counts.confirmed30,2);
  assert.equal(m4.doiRate30,66.7);
  assert.equal(m4.trend.length,30);
  assert.equal(m4.trend.reduce((n,x)=>n+x.requested,0),3);
  assert.equal(m4.trend.reduce((n,x)=>n+x.confirmed,0),2);
  assert.equal(m4.sources.reduce((n,x)=>n+x.count,0),3);
  assert.ok(!JSON.stringify(m4).includes('private-owner-fixture@example.test'));
  assert.match(m4.fetchedAt,/^\\d{4}-\\d{2}-\\d{2}T/);
  result=await call('/owner/newsletter/logout',{method:'POST',cookie,csrf:login.csrf});
  assert.equal(result.status,200);
  result=await call('/owner/newsletter/list',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/summary',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,401);
  assert.ok(!(await result.text()).includes(email));
});
