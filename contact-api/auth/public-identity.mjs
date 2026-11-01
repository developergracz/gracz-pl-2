import { randomBytes, createHash, timingSafeEqual, randomUUID, scrypt as rawScrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt=promisify(rawScrypt);
const HOST='https://gracz-contact-api.onrender.com';
const COOKIE='__Host-gracz_session';
const MAX_BODY=4096;
const failures=new Map();
const digest=x=>createHash('sha256').update(x).digest();
const json=(res,status,obj)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(JSON.stringify(obj));
};
const bad=(res,status,message)=>json(res,status,{ok:false,error:message});
const normalizeEmail=x=>String(x||'').trim().toLowerCase();
const normalizeNick=x=>String(x||'').trim();
const validNick=x=>/^[a-z][a-z0-9._-]{2,31}$/i.test(x);
const validEmail=x=>x.length<=254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x);
const validPassword=x=>typeof x==='string'&&x.length>=15&&Buffer.byteLength(x)<=256;
const hashPassword=async (pwd,salt)=>Buffer.from(await scrypt(pwd,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}));
const cookie=value=>COOKIE+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800';
const clearCookie=()=>COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
function sessionToken(req){const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return raw?.slice(COOKIE.length+1)||'';}
async function readBody(req){
 return new Promise((resolve,reject)=>{
  let total=0,buf='';
  req.on('data',chunk=>{total+=chunk.length;if(total>MAX_BODY){reject(new Error('TOO_LARGE'));req.destroy();return;}buf+=chunk.toString('utf8');});
  req.on('end',()=>{try{const x=JSON.parse(buf);if(!x||typeof x!=='object'||Array.isArray(x))throw Error('BAD_JSON');resolve(x);}catch{reject(new Error('BAD_JSON'));}});
  req.on('error',reject);
 });
}
function allow(key,max=8){
 const now=Date.now();let state=failures.get(key);
 if(!state||state.until<now){state={until:now+900000,count:0};failures.set(key,state);}
 state.count++;
 if(failures.size>20000){for(const [k,v] of failures){if(v.until<now)failures.delete(k);}if(failures.size>20000)failures.clear();}
 return state.count<=max;
}
function safeText(x){return typeof x==='string'?x:'';}
function authorizedOrigin(req){return req.headers.origin===HOST && req.headers['sec-fetch-site']!=='cross-site';}
async function sendVerifyEmail(apiKey,from,to,token){
 const link=HOST+'/konto/#potwierdz='+encodeURIComponent(token);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',signal:controller.signal,
  headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
  body:JSON.stringify({from,to,subject:'gracz.pl — potwierdź konto',
   html:'<p>Potwierdź nowe konto gracz.pl. Link jest ważny 30 minut.</p><p><a href="'+link+'">Potwierdź adres e-mail</a></p><p>Jeśli to nie Ty, zignoruj wiadomość.</p>'})
 });
 return response.ok;
 }finally{clearTimeout(timer);}
}
export function createPublicIdentityRouter({database,emailFrom,resendKey}){
 let initialized;
 async function ready(){
  if(!database.enabled||!resendKey||!emailFrom)throw Error('AUTH_UNAVAILABLE');
  if(!initialized){
   initialized=(async()=>{
    await database.query('CREATE SCHEMA IF NOT EXISTS gracz_public_identity');
    await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.accounts (
      id uuid PRIMARY KEY, nickname text NOT NULL, nickname_key text NOT NULL UNIQUE,
      email_key text NOT NULL UNIQUE, salt bytea NOT NULL, password_digest bytea NOT NULL,
      verified_at timestamptz, verify_digest bytea, verify_expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.sessions (
      token_digest bytea PRIMARY KEY, account_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`);
    await database.query('CREATE INDEX IF NOT EXISTS gracz_public_sessions_expiry ON gracz_public_identity.sessions(expires_at)');
    await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.profiles (
      account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
      display_name text NOT NULL, bio text NOT NULL DEFAULT '',
      country text NOT NULL DEFAULT 'PL', language text NOT NULL DEFAULT 'pl',
      updated_at timestamptz NOT NULL DEFAULT now())`);
   })().catch(e=>{initialized=undefined;throw e;});
  }
  await initialized;
 }
 async function respond(req,res,url){
  if(!url.pathname.startsWith('/auth/') && !url.pathname.startsWith('/konto'))return false;
  if(url.pathname==='/auth/status'){
   try{await ready();return json(res,200,{ok:true,ready:true}),true;}catch{return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;}
  }
  if(req.method==='GET'&&(url.pathname==='/konto'||url.pathname==='/konto/')){
   return false;
  }
  if(url.pathname==='/auth/session'&&req.method==='GET'){
   try{
    await ready();const token=sessionToken(req);
    if(!/^[a-f0-9]{64}$/.test(token))return json(res,200,{ok:true,loggedIn:false}),true;
    const q=await database.query(`SELECT a.nickname FROM gracz_public_identity.sessions s
      JOIN gracz_public_identity.accounts a ON a.id=s.account_id
      WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
    return json(res,200,q.rows.length?{ok:true,loggedIn:true,nickname:q.rows[0].nickname}:{ok:true,loggedIn:false}),true;
   }catch{return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;}
  }
  if(url.pathname==='/auth/profile'){
    if(req.method!=='GET' && req.method!=='PUT')return bad(res,405,'METODA_NIEDOZWOLONA'),true;
    if(req.method==='PUT' && !authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
    try{
      await ready();
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const readProfile=()=>database.query(`SELECT a.id, a.nickname, a.email_key, a.created_at,
        p.display_name, p.bio, p.country, p.language
        FROM gracz_public_identity.sessions s
        JOIN gracz_public_identity.accounts a ON a.id=s.account_id
        LEFT JOIN gracz_public_identity.profiles p ON p.account_id=a.id
        WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
      const result=await readProfile();
      if(!result.rows.length)return bad(res,401,'BRAK_SESJI'),true;
      const account=result.rows[0];
      if(req.method==='PUT'){
        if(!allow('profile:'+account.id,25))return bad(res,429,'ZBYT_WIELE_PROB'),true;
        let body;
        try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
        const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
        const bio=typeof body.bio==='string'?body.bio.trim():'';
        const country=body.country,language=body.language;
        if(displayName.length<2||displayName.length>40||/[\u0000-\u001f\u007f]/.test(displayName)||
          bio.length>300||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(bio)||
          !['PL','DE','CZ','SK','OTHER'].includes(country)||!['pl','en','de'].includes(language))
          return bad(res,400,'POPRAW_DANE_PROFILU'),true;
        await database.query(`INSERT INTO gracz_public_identity.profiles
          (account_id,display_name,bio,country,language,updated_at)
          VALUES ($1,$2,$3,$4,$5,now())
          ON CONFLICT (account_id) DO UPDATE SET display_name=excluded.display_name,
          bio=excluded.bio,country=excluded.country,language=excluded.language,updated_at=now()`,
          [account.id,displayName,bio,country,language]);
        account.display_name=displayName;account.bio=bio;account.country=country;account.language=language;
      }
      return json(res,200,{ok:true,profile:{
        nickname:account.nickname,email:account.email_key,
        displayName:account.display_name||account.nickname,
        bio:account.bio||'',country:account.country||'PL',
        language:account.language||'pl',createdAt:account.created_at
      }}),true;
    }catch(e){
      console.error('IDENTITY_PROFILE_ERROR',{code:safeText(e?.code)||'PROFILE_ERROR'});
      return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
    }
  }
  if(url.pathname==='/auth/nick-available' && req.method==='GET'){
   if(!allow('nick-check:'+req.socket.remoteAddress,55))return bad(res,429,'ZBYT_WIELE_PROB'),true;
   const nick=normalizeNick(url.searchParams.get('nick'));
   if(!validNick(nick))return json(res,200,{ok:true,available:false}),true;
   try{
    await ready();
    const lookup=await database.query('SELECT 1 FROM gracz_public_identity.accounts WHERE nickname_key=$1 LIMIT 1',[nick.toLowerCase()]);
    return json(res,200,{ok:true,available:lookup.rows.length===0}),true;
   }catch{return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;}
  }
  if(req.method!=='POST')return bad(res,405,'METODA_NIEDOZWOLONA'),true;
  if(!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
  if(!['/auth/register','/auth/verify','/auth/login','/auth/logout'].includes(url.pathname))return bad(res,404,'NIE_ZNALEZIONO'),true;
  if(!allow('ip:'+req.socket.remoteAddress,35))return bad(res,429,'ZBYT_WIELE_PROB'),true;
  let body;
  try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
  try{
   await ready();
   if(url.pathname==='/auth/register'){
    const nick=normalizeNick(body.nickname),email=normalizeEmail(body.email),pwd=body.password;
    if(!validNick(nick)||!validEmail(email)||!validPassword(pwd)||pwd!==body.repeatPassword||body.terms!==true||body.privacy!==true)
      return bad(res,400,'POPRAW_DANE_FORMULARZA'),true;
    if(!allow('reg:'+digest(email).toString('hex'),3))return bad(res,429,'ZBYT_WIELE_PROB'),true;
    const salt=randomBytes(16),hash=await hashPassword(pwd,salt),verify=randomBytes(32).toString('hex');
    let created=false;
    try{
     await database.query(`INSERT INTO gracz_public_identity.accounts
       (id,nickname,nickname_key,email_key,salt,password_digest,verify_digest,verify_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')`,
       [randomUUID(),nick,nick.toLowerCase(),email,salt,hash,digest(verify)]);created=true;
    }catch(e){if(e?.code!=='23505')throw e;}
    if(created){
     const sent=await sendVerifyEmail(resendKey,emailFrom,email,verify);
     if(!sent)return bad(res,503,'NIE_UDALO_SIE_WYSLAC_EMAIL'),true;
    }
    return json(res,200,{ok:true,message:'Sprawdź pocztę i potwierdź adres e-mail.'}),true;
   }
   if(url.pathname==='/auth/verify'){
    const token=safeText(body.token);
    if(!/^[a-f0-9]{64}$/.test(token))return bad(res,400,'LINK_NIEWAZNY'),true;
    const x=await database.query(`UPDATE gracz_public_identity.accounts
      SET verified_at=now(),verify_digest=NULL,verify_expires_at=NULL
      WHERE verify_digest=$1 AND verify_expires_at>now() AND verified_at IS NULL RETURNING id`,[digest(token)]);
    return x.rowCount?json(res,200,{ok:true}):bad(res,400,'LINK_NIEWAZNY_LUB_WYGASL'),true;
   }
   if(url.pathname==='/auth/login'){
    const login=normalizeEmail(body.login),pwd=body.password;
    if(login.length>254||!validPassword(pwd))return bad(res,401,'BLEDNY_LOGIN_LUB_HASLO'),true;
    if(!allow('login:'+digest(login).toString('hex'),12))return bad(res,429,'ZBYT_WIELE_PROB'),true;
    const x=await database.query(`SELECT id,nickname,salt,password_digest,verified_at
      FROM gracz_public_identity.accounts WHERE email_key=$1 OR nickname_key=$1 LIMIT 1`,[login]);
    const account=x.rows[0],salt=account?.salt||Buffer.from('0000000000000000'),hash=await hashPassword(pwd,salt);
    if(!account||!timingSafeEqual(Buffer.from(account.password_digest),hash)||!account.verified_at)
      return bad(res,401,'BLEDNY_LOGIN_LUB_HASLO'),true;
    const token=randomBytes(32).toString('hex');
    await database.query(`INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at)
      VALUES($1,$2,now()+interval '7 days')`,[digest(token),account.id]);
    res.setHeader('Set-Cookie',cookie(token));
    return json(res,200,{ok:true,nickname:account.nickname}),true;
   }
   if(url.pathname==='/auth/logout'){
    const token=sessionToken(req);
    if(/^[a-f0-9]{64}$/.test(token))await database.query('DELETE FROM gracz_public_identity.sessions WHERE token_digest=$1',[digest(token)]);
    res.setHeader('Set-Cookie',clearCookie());
    return json(res,200,{ok:true}),true;
   }
  }catch(e){console.error('IDENTITY_PUBLIC_ERROR',{code:safeText(e?.code)||'AUTH_ERROR'});return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;}
  return bad(res,404,'NIE_ZNALEZIONO'),true;
 }
 return {handle:respond,probe:ready};
}
