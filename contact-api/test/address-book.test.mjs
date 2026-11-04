import test from 'node:test';
import assert from 'node:assert/strict';
import {createAddressBookRouter,ensureAddressBookSchema} from '../auth/address-book.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';
const owner1='11111111-1111-4111-8111-111111111111',owner2='22222222-2222-4222-8222-222222222222';
const friend='33333333-3333-4333-8333-333333333333';
const host='https://gracz-contact-api.onrender.com';
const t1='a'.repeat(64),t2='b'.repeat(64);
function factory(){
 const records=[],sqls=[];
 let allowedFriend=true;
 const database={async query(sql,params=[]){
  sqls.push({sql,params});
  if(sql.includes('FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a'))
   return {rows:params[0]===t1?[{id:owner1}]:params[0]===t2?[{id:owner2}]:[]};
  if(sql.includes('SELECT a.id FROM gracz_public_identity.accounts a JOIN gracz_public_identity.friend_connections f'))
   return {rows:allowedFriend&&params[0]===owner1&&params[1]==='szachista'?[{id:friend}]:[]};
  if(sql.includes('INSERT INTO gracz_public_identity.player_address_book')){
   const [id,owner,friendId,name,email,phone,note,group,tags,favorite]=params;
   if(records.length>=2000)return {rowCount:0,rows:[]};
   if(records.some(x=>x.owner_id===owner&&x.friend_id&&x.friend_id===friendId)){
    const err=new Error('DUPLICATE');err.code='23505';throw err;
   }
   records.push({id,owner_id:owner,friend_id:friendId,name,email,phone,note,
     group_name:group,tags,favorite,created_at:'2026-11-04',updated_at:'2026-11-04'});
   return {rowCount:1,rows:[{id}]};
  }
  if(sql.includes('UPDATE gracz_public_identity.player_address_book')){
   const [owner,id,name,email,phone,note,group,tags,favorite]=params;
   const item=records.find(x=>x.owner_id===owner&&x.id===id);
   if(!item)return {rowCount:0,rows:[]};
   Object.assign(item,{name,email,phone,note,group_name:group,tags,favorite});
   return {rowCount:1,rows:[{id}]};
  }
  if(sql.includes('DELETE FROM gracz_public_identity.player_address_book')){
   const [owner,id]=params,index=records.findIndex(x=>x.owner_id===owner&&x.id===id);
   if(index<0)return {rowCount:0,rows:[]};
   records.splice(index,1);return {rowCount:1,rows:[{id}]};
  }
  if(sql.includes('SELECT b.id,b.name,b.email')){
   const owner=params[0];
   return {rows:records.filter(x=>x.owner_id===owner).map(x=>({
    ...x,nickname:x.friend_id?'Szachista':null,connected:!!x.friend_id
   }))};
  }
  if(sql.includes('SELECT COUNT(*)::integer AS total')){
   return {rows:[{total:records.filter(x=>x.owner_id===params[0]).length}]};
  }
  if(sql.includes('SELECT group_name,COUNT(*)::integer AS total')){
   const gr=new Map();
   for(const r of records.filter(x=>x.owner_id===params[0])){
    const current=gr.get(r.group_name)||{group_name:r.group_name,total:0,favorites:0};
    current.total++;if(r.favorite)current.favorites++;gr.set(r.group_name,current);
   }
   return {rows:[...gr.values()]};
  }
  throw Error('Unexpected query '+sql.slice(0,100));
 }};
 const api=createAddressBookRouter({database,ready:async()=>{},sessionToken:req=>req.headers.token||'',
  digest:token=>token,authorizedOrigin:req=>req.headers.origin===host,
  readBody:async req=>req.payload,allow:()=>true});
 async function call(token,method,path,payload,origin=host){
  const request={method,headers:{token,origin},socket:{remoteAddress:'127.0.0.1'},payload};
  const response={code:0,text:'',writeHead(code){this.code=code},end(body){this.text=String(body)}};
  const handled=await api.handle(request,response,new URL(path,host));
  assert.equal(handled,true);return {status:response.code,body:JSON.parse(response.text)};
 }
 return {call,records,sqls,setAllowed:v=>{allowedFriend=v}};
}
const entry={name:'Klubowy partner',nickname:'',email:'',phone:'',note:'Warcaby i Gomoku',
 group:'Klub graczy',tags:['warcaby','trening'],favorite:true};
