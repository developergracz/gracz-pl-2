import test from 'node:test';
import assert from 'node:assert/strict';
import {createGomokuAiChatRoute} from '../routes/gomoku-ai-chat-route.mjs';

const endpoint=new URL('https://gracz-contact-api.onrender.com/konto/gomoku/ai-chat');
function request(data={},override={}){
 const headers={
  host:'gracz-contact-api.onrender.com',
  origin:'https://gracz-contact-api.onrender.com',
  'content-type':'application/json',...override
 };
 return {
  method:'POST',headers,socket:{remoteAddress:'198.51.100.25'},
  async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}
 };
}
function response(){
 return {status:0,payload:null,headers:{},
  writeHead(status,headers){this.status=status;this.headers=headers;},
  end(raw){this.payload=JSON.parse(raw);}
 };
}
function payload(){
 const board=Array(225).fill('0');
 for(const col of [4,5,6,7])board[7*15+col]='1';
 board[7*15+3]='2';
 return {message:'Dlaczego zagrałeś w H6? A jaka jest stolica Polski?',
  history:[{role:'user',content:'Cześć'},{role:'assistant',content:'Witaj!'}],
  game:{board:board.join(''),turn:2,winner:0,history:[{player:1,to:7*15+7}]}
 };
}
test('Gomoku AI endpoint fails closed without a Groq key and never sends data',async()=>{
 let fetched=false;
 const handler=createGomokuAiChatRoute({apiKey:'',fetchImpl:async()=>{fetched=true;}});
 const res=response();
 assert.equal(await handler(request(payload()),res,endpoint),true);
 assert.equal(res.status,503);
 assert.equal(res.payload.error.code,'AI_NOT_CONFIGURED');
 assert.equal(fetched,false);
 assert.equal(res.headers['Cache-Control'],'no-store');
});
test('Gomoku AI endpoint does not act on unrelated paths or cross-origin requests',async()=>{
 const handler=createGomokuAiChatRoute({apiKey:'test-key',fetchImpl:async()=>{throw Error('must not fetch');}});
 assert.equal(await handler(request(payload()),response(),new URL('https://gracz-contact-api.onrender.com/other')),false);
 const res=response();
 await handler(request(payload(),{origin:'https://attacker.example'}),res,endpoint);
 assert.equal(res.status,403);
 assert.equal(res.payload.error.code,'ORIGIN_NOT_ALLOWED');
});
test('Gomoku AI safely sends a small Polish prompt, the board context and limited conversation history',async()=>{
 let calls=0;
 const handler=createGomokuAiChatRoute({apiKey:'secret-provider-key',fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer secret-provider-key');
  const json=JSON.parse(options.body);
  assert.equal(json.model,'openai/gpt-oss-120b');
  assert.equal(json.messages.at(-1).content,payload().message);
  assert.equal(json.messages.at(-2).content,'Witaj!');
  assert.match(json.messages[1].content,/natychmiastoweWygraneCzarnych/);
  assert.match(json.messages[1].content,/"I8"/);
  assert.doesNotMatch(json.messages[0].content,/secret-provider-key/);
  return {ok:true,json:async()=>({choices:[{message:{content:'Warszawa. Na planszy warto obronić I8.'}}]})};
 }});
 const res=response();
 await handler(request(payload()),res,endpoint);
 assert.equal(calls,1);
 assert.equal(res.status,200);
 assert.equal(res.payload.answer,'Warszawa. Na planszy warto obronić I8.');
 assert.doesNotMatch(JSON.stringify(res.payload),/secret-provider-key/);
});
test('Gomoku AI rate budget restricts repeated anonymous requests',async()=>{
 const handler=createGomokuAiChatRoute({apiKey:'provider-key',now:()=>1000,
  fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})})});
 for(let i=0;i<3;i++){
  const res=response();await handler(request(payload()),res,endpoint);assert.equal(res.status,200);
 }
 const fourth=response();
 await handler(request(payload()),fourth,endpoint);
 assert.equal(fourth.status,429);
 assert.equal(fourth.payload.error.code,'AI_LIMIT');
});
test('Gomoku AI never displays fabricated provider responses on upstream failure',async()=>{
 const handler=createGomokuAiChatRoute({apiKey:'provider-key',
  fetchImpl:async()=>({ok:false,status:429})});
 const res=response();await handler(request(payload()),res,endpoint);
 assert.equal(res.status,429);
 assert.equal(res.payload.answer,undefined);
 assert.equal(res.payload.error.code,'AI_PROVIDER_LIMIT');
});
test('Gomoku AI request validation rejects malformed board-free spam payloads',async()=>{
 const handler=createGomokuAiChatRoute({apiKey:'provider-key',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'Ok'}}]})})});
 const res=response();await handler(request({message:''}),res,endpoint);
 assert.equal(res.status,400);
 assert.equal(res.payload.error.code,'INVALID_MESSAGE');
});
