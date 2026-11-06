import {ensureChallengeCenterSchema,createChallengeCenterRouter} from './challenge-center.mjs';
import {ensureNotificationSchema,createNotificationRouter} from './notification-center.mjs';
import {ensureMessageCenterSchema,createMessageCenterRouter} from './message-center.mjs';
import {ensurePrivacySchema,createPrivacyRouter} from './privacy-center.mjs';
import {createOAuthRegistrationRouter} from './oauth-registration.mjs';
import {createSearchAccessRouter} from './search-access.mjs';
import {ensureSecuritySchema,createSecurityCenterRouter,recordSecurityEvent,recordSessionBrowser} from './security-center.mjs';
import {ensureAddressBookSchema,createAddressBookRouter} from './address-book.mjs';
import {ensurePremiumProfileSchema,createPremiumProfileRouter} from './premium-profile.mjs';
import { randomBytes, createHash, timingSafeEqual, randomUUID, scrypt as rawScrypt } from 'node:crypto';
import { initialGame, playMove } from './game-engine.mjs';
import {initialChessMatch,playChessMatch} from './chess-match.mjs';
import { promisify } from 'node:util';

const scrypt=promisify(rawScrypt);
const realtimeRead=Symbol('trusted realtime snapshot');
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
async function readBody(req,timeoutMs=0){
 return new Promise((resolve,reject)=>{
  let total=0,buf='',timer;
  const fail=error=>{clearTimeout(timer);reject(error);};
  if(timeoutMs)timer=setTimeout(()=>{fail(new Error('BODY_TIMEOUT'));req.destroy();},timeoutMs);
  req.on('data',chunk=>{total+=chunk.length;if(total>MAX_BODY){fail(new Error('TOO_LARGE'));req.destroy();return;}buf+=chunk.toString('utf8');});
  req.on('end',()=>{clearTimeout(timer);try{const x=JSON.parse(buf);if(!x||typeof x!=='object'||Array.isArray(x))throw Error('BAD_JSON');resolve(x);}catch{reject(new Error('BAD_JSON'));}});
  req.on('error',fail);
  req.on('close',()=>fail(new Error('BODY_CLOSED')));
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
async function sendResetPasswordEmail(apiKey,from,to,token){
 const link=HOST+'/konto/#nowe-haslo='+encodeURIComponent(token);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',signal:controller.signal,
   headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({from,to,subject:'gracz.pl — odzyskiwanie hasła',
    html:'<p>Otrzymaliśmy prośbę o zmianę hasła do konta gracz.pl.</p><p><a href="'+link+'">Ustaw nowe hasło</a></p><p>Link jest ważny 20 minut i działa tylko raz. Jeśli nie prosiłeś o zmianę, zignoruj wiadomość.</p>'})
  });
  return response.ok;
 }finally{clearTimeout(timer);}
}
// Same text for a new and an already registered address (no account enumeration).
const REGISTRATION_ACCEPTED='Jeżeli to nowe konto, wysłaliśmy link aktywacyjny ważny 30 minut. Sprawdź skrzynkę e-mail, także folder SPAM.';
// Resolves false (never throws) when Resend did not accept the message; logs no address or token.
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
 if(!response.ok)console.error('IDENTITY_VERIFY_EMAIL_ERROR',{status:response.status});
 return response.ok;
 }catch(e){
  console.error('IDENTITY_VERIFY_EMAIL_ERROR',{code:e?.name==='AbortError'?'TIMEOUT':'NETWORK'});
  return false;
 }finally{clearTimeout(timer);}
}
function activeUndo(state){
 const pending=state?.undo;
 if(!pending||typeof pending!=='object'||typeof pending.id!=='string'||
    ![1,2].includes(pending.requester)||
    !Number.isInteger(pending.targetTo)||pending.targetTo<0||pending.targetTo>=225)return null;
 const started=Date.parse(pending.createdAt);
 if(!Number.isFinite(started)||started>Date.now()+10000||
    Date.now()-started>180000)return null;
 return pending;
}
function evaluateGomokuBoard(board){
 if(!Array.isArray(board)||board.length!==225)return 0;
 const directions=[[1,0],[0,1],[1,1],[1,-1]];
 for(let i=0;i<225;i++){
  const p=board[i];if(p!==1&&p!==2)continue;
  const r=Math.floor(i/15),c=i%15;
  for(const [dr,dc] of directions){
   let won=true;
   for(let n=1;n<5;n++){
    const rr=r+n*dr,cc=c+n*dc;
    if(rr>=15||cc<0||cc>=15||board[rr*15+cc]!==p){won=false;break;}
   }
   if(won)return p;
  }
 }
 return board.every(p=>p!==0)?3:0;
}


const gomokuTimeOptions=new Set([0,1,2,3,5,7,10,15,30]);
const gomokuIncrementOptions=new Set([0,2,3,5,10]);
function createTimedGame(game,minutes,incrementSeconds=0){
 const state=game==='szachy'?initialChessMatch():initialGame(game);
 if(['gomoku','warcaby','szachy'].includes(game)&&Number.isInteger(minutes)&&minutes>0&&gomokuTimeOptions.has(minutes)){
  const ms=minutes*60000;
  state.clock={limitMs:ms,incrementMs:(gomokuIncrementOptions.has(incrementSeconds)?incrementSeconds:0)*1000,
   remaining:[ms,ms],ready:[false,false],since:null};
 }
 return state;
}
// Every change to a timed game is guarded by the existing optimistic match version.
// The browser only displays time; the PostgreSQL-backed state is authoritative.
function advanceGomokuClock(state,now,joinPlayer=0){
 if(!state?.clock||state.winner)return {state,changed:false,expired:false};
 const clock=state.clock;
 if(!Array.isArray(clock.remaining)||clock.remaining.length!==2||
    !Array.isArray(clock.ready)||clock.ready.length!==2||
    !Number.isInteger(clock.limitMs)||clock.limitMs<=0)
   return {state,changed:false,expired:false};
 const next={...state,clock:{...clock,remaining:[...clock.remaining],ready:[...clock.ready]}};
 let changed=false,expired=false;
 // Waiting for a consent response pauses clocks, but an unanswered request
 // expires after three minutes. Restore the interrupted turn from that
 // expiry instant rather than allowing an indefinite frozen clock.
 if(state.undo&&!activeUndo(state)&&!clock.since&&clock.ready.every(Boolean)){
  const requested=Date.parse(state.undo.createdAt);
  delete next.undo;
  next.clock.since=new Date(Number.isFinite(requested)?requested+180000:now).toISOString();
  changed=true;
 }
 const runningSince=next.clock.since;
 if(runningSince&&clock.ready[0]&&clock.ready[1]&&[1,2].includes(state.turn)){
  const start=Date.parse(runningSince);
  if(Number.isFinite(start)){
   const elapsed=Math.max(0,now-start);
   if(elapsed>=clock.remaining[state.turn-1]){
    next.clock.remaining[state.turn-1]=0;
    next.clock.since=null;
    next.clock.timeoutLoser=state.turn;
    next.winner=state.turn===1?2:1;
    changed=true;expired=true;
   }
  }
 }
 if(!expired&&[1,2].includes(joinPlayer)&&!clock.ready[joinPlayer-1]){
  next.clock.ready[joinPlayer-1]=true;
  changed=true;
  if(next.clock.ready.every(Boolean))next.clock.since=new Date(now).toISOString();
 }
 return {state:changed?next:state,changed,expired};
}
function clockAfterMove(previous,next,at){
 if(!previous.clock)return next;
 const clock=previous.clock;
 const since=Date.parse(clock.since);
 const elapsed=Number.isFinite(since)?Math.max(0,at-since):0;
 const remaining=[...clock.remaining];
 remaining[previous.turn-1]=Math.max(0,remaining[previous.turn-1]-elapsed);
 // Fischer bonus applies once, only after an accepted, non-terminal legal move.
 if(!next.winner&&next.turn!==previous.turn&&Number.isInteger(clock.incrementMs)&&clock.incrementMs>=0&&clock.incrementMs<=10000)
  remaining[previous.turn-1]+=clock.incrementMs;
 return {...next,clock:{...clock,remaining,
  since:next.winner?null:new Date(at).toISOString()}};
}

