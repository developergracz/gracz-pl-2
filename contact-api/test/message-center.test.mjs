import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMessageCenterRouter,ensureMessageCenterSchema} from '../auth/message-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const friend='33333333-3333-4333-8333-333333333333';
const sessionA='a'.repeat(64),sessionB='b'.repeat(64);
const origin='https://gracz-contact-api.onrender.com';
const blank=()=>({pinned:false,archived:false,muted:false,label:'',last_read_at:null});
function fixture(){
 const state=new Map(),calls=[];
 const db={async query(sql,params=[]){
  calls.push({sql,params});
  if(sql.startsWith('SELECT a.id FROM gracz_public_identity.sessions s')){
   return {rows:params[0]===sessionA?[{id:owner}]:params[0]===sessionB?[{id:stranger}]:[]};
  }
  if(sql.startsWith('SELECT a.nickname,COALESCE')){
   assert.match(sql,/AND \(c.account_a=\$1 OR c.account_b=\$1\)/);
   assert.match(sql,/c.status='accepted'/);
   assert.match(sql,/NOT EXISTS\(SELECT 1 FROM gracz_public_identity.friend_blocks/);
   assert.match(sql,/LIMIT 100/);
   if(params[0]!==owner)return {rows:[]};
   const current=state.get(owner+friend)||blank();
   return {rows:[{nickname:'Alfa',unread_count:current.last_read_at?0:3,
    pinned:current.pinned,archived:current.archived,muted:current.muted,label:current.label,
    last_body:'Cześć!',last_at:'2026-11-05T01:00:00.000Z',last_own:false}]};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.message_conversation_state')){
   assert.match(sql,/JOIN gracz_public_identity.friend_connections f/);
   assert.match(sql,/f.status='accepted'/);
   assert.match(sql,/NOT EXISTS\(SELECT 1 FROM gracz_public_identity.friend_blocks/);
   assert.match(sql,/ON CONFLICT\(owner_id,friend_id\) DO UPDATE SET/);
   const [actor,nick,label,pin,archive,mute,read]=params;
   if(actor!==owner||nick!=='alfa')return {rows:[],rowCount:0};
   const previous=state.get(actor+friend)||blank();
   if(sql.includes('pinned=true'))previous.pinned=true;
   if(sql.includes('pinned=false'))previous.pinned=false;
   if(sql.includes('archived=true'))previous.archived=true;
   if(sql.includes('archived=false'))previous.archived=false;
   if(sql.includes('muted=true'))previous.muted=true;
   if(sql.includes('muted=false'))previous.muted=false;
   if(sql.includes('label=$3'))previous.label=label;
   if(sql.includes('last_read_at=now()'))previous.last_read_at=new Date();
   if(sql.includes('last_read_at=NULL'))previous.last_read_at=null;
   state.set(actor+friend,previous);
   return {rows:[{friend_id:friend}],rowCount:1};
  }
  throw Error('Unexpected SQL: '+sql.slice(0,95));
 }};
 const router=createMessageCenterRouter({database:db,ready:async()=>{},sessionToken:req=>req.headers.token||'',digest:x=>x,
  authorizedOrigin:req=>req.headers.origin===origin,readBody:async req=>req.body,allow:()=>true});
 async function call(token=sessionA,method='GET',url='/auth/message-center',body={},requestOrigin=origin){
  const req={method,headers:{token,origin:requestOrigin},body,socket:{remoteAddress:'127.0.0.1'}};
  const res={status:0,content:'',headers:{},writeHead(code,headers){this.status=code;this.headers=headers},end(content){this.content=String(content)}};
  assert.equal(await router.handle(req,res,new URL(url,origin)),true);
  return {status:res.status,data:JSON.parse(res.content),headers:res.headers};
 }
 return {db,call,state,calls};
}
test('lightweight conversation metadata table belongs to each account',async()=>{
 const sql=[];
 await ensureMessageCenterSchema({query:async line=>{sql.push(line);return {rows:[]}}});
 assert.equal(sql.length,1);
 assert.match(sql[0],/PRIMARY KEY\(owner_id,friend_id\)/);
 assert.match(sql[0],/CHECK\(owner_id<>friend_id\)/);
 assert.match(sql[0],/ON DELETE CASCADE/);
 assert.match(sql[0],/last_read_at timestamptz/);
 assert.doesNotMatch(sql[0],/message_body|password_digest/);
});
test('no session, unauthorized origin, invalid method and invalid input all fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.call('')).status,401);
 assert.equal((await f.call(sessionA,'PUT')).status,405);
 assert.equal((await f.call(sessionA,'POST','/auth/message-center/state',{nickname:'Alfa',action:'pin'},'https://attacker.test')).status,403);
 for(const body of [{nickname:'Alfa',action:'drop'}, {nickname:'Nonfriend',action:'pin'},
  {nickname:'Alfa',action:'label',label:'hack'}, {nickname:'Alfa',action:'pin',unsafe:true},
  {nickname:'Alfa',action:'label',label:5}]){
  const response=await f.call(sessionA,'POST','/auth/message-center/state',body);
  assert.equal(response.status,body.nickname==='Nonfriend'?404:400);
 }
 assert.equal(f.state.size,0);
});
test('conversation summaries show only owner-verified accepted unblocked friends',async()=>{
 const f=fixture();
 const x=await f.call();
 assert.equal(x.status,200);
 assert.equal(x.headers['Cache-Control'],'private, no-store');
 assert.equal(x.data.conversations.length,1);
 assert.equal(x.data.conversations[0].nickname,'Alfa');
 assert.equal(x.data.conversations[0].unread,3);
 assert.equal(x.data.conversations[0].lastMessage,'Cześć!');
 assert.equal(JSON.stringify(x.data).includes(owner),false);
 assert.equal(JSON.stringify(x.data).includes(friend),false);
 assert.equal((await f.call(sessionB)).data.conversations.length,0);
});
test('pin, mute, archive, label and read are independent account-local state',async()=>{
 const f=fixture();
 const action=async(a,label)=>f.call(sessionA,'POST','/auth/message-center/state',{nickname:'Alfa',action:a,...(label?{label}:{})});
 assert.equal((await action('pin')).data.changed,1);
 assert.equal((await action('mute')).status,200);
 assert.equal((await action('archive')).status,200);
 assert.equal((await action('label','team')).status,200);
 const archived=(await f.call()).data.conversations[0];
 assert.equal(archived.pinned,true);
 assert.equal(archived.muted,true);
 assert.equal(archived.archived,true);
 assert.equal(archived.label,'team');
 assert.equal(archived.unread,3);
 assert.equal((await action('read')).status,200);
 assert.equal((await f.call()).data.conversations[0].unread,0);
 assert.equal((await action('unread')).status,200);
 assert.equal((await f.call()).data.conversations[0].unread,3);
 await action('unpin');await action('unmute');await action('restore');
 const normal=(await f.call()).data.conversations[0];
 assert.equal(normal.pinned,false);assert.equal(normal.muted,false);assert.equal(normal.archived,false);
 assert.equal((await f.call(sessionB,'POST','/auth/message-center/state',{nickname:'Alfa',action:'pin'})).status,404);
});
test('existing message sending and personal privacy policies remain authoritative',()=>{
 const backend=readFileSync(new URL('../auth/public-identity.mjs',import.meta.url),'utf8');
 const notification=readFileSync(new URL('../auth/notification-center.mjs',import.meta.url),'utf8');
 assert.match(backend,/if\(url.pathname==='\/auth\/social\/messages'/);
 assert.match(backend,/c.status='accepted'/);
 assert.match(backend,/p.trusted_messages_only/);
 assert.match(backend,/if\(await messageCenter.handle/);
 assert.match(notification,/COALESCE\(state.muted,false\)=false/);
});
test('responsive chat layout contains working list, options and original send path',()=>{
 const served=[];
 for(const path of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,data:'',writeHead(code){this.status=code},end(content){this.data=String(content)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,origin)),true);
  assert.equal(res.status,200);served.push(res.data);
 }
 const [html,js,css]=served;
 for(const id of ['msg-conversations','msg-find','msg-label','msg-mute','msg-pin','msg-archive',
   'msg-unread','msg-search-thread','message-form','message-content','message-send','msg-export'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/async function messageCenterLoad/);
 assert.match(js,/async function msgChange/);
 assert.match(js,/api\('message-center\/state'/);
 assert.match(js,/api\('social\/messages'/);
 assert.match(js,/if\(typeof setInterval==='function'\)setInterval/);
 assert.match(css,/Messages & Chat Full Max Premium/);
 assert.match(html,/Nie deklarujemy szyfrowania end-to-end/);
});
