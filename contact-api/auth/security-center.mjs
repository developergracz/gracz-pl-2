// GRACZ.PL — account-owned security center. No external providers or secondary auth.
// Sessions remain authoritative in gracz_public_identity.sessions.
import {createHash,randomUUID} from 'node:crypto';

const ROOT='gracz_public_identity';
const EVENTS=new Set(['login_success','password_changed','other_sessions_revoked','session_revoked','preferences_updated']);
function reply(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(body));return true;
}
const fail=(res,status,error)=>reply(res,status,{ok:false,error});
const sessionKey=digest=>createHash('sha256').update(Buffer.from(digest)).digest('hex');
function browserLabel(agent){
 if(typeof agent!=='string')return 'Nieznana przeglądarka';
 const v=agent.slice(0,300);
 const app=/Edg\//.test(v)?'Edge':/OPR\//.test(v)?'Opera':/Firefox\//.test(v)?'Firefox':
  /Chrome\//.test(v)?'Chrome':/Safari\//.test(v)?'Safari':'Przeglądarka';
 const system=/Windows/i.test(v)?'Windows':/Android/i.test(v)?'Android':
  /iPhone|iPad/i.test(v)?'iOS/iPadOS':/Macintosh|Mac OS/i.test(v)?'macOS':
  /Linux/i.test(v)?'Linux':'inne urządzenie';
 return app+' · '+system;
}
export async function ensureSecuritySchema(db){
 await db.query('CREATE TABLE IF NOT EXISTS '+ROOT+'.security_preferences (account_id uuid PRIMARY KEY REFERENCES '+ROOT+'.accounts(id) ON DELETE CASCADE,new_session_alert boolean NOT NULL DEFAULT true,password_alert boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now())');
 await db.query("CREATE TABLE IF NOT EXISTS "+ROOT+".security_events (id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,event_code text NOT NULL CHECK(event_code IN ('login_success','password_changed','other_sessions_revoked','session_revoked','preferences_updated')),created_at timestamptz NOT NULL DEFAULT now())");
 await db.query('CREATE INDEX IF NOT EXISTS gracz_security_events_recent ON '+ROOT+'.security_events(account_id,created_at DESC)');
 await db.query('CREATE TABLE IF NOT EXISTS '+ROOT+'.security_session_agents (token_digest bytea PRIMARY KEY REFERENCES '+ROOT+'.sessions(token_digest) ON DELETE CASCADE,browser_label text NOT NULL DEFAULT \'Nieznana przeglądarka\')');
}
export async function recordSecurityEvent(db,owner,code){
 if(!EVENTS.has(code))return false;
 await db.query('INSERT INTO '+ROOT+'.security_events(id,account_id,event_code) VALUES($1,$2,$3)',[randomUUID(),owner,code]);
 return true;
}
export async function recordSessionBrowser(db,tokenDigest,userAgent){
 await db.query('INSERT INTO '+ROOT+'.security_session_agents(token_digest,browser_label) VALUES($1,$2) ON CONFLICT(token_digest) DO UPDATE SET browser_label=excluded.browser_label',[tokenDigest,browserLabel(userAgent)]);
}
export function createSecurityCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  const root='/auth/security-center';
  if(url.pathname!==root && url.pathname!==root+'/revoke-session' && url.pathname!==root+'/revoke-others')return false;
  const isList=url.pathname===root,isDelete=url.pathname.endsWith('/revoke-session'),isAll=url.pathname.endsWith('/revoke-others');
  if((isList&&!['GET','PUT'].includes(req.method))||((isDelete||isAll)&&req.method!=='POST'))
   return fail(res,405,'METODA_NIEDOZWOLONA');
  if(req.method!=='GET'&&!authorizedOrigin(req))return fail(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return fail(res,401,'BRAK_SESJI');
   const tokenDigest=digest(token);
   const verified=await database.query('SELECT a.id,a.verified_at FROM '+ROOT+'.sessions s JOIN '+ROOT+'.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[tokenDigest]);
   if(!verified.rows.length)return fail(res,401,'BRAK_SESJI');
   const owner=verified.rows[0].id;
   if(!allow('security-center:'+owner,req.method==='GET'?160:45))return fail(res,429,'ZBYT_WIELE_PROB');
   if(isDelete){
    let body;try{body=await readBody(req)}catch{return fail(res,400,'BLEDNE_DANE')}
    const id=body.id;
    if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))return fail(res,400,'BLEDNE_DANE');
    const q=await database.query('SELECT s.token_digest FROM '+ROOT+'.sessions s WHERE s.account_id=$1 AND s.token_digest<>$2 AND s.expires_at>now() ORDER BY s.created_at DESC LIMIT 100',[owner,tokenDigest]);
    const target=q.rows.find(r=>sessionKey(r.token_digest)===id);
    if(!target)return fail(res,404,'SESJA_NIEAKTUALNA');
    const deleted=await database.query('DELETE FROM '+ROOT+'.sessions WHERE account_id=$1 AND token_digest=$2 AND token_digest<>$3 RETURNING token_digest',[owner,target.token_digest,tokenDigest]);
    if(!deleted.rowCount)return fail(res,409,'SESJA_NIEAKTUALNA');
    try{await recordSecurityEvent(database,owner,'session_revoked')}catch{}
    return reply(res,200,{ok:true,revoked:1});
   }
   if(isAll){
    const removed=await database.query('DELETE FROM '+ROOT+'.sessions WHERE account_id=$1 AND token_digest<>$2 RETURNING token_digest',[owner,tokenDigest]);
    if(removed.rowCount)try{await recordSecurityEvent(database,owner,'other_sessions_revoked')}catch{}
    return reply(res,200,{ok:true,revoked:removed.rowCount||0});
   }
   if(req.method==='PUT'){
    let body;try{body=await readBody(req)}catch{return fail(res,400,'BLEDNE_DANE')}
    if(typeof body.newSessionAlert!=='boolean'||typeof body.passwordAlert!=='boolean')
     return fail(res,400,'POPRAW_USTAWIENIA');
    await database.query('INSERT INTO '+ROOT+'.security_preferences(account_id,new_session_alert,password_alert) VALUES ($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET new_session_alert=excluded.new_session_alert,password_alert=excluded.password_alert,updated_at=now()',[owner,body.newSessionAlert,body.passwordAlert]);
    try{await recordSecurityEvent(database,owner,'preferences_updated')}catch{}
   }
   const [prefs,sessions,events]=await Promise.all([
    database.query('SELECT new_session_alert,password_alert FROM '+ROOT+'.security_preferences WHERE account_id=$1',[owner]),
    database.query('SELECT s.token_digest,s.created_at,s.expires_at,COALESCE(a.browser_label,\'Nieznana przeglądarka\') AS browser_label FROM '+ROOT+'.sessions s LEFT JOIN '+ROOT+'.security_session_agents a ON a.token_digest=s.token_digest WHERE s.account_id=$1 AND s.expires_at>now() ORDER BY s.created_at DESC LIMIT 100',[owner]),
    database.query('SELECT event_code,created_at FROM '+ROOT+'.security_events WHERE account_id=$1 ORDER BY created_at DESC,id DESC LIMIT 40',[owner])
   ]);
   const setting=prefs.rows[0]||{};
   return reply(res,200,{ok:true,verifiedEmail:true,secondFactor:{available:false,enabled:false},
    preferences:{newSessionAlert:setting.new_session_alert!==false,passwordAlert:setting.password_alert!==false},
    sessions:sessions.rows.map(r=>({id:sessionKey(r.token_digest),current:Buffer.from(r.token_digest).equals(Buffer.from(tokenDigest)),
     label:r.browser_label||'Nieznana przeglądarka',createdAt:r.created_at,expiresAt:r.expires_at})),
    events:events.rows.filter(e=>EVENTS.has(e.event_code)).map(e=>({code:e.event_code,at:e.created_at})),
    historyNote:'Historia wybranych zdarzeń od wdrożenia modułu. Nie obejmuje wcześniejszych logowań.',
    notificationsNote:'Alerty są widoczne tylko w panelu. Wysyłka e-mail nie jest uruchomiona.'});
  }catch(e){
   console.error('SECURITY_CENTER_ERROR',{code:typeof e?.code==='string'?e.code:'SECURITY_CENTER'});
   return fail(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