export function createPublicIdentityRouter({database,emailFrom,resendKey,onGomokuChange=()=>{},onMatchChange=onGomokuChange}){
 let initialized,activeGameRequests=0,pendingGameBodies=0;
 const gameBodyReaders=new Map();
 // Notification only, after existing durable writes; authorization and rules are unchanged.
 const notifyGomoku=id=>{try{onMatchChange(id);}catch{}};
 const oauth=createOAuthRegistrationRouter({
  database,ready:()=>ready(),
  sendVerifyEmail:(email,token)=>sendVerifyEmail(resendKey,emailFrom,email,token),
  recordSessionBrowser:(token,userAgent)=>recordSessionBrowser(database,token,userAgent),
  recordSecurityEvent:(accountId,event)=>recordSecurityEvent(database,accountId,event)
 });
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
    await database.query('ALTER TABLE gracz_public_identity.accounts ADD COLUMN IF NOT EXISTS reset_digest bytea');
    await database.query('ALTER TABLE gracz_public_identity.accounts ADD COLUMN IF NOT EXISTS reset_expires_at timestamptz');
    await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.sessions (
      token_digest bytea PRIMARY KEY, account_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`);
    await database.query('CREATE INDEX IF NOT EXISTS gracz_public_sessions_expiry ON gracz_public_identity.sessions(expires_at)');
    await ensureSecuritySchema(database);
    await database.query('CREATE TABLE IF NOT EXISTS gracz_public_identity.online_presence(account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,last_seen timestamptz NOT NULL DEFAULT now())');
    await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.profiles (
      account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
      display_name text NOT NULL, bio text NOT NULL DEFAULT '',
      country text NOT NULL DEFAULT 'PL', language text NOT NULL DEFAULT 'pl',
      updated_at timestamptz NOT NULL DEFAULT now())`);
     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.player_preferences (
       account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       density text NOT NULL DEFAULT 'comfortable',
       reduce_motion boolean NOT NULL DEFAULT false,
       large_text boolean NOT NULL DEFAULT false,
       favorite_games text[] NOT NULL DEFAULT ARRAY[]::text[],
       updated_at timestamptz NOT NULL DEFAULT now())`);

     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.friend_connections (
       account_a uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       account_b uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       requested_by uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       status text NOT NULL CHECK(status IN ('pending','accepted')),
       requested_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY(account_a,account_b),
       CHECK(account_a<account_b),
       CHECK(requested_by=account_a OR requested_by=account_b))`);
     await database.query('CREATE INDEX IF NOT EXISTS gracz_friend_connections_b ON gracz_public_identity.friend_connections(account_b,status)');
     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.friend_blocks (
       blocker uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       blocked uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       created_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY(blocker,blocked),CHECK(blocker<>blocked))`);
     await database.query('CREATE INDEX IF NOT EXISTS gracz_friend_blocks_target ON gracz_public_identity.friend_blocks(blocked)');
     await ensureAddressBookSchema(database);
     await ensurePrivacySchema(database);
     await ensureNotificationSchema(database);
     await ensureMessageCenterSchema(database);

     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.friend_messages (
       id uuid PRIMARY KEY, sender_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       recipient_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
       created_at timestamptz NOT NULL DEFAULT now(),
       CHECK (sender_id<>recipient_id))`);
     await database.query('CREATE INDEX IF NOT EXISTS gracz_friend_messages_pair ON gracz_public_identity.friend_messages(sender_id,recipient_id,created_at DESC)');
     await database.query('CREATE INDEX IF NOT EXISTS gracz_friend_messages_inbox ON gracz_public_identity.friend_messages(recipient_id,created_at DESC)');
     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.game_challenges (
       id uuid PRIMARY KEY, sender_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       recipient_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       game text NOT NULL CHECK (game IN ('warcaby','gomoku','szachy')),
       status text NOT NULL CHECK (status IN ('pending','accepted','declined','cancelled','expired')),
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
       CHECK (sender_id<>recipient_id))`);
     const chessCheck=await database.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='gracz_public_identity.game_challenges'::regclass AND conname='game_challenges_game_check'");
     if(!chessCheck.rows[0]?.definition?.includes('szachy')){
       await database.query("ALTER TABLE gracz_public_identity.game_challenges DROP CONSTRAINT IF EXISTS game_challenges_game_check");
       await database.query("ALTER TABLE gracz_public_identity.game_challenges ADD CONSTRAINT game_challenges_game_check CHECK (game IN ('warcaby','gomoku','szachy'))");
     }
     await database.query('ALTER TABLE gracz_public_identity.game_challenges ADD COLUMN IF NOT EXISTS time_limit_minutes integer NOT NULL DEFAULT 0');
     await database.query('ALTER TABLE gracz_public_identity.game_challenges ADD COLUMN IF NOT EXISTS increment_seconds integer NOT NULL DEFAULT 0');
     await database.query('CREATE INDEX IF NOT EXISTS gracz_challenges_sender ON gracz_public_identity.game_challenges(sender_id,created_at DESC)');
     await database.query('CREATE INDEX IF NOT EXISTS gracz_challenges_recipient ON gracz_public_identity.game_challenges(recipient_id,created_at DESC)');
     await database.query("CREATE UNIQUE INDEX IF NOT EXISTS gracz_challenges_one_pending ON gracz_public_identity.game_challenges(LEAST(sender_id,recipient_id),GREATEST(sender_id,recipient_id),game) WHERE status='pending'");

     await ensureChallengeCenterSchema(database);

     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.game_matches (
       challenge_id uuid PRIMARY KEY REFERENCES gracz_public_identity.game_challenges(id) ON DELETE CASCADE,
       state jsonb NOT NULL, version integer NOT NULL DEFAULT 0,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now())`);
     await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.game_match_messages (
       id uuid PRIMARY KEY,
       match_id uuid NOT NULL REFERENCES gracz_public_identity.game_matches(challenge_id) ON DELETE CASCADE,
       sender_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
       body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
       created_at timestamptz NOT NULL DEFAULT now())`);
     await database.query('CREATE INDEX IF NOT EXISTS gracz_match_messages_recent ON gracz_public_identity.game_match_messages(match_id,created_at DESC,id DESC)');
     await ensurePremiumProfileSchema(database);
   })().catch(e=>{initialized=undefined;throw e;});
  }
  await initialized;
 }
 const premiumProfile=createPremiumProfileRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow,validNick});
 const addressBook=createAddressBookRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 const securityCenter=createSecurityCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 const privacyCenter=createPrivacyRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 const notificationCenter=createNotificationRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 const messageCenter=createMessageCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 const challengeCenter=createChallengeCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow});
 // SameSite=Lax __Host- session is readable only when navigating to this origin.
 const searchAccess=createSearchAccessRouter({isAuthenticated:async req=>{
  await ready();
  const token=sessionToken(req);
  if(!/^[a-f0-9]{64}$/.test(token))return false;
  const result=await database.query(`SELECT 1 FROM gracz_public_identity.sessions s
    JOIN gracz_public_identity.accounts a ON a.id=s.account_id
    WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
  return result.rows.length>0;
 }});
 async function respond(req,res,url){
  if(await searchAccess.handle(req,res,url))return true;
  if(await oauth.handle(req,res,url))return true;
  if(await premiumProfile.handle(req,res,url))return true;
  if(await addressBook.handle(req,res,url))return true;
  if(await securityCenter.handle(req,res,url))return true;
  if(await privacyCenter.handle(req,res,url))return true;
  if(await notificationCenter.handle(req,res,url))return true;
  if(await messageCenter.handle(req,res,url))return true;
  if(await challengeCenter.handle(req,res,url))return true;
  if(!url.pathname.startsWith('/auth/') && !url.pathname.startsWith('/konto'))return false;
  if(url.pathname==='/auth/status'){
   try{await ready();return json(res,200,{ok:true,ready:true}),true;}catch{return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;}
  }
  if(req.method==='GET'&&(url.pathname==='/konto'||url.pathname==='/konto/')){
   return false;
  }
  // Password changes share the existing account and HttpOnly-session backend.
  if(url.pathname==='/auth/change-password'){
   if(req.method!=='POST')return bad(res,405,'METODA_NIEDOZWOLONA'),true;
   if(!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
   try{
    await ready();
    const token=sessionToken(req);
    if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
    const tokenDigest=digest(token);
    const q=await database.query('SELECT a.id,a.salt,a.password_digest FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[tokenDigest]);
    if(!q.rows.length)return bad(res,401,'BRAK_SESJI'),true;
    const account=q.rows[0];
    if(!allow('password-change:'+account.id,8))
     return bad(res,429,'ZBYT_WIELE_PROB'),true;
    let body;
    try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
    const currentPassword=body.currentPassword,newPassword=body.newPassword,repeatPassword=body.repeatPassword;
    if(!validPassword(currentPassword))
     return bad(res,401,'BLEDNE_AKTUALNE_HASLO'),true;
    if(!validPassword(newPassword)||newPassword!==repeatPassword||newPassword===currentPassword)
     return bad(res,400,'POPRAW_NOWE_HASLO'),true;
    const currentHash=Buffer.from(account.password_digest);
    const computed=await hashPassword(currentPassword,Buffer.from(account.salt));
    if(currentHash.length!==computed.length||!timingSafeEqual(currentHash,computed))
     return bad(res,401,'BLEDNE_AKTUALNE_HASLO'),true;
    const newSalt=randomBytes(16),newHash=await hashPassword(newPassword,newSalt);
    // Update credentials and revoke all OTHER sessions in one atomic SQL statement.
    // The current authenticated HttpOnly cookie remains valid.
    const saved=await database.query('WITH updated AS (UPDATE gracz_public_identity.accounts SET salt=$3,password_digest=$4 WHERE id=$1 AND password_digest=$2 RETURNING id), revoked AS (DELETE FROM gracz_public_identity.sessions s USING updated u WHERE s.account_id=u.id AND s.token_digest<>$5 RETURNING s.token_digest) SELECT (SELECT count(*) FROM updated)::integer AS changed, (SELECT count(*) FROM revoked)::integer AS revoked',
     [account.id,currentHash,newSalt,newHash,tokenDigest]);
    if(Number(saved.rows[0]?.changed)!==1)
     return bad(res,409,'HASLO_ZMIENIONE_PONOW_PROBE'),true;
    try{await recordSecurityEvent(database,account.id,'password_changed')}catch{}
    return json(res,200,{ok:true,otherSessionsRevoked:Number(saved.rows[0]?.revoked)||0}),true;
   }catch(e){
    console.error('IDENTITY_PASSWORD_CHANGE_ERROR',{code:safeText(e?.code)||'PASSWORD_CHANGE_ERROR'});
    return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
   }
  }
  // Login nickname change for the authenticated account only. Account id, e-mail, password and
  // sessions stay as they are; every relation is keyed by account id. UNIQUE(nickname_key) in
  // PostgreSQL settles concurrent requests, so another account's nick is never overwritten.
  if(url.pathname==='/auth/change-nickname'){
   if(req.method!=='POST')return bad(res,405,'METODA_NIEDOZWOLONA'),true;
   if(!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
   try{
    await ready();
    const token=sessionToken(req);
    if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
    const q=await database.query('SELECT a.id,a.nickname,a.salt,a.password_digest FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
    if(!q.rows.length)return bad(res,401,'BRAK_SESJI'),true;
    const account=q.rows[0];
    if(!allow('nickname-change:'+account.id,10))return bad(res,429,'ZBYT_WIELE_PROB'),true;
    let body;
    try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
    const nick=normalizeNick(body.nickname),currentPassword=body.currentPassword;
    if(!validNick(nick))return bad(res,400,'POPRAW_NICK'),true;
    if(nick===account.nickname)return bad(res,400,'NICK_BEZ_ZMIAN'),true;
    if(!validPassword(currentPassword))return bad(res,401,'BLEDNE_AKTUALNE_HASLO'),true;
    const currentHash=Buffer.from(account.password_digest);
    const computed=await hashPassword(currentPassword,Buffer.from(account.salt));
    if(currentHash.length!==computed.length||!timingSafeEqual(currentHash,computed))
     return bad(res,401,'BLEDNE_AKTUALNE_HASLO'),true;
    let changed;
    try{
     changed=await database.query(`UPDATE gracz_public_identity.accounts SET nickname=$2,nickname_key=$3
       WHERE id=$1 AND password_digest=$4 AND verified_at IS NOT NULL RETURNING nickname`,
       [account.id,nick,nick.toLowerCase(),currentHash]);
    }catch(e){if(e?.code==='23505')return bad(res,409,'NICK_ZAJETY'),true;throw e;}
    if(changed.rowCount!==1)return bad(res,409,'HASLO_ZMIENIONE_PONOW_PROBE'),true;
    return json(res,200,{ok:true,nickname:changed.rows[0].nickname}),true;
   }catch(e){
    console.error('IDENTITY_NICKNAME_CHANGE_ERROR',{code:safeText(e?.code)||'NICKNAME_CHANGE_ERROR'});
    return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
   }
  }
  // Top-level, cookie-aware UI-state bridge for public static pages on gracz.pl.
  // The HttpOnly SameSite=Lax cookie is never exposed to gracz.pl; only a display
  // hint is returned. This hint MUST NEVER authorize an account operation.
  if(url.pathname==='/auth/header-sync'){
   if(req.method!=='GET')return bad(res,405,'METODA_NIEDOZWOLONA'),true;
   const target=String(url.searchParams.get('to')||'');
   let destination;
   try{
    if(!target||target.length>2000)throw Error('BAD_TARGET');
    destination=new URL(target);
    if(!['https://gracz.pl','https://www.gracz.pl'].includes(destination.origin)||
       destination.username||destination.password)throw Error('BAD_ORIGIN');
    destination.searchParams.delete('gracz_header_state');
   }catch{return bad(res,400,'NIEPRAWIDLOWY_ADRES'),true;}
   let state='unknown';
   try{
    await ready();
    const token=sessionToken(req);
    if(!/^[a-f0-9]{64}$/.test(token))state='out';
    else{
     const result=await database.query(`SELECT 1 FROM gracz_public_identity.sessions s
      JOIN gracz_public_identity.accounts a ON a.id=s.account_id
      WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
     state=result.rows.length?'in':'out';
    }
   }catch{state='unknown';}
   // No nickname, token, cookie, or other account data in the redirect.
   destination.searchParams.set('gracz_header_state',state);
   res.writeHead(302,{
    'Location':destination.toString(),'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'
   });
   res.end();
   return true;
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
  
  if(url.pathname==='/auth/player-center' || url.pathname==='/auth/player-center/revoke-others'){
    const revoke=url.pathname.endsWith('/revoke-others');
    if((revoke && req.method!=='POST')||(!revoke && !['GET','PUT'].includes(req.method)))
      return bad(res,405,'METODA_NIEDOZWOLONA'),true;
    if(req.method!=='GET' && !authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
    try{
      await ready();
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const tokenDigest=digest(token);
      const session=await database.query(`SELECT a.id FROM gracz_public_identity.sessions s
        JOIN gracz_public_identity.accounts a ON a.id=s.account_id
        WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[tokenDigest]);
      if(!session.rows.length)return bad(res,401,'BRAK_SESJI'),true;
      const accountId=session.rows[0].id;
      if(revoke){
        if(!allow('player-revoke:'+accountId,12))return bad(res,429,'ZBYT_WIELE_PROB'),true;
        const result=await database.query(`DELETE FROM gracz_public_identity.sessions
          WHERE account_id=$1 AND token_digest<>$2`,[accountId,tokenDigest]);
        return json(res,200,{ok:true,revoked:result.rowCount||0}),true;
      }
      if(req.method==='PUT'){
        if(!allow('player-prefs:'+accountId,35))return bad(res,429,'ZBYT_WIELE_PROB'),true;
        let body;try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
        const {density,reduceMotion,largeText,favoriteGames}=body;
        const allowedGames=['warcaby','gomoku','szachy','tysiac','poker'];
        if(!['comfortable','compact'].includes(density)||
          typeof reduceMotion!=='boolean'||typeof largeText!=='boolean'||
          !Array.isArray(favoriteGames)||favoriteGames.length>allowedGames.length||
          favoriteGames.some(game=>typeof game!=='string'||!allowedGames.includes(game))||
          new Set(favoriteGames).size!==favoriteGames.length)
          return bad(res,400,'POPRAW_USTAWIENIA'),true;
        await database.query(`INSERT INTO gracz_public_identity.player_preferences
          (account_id,density,reduce_motion,large_text,favorite_games,updated_at)
          VALUES ($1,$2,$3,$4,$5,now())
          ON CONFLICT(account_id) DO UPDATE SET density=excluded.density,
          reduce_motion=excluded.reduce_motion,large_text=excluded.large_text,
          favorite_games=excluded.favorite_games,updated_at=now()`,
          [accountId,density,reduceMotion,largeText,favoriteGames]);
      }
      const [prefResult,sessionsResult]=await Promise.all([
        database.query(`SELECT density,reduce_motion,large_text,favorite_games
          FROM gracz_public_identity.player_preferences WHERE account_id=$1`,[accountId]),
        database.query(`SELECT created_at,expires_at,(token_digest=$2) AS current
          FROM gracz_public_identity.sessions WHERE account_id=$1 AND expires_at>now()
          ORDER BY created_at DESC LIMIT 25`,[accountId,tokenDigest])
      ]);
      const pref=prefResult.rows[0]||{};
      return json(res,200,{ok:true,center:{
        preferences:{
          density:pref.density||'comfortable',
          reduceMotion:pref.reduce_motion===true,
          largeText:pref.large_text===true,
          favoriteGames:Array.isArray(pref.favorite_games)?pref.favorite_games:[]
        },
        sessions:sessionsResult.rows.map(row=>({
          createdAt:row.created_at,expiresAt:row.expires_at,current:row.current===true
        }))
      }}),true;
    }catch(e){
      console.error('PLAYER_CENTER_ERROR',{code:safeText(e?.code)||'CENTER_ERROR'});
      return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
    }
  }

 

  if(url.pathname==='/auth/match' || url.pathname==='/auth/match/chat' || url.pathname==='/auth/match/undo'){
    const isChat=url.pathname==='/auth/match/chat';
    const isUndo=url.pathname==='/auth/match/undo';
    if(!['GET','POST'].includes(req.method))return bad(res,405,'METODA_NIEDOZWOLONA'),true;
    if(req.method==='POST'&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
    // Slow bodies have a separate, bounded budget and never hold DB/read slots.
    let body={};
    if(req.method==='POST'){
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const key=digest(token).toString('hex'),count=gameBodyReaders.get(key)||0;
      if(count>=2||pendingGameBodies>=64)return bad(res,429,'ZBYT_WIELE_PROB'),true;
      gameBodyReaders.set(key,count+1);pendingGameBodies++;
      try{body=await readBody(req,5000);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
      finally{
        pendingGameBodies--;const left=gameBodyReaders.get(key)-1;
        if(left)gameBodyReaders.set(key,left);else gameBodyReaders.delete(key);
      }
    }
    if(activeGameRequests>=32)return bad(res,503,'SYSTEM_ZAJETY'),true;
    activeGameRequests++;
    try{
      await ready();
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const authenticated=await database.query(`SELECT a.id FROM gracz_public_identity.sessions s
        JOIN gracz_public_identity.accounts a ON a.id=s.account_id
        WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
      if(!authenticated.rows.length)return bad(res,401,'BRAK_SESJI'),true;
      const actor=authenticated.rows[0].id;
      if(!req[realtimeRead]&&!allow((isChat?'match-chat-':isUndo?'match-undo-':'game-')+req.method+':'+actor,
        isChat?(req.method==='GET'?180:40):isUndo?20:(req.method==='GET'?240:80)))
        return bad(res,429,'ZBYT_WIELE_PROB'),true;
      const matchId=req.method==='GET'?url.searchParams.get('id'):body.id;
      if(typeof matchId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId))
        return bad(res,400,'BLEDNY_IDENTYFIKATOR'),true;
      const readMatch=()=>database.query(`SELECT m.state,m.version,c.game,
        c.sender_id,c.recipient_id,
        s.nickname AS sender_nick,r.nickname AS recipient_nick,
        NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
          WHERE (b.blocker=c.sender_id AND b.blocked=c.recipient_id)
          OR (b.blocker=c.recipient_id AND b.blocked=c.sender_id)) AS playable
        FROM gracz_public_identity.game_matches m
        JOIN gracz_public_identity.game_challenges c ON c.id=m.challenge_id
        JOIN gracz_public_identity.accounts s ON s.id=c.sender_id
        JOIN gracz_public_identity.accounts r ON r.id=c.recipient_id
        WHERE c.id=$1 AND c.status='accepted'
          AND ($2=c.sender_id OR $2=c.recipient_id) LIMIT 1`,[matchId,actor]);
      let current=await readMatch();
      if(!current.rows[0]?.state){
        // A room is created only for an accepted invitation and one of its two verified participants.
        const invite=await database.query(`SELECT c.game,c.time_limit_minutes,c.increment_seconds FROM gracz_public_identity.game_challenges c
          WHERE c.id=$1 AND c.status='accepted' AND ($2=c.sender_id OR $2=c.recipient_id)
          LIMIT 1`,[matchId,actor]);
        if(!invite.rows.length)return bad(res,404,'PARTIA_NIEDOSTEPNA'),true;
        await database.query(`INSERT INTO gracz_public_identity.game_matches(challenge_id,state)
          SELECT c.id,$2::jsonb FROM gracz_public_identity.game_challenges c
          WHERE c.id=$1 AND c.status='accepted'
            AND (c.sender_id=$3 OR c.recipient_id=$3)
          ON CONFLICT DO NOTHING`,[matchId,JSON.stringify(createTimedGame(invite.rows[0].game,invite.rows[0].time_limit_minutes,invite.rows[0].increment_seconds)),actor]);
        current=await readMatch();
      }
      if(!current.rows.length)return bad(res,404,'PARTIA_NIEDOSTEPNA'),true;
      let match=current.rows[0];
      const player=match.sender_id===actor?1:2;

      // Joining a time-controlled room marks this participant ready.
      // Only after both participants have visited the room does the first clock start.
      // A wall-clock timeout is finalized by the backend even if the browser was closed.
      if(['gomoku','warcaby','szachy'].includes(match.game)&&match.state?.clock){
       for(let attempt=0;attempt<4;attempt++){
        const tick=advanceGomokuClock(match.state,Date.now(),req.method==='GET'&&!isChat&&!isUndo?player:0);
        if(!tick.changed)break;
        const saved=await database.query(`UPDATE gracz_public_identity.game_matches m
          SET state=$1::jsonb,version=m.version+1,updated_at=now()
          FROM gracz_public_identity.game_challenges c
          WHERE m.challenge_id=$2 AND c.id=m.challenge_id AND c.status='accepted'
            AND m.version=$3 AND (c.sender_id=$4 OR c.recipient_id=$4)
          RETURNING m.version`,[JSON.stringify(tick.state),matchId,match.version,actor]);
        if(saved.rowCount){
         match={...match,state:tick.state,version:saved.rows[0].version};
         notifyGomoku(matchId);
         break;
        }
        const refreshed=await readMatch();
        if(!refreshed.rows.length)return bad(res,404,'PARTIA_NIEDOSTEPNA'),true;
        match=refreshed.rows[0];
        if(attempt===3)return bad(res,409,'ODSWIEZ_PARTIE'),true;
       }
      }

      if(isUndo){
        if(match.game!=='gomoku')return bad(res,400,'COFANIE_TYLKO_GOMOKU'),true;
        if(!match.playable)return bad(res,403,'PARTIA_ZABLOKOWANA'),true;
        if(match.state.winner)return bad(res,409,'PARTIA_ZAKONCZONA'),true;
        const existing=activeUndo(match.state);
        const exposed=existing?{
          id:existing.id,requester:existing.requester,
          requesterName:existing.requester===1?match.sender_nick:match.recipient_nick,
          targetTo:existing.targetTo,createdAt:existing.createdAt
        }:null;
        if(req.method==='GET')return json(res,200,{ok:true,undoRequest:exposed}),true;
        if(!Number.isInteger(body.version)||body.version!==match.version)
          return bad(res,409,'ODSWIEZ_PARTIE'),true;
        let next;
        if(body.action==='request'){
          if(existing)return bad(res,409,'PROSBA_JUZ_WYSLANA'),true;
          const history=match.state?.history;
          const target=Array.isArray(history)?[...history].reverse().find(
            item=>item.player===player&&Number.isInteger(item.to)&&match.state.board[item.to]===player):null;
          if(!target)return bad(res,409,'BRAK_RUCHU_DO_COFNIECIA'),true;
          next={...match.state,undo:{
            id:randomUUID(),requester:player,targetTo:target.to,
            createdAt:new Date().toISOString()
          }};
          if(next.clock){
           const at=Date.now(),start=Date.parse(next.clock.since);
           const remaining=[...next.clock.remaining];
           if(Number.isFinite(start))remaining[next.turn-1]=Math.max(0,remaining[next.turn-1]-(at-start));
           next.clock={...next.clock,remaining,since:null};
          }
        }else if(body.action==='accept'||body.action==='reject'){
          if(!existing||existing.id!==body.requestId||existing.requester===player)
            return bad(res,409,'PROSBA_NIEAKTUALNA'),true;
          next={...match.state};
          delete next.undo;
          if(body.action==='accept'){
            const target=existing.targetTo,history=next.history;
            if(!Array.isArray(history)||next.board?.[target]!==existing.requester)
              return bad(res,409,'PROSBA_NIEAKTUALNA'),true;
            const removed=history.map(item=>item.player).lastIndexOf(existing.requester);
            if(removed<0||history[removed].to!==target)
              return bad(res,409,'PROSBA_NIEAKTUALNA'),true;
            const board=next.board.slice();board[target]=0;
            const remaining=history.filter((_,i)=>i!==removed)
              .map((item,i)=>({...item,number:i+1}));
            next.board=board;next.history=remaining;
            next.moves=board.filter(Boolean).length;
            next.turn=existing.requester;
            next.winner=evaluateGomokuBoard(board);
            next.last=remaining.length?remaining[remaining.length-1].to:-1;
            // Consent undo reclaims the bonus granted for the withdrawn stone.
            if(next.clock&&Number.isInteger(next.clock.incrementMs)&&next.clock.incrementMs>0){
             const clockRemaining=[...next.clock.remaining];
             clockRemaining[existing.requester-1]=Math.max(0,
              clockRemaining[existing.requester-1]-next.clock.incrementMs);
             next.clock={...next.clock,remaining:clockRemaining};
            }
          }
          if(next.clock&&next.clock.ready.every(Boolean)&&!next.winner)
           next.clock={...next.clock,since:new Date().toISOString()};
        }else return bad(res,400,'BLEDNA_AKCJA'),true;
        const changed=await database.query(`UPDATE gracz_public_identity.game_matches m
          SET state=$1::jsonb,version=m.version+1,updated_at=now()
          FROM gracz_public_identity.game_challenges c
          WHERE m.challenge_id=$2 AND c.id=m.challenge_id AND c.status='accepted'
            AND m.version=$3 AND (c.sender_id=$4 OR c.recipient_id=$4)
            AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
              WHERE (b.blocker=c.sender_id AND b.blocked=c.recipient_id)
              OR (b.blocker=c.recipient_id AND b.blocked=c.sender_id))
          RETURNING m.version`,[JSON.stringify(next),matchId,match.version,actor]);
        if(!changed.rowCount)return bad(res,409,'ODSWIEZ_PARTIE'),true;
        match={...match,state:next,version:changed.rows[0].version};
        notifyGomoku(matchId);
        const undo=activeUndo(next);
        return json(res,200,{ok:true,serverTime:new Date().toISOString(),match:{
          id:matchId,game:match.game,version:match.version,player,
          players:[match.sender_nick,match.recipient_nick],
          state:match.state,playable:match.playable===true,
          undoRequest:undo?{id:undo.id,requester:undo.requester,
            requesterName:undo.requester===1?match.sender_nick:match.recipient_nick,
            targetTo:undo.targetTo,createdAt:undo.createdAt}:null
        }}),true;
      }
      if(isChat){
        if(!match.playable)return bad(res,403,'PARTIA_ZABLOKOWANA'),true;
        if(!['gomoku','warcaby','szachy'].includes(match.game))return bad(res,400,'CZAT_NIEDOSTEPNY'),true;
        if(req.method==='GET'){
          const messages=await database.query(`SELECT id,sender_id,body,created_at FROM (
            SELECT id,sender_id,body,created_at
            FROM gracz_public_identity.game_match_messages
            WHERE match_id=$1 ORDER BY created_at DESC,id DESC LIMIT 60
          ) recent ORDER BY created_at,id`,[matchId]);
          return json(res,200,{ok:true,messages:messages.rows.map(row=>({
            id:row.id,player:row.sender_id===match.sender_id?1:2,
            body:row.body,createdAt:row.created_at
          }))}),true;
        }
        const message=typeof body.message==='string'?body.message.trim():'';
        if(message.length<1||message.length>600||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message))
          return bad(res,400,'POPRAW_WIADOMOSC'),true;
        const sent=await database.query(`INSERT INTO gracz_public_identity.game_match_messages
          (id,match_id,sender_id,body)
          SELECT $1,c.id,$2,$3 FROM gracz_public_identity.game_challenges c
          WHERE c.id=$4 AND c.status='accepted'
          AND ($2=c.sender_id OR $2=c.recipient_id)
          AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
             WHERE (b.blocker=c.sender_id AND b.blocked=c.recipient_id)
             OR (b.blocker=c.recipient_id AND b.blocked=c.sender_id))
          RETURNING id,created_at`,[randomUUID(),actor,message,matchId]);
        if(!sent.rowCount)return bad(res,403,'PARTIA_ZABLOKOWANA'),true;
        notifyGomoku(matchId);
        return json(res,200,{ok:true,message:{id:sent.rows[0].id,createdAt:sent.rows[0].created_at}}),true;
      }
      if(req.method==='POST'){
        if(!match.playable)return bad(res,403,'PARTIA_ZABLOKOWANA'),true;
        if(activeUndo(match.state))return bad(res,409,'OCZEKUJE_NA_DECYZJE'),true;
        if(match.state?.clock&&(!match.state.clock.ready.every(Boolean)||!match.state.clock.since)&&!match.state.winner)
         return bad(res,409,'OCZEKIWANIE_NA_GRACZA'),true;
        if(!Number.isInteger(body.version)||body.version!==match.version)
          return bad(res,409,'ODSWIEZ_PARTIE'),true;
        const movedAt=Date.now();
        const overdue=advanceGomokuClock(match.state,movedAt);
        if(overdue.expired)return bad(res,409,'CZAS_MINAL'),true;
        const result=match.game==='szachy'?playChessMatch(match.state,player,body.move):playMove(match.game,match.state,player,body.move);
        if(result.error)return bad(res,409,result.error),true;
        if(match.game==='gomoku'){
          const previous=Array.isArray(match.state.history)?match.state.history.slice(-224):[];
          result.state.history=[...previous,{player,to:body.move.to,number:result.state.moves}];
          result.state=clockAfterMove(match.state,result.state,movedAt);
        }
        if(match.game==='warcaby'){
          const previous=Array.isArray(match.state.history)?match.state.history.slice(-159):[];
          result.state.history=[...previous,{player,from:body.move.from,to:body.move.to,number:result.state.moves}];
          result.state=clockAfterMove(match.state,result.state,movedAt);
        }
        if(match.game==='szachy')result.state=clockAfterMove(match.state,result.state,movedAt);
        const updated=await database.query(`UPDATE gracz_public_identity.game_matches m
          SET state=$1::jsonb,version=m.version+1,updated_at=now()
          FROM gracz_public_identity.game_challenges c
          WHERE m.challenge_id=$2 AND c.id=m.challenge_id AND c.status='accepted'
            AND m.version=$3 AND (c.sender_id=$4 OR c.recipient_id=$4)
            AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
              WHERE (b.blocker=c.sender_id AND b.blocked=c.recipient_id)
              OR (b.blocker=c.recipient_id AND b.blocked=c.sender_id))
          RETURNING m.version`,[JSON.stringify(result.state),matchId,match.version,actor]);
        if(!updated.rowCount)return bad(res,409,'ODSWIEZ_PARTIE'),true;
        match={...match,state:result.state,version:updated.rows[0].version};
        notifyGomoku(matchId);
      }
      let messages;
      if(req[realtimeRead]){
        if(!match.playable)return bad(res,403,'PARTIA_ZABLOKOWANA'),true;
        const chat=await database.query(`SELECT id,sender_id,body,created_at FROM (
          SELECT id,sender_id,body,created_at FROM gracz_public_identity.game_match_messages
          WHERE match_id=$1 ORDER BY created_at DESC,id DESC LIMIT 60
        ) recent ORDER BY created_at,id`,[matchId]);
        messages=chat.rows.map(row=>({id:row.id,player:row.sender_id===match.sender_id?1:2,
          body:row.body,createdAt:row.created_at}));
      }
      return json(res,200,{ok:true,messages,serverTime:new Date().toISOString(),match:{
        id:matchId,game:match.game,version:match.version,player,
        players:[match.sender_nick,match.recipient_nick],
        state:match.state,playable:match.playable===true,
        undoRequest:activeUndo(match.state)?{
          id:match.state.undo.id,requester:match.state.undo.requester,
          requesterName:match.state.undo.requester===1?match.sender_nick:match.recipient_nick,
          targetTo:match.state.undo.targetTo,createdAt:match.state.undo.createdAt
        }:null
      }}),true;
    }catch(e){
      console.error('MATCH_ERROR',{code:safeText(e?.code)||'MATCH_ERROR'});
      return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
    }finally{activeGameRequests--;}
  }
  if(url.pathname==='/auth/social/messages'||url.pathname==='/auth/social/challenges'){
    const messages=url.pathname.endsWith('/messages');
    if(!['GET','POST'].includes(req.method))return bad(res,405,'METODA_NIEDOZWOLONA'),true;
    if(req.method==='POST'&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
    try{
      await ready();
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const auth=await database.query(`SELECT a.id FROM gracz_public_identity.sessions s
        JOIN gracz_public_identity.accounts a ON a.id=s.account_id
        WHERE s.token_digest=$1 AND s.expires_at>now()
        AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
      if(!auth.rows.length)return bad(res,401,'BRAK_SESJI'),true;
      const actor=auth.rows[0].id;
      // Only verified friends without a block in either direction may exchange content.
      const findFriend=nickname=>database.query(`SELECT a.id,a.nickname
        FROM gracz_public_identity.accounts a
        JOIN gracz_public_identity.friend_connections c
          ON c.account_a=LEAST($1::uuid,a.id) AND c.account_b=GREATEST($1::uuid,a.id)
          AND c.status='accepted'
        WHERE a.nickname_key=$2 AND a.id<>$1 AND a.verified_at IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
            WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1))
        LIMIT 1`,[actor,normalizeNick(nickname).toLowerCase()]);
      if(messages){
        if(req.method==='GET'){
          const nick=normalizeNick(url.searchParams.get('nick'));
          if(!validNick(nick))return bad(res,400,'WPISZ_NICK'),true;
          if(!allow('thread-read:'+actor,180))return bad(res,429,'ZBYT_WIELE_PROB'),true;
          const friend=await findFriend(nick);
          if(!friend.rows.length)return bad(res,403,'TYLKO_ZNAJOMI'),true;
          const other=friend.rows[0];
          const result=await database.query(`SELECT id,sender_id,body,created_at FROM (
            SELECT id,sender_id,body,created_at FROM gracz_public_identity.friend_messages
            WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)
            ORDER BY created_at DESC,id DESC LIMIT 60
          ) recent ORDER BY created_at ASC,id ASC`,[actor,other.id]);
          return json(res,200,{ok:true,friend:other.nickname,messages:result.rows.map(row=>({
            id:row.id,own:row.sender_id===actor,body:row.body,createdAt:row.created_at
          }))}),true;
        }
        if(!allow('message-send:'+actor,45))return bad(res,429,'ZBYT_WIELE_PROB'),true;
        let body;try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
        const nick=normalizeNick(body.nickname);
        const content=typeof body.message==='string'?body.message.trim():'';
        if(!validNick(nick)||content.length<1||content.length>1000||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content))
          return bad(res,400,'POPRAW_WIADOMOSC'),true;
        const friend=await findFriend(nick);
        if(!friend.rows.length)return bad(res,403,'TYLKO_ZNAJOMI'),true;
        const saved=await database.query(`INSERT INTO gracz_public_identity.friend_messages(id,sender_id,recipient_id,body)
          SELECT $1,$2,$3,$4
          WHERE EXISTS(
            SELECT 1 FROM gracz_public_identity.friend_connections c
              WHERE c.account_a=LEAST($2::uuid,$3::uuid)
              AND c.account_b=GREATEST($2::uuid,$3::uuid) AND c.status='accepted')
          AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
            WHERE (b.blocker=$2 AND b.blocked=$3) OR (b.blocker=$3 AND b.blocked=$2))
          AND COALESCE((SELECT p.friend_messages FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$3),true)
          AND (NOT COALESCE((SELECT p.trusted_messages_only FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$3),false)
            OR EXISTS (SELECT 1 FROM gracz_public_identity.player_address_book ab WHERE ab.owner_id=$3 AND ab.friend_id=$2 AND ab.favorite=true))
          RETURNING id,created_at`,[randomUUID(),actor,friend.rows[0].id,content]);
        if(!saved.rowCount)return bad(res,409,'TYLKO_ZNAJOMI'),true;
        return json(res,200,{ok:true,message:{id:saved.rows[0].id,createdAt:saved.rows[0].created_at}}),true;
      }
      if(req.method==='GET'){
        if(!allow('challenges-read:'+actor,120))return bad(res,429,'ZBYT_WIELE_PROB'),true;
        const result=await database.query(`SELECT c.id,c.game,c.time_limit_minutes,c.increment_seconds,
          state.starred,state.archived,state.seen_at,state.note,c.updated_at,
          CASE WHEN c.expires_at<=now() AND c.status='pending' THEN 'expired' ELSE c.status END AS status,
          c.created_at,c.expires_at,c.sender_id=$1 AS outgoing,
          a.nickname AS opponent
          FROM gracz_public_identity.game_challenges c
          LEFT JOIN gracz_public_identity.challenge_item_state state ON state.owner_id=$1 AND state.challenge_id=c.id
          JOIN gracz_public_identity.accounts a ON a.id=CASE
            WHEN c.sender_id=$1 THEN c.recipient_id ELSE c.sender_id END
          WHERE (c.sender_id=$1 OR c.recipient_id=$1)
          AND c.created_at>now()-interval '30 days'
          ORDER BY c.created_at DESC LIMIT 60`,[actor]);
        return json(res,200,{ok:true,challenges:result.rows.map(row=>({
          id:row.id,game:row.game,status:row.status,opponent:row.opponent,
          timeLimitMinutes:row.time_limit_minutes||0,incrementSeconds:row.increment_seconds||0,
          outgoing:row.outgoing===true,createdAt:row.created_at,expiresAt:row.expires_at,
          updatedAt:row.updated_at,starred:row.starred===true,archived:row.archived===true,
          seen:row.seen_at!=null,note:row.note||''
        }))}),true;
      }
      if(!allow('challenge-action:'+actor,30))return bad(res,429,'ZBYT_WIELE_PROB'),true;
      let body;try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
      const action=safeText(body.action);
      if(action==='send'){
        const nick=normalizeNick(body.nickname),game=safeText(body.game);
        const minutes=body.timeLimitMinutes===undefined?0:body.timeLimitMinutes;
        const incrementSeconds=body.incrementSeconds===undefined?0:body.incrementSeconds;
        if(!validNick(nick)||!['warcaby','gomoku','szachy'].includes(game)||
           !gomokuTimeOptions.has(minutes)||!gomokuIncrementOptions.has(incrementSeconds)||
           (minutes===0&&incrementSeconds!==0))
          return bad(res,400,'BLEDNE_DANE'),true;
        const friend=await findFriend(nick);
        if(!friend.rows.length)return bad(res,403,'TYLKO_ZNAJOMI'),true;
        const other=friend.rows[0].id;
        await database.query(`UPDATE gracz_public_identity.game_challenges
          SET status='expired',updated_at=now()
          WHERE status='pending' AND expires_at<=now()
          AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))`,[actor,other]);
        let saved;
        try{
          saved=await database.query(`INSERT INTO gracz_public_identity.game_challenges
            (id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds)
            SELECT $1,$2,$3,$4,'pending',$5,$6
            WHERE EXISTS(SELECT 1 FROM gracz_public_identity.friend_connections c
              WHERE c.account_a=LEAST($2::uuid,$3::uuid)
              AND c.account_b=GREATEST($2::uuid,$3::uuid) AND c.status='accepted')
            AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
              WHERE (b.blocker=$2 AND b.blocked=$3) OR (b.blocker=$3 AND b.blocked=$2))
            AND COALESCE((SELECT p.game_invites FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$3),true)
            AND (NOT COALESCE((SELECT p.trusted_invites_only FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$3),false)
             OR EXISTS (SELECT 1 FROM gracz_public_identity.player_address_book ab WHERE ab.owner_id=$3 AND ab.friend_id=$2 AND ab.favorite=true))
            ON CONFLICT DO NOTHING RETURNING id`,[randomUUID(),actor,other,game,minutes,incrementSeconds]);
        }catch(e){if(e?.code==='23505')return bad(res,409,'ZAPROSZENIE_JUZ_WYSLANE'),true;throw e;}
        if(!saved.rowCount)return bad(res,409,'ZAPROSZENIE_JUZ_WYSLANE'),true;
        return json(res,200,{ok:true,id:saved.rows[0].id,game,timeLimitMinutes:minutes,incrementSeconds}),true;
      }
      if(!['accept','decline','cancel'].includes(action)||
        typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))
        return bad(res,400,'BLEDNE_DANE'),true;
      const status=action==='accept'?'accepted':action==='decline'?'declined':'cancelled';
      const role=action==='cancel'?'sender_id':'recipient_id';
      const changed=await database.query(`UPDATE gracz_public_identity.game_challenges c
        SET status=$1,updated_at=now()
        WHERE c.id=$2 AND c.${role}=$3 AND c.status='pending' AND c.expires_at>now()
        AND EXISTS (SELECT 1 FROM gracz_public_identity.friend_connections f
          WHERE f.account_a=LEAST(c.sender_id,c.recipient_id)
          AND f.account_b=GREATEST(c.sender_id,c.recipient_id) AND f.status='accepted')
        AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
          WHERE (b.blocker=c.sender_id AND b.blocked=c.recipient_id)
          OR (b.blocker=c.recipient_id AND b.blocked=c.sender_id))
        RETURNING c.id`,[status,body.id,actor]);
      if(!changed.rowCount)return bad(res,409,'ZAPROSZENIE_NIEAKTUALNE'),true;
      return json(res,200,{ok:true,id:changed.rows[0].id,status}),true;
    }catch(e){
      console.error('SOCIAL_ERROR',{code:safeText(e?.code)||'SOCIAL_ERROR'});
      return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
    }
  }
  if(url.pathname==='/auth/friends/presence'&&req.method==='GET'){
    try{
      await ready();
      const token=sessionToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
      const own=await database.query(`INSERT INTO gracz_public_identity.online_presence(account_id,last_seen)
        SELECT a.id,now() FROM gracz_public_identity.sessions s
        JOIN gracz_public_identity.accounts a ON a.id=s.account_id
        WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL
        ON CONFLICT(account_id) DO UPDATE SET last_seen=now()
        RETURNING account_id AS id`,[digest(token)]);
      if(!own.rowCount)return bad(res,401,'BRAK_SESJI'),true;
      const actor=own.rows[0].id;
      if(!allow('friends-presence:'+actor,90))return bad(res,429,'ZBYT_WIELE_PROB'),true;
      const friends=await database.query(`SELECT a.nickname,
        EXISTS(SELECT 1 FROM gracz_public_identity.online_presence active
          WHERE active.account_id=a.id AND active.last_seen>now()-interval '100 seconds'
          AND COALESCE((SELECT p.show_online FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=a.id),true)
          AND (NOT COALESCE((SELECT p.trusted_presence_only FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=a.id),false)
            OR EXISTS (SELECT 1 FROM gracz_public_identity.player_address_book ab WHERE ab.owner_id=a.id AND ab.friend_id=$1 AND ab.favorite=true))) AS online
        FROM gracz_public_identity.friend_connections c
        JOIN gracz_public_identity.accounts a ON a.id=CASE
          WHEN c.account_a=$1 THEN c.account_b ELSE c.account_a END
        WHERE (c.account_a=$1 OR c.account_b=$1) AND c.status='accepted'
          AND a.verified_at IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks b
            WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1))
        ORDER BY online DESC,a.nickname_key ASC LIMIT 200`,[actor]);
      return json(res,200,{ok:true,friends:friends.rows.map(row=>({
        nickname:row.nickname,online:row.online===true
      }))}),true;
    }catch(e){
      console.error('FRIENDS_PRESENCE_ERROR',{code:safeText(e?.code)||'ERROR'});
      return bad(res,503,'SYSTEM_NIEDOSTEPNY'),true;
    }
  }
  if(url.pathname==='/auth/friends' || url.pathname==='/auth/friends/search' ||
      url.pathname==='/auth/friends/action'){
     const isSearch=url.pathname.endsWith('/search'),isAction=url.pathname.endsWith('/action');
     if((isAction&&req.method!=='POST')||(!isAction&&req.method!=='GET'))
       return bad(res,405,'METODA_NIEDOZWOLONA'),true;
     if(isAction&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
     try{
       await ready();
       const token=sessionToken(req);
       if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI'),true;
       const accountResult=await database.query(`SELECT a.id
         FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a
         ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now()
         AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
       if(!accountResult.rows.length)return bad(res,401,'BRAK_SESJI'),true;
       const accountId=accountResult.rows[0].id;
       if(isSearch){
         if(!allow('friends-search:'+accountId,60))return bad(res,429,'ZBYT_WIELE_PROB'),true;
         const term=normalizeNick(url.searchParams.get('nick')).toLowerCase();
         if(term.length<3||term.length>32||!/^[a-z][a-z0-9._-]+$/.test(term))
           return bad(res,400,'WPISZ_NICK'),true;
         const result=await database.query(`SELECT a.nickname
           FROM gracz_public_identity.accounts a
           WHERE a.verified_at IS NOT NULL AND a.id<>$1
           AND (CASE WHEN COALESCE((SELECT p.exact_search_only FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=a.id),false)
             THEN a.nickname_key=$2 ELSE starts_with(a.nickname_key,$2) END)
           AND COALESCE((SELECT p.discoverable FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=a.id),true)
           AND NOT EXISTS (SELECT 1 FROM gracz_public_identity.friend_blocks b
             WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1))
           ORDER BY a.nickname_key ASC LIMIT 15`,[accountId,term]);
         return json(res,200,{ok:true,players:result.rows.map(row=>({nickname:row.nickname}))}),true;
       }
       if(isAction){
         if(!allow('friends-action:'+accountId,80))return bad(res,429,'ZBYT_WIELE_PROB'),true;
         let body;
         try{body=await readBody(req);}catch{return bad(res,400,'BLEDNE_DANE'),true;}
         const action=safeText(body.action),nick=normalizeNick(body.nickname);
         if(!['send','accept','decline','cancel','remove','block','unblock'].includes(action)||
           !validNick(nick))return bad(res,400,'BLEDNE_DANE'),true;
         if(action==='send'&&!allow('friends-invite:'+accountId,20))
           return bad(res,429,'ZBYT_WIELE_ZAPROSZEN'),true;
         const target=await database.query(`SELECT id FROM gracz_public_identity.accounts
           WHERE nickname_key=$1 AND verified_at IS NOT NULL LIMIT 1`,[nick.toLowerCase()]);
         if(!target.rows.length||target.rows[0].id===accountId)
           return bad(res,404,'GRACZ_NIEDOSTEPNY'),true;
         const otherId=target.rows[0].id;
         let result;
         if(action==='send'){
           result=await database.query(`INSERT INTO gracz_public_identity.friend_connections
             (account_a,account_b,requested_by,status)
             SELECT LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1::uuid,'pending'
             WHERE COALESCE((SELECT p.friend_requests FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$2),true)
             AND (NOT COALESCE((SELECT p.mutual_friends_only_requests FROM gracz_public_identity.privacy_preferences p WHERE p.account_id=$2),false)
               OR EXISTS(SELECT 1 FROM gracz_public_identity.friend_connections f1
                JOIN gracz_public_identity.friend_connections f2
                  ON (CASE WHEN f1.account_a=$1 THEN f1.account_b ELSE f1.account_a END)
                   = (CASE WHEN f2.account_a=$2 THEN f2.account_b ELSE f2.account_a END)
                WHERE (f1.account_a=$1 OR f1.account_b=$1) AND f1.status='accepted'
                  AND (f2.account_a=$2 OR f2.account_b=$2) AND f2.status='accepted'))
             AND NOT EXISTS (SELECT 1 FROM gracz_public_identity.friend_blocks b
               WHERE (b.blocker=$1 AND b.blocked=$2) OR (b.blocker=$2 AND b.blocked=$1))
             ON CONFLICT DO NOTHING RETURNING account_a`,[accountId,otherId]);
           if(!result.rowCount)return bad(res,409,'ZAPROSZENIE_NIEDOSTEPNE'),true;
         }else if(action==='accept'){
           result=await database.query(`UPDATE gracz_public_identity.friend_connections
             SET status='accepted',updated_at=now()
             WHERE account_a=LEAST($1::uuid,$2::uuid)
             AND account_b=GREATEST($1::uuid,$2::uuid)
             AND status='pending' AND requested_by=$2
             AND NOT EXISTS (SELECT 1 FROM gracz_public_identity.friend_blocks b
               WHERE (b.blocker=$1 AND b.blocked=$2) OR (b.blocker=$2 AND b.blocked=$1))
             RETURNING account_a`,[accountId,otherId]);
           if(!result.rowCount)return bad(res,409,'ZAPROSZENIE_NIEDOSTEPNE'),true;
         }else if(['decline','cancel','remove'].includes(action)){
           const condition=action==='remove'?"status='accepted'":
             action==='decline'?"status='pending' AND requested_by=$2":"status='pending' AND requested_by=$1";
           result=await database.query(`DELETE FROM gracz_public_identity.friend_connections
             WHERE account_a=LEAST($1::uuid,$2::uuid)
             AND account_b=GREATEST($1::uuid,$2::uuid)
             AND ${condition} RETURNING account_a`,[accountId,otherId]);
           if(!result.rowCount)return bad(res,409,'ZAPROSZENIE_NIEDOSTEPNE'),true;
         }else if(action==='block'){
           await database.query(`INSERT INTO gracz_public_identity.friend_blocks(blocker,blocked)
             VALUES($1,$2) ON CONFLICT DO NOTHING`,[accountId,otherId]);
           await database.query(`DELETE FROM gracz_public_identity.friend_connections
             WHERE account_a=LEAST($1::uuid,$2::uuid)
             AND account_b=GREATEST($1::uuid,$2::uuid)`,[accountId,otherId]);
         }else{
           await database.query(`DELETE FROM gracz_public_identity.friend_blocks
             WHERE blocker=$1 AND blocked=$2`,[accountId,otherId]);
         }
         return json(res,200,{ok:true,action}),true;
       }
       const [connections,blocks]=await Promise.all([
         database.query(`SELECT a.nickname,c.status,
           CASE WHEN c.requested_by=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
           FROM gracz_public_identity.friend_connections c
           JOIN gracz_public_identity.accounts a ON a.id=CASE
             WHEN c.account_a=$1 THEN c.account_b ELSE c.account_a END
           WHERE (c.account_a=$1 OR c.account_b=$1) AND a.verified_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM gracz_public_identity.friend_blocks b
             WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1))
           ORDER BY c.updated_at DESC LIMIT 300`,[accountId]),
         database.query(`SELECT a.nickname FROM gracz_public_identity.friend_blocks b
           JOIN gracz_public_identity.accounts a ON a.id=b.blocked
           WHERE b.blocker=$1 ORDER BY a.nickname_key LIMIT 200`,[accountId])
       ]);
       return json(res,200,{ok:true,connections:connections.rows.map(row=>({
         nickname:row.nickname,status:row.status,direction:row.direction
       })),blocked:blocks.rows.map(row=>({nickname:row.nickname}))}),true;
     }catch(e){
       console.error('FRIENDS_ERROR',{code:safeText(e?.code)||'FRIENDS_ERROR'});
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
  if(!['/auth/register','/auth/verify','/auth/login','/auth/logout','/auth/forgot-password','/auth/reset-password'].includes(url.pathname))return bad(res,404,'NIE_ZNALEZIONO'),true;
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
    const id=randomUUID(),nickKey=nick.toLowerCase();
    const insertAccount=async()=>(await database.query(`INSERT INTO gracz_public_identity.accounts
       (id,nickname,nickname_key,email_key,salt,password_digest,verify_digest,verify_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes') ON CONFLICT DO NOTHING`,
       [id,nick,nickKey,email,salt,hash,digest(verify)])).rowCount===1;
    let created=await insertAccount();
    if(!created){
     // An unconfirmed registration whose link expired can never sign in, reset or activate.
     // Release its e-mail/nick so the mailbox owner can register again with a fresh link.
     const released=await database.query(`DELETE FROM gracz_public_identity.accounts
       WHERE (email_key=$1 OR nickname_key=$2) AND verified_at IS NULL
       AND (verify_expires_at IS NULL OR verify_expires_at<=now())`,[email,nickKey]);
     if(released.rowCount)created=await insertAccount();
    }
    if(created){
     if(!await sendVerifyEmail(resendKey,emailFrom,email,verify)){
      // Never keep an account whose activation link was not sent: a retry must start clean.
      await database.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1 AND verified_at IS NULL',[id]);
      return bad(res,503,'NIE_UDALO_SIE_WYSLAC_EMAIL'),true;
     }
     return json(res,200,{ok:true,message:REGISTRATION_ACCEPTED}),true;
    }
    // Nicknames are public (see /auth/nick-available). The answer never depends on the e-mail,
    // so an existing address gets exactly the same response as a new one.
    const nickTaken=await database.query('SELECT 1 FROM gracz_public_identity.accounts WHERE nickname_key=$1 LIMIT 1',[nickKey]);
    if(nickTaken.rows.length)return bad(res,409,'NICK_ZAJETY'),true;
    return json(res,200,{ok:true,message:REGISTRATION_ACCEPTED}),true;
   }
   if(url.pathname==='/auth/verify'){
    const token=safeText(body.token);
    if(!/^[a-f0-9]{64}$/.test(token))return bad(res,400,'LINK_NIEWAZNY'),true;
    const x=await database.query(`UPDATE gracz_public_identity.accounts
      SET verified_at=now(),verify_digest=NULL,verify_expires_at=NULL
      WHERE verify_digest=$1 AND verify_expires_at>now() AND verified_at IS NULL RETURNING id`,[digest(token)]);
    return x.rowCount?json(res,200,{ok:true}):bad(res,400,'LINK_NIEWAZNY_LUB_WYGASL'),true;
   }
   if(url.pathname==='/auth/forgot-password'){
    const email=normalizeEmail(body.email);
    if(!validEmail(email))return bad(res,400,'POPRAW_DANE_FORMULARZA'),true;
    if(!allow('forgot:'+digest(email).toString('hex'),3))return bad(res,429,'ZBYT_WIELE_PROB'),true;
    const match=await database.query(
      'SELECT id FROM gracz_public_identity.accounts WHERE email_key=$1 AND verified_at IS NOT NULL LIMIT 1',[email]);
    if(match.rows.length){
      const token=randomBytes(32).toString('hex');
      await database.query(`UPDATE gracz_public_identity.accounts
        SET reset_digest=$1,reset_expires_at=now()+interval '20 minutes'
        WHERE id=$2`,[digest(token),match.rows[0].id]);
      // Generic answer prevents account enumeration, including when email delivery fails.
      try{await sendResetPasswordEmail(resendKey,emailFrom,email,token);}catch(e){
        console.error('IDENTITY_RESET_EMAIL_ERROR',{code:safeText(e?.code)||'SEND_ERROR'});
      }
    }
    return json(res,200,{ok:true,message:'Jeżeli adres należy do potwierdzonego konta, wysłaliśmy instrukcję odzyskiwania hasła.'}),true;
   }
   if(url.pathname==='/auth/reset-password'){
    const token=safeText(body.token),password=body.password;
    if(!/^[a-f0-9]{64}$/.test(token)||!validPassword(password)||password!==body.repeatPassword)
      return bad(res,400,'POPRAW_DANE_FORMULARZA'),true;
    if(!allow('reset-password:'+req.socket.remoteAddress,12))
      return bad(res,429,'ZBYT_WIELE_PROB'),true;
    const salt=randomBytes(16),hash=await hashPassword(password,salt);
    const changed=await database.query(`WITH updated AS (
       UPDATE gracz_public_identity.accounts SET salt=$2,password_digest=$3,
       reset_digest=NULL,reset_expires_at=NULL
       WHERE reset_digest=$1 AND reset_expires_at>now() AND verified_at IS NOT NULL
       RETURNING id
      ), revoked AS (
       DELETE FROM gracz_public_identity.sessions s USING updated a
       WHERE s.account_id=a.id RETURNING s.account_id
      ) SELECT id FROM updated`,[digest(token),salt,hash]);
    if(!changed.rowCount)return bad(res,400,'LINK_NIEWAZNY_LUB_WYGASL'),true;
    return json(res,200,{ok:true,message:'Hasło zostało zmienione. Możesz się zalogować.'}),true;
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
    // Audit labels are best-effort: login remains valid if activity logging fails.
    try{await recordSessionBrowser(database,digest(token),req.headers['user-agent']);}catch{}
    try{await recordSecurityEvent(database,account.id,'login_success');}catch{}
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
 // Reuse the production identity session for game endpoints without creating a second login.
 // Return only the verified account identity. Never accept a player ID from client input.
 async function authenticateGameRequest(req){
  await ready();
  const token=sessionToken(req);
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const result=await database.query(`SELECT a.id, a.nickname
    FROM gracz_public_identity.sessions s
    JOIN gracz_public_identity.accounts a ON a.id=s.account_id
    WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
  const account=result.rows[0];
  return account?{userId:String(account.id),displayName:String(account.nickname)}:null;
 }
 async function readRealtime(req,id){
  let status=0,body;
  const res={writeHead(code){status=code;},end(raw){body=JSON.parse(String(raw));}};
  await respond({method:'GET',headers:req.headers,socket:req.socket,[realtimeRead]:true},res,
   new URL('/auth/match?id='+encodeURIComponent(id),HOST));
  if(status!==200||!body?.ok)throw Object.assign(Error('READ_DENIED'),{status});
  return body;
 }
 return {handle:respond,probe:ready,authenticateGameRequest,readRealtime};
}
