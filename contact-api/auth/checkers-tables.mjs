// Public Warcaby lobby: durable waiting tables on the EXISTING PostgreSQL
// instance. Joining creates an accepted challenge that /auth/match already
// knows how to open. No process-local state, external brokers or cron jobs.
import {randomUUID} from 'node:crypto';

const ROOT='gracz_public_identity';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOCKS=new Set([0,3,5,7,10,15,20,30]);
const BONUSES=new Set([0,1,2,3,5,10]);
const COLORS=new Set(['white','black','random']);
const VISIBILITY=new Set(['public','private']);
const reply=(res,status,value)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(value));return true;
};
const fail=(res,status,error)=>reply(res,status,{ok:false,error});
export function validTableConfig(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).some(key=>!['action','id','title','minutes','incrementSeconds','color','visibility'].includes(key)))
  return false;
 if(!['create','edit'].includes(body.action)||
  (body.action==='edit'?(typeof body.id!=='string'||!UUID.test(body.id)):
   Object.hasOwn(body,'id'))||typeof body.title!=='string'||
  body.title.trim().length<3||body.title.trim().length>48||
  /[\u0000-\u001f\u007f<>]/.test(body.title)||
  !CLOCKS.has(body.minutes)||!BONUSES.has(body.incrementSeconds)||
  (!body.minutes&&body.incrementSeconds!==0)||
  !COLORS.has(body.color)||!VISIBILITY.has(body.visibility))return false;
 return true;
}
export async function ensureCheckersTablesSchema(database){
 await database.query("CREATE TABLE IF NOT EXISTS "+ROOT+".warcaby_tables ("+
  "id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,"+
  "guest_id uuid REFERENCES "+ROOT+".accounts(id) ON DELETE SET NULL,"+
  "title varchar(48) NOT NULL, minutes integer NOT NULL CHECK(minutes IN (0,3,5,7,10,15,20,30)),"+
  "increment_seconds integer NOT NULL CHECK(increment_seconds IN (0,1,2,3,5,10)),"+
  "color varchar(6) NOT NULL CHECK(color IN ('white','black','random')),"+
  "visibility varchar(7) NOT NULL CHECK(visibility IN ('public','private')),"+
  "status varchar(7) NOT NULL CHECK(status IN ('waiting','started','closed')),"+
  "created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),"+
  "CHECK(owner_id IS DISTINCT FROM guest_id))");
 await database.query("CREATE UNIQUE INDEX IF NOT EXISTS warcaby_one_waiting_table_per_owner "+
  "ON "+ROOT+".warcaby_tables(owner_id) WHERE status='waiting'");
 await database.query("CREATE INDEX IF NOT EXISTS warcaby_tables_waiting_recent "+
  "ON "+ROOT+".warcaby_tables(created_at DESC) WHERE status='waiting'");
}
const tableView=row=>({
 id:row.id,title:row.title,host:row.host,guest:row.guest||null,
 status:row.status,visibility:row.visibility,
 minutes:row.minutes,incrementSeconds:row.increment_seconds,
 color:row.color,mine:row.mine===true,joined:row.joined===true,
 createdAt:row.created_at
});
export function createCheckersTablesRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  if(url.pathname!=='/auth/warcaby/tables')return false;
  if(!['GET','POST'].includes(req.method))return fail(res,405,'METODA_NIEDOZWOLONA');
  if(req.method==='POST'&&!authorizedOrigin(req))return fail(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return fail(res,401,'BRAK_SESJI');
   const q=await database.query("SELECT a.id FROM "+ROOT+".sessions s JOIN "+ROOT+
    ".accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() "+
    "AND a.verified_at IS NOT NULL LIMIT 1",[digest(token)]);
   if(!q.rows.length)return fail(res,401,'BRAK_SESJI');
   const actor=q.rows[0].id;
   if(!allow('warcaby-tables:'+actor,req.method==='GET'?120:30))
    return fail(res,429,'ZBYT_WIELE_PROB');
   if(req.method==='GET'){
    const code=url.searchParams.get('code')||'';
    if(code&&!UUID.test(code))return fail(res,400,'BLEDNY_KOD_STOLU');
    const scope=url.searchParams.get('scope')||'waiting';
    if(!['waiting','mine','playing'].includes(scope))
     return fail(res,400,'BLEDNY_FILTR');
    // Private tables are not exposed through discovery. Anyone with the
    // unguessable UUID may access that precise table (and then request a seat).
    const list=await database.query("SELECT t.id,t.title,t.minutes,t.increment_seconds,"+
     "t.color,t.visibility,t.status,t.created_at,"+
     "host.nickname AS host,guest.nickname AS guest,"+
     "(t.owner_id=$1) AS mine,(t.guest_id=$1) AS joined "+
     "FROM "+ROOT+".warcaby_tables t JOIN "+ROOT+".accounts host ON host.id=t.owner_id "+
     "LEFT JOIN "+ROOT+".accounts guest ON guest.id=t.guest_id "+
     "WHERE t.created_at>now()-interval '12 hours' AND "+
     "(( $2::uuid IS NOT NULL AND t.id=$2::uuid) OR ($2::uuid IS NULL AND (t.visibility='public' OR t.owner_id=$1 OR t.guest_id=$1))) "+
     "AND (($3='waiting' AND t.status='waiting') "+
     "OR ($3='mine' AND (t.owner_id=$1 OR t.guest_id=$1) AND t.status<>'closed') "+
     "OR ($3='playing' AND t.status='started')) "+
     "ORDER BY CASE WHEN t.status='waiting' THEN 0 ELSE 1 END,t.created_at DESC LIMIT 80",
     [actor,code||null,scope]);
    return reply(res,200,{ok:true,tables:list.rows.map(tableView)});
   }
   let body;try{body=await readBody(req)}catch{return fail(res,400,'BLEDNE_DANE')}
   if(body?.action==='create'||body?.action==='edit'){
    if(!validTableConfig(body))return fail(res,400,'BLEDNA_KONFIGURACJA');
    if(body.action==='edit'){
     // Only the authenticated owner may edit their still-waiting table.
     // UPDATE is atomic with joins and closes on the existing PostgreSQL.
     const edited=await database.query("UPDATE "+ROOT+".warcaby_tables "+
      "SET title=$3,minutes=$4,increment_seconds=$5,color=$6,visibility=$7,updated_at=now() "+
      "WHERE id=$1 AND owner_id=$2 AND status='waiting' "+
      "AND created_at>now()-interval '12 hours' RETURNING id",
      [body.id,actor,body.title.trim(),body.minutes,body.incrementSeconds,body.color,body.visibility]);
     return edited.rowCount?reply(res,200,{ok:true,id:body.id}):fail(res,409,'STOL_NIEAKTUALNY');
    }
    const publicCount=await database.query("SELECT count(*)::int AS n FROM "+ROOT+
     ".warcaby_tables WHERE status='waiting' AND created_at>now()-interval '12 hours'");
    if(publicCount.rows[0].n>=80)return fail(res,429,'BRAK_WOLNYCH_MIEJSC');
    // Clear expired owner table on demand; no paid cron service needed.
    await database.query("UPDATE "+ROOT+".warcaby_tables SET status='closed',updated_at=now() "+
     "WHERE owner_id=$1 AND status='waiting' AND created_at<=now()-interval '12 hours'",[actor]);
    try{
     const saved=await database.query("INSERT INTO "+ROOT+
      ".warcaby_tables(id,owner_id,title,minutes,increment_seconds,color,visibility,status) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7,'waiting') RETURNING id",
      [randomUUID(),actor,body.title.trim(),body.minutes,body.incrementSeconds,body.color,body.visibility]);
     return reply(res,201,{ok:true,id:saved.rows[0].id,status:'waiting'});
    }catch(e){if(e.code==='23505')return fail(res,409,'MASZ_JUZ_OTWARTY_STOL');throw e}
   }
   if(!body||typeof body!=='object'||Array.isArray(body)||!['join','close'].includes(body.action)||
    typeof body.id!=='string'||!UUID.test(body.id)||
    Object.keys(body).some(k=>!['action','id'].includes(k)))
    return fail(res,400,'BLEDNE_DANE');
   if(body.action==='close'){
    const closed=await database.query("UPDATE "+ROOT+".warcaby_tables "+
     "SET status='closed',updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='waiting' "+
     "RETURNING id",[body.id,actor]);
    return closed.rowCount?reply(res,200,{ok:true}):fail(res,409,'STOL_NIEAKTUALNY');
   }
   // Atomic claim + accepted challenge. Concurrent joiners cannot both take
   // the last seat. All existing /auth/match participant checks remain intact.
   const joined=await database.query(
    "WITH taken AS (UPDATE "+ROOT+".warcaby_tables t "+
    "SET guest_id=$2,status='started',updated_at=now() "+
    "WHERE t.id=$1 AND t.status='waiting' AND t.owner_id<>$2 "+
    "AND t.created_at>now()-interval '12 hours' "+
    "AND NOT EXISTS(SELECT 1 FROM "+ROOT+".friend_blocks b "+
    "WHERE (b.blocker=t.owner_id AND b.blocked=$2) OR "+
    "(b.blocker=$2 AND b.blocked=t.owner_id)) "+
    "RETURNING t.id,t.owner_id,t.guest_id,t.minutes,t.increment_seconds,t.color), "+
    "created AS (INSERT INTO "+ROOT+".game_challenges "+
    "(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds,expires_at) "+
    "SELECT id,CASE WHEN color='black' OR (color='random' AND "+
    "mod(('x'||substr(md5(id::text),1,8))::bit(32)::bigint,2)=1) THEN guest_id ELSE owner_id END,"+
    "CASE WHEN color='black' OR (color='random' AND "+
    "mod(('x'||substr(md5(id::text),1,8))::bit(32)::bigint,2)=1) THEN owner_id ELSE guest_id END,"+
    "'warcaby','accepted',minutes,increment_seconds,now()+interval '7 days' FROM taken RETURNING id) "+
    "SELECT id FROM created",
    [body.id,actor]);
   return joined.rows.length?reply(res,200,{ok:true,matchId:joined.rows[0].id}):
    fail(res,409,'STOL_NIEDOSTEPNY');
  }catch(e){
   console.error('WARCABY_TABLES_ERROR',{code:String(e?.code||'TABLES_ERROR').slice(0,40)});
   return fail(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
