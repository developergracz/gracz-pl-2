// GRACZ.PL — real account-owned activity feed, no delivery providers or new services.
// Source events stay in their authoritative tables; this stores only personal inbox state.
const ROOT='gracz_public_identity';
const categories=['messages','friends','games','security'];
const settingKeys=['messages','friends','games','highlightUnread','showNicknames','showDates','autoReadOnOpen'];
const defaults=Object.freeze({messages:true,friends:true,games:true,highlightUnread:true,showNicknames:true,showDates:true,autoReadOnOpen:false,mutedUntil:null});
const SOURCE_QUERY=String.raw`
WITH source AS (
 SELECT 'message:'||m.id::text AS source_id,'messages' AS category,'Nowa wiadomość' AS title,
  a.nickname AS actor,'Otrzymano wiadomość prywatną' AS detail,m.created_at AS happened_at
 FROM gracz_public_identity.friend_messages m
 JOIN gracz_public_identity.accounts a ON a.id=m.sender_id
 LEFT JOIN gracz_public_identity.message_conversation_state state ON state.owner_id=$1 AND state.friend_id=m.sender_id
 WHERE m.recipient_id=$1 AND COALESCE(state.muted,false)=false
 UNION ALL
 SELECT 'friend-request:'||c.account_a::text||':'||c.account_b::text,'friends',
  'Zaproszenie do znajomych',a.nickname,'Nowe zaproszenie do zaakceptowania',c.requested_at
 FROM gracz_public_identity.friend_connections c
 JOIN gracz_public_identity.accounts a ON a.id=c.requested_by
 WHERE c.status='pending' AND c.requested_by<>$1 AND (c.account_a=$1 OR c.account_b=$1)
 UNION ALL
 SELECT 'friend-accepted:'||c.account_a::text||':'||c.account_b::text,'friends',
  'Zaakceptowano zaproszenie',a.nickname,'Nowa znajomość w GRACZ.PL',c.updated_at
 FROM gracz_public_identity.friend_connections c
 JOIN gracz_public_identity.accounts a ON a.id=CASE WHEN c.account_a=$1 THEN c.account_b ELSE c.account_a END
 WHERE c.status='accepted' AND c.requested_by=$1 AND (c.account_a=$1 OR c.account_b=$1)
 UNION ALL
 SELECT 'game-invite:'||c.id::text,'games','Zaproszenie do gry',a.nickname,
  'Zaproszenie: '||c.game,c.created_at
 FROM gracz_public_identity.game_challenges c
 JOIN gracz_public_identity.accounts a ON a.id=c.sender_id
 WHERE c.recipient_id=$1 AND c.status='pending' AND c.expires_at>now()
 UNION ALL
 SELECT 'game-update:'||c.id::text,'games',
  CASE WHEN c.status='accepted' THEN 'Przyjęto zaproszenie do gry'
       ELSE 'Odrzucono zaproszenie do gry' END,
  a.nickname,'Aktualizacja: '||c.game,c.updated_at
 FROM gracz_public_identity.game_challenges c
 JOIN gracz_public_identity.accounts a ON a.id=c.recipient_id
 WHERE c.sender_id=$1 AND c.status IN ('accepted','declined')
 UNION ALL
 SELECT 'security:'||e.id::text,'security',
  CASE e.event_code
   WHEN 'login_success' THEN 'Zalogowano do konta'
   WHEN 'password_changed' THEN 'Zmieniono hasło'
   WHEN 'session_revoked' THEN 'Zakończono sesję'
   WHEN 'other_sessions_revoked' THEN 'Wylogowano inne urządzenia'
   ELSE 'Zmieniono ustawienia ochrony' END,
  ''::text,'Zdarzenie dotyczące ochrony Twojego konta',e.created_at
 FROM gracz_public_identity.security_events e WHERE e.account_id=$1
),
recent AS (SELECT * FROM source WHERE happened_at>=now()-interval '90 days'
 ORDER BY happened_at DESC,source_id ASC LIMIT 200)
SELECT r.source_id,r.category,r.title,r.actor,r.detail,r.happened_at,
 st.read_at IS NOT NULL AS is_read,st.archived_at IS NOT NULL AS is_archived
FROM recent r
LEFT JOIN gracz_public_identity.notification_item_state st
 ON st.account_id=$1 AND st.source_id=r.source_id
ORDER BY r.happened_at DESC,r.source_id ASC
`;
function send(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(body));return true;
}
const bad=(res,status,error)=>send(res,status,{ok:false,error});
function pick(p={}){
 const output={};
 for(const key of settingKeys)output[key]=p[key]!==false;
 // autoReadOnOpen defaults false; enabling requires deliberate consent
 output.autoReadOnOpen=p.autoReadOnOpen===true;
 const mute=p.mutedUntil?new Date(p.mutedUntil):null;
 output.mutedUntil=mute&&Number.isFinite(mute.getTime())&&mute>Date.now()?mute.toISOString():null;
 return output;
}
function prefsFromRow(p={}){
 return pick({messages:p.messages_enabled,friends:p.friends_enabled,games:p.games_enabled,
  highlightUnread:p.highlight_unread,showNicknames:p.show_nicknames,showDates:p.show_dates,
  autoReadOnOpen:p.auto_read_on_open,mutedUntil:p.muted_until});
}
function validatePreferences(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const keys=Object.keys(input);
 if(keys.length!==settingKeys.length+1||!settingKeys.every(k=>typeof input[k]==='boolean'))return false;
 if(!keys.every(k=>settingKeys.includes(k)||k==='muteMinutes'))return false;
 return Number.isInteger(input.muteMinutes)&&[0,60,480,1440].includes(input.muteMinutes);
}
export async function ensureNotificationSchema(db){
 await db.query("CREATE TABLE IF NOT EXISTS "+ROOT+".notification_preferences (account_id uuid PRIMARY KEY REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,messages_enabled boolean NOT NULL DEFAULT true,friends_enabled boolean NOT NULL DEFAULT true,games_enabled boolean NOT NULL DEFAULT true,highlight_unread boolean NOT NULL DEFAULT true,show_nicknames boolean NOT NULL DEFAULT true,show_dates boolean NOT NULL DEFAULT true,auto_read_on_open boolean NOT NULL DEFAULT false,muted_until timestamptz,updated_at timestamptz NOT NULL DEFAULT now())");
 await db.query("CREATE TABLE IF NOT EXISTS "+ROOT+".notification_item_state (account_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,source_id text NOT NULL CHECK(length(source_id) BETWEEN 8 AND 160),read_at timestamptz,archived_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,source_id))");
}
export function createNotificationRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  const base='/auth/notification-center';
  if(url.pathname!==base&&url.pathname!==base+'/action')return false;
  const actionRoute=url.pathname.endsWith('/action');
  if((actionRoute&&req.method!=='POST')||(!actionRoute&&!['GET','PUT'].includes(req.method)))
   return bad(res,405,'METODA_NIEDOZWOLONA');
  if(req.method!=='GET'&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI');
   const auth=await database.query('SELECT a.id FROM '+ROOT+'.sessions s JOIN '+ROOT+'.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
   if(!auth.rows.length)return bad(res,401,'BRAK_SESJI');
   const owner=auth.rows[0].id;
   if(!allow('notifications:'+owner,req.method==='GET'?160:65))return bad(res,429,'ZBYT_WIELE_PROB');
   if(req.method==='PUT'){
    let body;try{body=await readBody(req)}catch{return bad(res,400,'BLEDNE_DANE')}
    if(!validatePreferences(body))return bad(res,400,'POPRAW_USTAWIENIA');
    const mute=body.muteMinutes===0?null:new Date(Date.now()+body.muteMinutes*60000);
    await database.query('INSERT INTO '+ROOT+'.notification_preferences (account_id,messages_enabled,friends_enabled,games_enabled,highlight_unread,show_nicknames,show_dates,auto_read_on_open,muted_until) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(account_id) DO UPDATE SET messages_enabled=EXCLUDED.messages_enabled,friends_enabled=EXCLUDED.friends_enabled,games_enabled=EXCLUDED.games_enabled,highlight_unread=EXCLUDED.highlight_unread,show_nicknames=EXCLUDED.show_nicknames,show_dates=EXCLUDED.show_dates,auto_read_on_open=EXCLUDED.auto_read_on_open,muted_until=EXCLUDED.muted_until,updated_at=now()',
      [owner,body.messages,body.friends,body.games,body.highlightUnread,body.showNicknames,body.showDates,body.autoReadOnOpen,mute]);
   }
   const settings=await database.query('SELECT messages_enabled,friends_enabled,games_enabled,highlight_unread,show_nicknames,show_dates,auto_read_on_open,muted_until FROM '+ROOT+'.notification_preferences WHERE account_id=$1',[owner]);
   const preferences=prefsFromRow(settings.rows[0]||{});
   const items=await database.query(SOURCE_QUERY,[owner]);
   const feed=items.rows.filter(row=>categories.includes(row.category)).map(row=>({
    id:row.source_id,category:row.category,title:row.title,actor:preferences.showNicknames?row.actor||'':'',
    detail:row.detail,at:row.happened_at,read:row.is_read===true,archived:row.is_archived===true
   }));
   const visible=feed.filter(row=>row.category==='security'||preferences[row.category]===true);
   if(actionRoute){
    let body;try{body=await readBody(req)}catch{return bad(res,400,'BLEDNE_DANE')}
    const action=body.action, permitted=['read','unread','archive','restore','read-all','archive-read'];
    if(!permitted.includes(action)||!Array.isArray(body.ids)||body.ids.length>200 ||
       !body.ids.every(id=>typeof id==='string'&&id.length<=160))return bad(res,400,'BLEDNE_DANE');
    const available=new Set(visible.map(row=>row.id)),eligible=new Set();
    if(action==='read-all'){for(const x of visible)if(!x.archived&&!x.read)eligible.add(x.id);}
    if(action==='archive-read'){for(const x of visible)if(!x.archived&&x.read)eligible.add(x.id);}
    if(action!=='read-all'&&action!=='archive-read'){
     if(body.ids.length!==1||!available.has(body.ids[0]))return bad(res,404,'POWIADOMIENIE_NIEDOSTEPNE');
     eligible.add(body.ids[0]);
    }
    const ids=[...eligible];
    if(ids.length){
     const column=['read','unread','read-all'].includes(action)?'read_at':'archived_at';
     const value=['unread','restore'].includes(action)?'NULL':'now()';
     const sql='INSERT INTO '+ROOT+'.notification_item_state(account_id,source_id,'+column+') SELECT $1,id,'+value+' FROM UNNEST($2::text[]) AS ids(id) WHERE TRUE ON CONFLICT(account_id,source_id) DO UPDATE SET '+column+'='+value+',updated_at=now()';
     await database.query(sql,[owner,ids]);
    }
    return send(res,200,{ok:true,changed:ids.length});
   }
   return send(res,200,{ok:true,items:visible,preferences,meta:{
    limit:200,days:90,count:visible.length,unread:visible.filter(x=>!x.read&&!x.archived).length,
    archived:visible.filter(x=>x.archived).length,securityAlwaysVisible:true,
    delivery:'Tylko centrum powiadomień w panelu. E-mail, SMS i push nie są uruchomione.',
    retention:'Lista obejmuje do 200 ostatnich zdarzeń z maksymalnie 90 dni.'}});
  }catch(error){
   console.error('NOTIFICATION_CENTER_ERROR',{code:typeof error?.code==='string'?error.code:'NOTIFICATION_CENTER'});
   return bad(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
