// Owner-only password + TOTP, durable PostgreSQL sessions and no public enrollment.
import {createHash,createHmac,randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
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
  if(typeof password!=='string'||password.length<16||password.length>128)throw Error('Password must be 16..128 characters');
  const salt=randomBytes(16).toString('hex');
  const digest=await scrypt(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return 'scrypt:'+salt+':'+digest.toString('hex');
};
export function createOwnerAuth({database,passwordSpec,totpBase32,now=Date.now}={}){
  const password=validPasswordSpec(passwordSpec),secret=decodeTotp(totpBase32);
  if(!database?.enabled||typeof database.transaction!=='function'||!password||!secret)return null;
  const csrfKey=createHmac('sha256',password.verifier).update('gracz-owner-session-csrf-v1').digest();
  const csrf=token=>createHmac('sha256',csrfKey).update(token).digest('base64url');
  async function audit(client,action){
    if(!['login_ok','login_denied','session_read','subscriber_list','subscriber_detail','logout'].includes(action))
      throw Error('Invalid audit action');
    await client.query('INSERT INTO newsletter_owner.audit(event_id,action) VALUES($1,$2)',[randomUUID(),action]);
  }
  async function login({password:attempt,code}={}){
    if(typeof attempt!=='string'||attempt.length>256||
       typeof code!=='string'||!/^[0-9]{6}$/.test(code))return null;
    // scrypt executes before the transaction to avoid holding a DB lock during KDF.
    const digest=await scrypt(attempt,password.salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    const passwordOk=equals(digest,password.verifier);
    return database.transaction(async client=>{
      const r=await client.query('SELECT failures,locked_until,last_totp_step FROM newsletter_owner.guard WHERE id=1 FOR UPDATE');
      if(r.rowCount!==1)throw Error('Owner schema missing');
      const guard=r.rows[0],time=now();
      if(guard.locked_until && new Date(guard.locked_until).getTime()>time)return null;
      const step=Math.floor(time/30000);
      let matching=-1;
      for(const delta of [-1,0,1]){
        const n=step+delta;
        if(n>Number(guard.last_totp_step) && equals(Buffer.from(code),Buffer.from(codeAt(secret,n))))matching=n;
      }
      if(!passwordOk||matching<0){
        const failures=Number(guard.failures)+1;
        await client.query('UPDATE newsletter_owner.guard SET failures=$1,locked_until=$2 WHERE id=1',
          [failures>=5?0:failures,failures>=5?new Date(time+15*60_000):null]);
        await audit(client,'login_denied');return null;
      }
      await client.query('UPDATE newsletter_owner.guard SET failures=0,locked_until=NULL,last_totp_step=$1 WHERE id=1',
        [matching]);
      // One OWNER session: rotate, revoke earlier sessions on every successful login.
      await client.query('DELETE FROM newsletter_owner.sessions');
      const token=randomBytes(32).toString('base64url'),tokenHash=hash(token);
      await client.query(`INSERT INTO newsletter_owner.sessions
        (token_hash,created_at,expires_at,idle_expires_at)
        VALUES ($1,clock_timestamp(),$2,$3)`,
        [tokenHash,new Date(time+ABS_MS),new Date(time+IDLE_MS)]);
      await audit(client,'login_ok');
      return {token,csrf:csrf(token),tokenHash};
    });
  }
  async function session(raw,action='session_read'){
    if(!raw||!['session_read','subscriber_list','subscriber_detail'].includes(action))return null;
    const tokenHash=hash(raw);
    return database.transaction(async client=>{
      const result=await client.query(`SELECT expires_at,idle_expires_at
        FROM newsletter_owner.sessions WHERE token_hash=$1 FOR UPDATE`,[tokenHash]);
      const row=result.rows[0],time=now();
      if(!row||new Date(row.expires_at).getTime()<=time||
         new Date(row.idle_expires_at).getTime()<=time)return null;
      await client.query('UPDATE newsletter_owner.sessions SET idle_expires_at=$2 WHERE token_hash=$1',
        [tokenHash,new Date(Math.min(time+IDLE_MS,new Date(row.expires_at).getTime()))]);
      await audit(client,action); // No data is returned if audit storage fails.
      return {tokenHash,csrf:csrf(raw)};
    });
  }
  async function logout(raw){
    if(!raw)return;
    await database.transaction(async client=>{
      await client.query('DELETE FROM newsletter_owner.sessions WHERE token_hash=$1',[hash(raw)]);
      await audit(client,'logout');
    });
  }
  const checkCsrf=(session,value)=>typeof value==='string'&&
    /^[A-Za-z0-9_-]{43}$/.test(value)&&
    equals(Buffer.from(session.csrf),Buffer.from(value));
  return Object.freeze({login,session,logout,checkCsrf});
}
