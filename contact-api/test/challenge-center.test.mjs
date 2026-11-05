import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallengeCenterRouter,ensureChallengeCenterSchema} from '../auth/challenge-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const another='22222222-2222-4222-8222-222222222222';
const invitation='33333333-3333-4333-8333-333333333333';
const token='a'.repeat(64),tokenOther='b'.repeat(64),origin='https://gracz-contact-api.onrender.com';
function fixture(){
 const data=new Map(),calls=[];
 const database={async query(sql,params=[]){
  calls.push({sql,params});
  if(sql.startsWith('SELECT a.id FROM gracz_public_identity.sessions s'))
   return {rows:params[0]===token?[{id:owner}]:params[0]===tokenOther?[{id:another}]:[]};
  if(sql.startsWith('INSERT INTO gracz_public_identity.challenge_item_state')){
   assert.match(sql,/FROM gracz_public_identity.game_challenges c WHERE c.id=\$2 AND \(c.sender_id=\$1 OR c.recipient_id=\$1\)/);
   assert.match(sql,/ON CONFLICT\(owner_id,challenge_id\) DO UPDATE SET/);
   const [account,id,note,star,archive,seen]=params;
   if(account!==owner||id!==invitation)return {rows:[]};
   const key=account+id,old=data.get(key)||{starred:false,archived:false,seen:false,note:''};
   if(sql.includes('starred=true'))old.starred=true;
   if(sql.includes('starred=false'))old.starred=false;
   if(sql.includes('archived=true'))old.archived=true;
   if(sql.includes('archived=false'))old.archived=false;
   if(sql.includes('seen_at=now()'))old.seen=true;
   if(sql.includes('seen_at=NULL'))old.seen=false;
   if(sql.includes('note=$3'))old.note=note;
   data.set(key,old);
   return {rows:[{challenge_id:id}]};
  }
  throw Error('Unexpected SQL '+sql.slice(0,100));
 }};
 const route=createChallengeCenterRouter({database,ready:async()=>{},sessionToken:req=>req.headers.token||'',
  digest:x=>x,authorizedOrigin:req=>req.headers.origin===origin,readBody:async req=>req.body,allow:()=>true});
 async function call(auth=token,method='POST',body={id:invitation,action:'star'},url='/auth/challenge-center/state',sender=origin){
  const req={method,headers:{token:auth,origin:sender},body};
  const res={status:0,body:'',headers:{},writeHead(code,headers){this.status=code;this.headers=headers},end(content){this.body=String(content)}};
  assert.equal(await route.handle(req,res,new URL(url,origin)),true);
  return {status:res.status,body:JSON.parse(res.body),headers:res.headers};
 }
 return {call,data,calls};
}
test('invitation organizer schema is owner-scoped and deletes metadata with accounts and invitations',async()=>{
 const sql=[];
 await ensureChallengeCenterSchema({query:async text=>{sql.push(text);return {rows:[]}}});
 assert.equal(sql.length,1);
 assert.match(sql[0],/PRIMARY KEY\(owner_id,challenge_id\)/);
 assert.match(sql[0],/REFERENCES gracz_public_identity.game_challenges\(id\) ON DELETE CASCADE/);
 assert.match(sql[0],/note varchar\(300\)/);
 assert.doesNotMatch(sql[0],/private_message|password_hash/);
});
test('sessions, origin and method are required, input and note strictly bounded',async()=>{
 const f=fixture();
 assert.equal((await f.call('')).status,401);
 assert.equal((await f.call(token,'GET')).status,405);
 assert.equal((await f.call(token,'POST',{id:invitation,action:'star'},undefined,'https://attacker.example')).status,403);
 for(const body of [
  {id:'not-a-uuid',action:'star'}, {id:invitation,action:'delete'}, {id:invitation,action:'star',note:'x'},
  {id:invitation,action:'note',note:'A'.repeat(301)},
  {id:invitation,action:'note',note:'x\u0000y'}, {id:invitation,action:'note',note:42},
  {id:invitation,action:'star',alien:true}
 ])assert.equal((await f.call(token,'POST',body)).status,400);
 assert.equal(f.data.size,0);
});
test('star, archive, mark seen and private note do not affect other player',async()=>{
 const f=fixture();
 const write=async(action,note)=>f.call(token,'POST',{id:invitation,action,...(note!==undefined?{note}:{})});
 for(const [action,note] of [['star'],['archive'],['seen'],['note','Zaproszenie na wieczór']]){
  const response=await write(action,note);assert.equal(response.status,200);
  assert.equal(response.headers['Cache-Control'],'private, no-store');
 }
 assert.deepEqual(f.data.get(owner+invitation),{starred:true,archived:true,seen:true,note:'Zaproszenie na wieczór'});
 assert.equal((await f.call(tokenOther)).status,404);
 assert.equal((await f.call(token,'POST',{id:another,action:'star'})).status,404);
 assert.equal(f.data.has(another+invitation),false);
 for(const a of ['unstar','restore','unseen'])assert.equal((await write(a)).status,200);
 assert.equal(f.data.get(owner+invitation).starred,false);
 assert.equal(f.data.get(owner+invitation).archived,false);
 assert.equal(f.data.get(owner+invitation).seen,false);
});
test('challenge permissions, both game timers and expiration are preserved',()=>{
 const source=readFileSync(new URL('../auth/public-identity.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(await challengeCenter.handle\(req,res,url\)\)return true/);
 assert.match(source,/c.time_limit_minutes,c.increment_seconds/);
 assert.match(source,/state.owner_id=\$1 AND state.challenge_id=c.id/);
 assert.match(source,/starred:row.starred===true,archived:row.archived===true/);
 assert.match(source,/const gomokuTimeOptions=new Set\(\[0,1,2,3,5,7,10,15,30\]\)/);
 assert.match(source,/const gomokuIncrementOptions=new Set\(\[0,2,3,5,10\]\)/);
 assert.match(source,/\['gomoku','warcaby'\]\.includes\(game\)/);
 assert.match(source,/c.status='pending' AND c.expires_at>now\(\)/);
});
test('premium challenge page has all eight tabs and working personal tools',()=>{
 const parts=[];
 for(const pathname of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,body:'',writeHead(status){this.status=status},end(body){this.body=String(body)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(pathname,origin)),true);
  assert.equal(res.status,200);parts.push(res.body);
 }
 const [html,js,css]=parts;
 assert.equal((html.match(/data-chall-tab="/g)||[]).length,8);
 for(const id of ['challenge-form','challenge-friend','challenge-game','challenge-time','challenge-increment',
  'challenge-list','chall-filter-status','chall-more','chall-settings','chall-note-save','chall-star-count'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/api\('social\/challenges'/);
 assert.match(js,/api\('challenge-center\/state'/);
 assert.match(js,/async function refreshChallenges/);
 assert.match(js,/timeLimitMinutes,incrementSeconds/);
 assert.match(css,/Full Max Premium Challenges/);
 assert.match(html,/Warcaby i Gomoku: dostępne limity czasu/);
});
