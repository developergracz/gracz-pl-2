import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationRouter,ensureNotificationSchema} from '../auth/notification-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const token1='a'.repeat(64),token2='b'.repeat(64);
const host='https://gracz-contact-api.onrender.com';
const source=[
 {source_id:'message:11111111-1111-4111-8111-111111111112',category:'messages',
  title:'Nowa wiadomość',actor:'Znajomy',detail:'Otrzymano wiadomość prywatną',
  happened_at:'2026-11-05T00:00:00.000Z'},
 {source_id:'game-invite:11111111-1111-4111-8111-111111111113',category:'games',
  title:'Zaproszenie do gry',actor:'Warcabista',detail:'Zaproszenie: warcaby',
  happened_at:'2026-11-04T00:00:00.000Z'},
 {source_id:'security:11111111-1111-4111-8111-111111111114',category:'security',
  title:'Zmieniono hasło',actor:'',detail:'Zdarzenie dotyczące ochrony Twojego konta',
  happened_at:'2026-11-03T00:00:00.000Z'}
];
const defaultSettings={messages_enabled:true,friends_enabled:true,games_enabled:true,
 highlight_unread:true,show_nicknames:true,show_dates:true,auto_read_on_open:false,muted_until:null};
const incoming={messages:true,friends:false,games:false,highlightUnread:true,showNicknames:false,
 showDates:false,autoReadOnOpen:true,muteMinutes:60};
