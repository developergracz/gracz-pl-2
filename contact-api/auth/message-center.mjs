// GRACZ.PL — owned inbox metadata for the existing verified friends messenger.
// The authoritative friend_messages table and /auth/social/messages remain unchanged.
const ROOT='gracz_public_identity';
const LABELS=new Set(['','team','family','friends','priority']);
const CHANGES=Object.freeze({
 pin:'pinned=true',unpin:'pinned=false',
 archive:'archived=true',restore:'archived=false',
 mute:'muted=true',unmute:'muted=false',
 read:'last_read_at=now()',unread:'last_read_at=NULL',
 label:'label=$3'
});
const LIST_SQL=[
 'SELECT a.nickname,COALESCE(s.pinned,false) AS pinned,',
 'COALESCE(s.archived,false) AS archived,COALESCE(s.muted,false) AS muted,',
 "COALESCE(s.label,'') AS label,s.last_read_at,",
 'recent.body AS last_body,recent.created_at AS last_at,',
 'recent.sender_id=$1 AS last_own,',
 'COALESCE((SELECT COUNT(*)::int FROM '+ROOT+'.friend_messages u',
 'WHERE u.sender_id=a.id AND u.recipient_id=$1',
 "AND u.created_at>COALESCE(s.last_read_at,'1970-01-01'::timestamptz)),0) AS unread_count",
 'FROM '+ROOT+'.friend_connections c',
 'JOIN '+ROOT+'.accounts a ON a.id=CASE WHEN c.account_a=$1 THEN c.account_b ELSE c.account_a END',
 'LEFT JOIN '+ROOT+'.message_conversation_state s ON s.owner_id=$1 AND s.friend_id=a.id',
 'LEFT JOIN LATERAL (SELECT m.body,m.created_at,m.sender_id FROM '+ROOT+'.friend_messages m',
 'WHERE (m.sender_id=$1 AND m.recipient_id=a.id) OR (m.sender_id=a.id AND m.recipient_id=$1)',
 'ORDER BY m.created_at DESC,m.id DESC LIMIT 1) recent ON true',
 "WHERE c.status='accepted' AND (c.account_a=$1 OR c.account_b=$1) AND a.verified_at IS NOT NULL",
 'AND NOT EXISTS(SELECT 1 FROM '+ROOT+'.friend_blocks b',
 'WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1))',
 'ORDER BY COALESCE(s.pinned,false) DESC,recent.created_at DESC NULLS LAST,a.nickname ASC LIMIT 100'
].join(' ');
function respond(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(body));return true;
}
const reject=(res,status,error)=>respond(res,status,{ok:false,error});
export async function ensureMessageCenterSchema(database){
 await database.query("CREATE TABLE IF NOT EXISTS "+ROOT+".message_conversation_state (owner_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,friend_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,pinned boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,muted boolean NOT NULL DEFAULT false,label text NOT NULL DEFAULT '' CHECK(label IN ('','team','family','friends','priority')),last_read_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,friend_id),CHECK(owner_id<>friend_id))");
}
export function createMessageCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  const base='/auth/message-center';
  if(url.pathname!==base&&url.pathname!==base+'/state')return false;
  const changing=url.pathname.endsWith('/state');
  if((changing&&req.method!=='POST')||(!changing&&req.method!=='GET'))return reject(res,405,'METODA_NIEDOZWOLONA');
  if(changing&&!authorizedOrigin(req))return reject(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return reject(res,401,'BRAK_SESJI');
   const auth=await database.query('SELECT a.id FROM '+ROOT+'.sessions s JOIN '+ROOT+'.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
   if(!auth.rows.length)return reject(res,401,'BRAK_SESJI');
   const owner=auth.rows[0].id;
   if(!allow('message-center:'+owner,changing?65:100))return reject(res,429,'ZBYT_WIELE_PROB');
   if(!changing){
    const list=await database.query(LIST_SQL,[owner]);
    return respond(res,200,{ok:true,conversations:list.rows.map(row=>({
     nickname:row.nickname,unread:Number(row.unread_count)||0,pinned:row.pinned===true,
     archived:row.archived===true,muted:row.muted===true,label:LABELS.has(row.label)?row.label:'',
     lastMessage:row.last_body||'',lastAt:row.last_at||null,lastOwn:row.last_own===true
    })),limit:100,note:'Lista zaakceptowanych znajomych; archiwum, wyciszenie i przypięcie dotyczą tylko Twojego konta.'});
   }
   let body;try{body=await readBody(req)}catch{return reject(res,400,'BLEDNE_DANE')}
   const {nickname,action}=body;
   const nick=typeof nickname==='string'?nickname.trim().toLowerCase():'';
   if(!/^[a-z][a-z0-9._-]{2,31}$/.test(nick)||
       typeof action!=='string'||!Object.hasOwn(CHANGES,action)||
       (action==='label'&&!LABELS.has(body.label))||
       Object.keys(body).some(k=>!['nickname','action','label'].includes(k)))return reject(res,400,'BLEDNE_DANE');
   const operation=CHANGES[action];
   // The authoritative friend predicate runs inside this atomic INSERT..ON CONFLICT.
   // The same action applies to the first metadata row and subsequent updates.
   const sql="INSERT INTO "+ROOT+".message_conversation_state (owner_id,friend_id,pinned,archived,muted,label,last_read_at) SELECT $1,a.id,$4,$5,$6,$3,CASE WHEN $7::boolean THEN now() ELSE NULL END FROM "+ROOT+".accounts a JOIN "+ROOT+".friend_connections f ON f.account_a=LEAST($1::uuid,a.id) AND f.account_b=GREATEST($1::uuid,a.id) AND f.status='accepted' WHERE a.nickname_key=$2 AND a.id<>$1 AND a.verified_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "+ROOT+".friend_blocks b WHERE (b.blocker=$1 AND b.blocked=a.id) OR (b.blocker=a.id AND b.blocked=$1)) ON CONFLICT(owner_id,friend_id) DO UPDATE SET "+operation+",updated_at=now() RETURNING friend_id";
   const args=[owner,nick,action==='label'?body.label:'',action==='pin',
    action==='archive',action==='mute',action==='read'];
   const result=await database.query(sql,args);
   if(!result.rows.length)return reject(res,404,'ROZMOWA_NIEDOSTEPNA');
   return respond(res,200,{ok:true,action,nickname:body.nickname,changed:1});
  }catch(error){
   console.error('MESSAGE_CENTER_ERROR',{code:typeof error?.code==='string'?error.code:'MESSAGE_CENTER'});
   return reject(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
