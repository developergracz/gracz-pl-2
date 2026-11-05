// GRACZ.PL — privacy policies enforced by the same PostgreSQL identity and social APIs.
// Public profile settings are shared with premium-profile.mjs, not duplicated.
const ROOT='gracz_public_identity';
export const privacyDefaults=Object.freeze({
 discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
 exactSearchOnly:false,mutualFriendsOnlyRequests:false,trustedMessagesOnly:false,
 trustedInvitesOnly:false,trustedPresenceOnly:false,
 publicProfile:false,showStats:false,showCountry:false,showBadges:false,
 showDisplayName:true,showBio:true,showMotto:true,showJoined:true,showCity:true,showWinRate:true
});
const flags=Object.keys(privacyDefaults);
const persistedPrivacy=[
 ['discoverable','discoverable'],['friendRequests','friend_requests'],
 ['friendMessages','friend_messages'],['gameInvites','game_invites'],['showOnline','show_online'],
 ['exactSearchOnly','exact_search_only'],['mutualFriendsOnlyRequests','mutual_friends_only_requests'],
 ['trustedMessagesOnly','trusted_messages_only'],['trustedInvitesOnly','trusted_invites_only'],
 ['trustedPresenceOnly','trusted_presence_only'],['showDisplayName','show_display_name'],
 ['showBio','show_bio'],['showMotto','show_motto'],['showJoined','show_joined'],
 ['showCity','show_city'],['showWinRate','show_win_rate']
];
const publicFields=['publicProfile','showStats','showCountry','showBadges'];
const publicColumns=['public_profile','show_stats','show_country','show_badges'];
const prefCols=persistedPrivacy.map(x=>x[1]);
const prefix='gracz_public_identity.';
const param=(index)=>String.fromCharCode(36)+index;
const updateSql='WITH privacy_saved AS (INSERT INTO '+prefix+'privacy_preferences (account_id,'+
 prefCols.join(',')+',updated_at) VALUES ($1,'+prefCols.map((_,i)=>param(i+2)).join(',')+
 ',now()) ON CONFLICT(account_id) DO UPDATE SET '+prefCols.map(col=>col+'=EXCLUDED.'+col).join(',')+
 ',updated_at=now() RETURNING account_id) INSERT INTO '+prefix+
 'player_profile_premium (account_id,'+publicColumns.join(',')+',updated_at) SELECT account_id,'+
 publicColumns.map((_,i)=>param(i+2+prefCols.length)).join(',')+
 ',now() FROM privacy_saved WHERE TRUE ON CONFLICT(account_id) DO UPDATE SET '+
 publicColumns.map(col=>col+'=EXCLUDED.'+col).join(',')+',updated_at=now()';
