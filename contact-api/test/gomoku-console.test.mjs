import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { serveGomokuConsole } from '../auth/gomoku-console.mjs';

const host='https://gracz-contact-api.onrender.com';
function served(path,method='GET'){
 const res={status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=String(body||'');}};
 const found=serveGomokuConsole({method},res,new URL(path,host));
 return {found,...res};
}
test('Gomoku Full Max Premium serves its dedicated console and assets without login',()=>{
 for(const [path,type] of [['/konto/gomoku/','text/html'],['/konto/gomoku/styl.css','text/css'],
  ['/konto/gomoku/app.js','application/javascript']]){
  const res=served(path);assert.equal(res.found,true);
  assert.equal(res.status,200);assert.match(res.headers['Content-Type'],new RegExp(type));
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.match(res.headers['Content-Security-Policy'],/connect-src 'self'/);
  assert.equal(Number(res.headers['Content-Length']),Buffer.byteLength(res.body));
 }
 assert.equal(served('/konto/gomoku/','POST').found,false);
 assert.equal(served('/konto/gomoku/unknown').found,false);
 const html=served('/konto/gomoku/').body;
 assert.match(html,/noindex,nofollow,noarchive/);
 for(const id of ['board','training-mode','online-mode','room-select','join-room','game-state','restart','refresh-match'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Trening/);assert.match(html,/Ze znajomym/);
 const css=served('/konto/gomoku/styl.css').body;
 assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/aspect-ratio:1/);
 new Script(served('/konto/gomoku/app.js').body);
});
test('Gomoku browser console can play immediately against a computer and join a real accepted room',async()=>{
 const fake=new Map(),queued=[],calls=[];
 class Element{
  constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;this.disabled=false;
   this.textContent='';this.style={};this.classes=new Set();
   this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),
    contains:x=>this.classes.has(x),
    toggle:(x,value)=>{if(value===undefined)value=!this.classes.has(x);if(value)this.classes.add(x);else this.classes.delete(x);}};
  }
  addEventListener(name,handler){this.listeners[name]=handler;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.value='';}
  setAttribute(){}
 }
 const get=id=>{if(!fake.has(id))fake.set(id,new Element());return fake.get(id);};
 const board=Array(225).fill(0);
 const matchId='d48944ab-106f-4d4b-855b-bcb76e30a112';
 const match={id:matchId,game:'gomoku',version:0,player:1,players:['GraczAlfa','GraczBeta'],
  playable:true,state:{board,turn:1,winner:0,moves:0}};
 const fetch=async(path,options)=>{
  calls.push({path,options});
  if(path==='/auth/profile')return {ok:true,status:200,json:async()=>({ok:true,profile:{nickname:'GraczAlfa'}})};
  if(path==='/auth/social/challenges')return {ok:true,status:200,json:async()=>({ok:true,challenges:[
   {id:matchId,game:'gomoku',status:'accepted',opponent:'GraczBeta'}
  ]})};
  if(path==='/auth/match?id='+encodeURIComponent(matchId))return {ok:true,status:200,
   json:async()=>({ok:true,match})};
  if(path==='/auth/match'&&options.method==='POST'){
   const sent=JSON.parse(options.body);
   assert.equal(sent.version,0);assert.equal(sent.id,matchId);
   match.version=1;match.state.board[sent.move.to]=1;match.state.turn=2;match.state.moves=1;
   return {ok:true,status:200,json:async()=>({ok:true,match})};
  }
  throw Error('unexpected fetch '+path);
 };
 const context={
  document:{getElementById:get,createElement:()=>new Element(),visibilityState:'visible'},
  window:{setTimeout:fn=>{queued.push(fn);},setInterval:()=>{}},
  location:{search:'',pathname:'/konto/gomoku/'},
  history:{replaceState(){}},
  URLSearchParams,fetch,console
 };
 new Script(served('/konto/gomoku/app.js').body).runInNewContext(context);
 assert.equal(get('board').children.length,225);
 get('board').children[112].listeners.click();
 assert.equal(get('move-count').textContent,'Ruchy: 1');
 assert.equal(get('board').children[112].classes.has('p1'),true);
 assert.equal(queued.length,1);queued.pop()();
 assert.equal(get('move-count').textContent,'Ruchy: 2');
 assert.equal(get('board').children.filter(x=>x.classes.has('p2')).length,1);
 get('online-mode').listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('room-select').children.length,2);
 assert.equal(get('join-room').disabled,false);
 get('join-room').listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children.length,225);
 assert.equal(get('black-name').textContent,'GraczAlfa');
 assert.equal(get('room-tag').textContent,'POKÓJ ONLINE');
 get('board').children[44].listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children[44].classes.has('p1'),true);
 assert.equal(get('move-count').textContent,'Ruchy: 1');
 assert.ok(calls.every(x=>x.options.credentials==='same-origin'));
});
