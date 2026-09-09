import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';

const dataset=JSON.parse(await readFile(resolve(process.env.WAVE_B_DATASET||'perf/k6/datasets/runtime.json'),'utf8'));
const kind=String(process.env.WAVE_B_SSE_KIND||'gomoku');
const target=Math.max(1,Math.min(10000,Number(process.env.WAVE_B_SSE_CONNECTIONS||100)));
const seconds=Math.max(5,Number(process.env.WAVE_B_SSE_SECONDS||30));
const connectRate=Math.max(1,Number(process.env.WAVE_B_SSE_CONNECT_RATE||100));
const runId=String(process.env.WAVE_B_RUN_ID||`sse-${kind}-${target}`);
const baseUrls=String(process.env.BASE_URLS||dataset.baseUrls?.join(',')||'http://127.0.0.1:3000').split(',').map(x=>x.trim()).filter(Boolean);
const deadline=Date.now()+seconds*1000;
const metrics={kind,target,seconds,connectRate,startedAt:new Date().toISOString(),attempts:0,successfulConnections:0,failedConnections:0,disconnects:0,reconnects:0,snapshots:0,maxActive:0,active:0,establishmentMs:[],reconnectMs:[],attemptsBySecond:{},retryValues:[]};
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function percentile(values,p){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]}
function route(index){
  const base=baseUrls[index%baseUrls.length];
  if(kind==='global-chat'){const u=dataset.users[index%dataset.users.length];return{url:`${base}/global-chat/events`,token:u.token,mode:'native'}}
  const key=kind==='thousand'?'thousandGames':'gomokuGames',games=dataset[key]||[];if(!games.length)throw new Error(`No ${key} in dataset`);
  const game=games[index%games.length],userId=game.players[index%game.players.length],u=dataset.users.find(x=>x.userId===userId);if(!u)throw new Error(`Missing user ${userId}`);
  return{url:kind==='thousand'?`${base}/thousand/games/${encodeURIComponent(game.gameId)}/events`:`${base}/gomoku/games/${encodeURIComponent(game.gameId)}/events`,token:u.token,mode:kind==='gomoku'?'gomoku':'native'};
}
async function consume(index){let reconnectAttempt=0,lastDisconnectAt=null,nativeRetry=1000,first=true;
  while(Date.now()<deadline){
    const spec=route(index),attemptStart=performance.now(),bucket=String(Math.floor((Date.now()-(deadline-seconds*1000))/1000));metrics.attempts++;metrics.attemptsBySecond[bucket]=(metrics.attemptsBySecond[bucket]||0)+1;if(!first)metrics.reconnects++;
    const controller=new AbortController(),remaining=Math.max(1,deadline-Date.now()),timer=setTimeout(()=>controller.abort(),remaining);timer.unref?.();let wasActive=false;
    try{
      const response=await fetch(spec.url,{headers:{authorization:`Bearer ${spec.token}`,accept:'text/event-stream','user-agent':'gracz-wave-b-sse/1.0'},signal:controller.signal});
      if(!response.ok||!response.body)throw new Error(`HTTP ${response.status}`);
      const established=performance.now()-attemptStart;metrics.establishmentMs.push(established);if(lastDisconnectAt!==null)metrics.reconnectMs.push(Date.now()-lastDisconnectAt);metrics.successfulConnections++;metrics.active++;wasActive=true;metrics.maxActive=Math.max(metrics.maxActive,metrics.active);reconnectAttempt=0;
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(Date.now()<deadline){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);for(const line of block.split('\n'))if(line.startsWith('retry:')){const v=Number(line.slice(6).trim());if(Number.isFinite(v)&&v>=0){nativeRetry=v;metrics.retryValues.push(v)}}if(block.includes('event: gomoku.snapshot')||block.includes('event: thousand.snapshot')||block.includes('event: connected'))metrics.snapshots++;}}
    }catch(error){if(Date.now()<deadline&&error?.name!=='AbortError')metrics.failedConnections++;}
    finally{clearTimeout(timer);if(wasActive){metrics.active--;metrics.disconnects++;lastDisconnectAt=Date.now();}}
    if(Date.now()>=deadline)break;
    let delay;if(spec.mode==='gomoku'){const base=500*(2**Math.min(reconnectAttempt,4)),jitter=Math.floor(Math.random()*500);delay=Math.min(10000,base+jitter);reconnectAttempt++;}else delay=nativeRetry;
    await sleep(Math.min(delay,Math.max(0,deadline-Date.now())));first=false;
  }
}
const workers=[];for(let i=0;i<target;i++){workers.push(consume(i));if((i+1)%connectRate===0)await sleep(1000)}await Promise.allSettled(workers);
metrics.finishedAt=new Date().toISOString();metrics.establishment={p50:percentile(metrics.establishmentMs,.50),p95:percentile(metrics.establishmentMs,.95),p99:percentile(metrics.establishmentMs,.99),max:metrics.establishmentMs.length?Math.max(...metrics.establishmentMs):null};metrics.reconnectLatency={p50:percentile(metrics.reconnectMs,.50),p95:percentile(metrics.reconnectMs,.95),p99:percentile(metrics.reconnectMs,.99),max:metrics.reconnectMs.length?Math.max(...metrics.reconnectMs):null};delete metrics.establishmentMs;delete metrics.reconnectMs;
const out=resolve(`perf/k6/reports/${runId}-sse.json`);await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
