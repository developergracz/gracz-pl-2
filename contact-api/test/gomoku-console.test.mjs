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
 for(const id of ['board','training-mode','online-mode','room-select','join-room','game-state','restart','refresh-match','undo-move','analyze-position','game-settings','fullscreen-game','analysis-note','history-tab','chat-tab','moves-list','chat-messages','chat-preview','chat-form','chat-input','chat-send'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Trening/);assert.match(html,/Ze znajomym/);
 assert.match(html,/id="ai-level"/);
 assert.match(html,/<option value="expert" selected>/);
 assert.match(html,/<option value="hard">/);
 assert.match(html,/<option value="normal">/);
 const css=served('/konto/gomoku/styl.css').body;
 assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/aspect-ratio:1/);
 assert.match(css,/\.cell\.p1\.occupied::after/);
 assert.match(css,/\.cell\.p2\.occupied::after/);
 assert.match(css,/#edf0ec/); // pearl white board, no dark wooden board
 assert.match(css,/\.boardframe\{[^}]*background:linear-gradient/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/\.tool-btn/);
 assert.match(css,/\.side-dock/);
 assert.match(css,/\.move-row/);
 assert.match(css,/\.chat-bubble/);
 assert.match(css,/grid-template-columns:27\.5%/);
 assert.match(css,/\.side-dock\{grid-column:2;grid-row:1 \/ 5/);
 assert.match(css,/\.side-dock \.game-tools\{grid-template-columns:repeat\(4/);
 assert.match(css,/\.boardframe\{width:min\(100%,calc\(100dvh - 270px\)/);
 new Script(served('/konto/gomoku/app.js').body);
});
test('Gomoku browser console can play immediately against a computer and join a real accepted room',async()=>{
 const fake=new Map(),queued=[],calls=[];
 class Element{
  constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;this.disabled=false;
   this.textContent='';this.style={};this.classes=new Set();this.focused=false;
   this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),
    contains:x=>this.classes.has(x),
    toggle:(x,value)=>{if(value===undefined)value=!this.classes.has(x);if(value)this.classes.add(x);else this.classes.delete(x);}};
  }
  addEventListener(name,handler){this.listeners[name]=handler;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.value='';}
  setAttribute(){}
  focus(){this.focused=true;}
  scrollIntoView(){}
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
  if(path==='/auth/match/chat?id='+matchId)return {ok:true,status:200,json:async()=>({ok:true,messages:[]})};
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
 assert.equal(get('moves-list').children.length,2,'History includes player and AI response');
 assert.equal(get('history-count').textContent,'2');
 assert.equal(get('moves-list').children[0].children[2].textContent,'H8');
 assert.equal(get('undo-move').disabled,false);
 get('analyze-position').listeners.click();
 assert.equal(get('analysis-note').hidden,false);
 assert.equal(get('board').children.filter(x=>x.classes.has('suggested')).length,1);
 get('game-settings').listeners.click();
 assert.equal(get('ai-level').focused,true);
 get('undo-move').listeners.click();
 assert.equal(get('move-count').textContent,'Ruchy: 0');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,0);
 assert.equal(get('undo-move').disabled,true);
 assert.equal(get('moves-list').children[0].textContent,'Wybierz pole i rozpocznij partię.');
 get('chat-tab').listeners.click();
 assert.equal(get('chat-panel').hidden,false);
 assert.equal(get('moves-panel').hidden,true);
 assert.equal(get('chat-input').disabled,false);
 get('chat-input').value='Powodzenia!';
 await get('chat-form').listeners.submit({preventDefault(){}});
 assert.equal(get('chat-messages').children.length,2);
 assert.equal(get('chat-messages').children[1].children[1].textContent,'Dzięki, wzajemnie! 🤝');
 assert.equal(get('chat-preview').children.length,2);
 get('history-tab').listeners.click();
 assert.equal(get('chat-preview').hidden,false);
 assert.equal(get('chat-panel').hidden,true);
 get('online-mode').listeners.click();
 assert.equal(get('chat-input').disabled,true);
 assert.equal(get('undo-move').disabled,true);
 assert.equal(get('analyze-position').disabled,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('room-select').children.length,2);
 assert.equal(get('join-room').disabled,false);
 get('join-room').listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children.length,225);
 assert.equal(get('black-name').textContent,'GraczAlfa');
 assert.equal(get('room-tag').textContent,'POKÓJ ONLINE');
 assert.equal(get('chat-input').disabled,false);
 get('board').children[44].listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children[44].classes.has('p1'),true);
 assert.equal(get('move-count').textContent,'Ruchy: 1');
 assert.ok(calls.every(x=>x.options.credentials==='same-origin'));
});


function getTrainedAI(){
 const client=served('/konto/gomoku/app.js').body;
 const head=client.indexOf('function victory('),end=client.indexOf('function describe(',head);
 const from=client.indexOf('const axes='),until=client.indexOf('function trainMove(',from);
 assert.ok(head>=0&&end>head&&from>=0&&until>from,'AI components are present');
 const evaluator=[
  'const size=15,count=225;',
  'const inBounds=(r,c)=>r>=0&&r<size&&c>=0&&c<size;',
  client.slice(head,end),client.slice(from,until),
  '({cpuMove,tacticalScore})'
 ].join('\n');
 return new Script(evaluator).runInNewContext({});
}

test('Expert Gomoku AI wins immediately rather than making a merely attractive move',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(const col of [4,5,6,7])board[7*15+col]=2;
 for(const col of [3,4,5])board[10*15+col]=1;
 const original=board.slice();
 for(const level of ['normal','hard','expert']){
  const move=cpuMove(board,level);
  assert.ok([7*15+3,7*15+8].includes(move),level+' must finish five-in-a-row');
  assert.deepEqual(board,original,'AI cannot mutate active board state');
 }
});

test('Gomoku AI blocks the only immediate human win at all levels',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 board[7*15+3]=2; // Close the left end of the human four.
 for(const col of [4,5,6,7])board[7*15+col]=1;
 for(const level of ['normal','hard','expert']){
  assert.equal(cpuMove(board,level),7*15+8,level+' must block human win');
 }
});

test('Expert Gomoku AI builds a decisive crossing double threat',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(const col of [5,6,8])board[7*15+col]=2;
 board[6*15+7]=2;board[8*15+7]=2;
 for(const level of ['hard','expert'])
  assert.equal(cpuMove(board,level),7*15+7,level+' must find crossing threat');
});

test('Expert Gomoku AI chooses legal, deterministic moves in a midgame position',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(let n=0;n<32;n++){
  const r=5+(n*3)%6,c=4+(n*7)%7,at=r*15+c;
  if(!board[at])board[at]=n%2+1;
 }
 const first=cpuMove(board,'expert'),second=cpuMove(board,'expert');
 assert.equal(first,second,'Same position must yield same choice');
 assert.ok(Number.isInteger(first)&&first>=0&&first<225);
 assert.equal(board[first],0);
});