function respond(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(data));return true;
}
const bad=(res,status,error)=>respond(res,status,{ok:false,error});
function fromRow(r={}){
 return {
  discoverable:r.discoverable!==false,friendRequests:r.friend_requests!==false,
  friendMessages:r.friend_messages!==false,gameInvites:r.game_invites!==false,
  showOnline:r.show_online!==false,
  exactSearchOnly:r.exact_search_only===true,
  mutualFriendsOnlyRequests:r.mutual_friends_only_requests===true,
  trustedMessagesOnly:r.trusted_messages_only===true,
  trustedInvitesOnly:r.trusted_invites_only===true,
  trustedPresenceOnly:r.trusted_presence_only===true,
  publicProfile:r.public_profile===true,
  showStats:r.show_stats===true,showCountry:r.show_country===true,showBadges:r.show_badges===true,
  showDisplayName:r.show_display_name!==false,showBio:r.show_bio!==false,
  showMotto:r.show_motto!==false,showJoined:r.show_joined!==false,
  showCity:r.show_city!==false,showWinRate:r.show_win_rate!==false
 };
}
function validated(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const keys=Object.keys(input);
 return keys.length===flags.length&&keys.every(key=>flags.includes(key)&&typeof input[key]==='boolean');
}
export async function ensurePrivacySchema(db){
 await db.query('CREATE TABLE IF NOT EXISTS '+ROOT+'.privacy_preferences (account_id uuid PRIMARY KEY REFERENCES '+ROOT+'.accounts(id) ON DELETE CASCADE,discoverable boolean NOT NULL DEFAULT true,friend_requests boolean NOT NULL DEFAULT true,friend_messages boolean NOT NULL DEFAULT true,game_invites boolean NOT NULL DEFAULT true,show_online boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now())');
 // Existing users keep prior behavior until they explicitly restrict a setting.
 for(const [column,value] of [
  ['exact_search_only',false],['mutual_friends_only_requests',false],
  ['trusted_messages_only',false],['trusted_invites_only',false],['trusted_presence_only',false],
  ['show_display_name',true],['show_bio',true],['show_motto',true],
  ['show_joined',true],['show_city',true],['show_win_rate',true]
 ]){
  await db.query('ALTER TABLE '+ROOT+'.privacy_preferences ADD COLUMN IF NOT EXISTS '+column+
   ' boolean NOT NULL DEFAULT '+String(value));
 }
}
export function createPrivacyRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  const base='/auth/privacy-center',exportPath=base+'/export';
  if(url.pathname!==base&&url.pathname!==exportPath)return false;
  if((url.pathname===exportPath&&req.method!=='GET')||
   (url.pathname===base&&!['GET','PUT'].includes(req.method)))
   return bad(res,405,'METODA_NIEDOZWOLONA');
  if(req.method==='PUT'&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI');
   const auth=await database.query('SELECT a.id FROM '+ROOT+'.sessions s JOIN '+ROOT+'.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
   if(!auth.rows.length)return bad(res,401,'BRAK_SESJI');
   const owner=auth.rows[0].id;
   if(!allow('privacy-center:'+owner,req.method==='GET'?120:35))return bad(res,429,'ZBYT_WIELE_PROB');
   if(req.method==='PUT'){
    let body;try{body=await readBody(req)}catch{return bad(res,400,'BLEDNE_DANE')}
    if(!validated(body))return bad(res,400,'POPRAW_USTAWIENIA_PRYWATNOSCI');
    // One atomic SQL CTE updates the private policy and existing public profile.
    // No read-modify-write race with the profile editor, no change to avatar/cover.
    await database.query(updateSql,[owner,...persistedPrivacy.map(([key])=>body[key]),
     ...publicFields.map(key=>body[key])]);
   }
   const result=await database.query('SELECT '+prefCols.map(col=>'p.'+col).join(',')+',x.public_profile,x.show_stats,x.show_country,x.show_badges FROM (SELECT $1::uuid AS id) self LEFT JOIN '+ROOT+'.privacy_preferences p ON p.account_id=self.id LEFT JOIN '+ROOT+'.player_profile_premium x ON x.account_id=self.id',[owner]);
   const preferences=fromRow(result.rows[0]);
   if(url.pathname===exportPath){
    const account=await database.query('SELECT a.nickname,a.email_key,a.created_at,p.display_name,p.bio,p.country,p.language,x.avatar,x.cover,x.accent,x.motto,x.city FROM '+ROOT+'.accounts a LEFT JOIN '+ROOT+'.profiles p ON p.account_id=a.id LEFT JOIN '+ROOT+'.player_profile_premium x ON x.account_id=a.id WHERE a.id=$1',[owner]);
    const a=account.rows[0]||{};
    return respond(res,200,{ok:true,format:'gracz-privacy-settings-v1',exportedAt:new Date().toISOString(),
     scope:'Ustawienia prywatności i własne podstawowe dane profilu — nie pełne archiwum danych konta.',
     preferences,profile:{nickname:a.nickname||'',email:a.email_key||'',createdAt:a.created_at||null,
      displayName:a.display_name||'',bio:a.bio||'',country:a.country||'',language:a.language||'',
      avatar:a.avatar||'',cover:a.cover||'',accent:a.accent||'',motto:a.motto||'',city:a.city||''}});
   }
   return respond(res,200,{ok:true,preferences,policy:{
    socialContacts:'Wiadomości i wyzwania tylko między zaakceptowanymi znajomymi. Możesz ograniczyć je dalej do kontaktów z gwiazdką w książce adresowej.',
    trustedOnly:'Ulubieni to kontakty powiązane z kontem gracza i oznaczone gwiazdką w Twojej prywatnej książce.',
    mutualOnly:'Nowe zaproszenia do znajomych wymagają wspólnego zaakceptowanego znajomego, gdy ta opcja jest włączona.',
    presence:'Status online widoczny tylko znajomym, gdy jest włączony.',
    publicProfile:'Profil publiczny i jego statystyki podlegają osobnym zgodom poniżej.',
    forum:'Funkcje przyszłego forum nie są jeszcze połączone z tymi ustawieniami.'}});
  }catch(e){
   console.error('PRIVACY_CENTER_ERROR',{code:typeof e?.code==='string'?e.code:'PRIVACY_CENTER'});
   return bad(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}