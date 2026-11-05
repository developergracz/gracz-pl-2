// Profile premium uses the existing account, match and PostgreSQL infrastructure.
// Public visibility is opt-in and private information is never returned by public API.
const defaults=Object.freeze({
 avatar:'initial',cover:'wave',accent:'turquoise',motto:'',city:'',
 timeZone:'Europe/Warsaw',dateFormat:'pl',publicProfile:false,
 showStats:false,showCountry:false,showBadges:false,sounds:false
});
const lists={
 avatar:['initial','crown','knight','diamond','rook','star'],
 cover:['wave','aurora','minimal','chess'],
 accent:['turquoise','midnight','royal','light'],
 timeZone:['Europe/Warsaw','Europe/Berlin','UTC','America/New_York'],
 dateFormat:['pl','iso']
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function output(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(data));
}
const fail=(res,status,error)=>output(res,status,{ok:false,error});
function normalize(row={}){
 return {
  avatar:lists.avatar.includes(row.avatar)?row.avatar:defaults.avatar,
  cover:lists.cover.includes(row.cover)?row.cover:defaults.cover,
  accent:lists.accent.includes(row.accent)?row.accent:defaults.accent,
  motto:typeof row.motto==='string'?row.motto:'',
  city:typeof row.city==='string'?row.city:'',
  timeZone:lists.timeZone.includes(row.time_zone)?row.time_zone:defaults.timeZone,
  dateFormat:lists.dateFormat.includes(row.date_format)?row.date_format:defaults.dateFormat,
  publicProfile:row.public_profile===true,showStats:row.show_stats===true,
  showCountry:row.show_country===true,showBadges:row.show_badges===true,
  sounds:row.sounds===true
 };
}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const value={};
 for(const [key,options] of Object.entries(lists))
  if(!options.includes(input[key]))return null;
 for(const [key,max] of [['motto',80],['city',60]]){
  if(typeof input[key]!=='string')return null;
  const v=input[key].trim();
  if(v.length>max||/[\u0000-\u001f\u007f]/.test(v))return null;
  value[key]=v;
 }
 for(const key of ['publicProfile','showStats','showCountry','showBadges','sounds'])
  if(typeof input[key]!=='boolean')return null;
 return {...value,avatar:input.avatar,cover:input.cover,accent:input.accent,
  timeZone:input.timeZone,dateFormat:input.dateFormat,
  publicProfile:input.publicProfile,showStats:input.showStats,
  showCountry:input.showCountry,showBadges:input.showBadges,sounds:input.sounds};
}
const achievements=[
 {id:'first-play',name:'Pierwsza partia',need:1,key:'played',icon:'♟'},
 {id:'ten-play',name:'Stały bywalec',need:10,key:'played',icon:'◆'},
 {id:'fifty-play',name:'Weteran stołu',need:50,key:'played',icon:'♜'},
 {id:'first-win',name:'Pierwsze zwycięstwo',need:1,key:'wins',icon:'★'},
 {id:'ten-wins',name:'Dziesięć zwycięstw',need:10,key:'wins',icon:'♛'},
 {id:'fifty-wins',name:'Mistrz konsekwencji',need:50,key:'wins',icon:'✦'},
 {id:'hundred-wins',name:'Setka wygranych',need:100,key:'wins',icon:'🏆'}
];
export async function ensurePremiumProfileSchema(database){
 await database.query(`CREATE TABLE IF NOT EXISTS gracz_public_identity.player_profile_premium (
  account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE,
  avatar text NOT NULL DEFAULT 'initial',cover text NOT NULL DEFAULT 'wave',
  accent text NOT NULL DEFAULT 'turquoise',motto text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',time_zone text NOT NULL DEFAULT 'Europe/Warsaw',
  date_format text NOT NULL DEFAULT 'pl', public_profile boolean NOT NULL DEFAULT false,
  show_stats boolean NOT NULL DEFAULT false,show_country boolean NOT NULL DEFAULT false,
  show_badges boolean NOT NULL DEFAULT false,sounds boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now())`);
}
export function createPremiumProfileRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow,validNick}){
 async function authenticated(req){
  const token=sessionToken(req);
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const result=await database.query(`SELECT a.id,a.nickname FROM gracz_public_identity.sessions s
   JOIN gracz_public_identity.accounts a ON a.id=s.account_id
   WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1`,[digest(token)]);
  return result.rows[0]||null;
 }
 async function extras(accountId){
  const result=await database.query('SELECT * FROM gracz_public_identity.player_profile_premium WHERE account_id=$1',[accountId]);
  return normalize(result.rows[0]);
 }
 async function summary(accountId){
  const grouped=await database.query(`SELECT c.game,
   COUNT(*) FILTER(WHERE m.state->>'winner' IN ('1','2','3'))::integer AS played,
   COUNT(*) FILTER(WHERE (m.state->>'winner'='1' AND c.sender_id=$1)
    OR (m.state->>'winner'='2' AND c.recipient_id=$1))::integer AS wins,
   COUNT(*) FILTER(WHERE (m.state->>'winner'='2' AND c.sender_id=$1)
    OR (m.state->>'winner'='1' AND c.recipient_id=$1))::integer AS losses,
   COUNT(*) FILTER(WHERE m.state->>'winner'='3')::integer AS draws,
   COUNT(*) FILTER(WHERE m.state->>'winner'='0')::integer AS active
   FROM gracz_public_identity.game_matches m
   JOIN gracz_public_identity.game_challenges c ON c.id=m.challenge_id
   WHERE c.sender_id=$1 OR c.recipient_id=$1 GROUP BY c.game`,[accountId]);
  const byGame={};let played=0,wins=0,losses=0,draws=0,active=0;
  for(const x of grouped.rows){
   const values={played:Number(x.played)||0,wins:Number(x.wins)||0,
    losses:Number(x.losses)||0,draws:Number(x.draws)||0,active:Number(x.active)||0};
   if(x.game==='gomoku'||x.game==='warcaby')byGame[x.game]=values;
   played+=values.played;wins+=values.wins;losses+=values.losses;draws+=values.draws;active+=values.active;
  }
  const recent=await database.query(`SELECT c.id,c.game,m.updated_at,m.state->>'winner' AS winner,
   m.state->>'moves' AS moves,
   CASE WHEN c.sender_id=$1 THEN r.nickname ELSE s.nickname END AS opponent,
   CASE WHEN c.sender_id=$1 THEN 1 ELSE 2 END AS player
   FROM gracz_public_identity.game_matches m
   JOIN gracz_public_identity.game_challenges c ON c.id=m.challenge_id
   JOIN gracz_public_identity.accounts s ON s.id=c.sender_id
   JOIN gracz_public_identity.accounts r ON r.id=c.recipient_id
   WHERE c.sender_id=$1 OR c.recipient_id=$1 ORDER BY m.updated_at DESC LIMIT 12`,[accountId]);
  const games=recent.rows.filter(x=>uuid.test(String(x.id||''))).map(x=>{
   const player=Number(x.player),winner=Number(x.winner);
   return {id:x.id,game:x.game,opponent:x.opponent,updatedAt:x.updated_at,
    moves:Number(x.moves)||0,result:winner===0?'active':winner===3?'draw':winner===player?'win':'loss'};
  });
  return {totals:{played,wins,losses,draws,active,winRate:played?Math.round(wins/played*100):0},
   byGame,latest:games,achievements:achievements.map(({id,name,need,key,icon})=>({
    id,name,need,icon,unlocked:(key==='played'?played:wins)>=need,
    progress:Math.min(need,key==='played'?played:wins)
   }))};
 }
 async function handle(req,res,url){
  const publicPath=url.pathname==='/auth/public-profile';
  const extrasPath=url.pathname==='/auth/profile/premium';
  const statsPath=url.pathname==='/auth/profile/stats';
  if(!publicPath&&!extrasPath&&!statsPath)return false;
  if((!extrasPath&&req.method!=='GET')||(extrasPath&&!['GET','PUT'].includes(req.method)))
   return fail(res,405,'METODA_NIEDOZWOLONA'),true;
  if(req.method==='PUT'&&!authorizedOrigin(req))return fail(res,403,'NIEDOZWOLONE_POCHODZENIE'),true;
  try{
   await ready();
   if(publicPath){
    const nick=String(url.searchParams.get('nick')||'');
    if(!validNick(nick)||!allow('public-profile-read:'+String(req.socket?.remoteAddress||'unknown'),180))
     return fail(res,400,'BLEDNY_IDENTYFIKATOR'),true;
    const q=await database.query(`SELECT a.id,a.nickname,a.created_at,p.display_name,p.bio,p.country,
      privacy.show_display_name,privacy.show_bio,privacy.show_motto,privacy.show_joined,
      privacy.show_city,privacy.show_win_rate,x.* FROM gracz_public_identity.accounts a
      JOIN gracz_public_identity.player_profile_premium x ON x.account_id=a.id
      LEFT JOIN gracz_public_identity.profiles p ON p.account_id=a.id
      LEFT JOIN gracz_public_identity.privacy_preferences privacy ON privacy.account_id=a.id
      WHERE a.nickname_key=$1 AND a.verified_at IS NOT NULL AND x.public_profile=true LIMIT 1`,[nick.toLowerCase()]);
    if(!q.rows.length)return fail(res,404,'PROFIL_NIEPUBLICZNY'),true;
    const row=q.rows[0],settings=normalize(row);
    const publicData={nickname:row.nickname,
     displayName:row.show_display_name===false?row.nickname:(row.display_name||row.nickname),
     bio:row.show_bio===false?'':(row.bio||''),
     createdAt:row.show_joined===false?null:row.created_at,
     avatar:settings.avatar,cover:settings.cover,accent:settings.accent,
     motto:row.show_motto===false?'':settings.motto,
     city:settings.showCountry&&row.show_city!==false?settings.city:'',
     country:settings.showCountry?row.country||'':'',badges:[]};
    if(settings.showStats){
     const stats=await summary(row.id);
     publicData.stats={totals:{...stats.totals},byGame:stats.byGame};
     if(row.show_win_rate===false)delete publicData.stats.totals.winRate;
     if(settings.showBadges)publicData.badges=stats.achievements.filter(a=>a.unlocked);
    }
    return output(res,200,{ok:true,profile:publicData}),true;
   }
   const actor=await authenticated(req);
   if(!actor)return fail(res,401,'BRAK_SESJI'),true;
   if(statsPath)return output(res,200,{ok:true,stats:await summary(actor.id)}),true;
   if(req.method==='PUT'){
    if(!allow('premium-profile:'+actor.id,30))return fail(res,429,'ZBYT_WIELE_PROB'),true;
    let body;try{body=await readBody(req)}catch{return fail(res,400,'BLEDNE_DANE'),true}
    const data=validate(body);if(!data)return fail(res,400,'POPRAW_USTAWIENIA_PROFILU'),true;
    await database.query(`INSERT INTO gracz_public_identity.player_profile_premium
     (account_id,avatar,cover,accent,motto,city,time_zone,date_format,public_profile,
      show_stats,show_country,show_badges,sounds,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     ON CONFLICT(account_id) DO UPDATE SET
      avatar=EXCLUDED.avatar,cover=EXCLUDED.cover,accent=EXCLUDED.accent,
      motto=EXCLUDED.motto,city=EXCLUDED.city,time_zone=EXCLUDED.time_zone,
      date_format=EXCLUDED.date_format,public_profile=EXCLUDED.public_profile,
      show_stats=EXCLUDED.show_stats,show_country=EXCLUDED.show_country,
      show_badges=EXCLUDED.show_badges,sounds=EXCLUDED.sounds,updated_at=now()`,
     [actor.id,data.avatar,data.cover,data.accent,data.motto,data.city,
      data.timeZone,data.dateFormat,data.publicProfile,data.showStats,data.showCountry,
      data.showBadges,data.sounds]);
   }
   return output(res,200,{ok:true,preferences:await extras(actor.id),
    publicUrl:'/konto/profil/'+encodeURIComponent(actor.nickname)}),true;
  }catch(error){
   console.error('PREMIUM_PROFILE_ERROR',{code:typeof error?.code==='string'?error.code:'PROFILE_ERROR'});
   return fail(res,503,'SYSTEM_NIEDOSTEPNY'),true;
  }
 }
 return {handle};
}
