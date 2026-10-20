import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
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
  const host='http://127.0.0.1:'+srv.address().port;
  const h={'host':'gracz-contact-api.onrender.com','x-forwarded-proto':'https',
    'origin':'https://gracz-contact-api.onrender.com',
    'sec-fetch-site':'same-origin'};
  const call=(path,{method='GET',data,cookie,csrf,origin}={})=>fetch(host+path,{
    method,headers:{...h,...(origin===undefined?{}:{origin}),
      ...(cookie?{'cookie':cookie}:{}),
      ...(csrf?{'x-owner-csrf':csrf}:{}),
      ...(data?{'content-type':'application/json'}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
  });
  let result=await call('/owner/newsletter/');
  assert.equal(result.status,401);
  result=await call('/owner/newsletter/list',{method:'POST',data:{}});
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
  result=await call('/owner/newsletter/list',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,200);
  const listing=await result.json();
  assert.equal(listing.ok,true);
  assert.equal(listing.items.length,1);
  assert.equal(listing.items[0].email,email);
  const tokenHandle=listing.items[0].handle;
  result=await call('/owner/newsletter/detail',{method:'POST',cookie,
    csrf:login.csrf,data:{handle:tokenHandle}});
  assert.equal(result.status,200);
  assert.equal((await result.json()).email,email);
  result=await call('/owner/newsletter/logout',{method:'POST',cookie,csrf:login.csrf});
  assert.equal(result.status,200);
  result=await call('/owner/newsletter/list',{method:'POST',cookie,csrf:login.csrf,data:{}});
  assert.equal(result.status,401);
  assert.ok(!(await result.text()).includes(email));
});
