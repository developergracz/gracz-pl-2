import {randomBytes,randomUUID,createHash,createPublicKey,verify as verifySignature,scrypt as rawScrypt} from 'node:crypto';
import {promisify} from 'node:util';

// Optional provider credentials are read only from Render environment variables.
// These routes stay disabled until each provider application is configured.
const hashPassword=promisify(rawScrypt);
const HOST='https://gracz-contact-api.onrender.com';
const STATE_COOKIE='__Host-gracz_oauth_state';
const SESSION_COOKIE='__Host-gracz_session';
const startAttempts=new Map();
function allowStart(ip){
 const now=Date.now();const key=String(ip||'unknown');
 const current=startAttempts.get(key);const next=!current||current.until<now?{count:1,until:now+600000}:{count:current.count+1,until:current.until};
 if(startAttempts.size>2000){for(const [k,v] of startAttempts){if(v.until<now)startAttempts.delete(k);}if(startAttempts.size>2000)startAttempts.clear();}
 startAttempts.set(key,next);return next.count<=20;
}
const providers={
 google:{
  clientId:process.env.GRACZ_GOOGLE_CLIENT_ID||'',
  secret:process.env.GRACZ_GOOGLE_CLIENT_SECRET||'',
  authorize:'https://accounts.google.com/o/oauth2/v2/auth',
  token:'https://oauth2.googleapis.com/token',
  keys:'https://www.googleapis.com/oauth2/v3/certs',
  scope:'openid email profile'
 },
 microsoft:{
  clientId:process.env.GRACZ_MICROSOFT_CLIENT_ID||'',
  secret:process.env.GRACZ_MICROSOFT_CLIENT_SECRET||'',
  authorize:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  keys:'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  scope:'openid profile email'
 },
 discord:{
  clientId:process.env.GRACZ_DISCORD_CLIENT_ID||'',
  secret:process.env.GRACZ_DISCORD_CLIENT_SECRET||'',
  authorize:'https://discord.com/oauth2/authorize',
  token:'https://discord.com/api/oauth2/token',
  userinfo:'https://discord.com/api/users/@me',
  scope:'identify email'
 }
};
const digest=value=>createHash('sha256').update(value).digest();
const rand=(size=32)=>randomBytes(size).toString('base64url');
const trimmed=value=>typeof value==='string'?value.trim():'';
const validEmail=value=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)&&value.length<=254;
const cookie=(name,value,age)=>name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
const byCookie=(req,name)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const redirect=(res,location,cookies=[])=>{
 res.writeHead(303,{'Location':location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',...(cookies.length?{'Set-Cookie':cookies}:{})});
 res.end();
};
const fail=(res,code)=>redirect(res,HOST+'/konto/?oauth_error='+encodeURIComponent(code),[cookie(STATE_COOKIE,'',0)]);
const endpoint=provider=>HOST+'/auth/oauth/'+provider+'/callback';
const enabled=provider=>Boolean(providers[provider]?.clientId&&providers[provider]?.secret);
async function getJson(url,opts={}){
 const response=await fetch(url,{...opts,signal:AbortSignal.timeout(9000),redirect:'error'});
 if(!response.ok)throw Error('REMOTE_AUTH_FAILURE');
 return response.json();
}
function verifyIdToken(token,provider,expectedNonce){
 if(typeof token!=='string'||token.length>16000||token.split('.').length!==3)throw Error('INVALID_ID_TOKEN');
 const [head,body,signature]=token.split('.');
 const header=JSON.parse(Buffer.from(head,'base64url').toString('utf8'));
 const claims=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw Error('UNSUPPORTED_TOKEN_ALGORITHM');
 const now=Math.floor(Date.now()/1000),aud=claims.aud;
 const clientId=providers[provider].clientId;
 if(!Number.isFinite(claims.exp)||claims.exp<=now-30||
    (claims.iat&&claims.iat>now+60)||(claims.nbf&&claims.nbf>now+60)||
    !(aud===clientId||(Array.isArray(aud)&&aud.includes(clientId)))||
    (Array.isArray(aud)&&aud.length>1&&claims.azp!==clientId)||
    claims.nonce!==expectedNonce||typeof claims.sub!=='string'||claims.sub.length>200){
  throw Error('INVALID_ID_TOKEN_CLAIMS');
 }
 if(provider==='google'){
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss))throw Error('INVALID_ISSUER');
 }else{
  const tenant=trimmed(claims.tid);
  if(!/^[0-9a-f-]{36}$/i.test(tenant)||
     claims.iss!=='https://login.microsoftonline.com/'+tenant+'/v2.0')throw Error('INVALID_ISSUER');
 }
 return {header,claims,head,body,signature};
}
async function identityFromTokens(provider,token,expectedNonce){
 if(provider==='discord'){
  const user=await getJson(providers.discord.userinfo,{
   headers:{Authorization:'Bearer '+token.access_token,Accept:'application/json'}
  });
  if(!/^\d{5,25}$/.test(String(user.id||'')))throw Error('INVALID_PROVIDER_ID');
  return {sub:String(user.id),email:trimmed(user.email).toLowerCase(),verified:user.verified===true,name:trimmed(user.global_name||user.username)};
 }
 const parsed=verifyIdToken(token.id_token,provider,expectedNonce);
 const keys=await getJson(providers[provider].keys);
 const jwk=(keys.keys||[]).find(k=>k.kid===parsed.header.kid&&k.kty==='RSA'&&
  (!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
 if(!jwk)throw Error('UNKNOWN_SIGNING_KEY');
 const publicKey=createPublicKey({key:jwk,format:'jwk'});
 const message=Buffer.from(parsed.head+'.'+parsed.body);
 if(!verifySignature('RSA-SHA256',message,publicKey,Buffer.from(parsed.signature,'base64url')))
  throw Error('INVALID_ID_TOKEN_SIGNATURE');
 const claims=parsed.claims;
 const email=trimmed(claims.email||claims.preferred_username).toLowerCase();
 return {sub:claims.sub,email,verified:provider==='google'&&claims.email_verified===true,
  name:trimmed(claims.name||claims.preferred_username||email.split('@')[0])};
}
function nickname(name){
 const normalized=String(name||'gracz').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9._-]/gi,'').replace(/^[^a-z]+/i,'').slice(0,18);
 return (normalized.length>=3?normalized:'gracz')+'_'+randomBytes(3).toString('hex');
}
export function createOAuthRegistrationRouter({database,ready,sendVerifyEmail,recordSessionBrowser=async()=>{},recordSecurityEvent=async()=>{}}){
 let initialized;
 async function oauthReady(){
  await ready();
  if(!initialized){
   initialized=(async()=>{
    await database.query('CREATE TABLE IF NOT EXISTS gracz_public_identity.oauth_pending ('+
      'state_digest bytea PRIMARY KEY, provider text NOT NULL, verifier text NOT NULL, nonce text NOT NULL,'+
      ' expires_at timestamptz NOT NULL)');
    await database.query('CREATE TABLE IF NOT EXISTS gracz_public_identity.oauth_identities ('+
      'provider text NOT NULL, subject text NOT NULL, account_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,'+
      ' created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (provider,subject),'+
      ' UNIQUE (account_id,provider))');
   })().catch(e=>{initialized=null;throw e});
  }
  await initialized;
 }
 async function handle(req,res,url){
  if(url.pathname==='/auth/oauth/providers'){
   if(req.method!=='GET'){res.writeHead(405,{'Cache-Control':'no-store'});res.end();return true;}
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'});
   res.end(JSON.stringify({ok:true,providers:Object.fromEntries(Object.keys(providers).map(p=>[p,enabled(p)]))}));
   return true;
  }
  const match=/^\/auth\/oauth\/(google|microsoft|discord)\/(start|callback)$/.exec(url.pathname);
  if(!match)return false;
  const [,provider,stage]=match;
  if(req.method!=='GET'){res.writeHead(405,{'Cache-Control':'no-store'});res.end();return true;}
  if(!enabled(provider))return fail(res,'not-configured'),true;
  try{
   await oauthReady();
   if(stage==='start'){
    if(!allowStart(req.socket?.remoteAddress))return fail(res,'too-many-requests'),true;
    const state=rand(32),verifier=rand(32),nonce=rand(32);
    await database.query('DELETE FROM gracz_public_identity.oauth_pending WHERE expires_at < now()');
    await database.query('INSERT INTO gracz_public_identity.oauth_pending(state_digest,provider,verifier,nonce,expires_at)'+
     " VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[digest(state),provider,verifier,nonce]);
    const auth=new URL(providers[provider].authorize);
    const args={client_id:providers[provider].clientId,redirect_uri:endpoint(provider),response_type:'code',
     scope:providers[provider].scope,state};
    args.code_challenge=createHash('sha256').update(verifier).digest('base64url');
    args.code_challenge_method='S256';
    if(provider!=='discord')args.nonce=nonce;
    for(const [key,value] of Object.entries(args))auth.searchParams.set(key,value);
    redirect(res,auth.toString(),[cookie(STATE_COOKIE,state,600)]);return true;
   }
   const state=trimmed(url.searchParams.get('state'));
   const code=trimmed(url.searchParams.get('code'));
   const fromCookie=byCookie(req,STATE_COOKIE);
   if(!state||!code||state.length>160||code.length>2000||state!==fromCookie)
    return fail(res,'invalid-state'),true;
   const pending=await database.query(
    'DELETE FROM gracz_public_identity.oauth_pending WHERE state_digest=$1 AND provider=$2 AND expires_at>now() RETURNING verifier,nonce',
    [digest(state),provider]);
   if(pending.rows.length!==1)return fail(res,'expired'),true;
   const {verifier,nonce}=pending.rows[0];
   const token=await getJson(providers[provider].token,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
    body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:endpoint(provider),
     client_id:providers[provider].clientId,client_secret:providers[provider].secret,code_verifier:verifier}).toString()
   });
   if(typeof token.access_token!=='string'||token.access_token.length<10)
    return fail(res,'invalid-token'),true;
   const ident=await identityFromTokens(provider,token,nonce);
   if(!validEmail(ident.email)||!ident.sub)
    return fail(res,'email-required'),true;
   let account=await database.query(
    'SELECT a.id,a.verified_at,a.nickname FROM gracz_public_identity.oauth_identities o '+
    'JOIN gracz_public_identity.accounts a ON a.id=o.account_id '+
    'WHERE o.provider=$1 AND o.subject=$2 LIMIT 1',[provider,ident.sub]);
   if(account.rows.length===0){
    const salt=randomBytes(16),randomPassword=rand(40);
    const passwordDigest=Buffer.from(await hashPassword(randomPassword,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}));
    const verificationToken=ident.verified?null:randomBytes(32).toString('hex');
    const accountId=randomUUID(),nick=nickname(ident.name);
    // The CTE guarantees we never silently attach a provider to an existing email account.
    const created=await database.query(
     'WITH inserted AS (INSERT INTO gracz_public_identity.accounts'+
     '(id,nickname,nickname_key,email_key,salt,password_digest,verified_at,verify_digest,verify_expires_at)'+
     ' VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id,nickname,verified_at),'+
     ' associated AS (INSERT INTO gracz_public_identity.oauth_identities(provider,subject,account_id)'+
     ' SELECT $10,$11,id FROM inserted ON CONFLICT DO NOTHING RETURNING account_id)'+
     ' SELECT inserted.id,inserted.nickname,inserted.verified_at FROM inserted'+
     ' JOIN associated ON associated.account_id=inserted.id',
     [accountId,nick,nick.toLowerCase(),ident.email,salt,passwordDigest,
      ident.verified?new Date():null,verificationToken?digest(verificationToken):null,
      verificationToken?new Date(Date.now()+30*60000):null,provider,ident.sub]);
    if(created.rows.length===0)return fail(res,'email-already-used'),true;
    account=created;
    if(verificationToken){
     let sent=false;try{sent=await sendVerifyEmail(ident.email,verificationToken);}catch{}
     return sent?redirect(res,HOST+'/konto/?oauth_notice=verify',[cookie(STATE_COOKIE,'',0)]),true:fail(res,'email-send-failed'),true;
    }
   }
   if(!account.rows[0].verified_at){
    const verificationToken=randomBytes(32).toString('hex');
    await database.query('UPDATE gracz_public_identity.accounts SET verify_digest=$1,'+
      "verify_expires_at=now()+interval '30 minutes' WHERE id=$2",
      [digest(verificationToken),account.rows[0].id]);
    let sent=false;try{sent=await sendVerifyEmail(ident.email,verificationToken);}catch{}
    return sent?redirect(res,HOST+'/konto/?oauth_notice=verify',[cookie(STATE_COOKIE,'',0)]),true:fail(res,'email-send-failed'),true;
   }
   const session= randomBytes(32).toString('hex');
   await database.query('INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at)'+
    " VALUES($1,$2,now()+interval '7 days')",[digest(session),account.rows[0].id]);
   try{await recordSessionBrowser(digest(session),req.headers['user-agent']);}catch{}
   try{await recordSecurityEvent(account.rows[0].id,'login_success');}catch{}
   redirect(res,HOST+'/konto/panel/',[cookie(STATE_COOKIE,'',0),cookie(SESSION_COOKIE,session,604800)]);
   return true;
  }catch(e){
   console.error('OAUTH_ACCOUNT_ERROR',{provider,code:typeof e?.message==='string'?e.message.slice(0,90):'OAUTH_ERROR'});
   return fail(res,'oauth-error'),true;
  }
 }
 return {handle,providers:()=>Object.fromEntries(Object.keys(providers).map(p=>[p,enabled(p)]))};
}
