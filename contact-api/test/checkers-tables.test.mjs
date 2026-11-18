import test from 'node:test';
import assert from 'node:assert/strict';
import {validTableConfig,ensureCheckersTablesSchema,createCheckersTablesRouter} from '../auth/checkers-tables.mjs';

const id='12345678-1234-4234-8234-1234567890ab';
const config={action:'create',title:'Warcaby dla wszystkich',minutes:7,
 incrementSeconds:2,color:'white',visibility:'public'};
const make=()=>{
 const statements=[];
 let code=null;
 const db={query:async(sql,args=[])=>{
  statements.push({sql,args});
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions'))
   return {rows:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}],rowCount:1};
  if(sql.includes('SELECT count(*)::int AS n'))return {rows:[{n:0}],rowCount:1};
  if(sql.includes('INSERT INTO gracz_public_identity.warcaby_tables'))
   return {rows:[{id}],rowCount:1};
  if(sql.startsWith('WITH taken AS'))return {rows:[{id}],rowCount:1};
  if(sql.includes('SELECT t.id,t.title,t.minutes'))
   return {rows:[{id,title:config.title,minutes:7,increment_seconds:2,color:'white',
    visibility:'public',status:'waiting',host:'Host',guest:null,mine:false,
    joined:false,created_at:'2026-11-18T12:00:00Z'}],rowCount:1};
  return {rows:[],rowCount:1};
 }};
 let body={...config},authenticated=true,origin=true;
 const router=createCheckersTablesRouter({database:db,ready:async()=>{},sessionToken:()=>authenticated?'a'.repeat(64):'',
  digest:()=>Buffer.alloc(32),authorizedOrigin:()=>origin,
  readBody:async()=>body,allow:()=>true});
 const call=async(method,query='')=>{
  const req={method},url=new URL('https://gracz.pl/auth/warcaby/tables'+query);
  const res={writeHead(status,headers){this.status=status;this.headers=headers},
   end(raw){this.result=JSON.parse(raw)}};
  const handled=await router.handle(req,res,url);
  return {...res,handled};
 };
 return {db,statements,call,setBody:v=>body=v,setOrigin:v=>origin=v,setAuthenticated:v=>authenticated=v};
};
test('strict table options reject malformed data, injection and untimed increments',()=>{
 assert.equal(validTableConfig(config),true);
 assert.equal(validTableConfig({...config,action:'edit',id}),true);
 assert.equal(validTableConfig({...config,id}),false);
 for(const change of [{id:'bad'},{id:null},{title:'x'},{visibility:'secret'},{unexpected:1}])
  assert.equal(validTableConfig({...config,action:'edit',id,...change}),false,JSON.stringify(change));
 for(const change of [{minutes:1},{incrementSeconds:100},{color:'red'},{visibility:'secret'},
  {title:'<script>evil</script>'},{title:'x'},{minutes:0,incrementSeconds:2},
  {unexpected:'drop'}])
  assert.equal(validTableConfig({...config,...change}),false,JSON.stringify(change));
});
test('new tables are durable in the existing schema, with one waiting table per user',async()=>{
 const f=make();
 await ensureCheckersTablesSchema(f.db);
 assert.ok(f.statements.some(x=>x.sql.includes('warcaby_one_waiting_table_per_owner')));
 assert.ok(f.statements.some(x=>x.sql.includes('CREATE TABLE IF NOT EXISTS gracz_public_identity.warcaby_tables')));
});
test('table API requires session and same-origin, returns no-store, lists actual DB rows',async()=>{
 const f=make();
 f.setAuthenticated(false);
 assert.equal((await f.call('GET')).status,401);
 f.setAuthenticated(true);f.setOrigin(false);f.setBody(config);
 assert.equal((await f.call('POST')).status,403);
 f.setOrigin(true);
 assert.equal((await f.call('PUT')).status,405);
 const rows=await f.call('GET','?scope=waiting');
 assert.equal(rows.status,200);
 assert.equal(rows.headers['Cache-Control'],'private, no-store');
 assert.equal(rows.result.tables[0].host,'Host');
 assert.equal(rows.result.tables[0].id,id);
 assert.equal((await f.call('GET','?scope=other')).status,400);
 assert.equal((await f.call('GET','?code=../secret')).status,400);
});
test('creating a real table uses bound parameters; cancel can only close owner waiting table',async()=>{
 const f=make();
 const r=await f.call('POST');
 assert.equal(r.status,201);assert.equal(r.result.id,id);
 const creation=f.statements.find(x=>x.sql.includes('INSERT INTO gracz_public_identity.warcaby_tables'));
 assert.deepEqual(creation.args.slice(2),[config.title,7,2,'white','public']);
 assert.ok(creation.sql.includes('owner_id'));
 f.setBody({action:'close',id});
 const closed=await f.call('POST');
 assert.equal(closed.status,200);
 assert.ok(f.statements.some(x=>x.sql.includes("owner_id=$2 AND status='waiting'")));
});
test('joining atomically reserves a single seat and creates an accepted authorized challenge',async()=>{
 const f=make();f.setBody({action:'join',id});
 const out=await f.call('POST');
 assert.equal(out.status,200);assert.equal(out.result.matchId,id);
 const sql=f.statements.find(x=>x.sql.startsWith('WITH taken AS')).sql;
 for(const fragment of ["UPDATE gracz_public_identity.warcaby_tables","t.status='waiting'",
  "t.owner_id<>$2",'friend_blocks','INSERT INTO gracz_public_identity.game_challenges',
  "'warcaby','accepted'",'RETURNING id'])
  assert.ok(sql.includes(fragment),fragment);
 assert.equal(f.statements.at(-1).args[0],id);
});
test('unknown and malformed actions fail closed',async()=>{
 const f=make();
 for(const body of [{action:'join',id:'bad'},{action:'start',id},{action:'close',id,extra:true},null]){
  f.setBody(body);assert.equal((await f.call('POST')).status,400);
 }
});

