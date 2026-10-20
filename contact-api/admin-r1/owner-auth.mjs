// Owner-only password with opt-in username mode or legacy TOTP; durable PostgreSQL sessions.
import {createHash,createHmac,randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {createContactDataCrypto} from '../security/contact-data-crypto.mjs';
const scrypt=promisify(scryptCallback);
const COOKIE='__Host-gracz_owner';
const ABS_MS=8*60*60*1000, IDLE_MS=15*60*1000;
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const hash=value=>createHash('sha256').update(value).digest('hex');
const validPasswordSpec=value=>{
  const m=/^scrypt:([a-f0-9]{32}):([a-f0-9]{64})$/.exec(String(value||''));
  return m?{salt:m[1],verifier:Buffer.from(m[2],'hex')}:null;
};
export const decodeTotp=value=>{
  if(typeof value!=='string'||!/^[A-Z2-7]{32}$/.test(value))return null;
  let n=0,bits=0;const bytes=[];
  for(const char of value){
    n=(n<<5)|B32.indexOf(char);bits+=5;
    if(bits>=8){bits-=8;bytes.push((n>>bits)&255);n&=(1<<bits)-1;}
  }
  return bytes.length===20?Buffer.from(bytes):null;
};
export const encodeTotp=buffer=>{
  if(!Buffer.isBuffer(buffer)||buffer.length!==20)throw Error('Invalid TOTP seed');
  let n=0,bits=0,out='';
  for(const byte of buffer){
    n=(n<<8)|byte;bits+=8;
    while(bits>=5){bits-=5;out+=B32[(n>>bits)&31];n&=(1<<bits)-1;}
  }
  if(bits)out+=B32[(n<<(5-bits))&31];
  return out;
};
export function codeAt(secret,step) {
  const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));
  const mac=createHmac('sha1',secret).update(b).digest();
  const offset=mac.at(-1)&15;
  const value=(mac.readUInt32BE(offset)&0x7fffffff)%1_000_000;
  return String(value).padStart(6,'0');
}
const equals=(a,b)=>a.length===b.length&&timingSafeEqual(a,b);
export function parseOwnerCookie(header){
  const matches=String(header||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
  if(matches.length!==1)return null;
  const token=matches[0].slice(COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(token)&&Buffer.from(token,'base64url').length===32?token:null;
}
export const clearCookie=COOKIE+'=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict';
export const newCookie=token=>COOKIE+'='+token+'; Path=/; Max-Age=28800; Secure; HttpOnly; SameSite=Strict';
export const newVerifier=async password=>{
  if(typeof password!=='string'||password.length<9||password.length>128)throw Error('Password must be 9..128 characters');
  const salt=randomBytes(16).toString('hex');
  const digest=await scrypt(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return 'scrypt:'+salt+':'+digest.toString('hex');
};
export function createOwnerAuth({
  database,passwordSpec,totpBase32,username,passwordOnly=false,now=Date.now,
  recoverySecret,recoveryMailer,recoveryEnabled=false
}={}){
  const password=validPasswordSpec(passwordSpec);
  const secret=passwordOnly?null:decodeTotp(totpBase32);
  const ownerName=passwordOnly&&typeof username==='string'&&
    /^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)?username:null;
  if(!database?.enabled||typeof database.transaction!=='function'||!password||
     (passwordOnly?!ownerName:!secret))return null;
  // Changing the mode, username or verifier revokes existing durable sessions.
  const fingerprint=(verifier,name)=>passwordOnly
    ?createHmac('sha256',verifier.verifier)
      .update('gracz-owner-nick-password-v1:').update(name).digest('hex')
    :createHmac('sha256',secret)
      .update('gracz-owner-credential-generation-v1')
      .update(verifier.verifier).digest('hex');
  // Only a verified password-only OWNER can persist overrides. Before the
  // first explicit change, private Render secrets remain the bootstrap source.
  // A missing/invalid credential store MUST fail closed, never silently
  // restore the old environment password after a credential change.
  async function credentials(client=database){
    if(!passwordOnly){
      const csrfKey=createHmac('sha256',password.verifier)
        .update('gracz-owner-session-csrf-v1').digest();
      return {password,name:ownerName,verifierSpec:passwordSpec,
        fingerprint:fingerprint(password,ownerName),
        csrf:token=>createHmac('sha256',csrfKey).update(token).digest('base64url')};
    }
    const result=await client.query(
      'SELECT username,password_verifier FROM newsletter_owner.credentials WHERE id=1');
    if(result.rowCount>1)throw Error('Invalid OWNER credentials');
    const row=result.rows[0];
    const spec=row?row.password_verifier:passwordSpec;
    const name=row?row.username:ownerName;
    const parsed=validPasswordSpec(spec);
    if(!parsed||!(/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(name)))
      throw Error('Invalid OWNER credential store');
    const csrfKey=createHmac('sha256',parsed.verifier)
      .update('gracz-owner-session-csrf-v1').digest();
    return {password:parsed,name,verifierSpec:spec,
      fingerprint:fingerprint(parsed,name),
      csrf:token=>createHmac('sha256',csrfKey).update(token).digest('base64url')};
  }
  async function audit(client,action){
    if(!['login_ok','login_denied','session_read','subscriber_list','subscriber_detail','logout','credentials_changed',
      'recovery_email_set','recovery_requested','recovery_completed'].includes(action))
      throw Error('Invalid audit action');
    await client.query('INSERT INTO newsletter_owner.audit(event_id,action) VALUES($1,$2)',[randomUUID(),action]);
  }
  async function login({username:attemptedName,password:attempt,code}={}){
    if(typeof attempt!=='string'||attempt.length>256||
       (!passwordOnly&&(typeof code!=='string'||!/^[0-9]{6}$/.test(code))))return null;
    // Cheap durable lockout preflight avoids expensive KDF work after the
    // limit is reached. Rechecked under the row lock below to avoid races.
    const preflight=await database.queryBounded(
      'SELECT locked_until FROM newsletter_owner.guard WHERE id=1',[],
      {timeoutMs:2000});
    if(preflight.rows?.length!==1 ||
       (preflight.rows[0].locked_until &&
        new Date(preflight.rows[0].locked_until).getTime()>now()))return null;
    const current=await credentials();
    // Compute KDF outside the PostgreSQL transaction.
    const digest=await scrypt(attempt,current.password.salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    const passwordOk=equals(digest,current.password.verifier);
    // Check both identities without early exit; failed usernames count toward lockout.
    const usernameOk=!passwordOnly||(typeof attemptedName==='string'&&
      attemptedName.length<=64&&equals(
        createHash('sha256').update(attemptedName).digest(),
        createHash('sha256').update(current.name).digest()));
    return database.transaction(async client=>{
      const r=await client.query('SELECT failures,locked_until,last_totp_step FROM newsletter_owner.guard WHERE id=1 FOR UPDATE');
      if(r.rowCount!==1)throw Error('Owner schema missing');
      const guard=r.rows[0],time=now();
      if(guard.locked_until && new Date(guard.locked_until).getTime()>time)return null;
      // Reject a concurrent credential rotation, even if password verification
      // started before the other request committed its update.
      const locked=await credentials(client);
      if(locked.fingerprint!==current.fingerprint)return null;
      let matching=-1;
      if(!passwordOnly){
        const step=Math.floor(time/30000);
        for(const delta of [-1,0,1]){
          const n=step+delta;
          if(n>Number(guard.last_totp_step) &&
             equals(Buffer.from(code),Buffer.from(codeAt(secret,n))))matching=n;
        }
      }
      if(!passwordOk||!usernameOk||(!passwordOnly&&matching<0)){
        const failures=Number(guard.failures)+1;
        await client.query('UPDATE newsletter_owner.guard SET failures=$1,locked_until=$2 WHERE id=1',
          [failures>=5?0:failures,failures>=5?new Date(time+15*60_000):null]);
        await audit(client,'login_denied');return null;
      }
      if(passwordOnly){
        await client.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL WHERE id=1');
      }else{
        await client.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL,last_totp_step=$1 WHERE id=1',
          [matching]);
      }
      // One OWNER session: rotate, revoke earlier sessions on every successful login.
      await client.query('DELETE FROM newsletter_owner.sessions');
      const token=randomBytes(32).toString('base64url'),tokenHash=hash(token);
      await client.query(`INSERT INTO newsletter_owner.sessions
        (token_hash,credential_fingerprint,created_at,expires_at,idle_expires_at)
        VALUES ($1,$4,clock_timestamp(),$2,$3)`,
        [tokenHash,new Date(time+ABS_MS),new Date(time+IDLE_MS),current.fingerprint]);
      await audit(client,'login_ok');
      return {token,csrf:current.csrf(token),tokenHash};
    });
  }
  async function session(raw,action='session_read'){
    if(!raw||!['session_read','subscriber_list','subscriber_detail'].includes(action))return null;
    const tokenHash=hash(raw);
    return database.transaction(async client=>{
      const current=await credentials(client);
      const result=await client.query(`SELECT expires_at,idle_expires_at
        FROM newsletter_owner.sessions WHERE token_hash=$1 AND credential_fingerprint=$2 FOR UPDATE`,[tokenHash,current.fingerprint]);
      const row=result.rows[0],time=now();
      if(!row||new Date(row.expires_at).getTime()<=time||
         new Date(row.idle_expires_at).getTime()<=time)return null;
      await client.query('UPDATE newsletter_owner.sessions SET idle_expires_at=$2 WHERE token_hash=$1',
        [tokenHash,new Date(Math.min(time+IDLE_MS,new Date(row.expires_at).getTime()))]);
      await audit(client,action); // No data is returned if audit storage fails.
      return {tokenHash,csrf:current.csrf(raw)};
    });
  }
  async function logout(raw){
    if(!raw)return;
    await database.transaction(async client=>{
      await client.query('DELETE FROM newsletter_owner.sessions WHERE token_hash=$1',[hash(raw)]);
      await audit(client,'logout');
    });
  }
  async function settings(raw){
    if(!passwordOnly||!await session(raw))return null;
    const result=await database.queryBounded(
      "SELECT max(recorded_at) AS last_login_at FROM newsletter_owner.audit WHERE action='login_ok'",
      [],{timeoutMs:2000});
    const current=await credentials();
    let recoveryEmailMasked=null;
    if(recoveryReady){
      const recovery=await database.queryBounded(
        'SELECT email_ciphertext FROM newsletter_owner.recovery WHERE id=1',[],{timeoutMs:2000});
      const cipher=recovery.rows?.[0]?.email_ciphertext;
      if(cipher){
        const mailbox=recoveryCrypto.decrypt(cipher,{aad:'owner-recovery-email'});
        const [local,domain]=mailbox.split('@');
        recoveryEmailMasked=local.slice(0,1)+'***@'+domain;
      }
    }
    return {username:current.name,recoveryAvailable:recoveryReady,recoveryEmailMasked,
      lastLoginAt:result.rows?.[0]?.last_login_at?.toISOString?.()??null};
  }
  async function changeCredentials(raw,{oldPassword,newPassword,username:newName}={}){
    if(!passwordOnly||typeof oldPassword!=='string'||
       oldPassword.length<9||oldPassword.length>256||
       (newPassword!==undefined&&(typeof newPassword!=='string'||
       newPassword.length<9||newPassword.length>128))||
       (newName!==undefined&&!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(newName)))
      return false;
    const current=await credentials();
    const name=newName===undefined?current.name:newName;
    if(name===current.name&&newPassword===undefined)return false;
    // Both password checks and fresh scrypt run outside the database lock.
    const oldDigest=await scrypt(oldPassword,current.password.salt,32,
      {N:16384,r:8,p:1,maxmem:64*1024*1024});
    const passwordMatches=equals(oldDigest,current.password.verifier);
    if(!passwordMatches)return false;
    const nextSpec=newPassword===undefined?current.verifierSpec:await newVerifier(newPassword);
    const nextParsed=validPasswordSpec(nextSpec);
    if(newPassword!==undefined){
      const same=await scrypt(newPassword,current.password.salt,32,
        {N:16384,r:8,p:1,maxmem:64*1024*1024});
      if(equals(same,current.password.verifier))return false;
    }
    if(!nextParsed)return false;
    const tokenHash=hash(raw);
    return database.transaction(async client=>{
      // The shared OWNER guard serializes concurrent account changes.
      const guard=await client.query(
        'SELECT locked_until FROM newsletter_owner.guard WHERE id=1 FOR UPDATE');
      if(guard.rowCount!==1)return false;
      if(guard.rows[0].locked_until&&
         new Date(guard.rows[0].locked_until).getTime()>now())return false;
      const locked=await credentials(client);
      if(locked.fingerprint!==current.fingerprint)return false;
      const existing=await client.query(
        'SELECT expires_at,idle_expires_at FROM newsletter_owner.sessions WHERE token_hash=$1 AND credential_fingerprint=$2 FOR UPDATE',
        [tokenHash,current.fingerprint]);
      const row=existing.rows[0],time=now();
      if(!row||new Date(row.expires_at).getTime()<=time||
         new Date(row.idle_expires_at).getTime()<=time)return false;
      await client.query(
        'INSERT INTO newsletter_owner.credentials(id,username,password_verifier) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_verifier=excluded.password_verifier,updated_at=clock_timestamp()',
        [name,nextSpec]);
      await client.query('DELETE FROM newsletter_owner.sessions');
      await audit(client,'credentials_changed');
      return true;
    });
  }

  // M6 is opt-in until the dedicated SQL is applied on the private Render DB.
  // Bootstrapping login remains independent of recovery availability.
  const recoveryCrypto=createContactDataCrypto({secret:recoverySecret});
  const recoveryReady=Boolean(recoveryEnabled&&passwordOnly&&
    recoveryCrypto.enabled&&typeof recoveryMailer?.send==='function');
  const dateKey=value=>value instanceof Date?value.toISOString().slice(0,10):
    typeof value==='string'?value.slice(0,10):'';
  const normalizeEmail=value=>{
    const email=typeof value==='string'?value.trim().toLowerCase():'';
    return email.length>=6&&email.length<=254&&
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:null;
  };
  const tagEmail=email=>createHmac('sha256',String(recoverySecret))
    .update('gracz.pl/owner/recovery/email/v1:').update(email).digest('hex');
  const codeHash=(purpose,code)=>hash('owner-recovery:'+purpose+':'+code);
  const safeCode=code=>typeof code==='string'&&/^[A-Za-z0-9_-]{24}$/.test(code);
  const waitMs=(date,time)=>date&&new Date(date).getTime()>time;
  const codeMatches=(provided,stored)=>typeof stored==='string'&&
    equals(Buffer.from(provided,'hex'),Buffer.from(stored,'hex'));

  // OWNER must know their current password AND have a live CSRF-protected
  // session to start associating a new recovery mailbox.
  async function beginRecoveryEmail(raw,{password:oldPassword,email:inputEmail}={}){
    if(!recoveryReady||!await session(raw)||!normalizeEmail(inputEmail)||
      typeof oldPassword!=='string'||oldPassword.length>256)return false;
    const current=await credentials();
    const digest=await scrypt(oldPassword,current.password.salt,32,
      {N:16384,r:8,p:1,maxmem:64*1024*1024});
    if(!equals(digest,current.password.verifier))return false;
    const email=normalizeEmail(inputEmail),code=randomBytes(18).toString('base64url');
    const encrypted=recoveryCrypto.encrypt(email,{aad:'owner-recovery-email'});
    const reserved=await database.transaction(async client=>{
      const g=await client.query('SELECT locked_until FROM newsletter_owner.guard WHERE id=1 FOR UPDATE');
      if(waitMs(g.rows[0]?.locked_until,now()))return false;
      if((await credentials(client)).fingerprint!==current.fingerprint)return false;
      const r=await client.query('SELECT pending_last_sent FROM newsletter_owner.recovery WHERE id=1 FOR UPDATE');
      if(r.rowCount!==1||waitMs(r.rows[0].pending_last_sent&&
        new Date(r.rows[0].pending_last_sent).getTime()+60_000,now()))return false;
      await client.query(
        'UPDATE newsletter_owner.recovery SET pending_ciphertext=$1,pending_tag=$2,'+
        'pending_code_hash=$3,pending_expires=$4,pending_attempts=0,pending_last_sent=clock_timestamp() WHERE id=1',
        [encrypted,tagEmail(email),codeHash('verify',code),new Date(now()+600_000)]);
      return true;
    });
    if(!reserved)return false;
    try{await recoveryMailer.send({email,code,purpose:'verify'});return true;}
    catch{return false;}
  }
  async function confirmRecoveryEmail(raw,code){
    if(!recoveryReady||!safeCode(code)||!await session(raw))return false;
    return database.transaction(async client=>{
      const r=await client.query('SELECT * FROM newsletter_owner.recovery WHERE id=1 FOR UPDATE');
      const row=r.rows[0];
      if(!row||!waitMs(row.pending_expires,now())||row.pending_attempts>=5)return false;
      if(!codeMatches(codeHash('verify',code),row.pending_code_hash)){
        await client.query(
          'UPDATE newsletter_owner.recovery SET pending_attempts=LEAST(5,pending_attempts+1) WHERE id=1');
        return false;
      }
      await client.query(
        'UPDATE newsletter_owner.recovery SET email_ciphertext=pending_ciphertext,email_tag=pending_tag,'+
        'pending_ciphertext=NULL,pending_tag=NULL,pending_code_hash=NULL,pending_expires=NULL,'+
        'pending_attempts=0,pending_last_sent=NULL,reset_code_hash=NULL,reset_expires=NULL,'+
        'reset_attempts=0,reset_last_sent=NULL,reset_day=NULL,reset_daily_count=0 WHERE id=1');
      await audit(client,'recovery_email_set');
      return true;
    });
  }
  // Public request: always respond identically regardless of account/mailbox.
  async function requestPasswordRecovery(inputEmail){
    if(!recoveryReady)return false;
    const email=normalizeEmail(inputEmail);
    if(!email)return true;
    const code=randomBytes(18).toString('base64url'),time=now(),day=new Date(time).toISOString().slice(0,10);
    const allowed=await database.transaction(async client=>{
      const r=await client.query(
        'SELECT email_tag,reset_last_sent,reset_day,reset_daily_count FROM newsletter_owner.recovery WHERE id=1 FOR UPDATE');
      const row=r.rows[0];
      if(!row||row.email_tag!==tagEmail(email)||
        waitMs(row.reset_last_sent&&new Date(row.reset_last_sent).getTime()+300_000,time)||
        (dateKey(row.reset_day)===day&&row.reset_daily_count>=5))return false;
      await client.query(
        'UPDATE newsletter_owner.recovery SET reset_code_hash=$1,reset_expires=$2,'+
        'reset_attempts=0,reset_last_sent=clock_timestamp(),reset_day=$3,'+
        'reset_daily_count=$4 WHERE id=1',
        [codeHash('reset',code),new Date(time+600_000),day,
          dateKey(row.reset_day)===day?Number(row.reset_daily_count)+1:1]);
      await audit(client,'recovery_requested');
      return true;
    });
    if(allowed)try{await recoveryMailer.send({email,code,purpose:'reset'});}catch{
      // Deliberately indistinguishable from unknown mailbox; do not retry
      // an uncertain Resend delivery automatically.
    }
    return true;
  }
  // Reset is limited to a verified mailbox, one random 144-bit code,
  // max five guesses and 10 minutes. No credential changes on request alone.
  async function completePasswordRecovery({email:inputEmail,code,newPassword}={}){
    if(!recoveryReady||!safeCode(code)||!normalizeEmail(inputEmail)||
      typeof newPassword!=='string'||newPassword.length<9||newPassword.length>128)return false;
    const address=tagEmail(normalizeEmail(inputEmail)),digest=codeHash('reset',code);
    const pre=await database.queryBounded(
      'SELECT email_tag,reset_code_hash,reset_expires,reset_attempts '+
      'FROM newsletter_owner.recovery WHERE id=1',[],{timeoutMs:2000});
    const row=pre.rows?.[0];
    if(!row||row.email_tag!==address||!waitMs(row.reset_expires,now())||
      row.reset_attempts>=5)return false;
    if(!codeMatches(digest,row.reset_code_hash)){
      await database.transaction(async client=>{
        const v=await client.query(
          'SELECT email_tag,reset_code_hash,reset_attempts,reset_expires FROM newsletter_owner.recovery WHERE id=1 FOR UPDATE');
        if(v.rows[0]?.email_tag===address&&waitMs(v.rows[0]?.reset_expires,now())&&
          v.rows[0]?.reset_attempts<5&&!codeMatches(digest,v.rows[0]?.reset_code_hash))
          await client.query('UPDATE newsletter_owner.recovery SET reset_attempts=LEAST(5,reset_attempts+1) WHERE id=1');
      });
      return false;
    }
    const nextSpec=await newVerifier(newPassword); // only after cheap proof check
    return database.transaction(async client=>{
      await client.query('SELECT id FROM newsletter_owner.guard WHERE id=1 FOR UPDATE');
      const r=await client.query('SELECT * FROM newsletter_owner.recovery WHERE id=1 FOR UPDATE');
      const v=r.rows[0];
      if(!v||v.email_tag!==address||!waitMs(v.reset_expires,now())||
        v.reset_attempts>=5||!codeMatches(digest,v.reset_code_hash))return false;
      const current=await credentials(client);
      await client.query(
        'INSERT INTO newsletter_owner.credentials(id,username,password_verifier) VALUES(1,$1,$2) '+
        'ON CONFLICT(id) DO UPDATE SET password_verifier=excluded.password_verifier,'+
        'updated_at=clock_timestamp()', [current.name,nextSpec]);
      await client.query('DELETE FROM newsletter_owner.sessions');
      await client.query(
        'UPDATE newsletter_owner.recovery SET reset_code_hash=NULL,reset_expires=NULL,reset_attempts=0 WHERE id=1');
      await audit(client,'recovery_completed');
      return true;
    });
  }

  const checkCsrf=(session,value)=>typeof value==='string'&&
    /^[A-Za-z0-9_-]{43}$/.test(value)&&
    equals(Buffer.from(session.csrf),Buffer.from(value));
  return Object.freeze({login,session,logout,checkCsrf,settings,changeCredentials,
    recoveryReady,beginRecoveryEmail,confirmRecoveryEmail,
    requestPasswordRecovery,completePasswordRecovery});
}