test('schema has private owner FK and stable optional friend identity without new services',async()=>{
 const statements=[],database={query:async q=>{statements.push(q);return {rows:[]}}};
 await ensureAddressBookSchema(database);
 assert.equal(statements.length,3);
 assert.match(statements[0],/owner_id uuid NOT NULL REFERENCES/);
 assert.match(statements[0],/friend_id uuid REFERENCES/);
 assert.match(statements[1],/owner_id,updated_at DESC/);
 assert.match(statements[2],/owner_id,friend_id/);
});
test('private address book requires session and authorized mutation origin',async()=>{
 const f=factory();
 assert.equal((await f.call('','GET','/auth/address-book')).status,401);
 assert.equal((await f.call(t1,'PUT','/auth/address-book',entry,'https://attacker.invalid')).status,403);
 assert.equal((await f.call(t1,'POST','/auth/address-book',entry)).status,405);
 assert.equal(f.records.length,0);
});
test('each account reads and edits only its own contacts, with private notes and email',async()=>{
 const f=factory();
 const create=await f.call(t1,'PUT','/auth/address-book',{...entry,email:'own@example.test',phone:'+48 600 123 456'});
 assert.equal(create.status,200);
 const owner=await f.call(t1,'GET','/auth/address-book');
 assert.equal(owner.status,200);assert.equal(owner.body.contacts.length,1);
 assert.equal(owner.body.contacts[0].email,'own@example.test');
 assert.equal(owner.body.contacts[0].note,'Warcaby i Gomoku');
 const stranger=await f.call(t2,'GET','/auth/address-book');
 assert.equal(stranger.body.contacts.length,0);
 const edit=await f.call(t2,'PUT','/auth/address-book',{...entry,id:create.body.id,name:'Cudzy kontakt'});
 assert.equal(edit.status,404);
 const deleting=await f.call(t2,'DELETE','/auth/address-book',{id:create.body.id});
 assert.equal(deleting.status,404);
 assert.equal(f.records[0].name,entry.name);
 assert.equal((await f.call(t1,'DELETE','/auth/address-book',{id:create.body.id})).status,200);
});
test('linking a platform account requires accepted unblocked friendship',async()=>{
 const f=factory(),linked={...entry,nickname:'Szachista'};
 assert.equal((await f.call(t1,'PUT','/auth/address-book',linked)).status,200);
 assert.equal(f.records[0].friend_id,friend);
 const duplicate=await f.call(t1,'PUT','/auth/address-book',linked);assert.equal(duplicate.status,409);
 f.setAllowed(false);
 assert.equal((await f.call(t1,'PUT','/auth/address-book',{...linked,name:'Nowy'})).status,403);
 assert.equal((await f.call(t2,'PUT','/auth/address-book',linked)).status,403);
});
test('invalid input and oversized notes are rejected without database writes',async()=>{
 const f=factory();
 for(const change of [{note:'A'.repeat(1001)},{tags:Array(9).fill('tag')},{email:'bad email'}, {phone:'DROP TABLE'}]){
  const r=await f.call(t1,'PUT','/auth/address-book',{...entry,...change});
  assert.equal(r.status,400);
 }
 assert.equal(f.records.length,0);
});
test('Friends Hub UI is present without deleting original friends, messages or blocks',()=>{
 const paths=['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css'];
 const payload=paths.map(path=>{
  const r={code:0,body:'',writeHead(code){this.code=code},end(v){this.body=String(v)}};
  assert.equal(servePlayerPanel({method:'GET'},r,new URL(path,host)),true);
  assert.equal(r.code,200);return r.body;
 });
 const [html,js,css]=payload;
 assert.equal((html.match(/data-fh-tab="/g)||[]).length,5);
 assert.equal((html.match(/data-fh-pane="/g)||[]).length,5);
 for(const id of ['friends-list','friends-incoming','friends-blocked','ab-form','ab-list',
  'ab-group-filter','ab-import-file','ab-export','ab-search','ab-favorites-filter'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function abOpenFriend\(nickname\)/);
 assert.match(js,/openSocialContact\('messages',item\.nickname\)/);
 assert.match(css,/Friends Hub Full Max Premium/);
 assert.doesNotMatch(html,/<script[^>]+src="https:/i);
});