test('owner-only edit updates an existing waiting table with bound parameters',async()=>{
 const f=make();f.setBody({...config,action:'edit',id,title:'Nowa nazwa',minutes:10,
  incrementSeconds:3,color:'black',visibility:'private'});
 const out=await f.call('POST');
 assert.equal(out.status,200);assert.equal(out.result.id,id);
 const write=f.statements.find(x=>x.sql.includes('SET title=$3,minutes=$4'));
 assert.ok(write,'No update query');
 assert.deepEqual(write.args,[id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Nowa nazwa',10,3,'black','private']);
 assert.ok(write.sql.includes("owner_id=$2 AND status='waiting'"));
 assert.ok(write.sql.includes("created_at>now()-interval '12 hours'"));
});
test('edit fails closed when table was claimed, closed or belongs to another owner',async()=>{
 const f=make();
 const old=f.db.query;
 f.db.query=(sql,args)=>sql.includes('SET title=$3,minutes=$4')?Promise.resolve({rows:[],rowCount:0}):old(sql,args);
 f.setBody({...config,action:'edit',id});
 const out=await f.call('POST');
 assert.equal(out.status,409);assert.equal(out.result.error,'STOL_NIEAKTUALNY');
 f.setBody({...config,action:'edit',id:'not-a-uuid'});
 assert.equal((await f.call('POST')).status,400);
});
test('invite lookup narrows visibility to the exact table UUID',async()=>{
 const f=make();await f.call('GET','?scope=waiting&code='+id);
 const lookup=f.statements.find(x=>x.sql.includes('SELECT t.id,t.title,t.minutes'));
 assert.ok(lookup.sql.includes("t.id=$2::uuid"));
 assert.ok(lookup.sql.includes("$2::uuid IS NULL"));
 assert.equal(lookup.args[1],id);
});
