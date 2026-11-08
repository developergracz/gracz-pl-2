import test from 'node:test';
import assert from 'node:assert/strict';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {graczAiChatJs,graczAiChatCss} from '../auth/gracz-ai-chat-assets.mjs';
import {createGomokuAiChatRoute} from '../routes/gomoku-ai-chat-route.mjs';

const root='https://gracz-contact-api.onrender.com';
const get=(serve,path)=>{
  const req={method:'GET'};
  const res={status:0,headers:{},raw:'',
    writeHead(status,headers){this.status=status;this.headers=headers;},
    end(body){this.raw=String(body??'');}
  };
  assert.equal(serve(req,res,new URL(path,root)),true);
  assert.equal(res.status,200);
  return res;
};
const request=(data={},origin=root)=>({
  method:'POST',headers:{host:'gracz-contact-api.onrender.com',origin,'content-type':'application/json'},
  socket:{remoteAddress:'198.51.100.70'},
  async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}
});
const response=()=>({status:0,payload:null,
  writeHead(status){this.status=status;},
  end(raw){this.payload=JSON.parse(raw);}
});

test('Gomoku, Warcaby and Szachy share private GRACZ AI links without replacing player chat',()=>{
  for(const [serve,slug] of [[serveGomokuConsole,'gomoku'],[serveCheckersConsole,'warcaby'],[serveChessConsole,'szachy']]){
    const page=get(serve,'/konto/'+slug+'/').raw;
    assert.match(page,/href="\/konto\/gracz-ai-chat\.css"/);
    assert.match(page,/src="\/konto\/gracz-ai-chat\.js"/);
    for(const id of ['chat-form','chat-input','chat-messages','chat-panel','chat-tab']){
      assert.ok(page.includes('id="'+id+'"'),slug+' preserves original chat '+id);
    }
    assert.match(page,/role="tablist"/);
  }
  assert.match(get(serveGomokuConsole,'/konto/gracz-ai-chat.js').headers['Content-Type'],/javascript/);
  assert.match(get(serveGomokuConsole,'/konto/gracz-ai-chat.css').headers['Content-Type'],/css/);
  assert.match(graczAiChatJs,/gracz-ai-shell/);
  assert.match(graczAiChatJs,/playerMessages\.hidden = active/);
  assert.match(graczAiChatJs,/playerComposer\.hidden = active/);
  assert.match(graczAiChatJs,/textContent = text/);
  assert.doesNotMatch(graczAiChatJs,/match\/chat|localStorage|sessionStorage/);
  assert.match(graczAiChatCss,/gracz-ai-toggle/);
});

test('All three paths use existing server-only Groq provider with isolated conversation context',async()=>{
  for(const [slug,name] of [['gomoku','Gomoku'],['warcaby','Warcaby'],['szachy','Szachy']]){
    const calls=[];
    const handle=createGomokuAiChatRoute({apiKey:'fake-key',fetchImpl:async (url,options)=>{
      calls.push({url,options});
      return {ok:true,json:async()=>({choices:[{message:{content:'Witaj w '+name+'!'}}]})};
    }});
    const req=request({message:'Porozmawiajmy o zasadach gry.'});
    const res=response();
    assert.equal(await handle(req,res,new URL('/konto/'+slug+'/ai-chat',root)),true);
    assert.equal(res.status,200);
    assert.equal(res.payload.answer,'Witaj w '+name+'!');
    assert.equal(calls.length,1);
    const payload=JSON.parse(calls[0].options.body);
    assert.match(payload.messages[0].content,new RegExp(name));
    assert.equal(calls[0].options.headers.Authorization,'Bearer fake-key');
    assert.doesNotMatch(JSON.stringify(res.payload),/fake-key/);
    if(slug!=='gomoku')assert.match(payload.messages[1].content,/Brak zweryfikowanych danych/);
  }
});

test('AI rejects cross-origin requests for each game without sending to provider',async()=>{
  let count=0;
  const handle=createGomokuAiChatRoute({apiKey:'key',fetchImpl:async()=>{count++;throw Error('must not call');}});
  for(const slug of ['gomoku','warcaby','szachy']){
    const res=response();
    await handle(request({message:'Cześć'},'https://attacker.invalid'),res,new URL('/konto/'+slug+'/ai-chat',root));
    assert.equal(res.status,403);
    assert.equal(res.payload.error.code,'ORIGIN_NOT_ALLOWED');
  }
  assert.equal(count,0);
});
