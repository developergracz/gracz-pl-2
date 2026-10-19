// Real business entrypoint, no module hook. All optional provider traffic is trapped locally.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';
export async function startHeldHttpServer(t,databaseUrl){
  assertDisposableDatabaseUrl(databaseUrl);
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  let providerCalls=0,logs='';
  const provider=createServer((req,res)=>{providerCalls++;res.writeHead(500);res.end();});
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{
    PATH:process.env.PATH,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:databaseUrl,
    EMAIL_FROM:'sender@example.test',CONTACT_TO:'owner@example.test',
    CONTACT_DATA_ENCRYPTION_SECRET:'test-'+'c'.repeat(40),CONTACT_REPLY_SECRET:'test-'+'r'.repeat(40),
    NEWSLETTER_SECRET:'test-'+'n'.repeat(40),NEWSLETTER_CONSENT_HASH_SECRET:'test-'+'h'.repeat(40),
    NEWSLETTER_INTAKE_PAUSED:'false',NEWSLETTER_RESEND_API_KEY:'test-key',RESEND_API_KEY:'test-key',
    RESEND_API_BASE:'http://127.0.0.1:'+provider.address().port,RESEND_ENDPOINT:'http://127.0.0.1:'+provider.address().port+'/emails',
  },stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
  let stopped=false;
  async function stop(){
    if(stopped)return;stopped=true;
    if(child.exitCode===null&&child.signalCode===null){
      const exit=once(child,'exit'),timer=setTimeout(()=>child.kill('SIGKILL'),3000);
      child.kill('SIGTERM');try{await exit;}finally{clearTimeout(timer);}
    }
    await new Promise(resolve=>provider.close(resolve));
  }
  t.after(stop);
  const base='http://127.0.0.1:'+port;
  for(let i=0;i<200;i++){
    if(child.exitCode!==null)throw new Error('Synthetic held server exited');
    try{if((await fetch(base+'/health')).ok)return {base,stop,get providerCalls(){return providerCalls;},get logs(){return logs;}};}catch{}
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error('Synthetic held server startup deadline');
}
