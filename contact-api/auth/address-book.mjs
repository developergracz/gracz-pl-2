// Account-owned address book. Never returns another user's private profile fields.
// Stable friend_id supports a future forum identity join; no forum integration is live.
import {randomUUID} from 'node:crypto';
const nickPattern=/^[a-z][a-z0-9._-]{2,31}$/i;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function send(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(data));
 return true;
}
function bad(res,status,code){return send(res,status,{ok:false,error:code})}
function cleanText(value,max,required=false){
 if(typeof value!=='string')return null;
 const s=value.trim();
 if(s.length>max||(required&&!s)||/[\u0000-\u001f\u007f]/.test(s))return null;
 return s;
}
function validate(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const name=cleanText(data.name,64,true);
 const nickname=data.nickname==null?'':cleanText(data.nickname,32);
 const email=cleanText(data.email,160);
 const phone=cleanText(data.phone,40);
 const note=cleanText(data.note,1000);
 const group=cleanText(data.group,32,true);
 const tags=data.tags;
 if(!name||nickname===null||email===null||phone===null||note===null||!group||
   typeof data.favorite!=='boolean'||!Array.isArray(tags)||tags.length>8||!tags.every(x=>typeof x==='string'&&x.trim()&&x.trim().length<=24&&
   !/[\u0000-\u001f\u007f]/.test(x)))return null;
 if(nickname&&!nickPattern.test(nickname))return null;
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
 if(phone&&!/^\+?[\d ().-]{3,40}$/.test(phone))return null;
 const distinct=[...new Set(tags.map(x=>x.trim()))];
 return {name,nickname,email,phone,note,group,tags:distinct,favorite:data.favorite};
}
const table='gracz_public_identity.player_address_book';
export async function ensureAddressBookSchema(database){
 await database.query('CREATE TABLE IF NOT EXISTS '+table+' (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES gracz_public_identity.accounts(id) ON DELETE CASCADE, friend_id uuid REFERENCES gracz_public_identity.accounts(id) ON DELETE SET NULL, name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 64), email text NOT NULL DEFAULT \'\', phone text NOT NULL DEFAULT \'\', note text NOT NULL DEFAULT \'\', group_name text NOT NULL DEFAULT \'Bez grupy\', tags text[] NOT NULL DEFAULT ARRAY[]::text[], favorite boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(friend_id IS NULL OR friend_id<>owner_id))');
 await database.query('CREATE INDEX IF NOT EXISTS gracz_address_book_owner_recent ON '+table+' (owner_id,updated_at DESC)');
 await database.query('CREATE UNIQUE INDEX IF NOT EXISTS gracz_address_book_friend_unique ON '+table+' (owner_id,friend_id) WHERE friend_id IS NOT NULL');
}
export function createAddressBookRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  if(url.pathname!=='/auth/address-book')return false;
  if(!['GET','PUT','DELETE'].includes(req.method))return bad(res,405,'METODA_NIEDOZWOLONA');
  if(req.method!=='GET'&&!authorizedOrigin(req))return bad(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return bad(res,401,'BRAK_SESJI');
   const auth=await database.query('SELECT a.id FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
   if(!auth.rows.length)return bad(res,401,'BRAK_SESJI');
   const owner=auth.rows[0].id;
   if(!allow('address-book:'+owner,req.method==='GET'?180:80))return bad(res,429,'ZBYT_WIELE_PROB');
   if(req.method==='GET'){
    const query=String(url.searchParams.get('query')||'').trim().slice(0,80);
    const group=String(url.searchParams.get('group')||'').trim().slice(0,32);
    const favorites=url.searchParams.get('favorites')==='1';
    const page=Number(url.searchParams.get('page')||0);
    if(!Number.isSafeInteger(page)||page<0||page>10000)return bad(res,400,'BLEDNE_DANE');
    const pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
    const params=[owner,pattern,group,favorites];
    const where="WHERE b.owner_id=$1 AND (b.name ILIKE $2 ESCAPE '\\' OR COALESCE(a.nickname,'') ILIKE $2 ESCAPE '\\' OR b.note ILIKE $2 ESCAPE '\\' OR b.tags::text ILIKE $2 ESCAPE '\\') AND ($3='' OR b.group_name=$3) AND (NOT $4::boolean OR b.favorite=true)";
    const rows=await database.query('SELECT b.id,b.name,b.email,b.phone,b.note,b.group_name,b.tags,b.favorite,b.friend_id,a.nickname, b.created_at,b.updated_at, EXISTS(SELECT 1 FROM gracz_public_identity.friend_connections f WHERE f.account_a=LEAST(b.owner_id,b.friend_id) AND f.account_b=GREATEST(b.owner_id,b.friend_id) AND f.status=\'accepted\') AND NOT EXISTS(SELECT 1 FROM gracz_public_identity.friend_blocks x WHERE (x.blocker=b.owner_id AND x.blocked=b.friend_id) OR (x.blocker=b.friend_id AND x.blocked=b.owner_id)) AS connected FROM '+table+' b LEFT JOIN gracz_public_identity.accounts a ON a.id=b.friend_id '+where+' ORDER BY b.favorite DESC,b.name COLLATE "C" ASC,b.id ASC LIMIT 60 OFFSET $5',[...params,page*60]);
    const count=await database.query('SELECT COUNT(*)::integer AS total FROM '+table+' b LEFT JOIN gracz_public_identity.accounts a ON a.id=b.friend_id '+where,params);
    const groups=await database.query('SELECT group_name,COUNT(*)::integer AS total,COUNT(*) FILTER (WHERE favorite)::integer AS favorites FROM '+table+' WHERE owner_id=$1 GROUP BY group_name ORDER BY group_name COLLATE "C" LIMIT 100',[owner]);
    return send(res,200,{ok:true,contacts:rows.rows.map(r=>({
     id:r.id,name:r.name,email:r.email,phone:r.phone,note:r.note,group:r.group_name,tags:r.tags||[],
     favorite:r.favorite===true,nickname:r.nickname||'',linked:!!r.friend_id,connected:r.connected===true,
     updatedAt:r.updated_at,createdAt:r.created_at
    })),total:Number(count.rows[0]?.total)||0,page,pageSize:60,favoritesTotal:groups.rows.reduce((sum,r)=>sum+(Number(r.favorites)||0),0),groups:groups.rows.map(r=>({name:r.group_name,count:Number(r.total)}))});
   }
   let body;
   try{body=await readBody(req)}catch{return bad(res,400,'BLEDNE_DANE')}
   if(req.method==='DELETE'){
    if(!uuidPattern.test(String(body.id||'')))return bad(res,400,'BLEDNE_DANE');
    const deleted=await database.query('DELETE FROM '+table+' WHERE owner_id=$1 AND id=$2 RETURNING id',[owner,body.id]);
    if(!deleted.rowCount)return bad(res,404,'KONTAKT_NIE_ZNALEZIONY');
    return send(res,200,{ok:true,deleted:true});
   }
   const record=validate(body);
   if(!record)return bad(res,400,'POPRAW_DANE_KONTAKTU');
   const id=body.id===null||body.id===undefined?'':String(body.id);
   if(id&&!uuidPattern.test(id))return bad(res,400,'BLEDNE_DANE');
   if(id){
    // Only user-owned fields are mutable. Linked identity cannot be replaced by an alias.
    const result=await database.query('UPDATE '+table+' SET name=$3,email=$4,phone=$5,note=$6,group_name=$7,tags=$8,favorite=$9,updated_at=now() WHERE id=$2 AND owner_id=$1 RETURNING id',
     [owner,id,record.name,record.email,record.phone,record.note,record.group,record.tags,record.favorite]);
    if(!result.rowCount)return bad(res,404,'KONTAKT_NIE_ZNALEZIONY');
    return send(res,200,{ok:true,id});
   }
   let friendId=null;
   if(record.nickname){
    // A player identity may only be linked to an accepted, unblocked friendship.
    const checked=await database.query('SELECT a.id FROM gracz_public_identity.accounts a JOIN gracz_public_identity.friend_connections f ON f.account_a=LEAST($1::uuid,a.id) AND f.account_b=GREATEST($1::uuid,a.id) AND f.status=\'accepted\' WHERE a.nickname_key=$2 AND a.verified_at IS NOT NULL AND a.id<>$1 AND NOT EXISTS (SELECT 1 FROM gracz_public_identity.friend_blocks x WHERE (x.blocker=$1 AND x.blocked=a.id) OR (x.blocker=a.id AND x.blocked=$1)) LIMIT 1',[owner,record.nickname.toLowerCase()]);
    if(!checked.rows.length)return bad(res,403,'TYLKO_ZNAJOMI');
    friendId=checked.rows[0].id;
   }
   const inserted=await database.query('INSERT INTO '+table+' (id,owner_id,friend_id,name,email,phone,note,group_name,tags,favorite) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE (SELECT COUNT(*) FROM '+table+' WHERE owner_id=$2)<2000 RETURNING id',
    [randomUUID(),owner,friendId,record.name,record.email,record.phone,record.note,record.group,record.tags,record.favorite]);
   if(!inserted.rowCount)return bad(res,409,'LIMIT_KONTAKTOW');
   return send(res,200,{ok:true,id:inserted.rows[0].id});
  }catch(e){
   if(e?.code==='23505')return bad(res,409,'KONTAKT_JUZ_ISTNIEJE');
   console.error('ADDRESS_BOOK_ERROR',{code:typeof e?.code==='string'?e.code:'ADDRESS_BOOK'});
   return bad(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
