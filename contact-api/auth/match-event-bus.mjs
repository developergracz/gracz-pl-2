import {randomUUID} from 'node:crypto';

// Invalidation only. PostgreSQL commits and authorization never depend on Redis.
// A bounded periodic DB reconciliation in the hub repairs even a lost final event.
export function createMatchEventBus({url,onChange,onReconnect,logger=console}){
 const source=randomUUID(),channel='gracz:match:invalidate:v1';
 const pending=new Set();
 let publisher,subscriber,closed=false,running=0,lastWarning=0;
 function warn(){
  if(Date.now()-lastWarning<30000)return;lastWarning=Date.now();
  logger.warn?.('MATCH_TRANSPORT_UNAVAILABLE');
 }
 function pump(){
  while(!closed&&publisher?.isReady&&running<8&&pending.size){
   const id=pending.values().next().value;pending.delete(id);running++;
   publisher.publish(channel,JSON.stringify({source,id})).catch(warn).finally(()=>{running--;pump();});
  }
 }
 const ready=(async()=>{
  const {createClient}=await import('@redis/client');
  if(closed)return;
  publisher=createClient({url,disableOfflineQueue:true,commandsQueueMaxLength:64,
   socket:{connectTimeout:3000,reconnectStrategy:attempt=>Math.min(5000,100*2**Math.min(attempt,5))+Math.floor(Math.random()*250)}});
  subscriber=publisher.duplicate();
  for(const client of [publisher,subscriber])client.on('error',warn);
  publisher.on('ready',pump);
  subscriber.on('ready',()=>onReconnect());
  await Promise.all([publisher.connect(),subscriber.connect()]);
  if(closed)return;
  await subscriber.subscribe(channel,raw=>{
   if(raw.length>256)return;
   try{
    const event=JSON.parse(raw);
    if(event.source!==source&&typeof event.id==='string'&&/^[0-9a-f-]{36}$/i.test(event.id))onChange(event.id);
   }catch{}
  });
 })().catch(warn);
 return {ready,notify(id){
  // Do not replay an outage backlog; a fresh PostgreSQL snapshot supersedes it.
  if(closed||!publisher?.isReady)return;
  if(pending.size<16384)pending.add(id);pump();
 },close(){
  closed=true;pending.clear();
  for(const client of [publisher,subscriber])if(client?.isOpen)client.destroy();
 }};
}
