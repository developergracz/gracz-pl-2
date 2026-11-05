// Owner-specific invitation organization. Gameplay and invitation authorization remain
// in /auth/social/challenges; metadata is not shared with other players.
const ROOT='gracz_public_identity';
const actions={star:'starred=true',unstar:'starred=false',archive:'archived=true',
 restore:'archived=false',seen:'seen_at=now()',unseen:'seen_at=NULL',note:'note=$3'};
function reply(res,status,obj){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(obj));return true;
}
const fail=(res,status,error)=>reply(res,status,{ok:false,error});
export async function ensureChallengeCenterSchema(database){
 await database.query("CREATE TABLE IF NOT EXISTS "+ROOT+".challenge_item_state (owner_id uuid NOT NULL REFERENCES "+ROOT+".accounts(id) ON DELETE CASCADE,challenge_id uuid NOT NULL REFERENCES "+ROOT+".game_challenges(id) ON DELETE CASCADE,starred boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,seen_at timestamptz,note varchar(300) NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,challenge_id))");
}
export function createChallengeCenterRouter({database,ready,sessionToken,digest,authorizedOrigin,readBody,allow}){
 async function handle(req,res,url){
  if(url.pathname!=='/auth/challenge-center/state')return false;
  if(req.method!=='POST')return fail(res,405,'METODA_NIEDOZWOLONA');
  if(!authorizedOrigin(req))return fail(res,403,'NIEDOZWOLONE_POCHODZENIE');
  try{
   await ready();
   const token=sessionToken(req);
   if(!/^[a-f0-9]{64}$/.test(token))return fail(res,401,'BRAK_SESJI');
   const auth=await database.query('SELECT a.id FROM '+ROOT+'.sessions s JOIN '+ROOT+'.accounts a ON a.id=s.account_id WHERE s.token_digest=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL LIMIT 1',[digest(token)]);
   if(!auth.rows.length)return fail(res,401,'BRAK_SESJI');
   const owner=auth.rows[0].id;
   if(!allow('challenge-center:'+owner,75))return fail(res,429,'ZBYT_WIELE_PROB');
   let body;try{body=await readBody(req)}catch{return fail(res,400,'BLEDNE_DANE')}
   if(!body||typeof body!=='object'||Array.isArray(body)||
      typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)||
      typeof body.action!=='string'||!Object.hasOwn(actions,body.action)||
      Object.keys(body).some(key=>!['id','action','note'].includes(key))||
      (body.action==='note'&&(typeof body.note!=='string'||body.note.length>300||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.note)))||
      (body.action!=='note'&&Object.hasOwn(body,'note')))
    return fail(res,400,'BLEDNE_DANE');
   const action=body.action,mutation=actions[action];
   // Enforced at the SQL boundary: only a sender or recipient can change their
   // own metadata, including the initial INSERT. Atomic single statement.
   const query='INSERT INTO '+ROOT+'.challenge_item_state(owner_id,challenge_id,starred,archived,seen_at,note) SELECT $1,c.id,$4,$5,CASE WHEN $6::boolean THEN now() ELSE NULL END,$3 FROM '+ROOT+'.game_challenges c WHERE c.id=$2 AND (c.sender_id=$1 OR c.recipient_id=$1) ON CONFLICT(owner_id,challenge_id) DO UPDATE SET '+mutation+',updated_at=now() RETURNING challenge_id';
   const changed=await database.query(query,[owner,body.id,action==='note'?body.note.trim():'',
     action==='star',action==='archive',action==='seen']);
   if(!changed.rows.length)return fail(res,404,'ZAPROSZENIE_NIEDOSTEPNE');
   return reply(res,200,{ok:true,id:body.id,action});
  }catch(e){
   console.error('CHALLENGE_CENTER_ERROR',{code:typeof e?.code==='string'?e.code:'CHALLENGE_CENTER'});
   return fail(res,503,'SYSTEM_NIEDOSTEPNY');
  }
 }
 return {handle};
}
