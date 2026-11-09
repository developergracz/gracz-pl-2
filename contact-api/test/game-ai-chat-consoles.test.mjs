import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
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
  assert.doesNotThrow(()=>new Function(graczAiChatJs),'shared browser script must parse');
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

test('AI send button and Enter each send exactly once in all three game consoles',async()=>{
  for(const slug of ['gomoku','warcaby','szachy']){
    const calls=[];
    const makeElement=()=>({
      children:[],listeners:new Map(),attributes:{},hidden:false,disabled:false,
      textContent:'',value:'',scrollTop:0,scrollHeight:0,
      append(...nodes){this.children.push(...nodes)},
      setAttribute(name,value){this.attributes[name]=String(value)},
      addEventListener(name,handler){this.listeners.set(name,handler)},
      dispatch(name,event={}){return this.listeners.get(name)?.({
        preventDefault(){},stopPropagation(){},...event
      })},
      focus(){}
    });
    const panel=makeElement(),header=makeElement(),messages=makeElement(),composer=makeElement(),tab=makeElement();
    tab.click=()=>{};
    const document={
      getElementById(id){return {'chat-panel':panel,'chat-messages':messages,'chat-tab':tab}[id]||null},
      querySelector(q){return {'#match-panel .dock-header':header,'#match-panel .mini-chat':composer}[q]||null},
      createElement(){return makeElement()}
    };
    const fetch=async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});
      return {ok:true,json:async()=>({ok:true,answer:'Odpowiedź GRACZ AI'})};
    };
    runInNewContext(graczAiChatJs,{
      document,location:{pathname:'/konto/'+slug+'/'},fetch,
      AbortController,setTimeout,clearTimeout
    });
    const toggle=header.children[0];
    assert.ok(toggle,slug+': AI toggle must initialize');
    toggle.dispatch('click');
    assert.equal(panel.children.length,1);
    assert.equal(composer.hidden,true);
    const section=panel.children[0],log=section.children[1],form=section.children[2];
    const input=form.children[0],button=form.children[1];
    assert.equal(section.hidden,false);
    input.value='Pytanie przez przycisk';
    button.dispatch('click');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,1,slug+': button must submit exactly once');
    assert.equal(calls[0].url,'/konto/'+slug+'/ai-chat');
    assert.equal(calls[0].body.message,'Pytanie przez przycisk');
    assert.ok(log.children.some(row=>row.children[1]?.textContent==='Odpowiedź GRACZ AI'));
    input.value='Pytanie przez Enter';
    let keyPrevented=false;
    input.dispatch('keydown',{key:'Enter',preventDefault(){keyPrevented=true}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(keyPrevented,true);
    assert.equal(calls.length,2,slug+': Enter must submit exactly once');
    assert.equal(calls[1].body.message,'Pytanie przez Enter');
    assert.equal(input.value,'');
    assert.equal(button.disabled,false);
    toggle.dispatch('click');
    assert.equal(composer.hidden,false);
    assert.equal(section.hidden,true);
  }
});

test('Computer-mode chat in Warcaby and Chess calls GRACZ AI; player chat remains isolated',()=>{
  const warcaby=get(serveCheckersConsole,'/konto/warcaby/app.js').raw;
  const szachy=get(serveChessConsole,'/konto/szachy/app.js').raw;
  for(const [name,src] of [['Warcaby',warcaby],['Szachy',szachy]]){
    assert.doesNotThrow(()=>parse(src,{ecmaVersion:'latest',sourceType:'module'}),name+' console JavaScript must parse');
    assert.match(src,/['"]chat-form['"]/,'existing native form remains wired');
    assert.match(src,/match\/chat/,'online player chat must remain available');
  }
  assert.doesNotMatch(warcaby,/trainingNotes\.push\(/,'undefined trainingNotes must never block sending');
  assert.match(warcaby,/if\(mode==='training'\)\{await sendTrainingAi\(value\);return;\}/);
  assert.match(warcaby,/fetch\('\/konto\/warcaby\/ai-chat'/);
  assert.match(warcaby,/GRACZ AI przygotowuje odpowiedź/);
  assert.match(szachy,/if\(mode==='local'\)\{\s*if\(!computerEnabled\)/);
  assert.match(szachy,/fetch\('\/konto\/szachy\/ai-chat'/);
  assert.match(szachy,/sender_nick:'GRACZ AI'/);
  assert.match(szachy,/if\(!online\?\.playable/,'online mode still checks match authorization');
});