function fixture(){
 const prefs=new Map(),state=new Map(),sqlCalls=[];
 const db={async query(sql,params=[]){
  sqlCalls.push({sql,params});
  if(sql.startsWith('SELECT a.id FROM gracz_public_identity.sessions s')){
   return {rows:params[0]===token1?[{id:owner}]:params[0]===token2?[{id:other}]:[]};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.notification_preferences')){
   const [id,messages,friends,games,highlight,showNick,showDates,autoRead,mute]=params;
   prefs.set(id,{messages_enabled:messages,friends_enabled:friends,games_enabled:games,
    highlight_unread:highlight,show_nicknames:showNick,show_dates:showDates,
    auto_read_on_open:autoRead,muted_until:mute});
   return {rowCount:1};
  }
  if(sql.startsWith('SELECT messages_enabled,friends_enabled')){
   return {rows:prefs.has(params[0])?[prefs.get(params[0])]:[]};
  }
  if(sql.includes('WITH source AS (')||sql.startsWith('\nWITH source AS (')){
   assert.match(sql,/WHERE m.recipient_id=\$1/);
   assert.match(sql,/WHERE e.account_id=\$1/);
   assert.match(sql,/st.account_id=\$1/);
   assert.match(sql,/LIMIT 200/);
   const id=params[0];if(id!==owner)return {rows:[]};
   return {rows:source.map(e=>({
    ...e,is_read:state.get(id+e.source_id)?.read===true,
    is_archived:state.get(id+e.source_id)?.archived===true
   }))};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.notification_item_state')){
   const ids=params[1];
   const markRead=sql.includes('read_at'),clear=sql.includes('=NULL')||sql.includes('id,NULL');
   for(const eventId of ids){
    const key=params[0]+eventId,val=state.get(key)||{};
    if(markRead)val.read=!clear;
    else val.archived=!clear;
    state.set(key,val);
   }
   return {rowCount:ids.length};
  }
  throw Error('Unexpected SQL: '+sql.slice(0,105));
 }};
 const api=createNotificationRouter({database:db,ready:async()=>{},sessionToken:req=>req.headers.session||'',
  digest:t=>t,authorizedOrigin:req=>req.headers.origin===host,readBody:async req=>req.payload,
  allow:()=>true});
 async function call(session=token1,method='GET',path='/auth/notification-center',payload={},origin=host){
  const req={method,headers:{session,origin},payload,socket:{remoteAddress:'127.0.0.1'}};
  const res={status:0,body:'',headers:{},writeHead(n,h){this.status=n;this.headers=h},end(x){this.body=String(x)}};
  const handled=await api.handle(req,res,new URL(path,host));
  assert.equal(handled,true);
  return {status:res.status,body:JSON.parse(res.body),headers:res.headers};
 }
 return {call,state,prefs,sqlCalls,db};
}
test('minimal owner-scoped schema, no new external delivery or duplicated message storage',async()=>{
 const sql=[];
 await ensureNotificationSchema({query:async text=>{sql.push(text);return {rows:[]}}});
 assert.equal(sql.length,2);
 assert.match(sql[0],/account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts/);
 assert.match(sql[1],/PRIMARY KEY\(account_id,source_id\)/);
 assert.doesNotMatch(sql.join(' '),/message_body|email_address|sms_phone/i);
});
test('only verified session can read, and writes require authorized origin',async()=>{
 const f=fixture();
 assert.equal((await f.call('')).status,401);
 assert.equal((await f.call(token1,'POST','/auth/notification-center')).status,405);
 assert.equal((await f.call(token1,'PUT','/auth/notification-center',incoming,'https://external.test')).status,403);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'read',ids:[source[0].source_id]},'https://external.test')).status,403);
 assert.equal(f.sqlCalls.filter(x=>x.sql.startsWith('INSERT INTO')).length,0);
});
test('real feed shows only own events, no message bodies, with protected security category',async()=>{
 const f=fixture();
 const me=await f.call();
 assert.equal(me.status,200);assert.equal(me.body.items.length,3);
 assert.equal(me.body.meta.unread,3);
 assert.equal(me.body.meta.securityAlwaysVisible,true);
 assert.equal(JSON.stringify(me.body).includes('Otrzymano wiadomość prywatną'),true);
 assert.equal(JSON.stringify(me.body).includes(owner),false);
 assert.equal((await f.call(token2)).body.items.length,0);
});
test('per-account settings filter categories, hide nickname and preserve security',async()=>{
 const f=fixture();
 assert.equal((await f.call(token1,'PUT','/auth/notification-center',{...incoming,messages:false})).status,200);
 const muted=await f.call();
 assert.deepEqual(muted.body.items.map(x=>x.category),['security']);
 assert.equal(muted.body.preferences.autoReadOnOpen,true);
 assert.equal((await f.call(token2)).body.preferences.messages,true);
 assert.equal((await f.call(token1,'PUT','/auth/notification-center',incoming)).status,200);
 const visible=await f.call();
 assert.deepEqual(visible.body.items.map(x=>x.category),['messages','security']);
 assert.equal(visible.body.items[0].actor,'');
 assert.ok(new Date(visible.body.preferences.mutedUntil)>new Date());
 assert.equal(visible.body.meta.unread,2);
});
test('strict preference validation allows only supported switches and mute durations',async()=>{
 const f=fixture();
 for(const payload of [{...incoming,muteMinutes:-1},{...incoming,muteMinutes:15},
  {...incoming,showDates:'false'},{...incoming,extra:true}])
  assert.equal((await f.call(token1,'PUT','/auth/notification-center',payload)).status,400);
});
test('read, unread, archive, restore and bulk actions are scoped to current account events',async()=>{
 const f=fixture();
 const first=source[0].source_id,second=source[1].source_id;
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'read',ids:[first]})).body.changed,1);
 assert.equal((await f.call()).body.meta.unread,2);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'archive',ids:[first]})).body.changed,1);
 assert.equal((await f.call()).body.meta.archived,1);
 assert.equal((await f.call(token2,'POST','/auth/notification-center/action',{action:'read',ids:[first]})).status,404);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'read',ids:['message:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']})).status,404);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'restore',ids:[first]})).body.changed,1);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'unread',ids:[first]})).body.changed,1);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'read-all',ids:[]})).body.changed,3);
 assert.equal((await f.call()).body.meta.unread,0);
 assert.equal((await f.call(token1,'POST','/auth/notification-center/action',{action:'archive-read',ids:[]})).body.changed,3);
 assert.equal((await f.call()).body.meta.archived,3);
 assert.equal(f.state.get(owner+second).archived,true);
});
test('premium notifications panel exposes eight tabs, real actions and no false email/push claims',()=>{
 const result=[];
 for(const path of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,text:'',writeHead(n){this.status=n},end(x){this.text=String(x)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,host)),true);
  assert.equal(res.status,200);result.push(res.text);
 }
 const [html,js,css]=result;
 assert.equal((html.match(/data-nt-tab="/g)||[]).length,8);
 for(const id of ['nt-list','nt-unread','nt-mark-all','nt-archive-read','nt-settings-form','nt-mute','nt-export'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Wysyłka zewnętrznych powiadomień e-mail, push i SMS nie jest uruchomiona/);
 assert.match(js,/notification-center\/action/);
 assert.match(js,/async function ntLoad/);
 assert.match(js,/ntOpenTarget/);
 assert.match(css,/Notifications Full Max Premium/);
});
