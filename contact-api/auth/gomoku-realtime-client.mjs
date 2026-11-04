// Self-contained so the console can embed the same tested transport without a bundle.
export function createGomokuRealtimeClient({WebSocketImpl,url,getMatchId,getVersion,canConnect,onMessage,onFallback,
 schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),random=Math.random}){
 let socket=null,room=null,ready=false,seq=0,retry=null,watchdog=null,attempt=0;
 function stop(){
  cancel(retry);cancel(watchdog);retry=watchdog=null;ready=false;
  const old=socket;socket=null;old?.close();
 }
 function failed(current){
  if(current!==socket)return;
  stop();
  if(!canConnect()||!getMatchId())return;
  onFallback();
  const delay=Math.min(30000,1000*2**Math.min(attempt++,5)*(1+random()));
  retry=schedule(()=>{retry=null;update();},delay);
 }
 function arm(current,ms){cancel(watchdog);watchdog=schedule(()=>failed(current),ms);}
 function update(){
  const id=getMatchId();
  if(!WebSocketImpl||!canConnect()||!id){stop();room=null;return;}
  if(room===id&&(socket||retry))return;
  stop();room=id;seq=0;
  let current;
  try{current=new WebSocketImpl(url);socket=current;}catch{
   // Use the same bounded retry path for a synchronous connection failure.
   socket=current={close(){}};failed(current);return;
  }
  arm(current,8000);
  current.onopen=()=>{if(current===socket)current.send(JSON.stringify({type:'subscribe',matchId:id,version:getVersion()??-1}));};
  current.onerror=()=>failed(current);
  current.onclose=()=>failed(current);
  current.onmessage=event=>{
   if(current!==socket)return;
   try{
    const m=JSON.parse(event.data);
    if(m.matchId!==id||!Number.isSafeInteger(m.seq))throw Error('invalid envelope');
    if(m.type==='heartbeat'){
     if(!ready||m.seq!==seq)throw Error('missed update');
    }else{
     if(ready&&m.seq<=seq)return;
     if(!ready?(m.type!=='snapshot'||m.seq!==1):(!['match','chat'].includes(m.type)||m.seq!==seq+1))throw Error('sequence gap');
     if(onMessage(m)!==true)throw Error('state rejected');
     seq=m.seq;ready=true;attempt=0;
    }
    arm(current,60000);
   }catch{failed(current);}
  };
 }
 return {update,isReady:()=>ready};
}
