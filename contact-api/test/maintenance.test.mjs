import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer,connect} from 'node:net';
import {request} from 'node:http';
import {mkdtemp,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const artifact=new URL('../maintenance/',import.meta.url);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const unavailable={ok:false,error:'maintenance',message:'API jest tymczasowo niedostępne. Spróbuj ponownie później.'};
function http(base,path,method='GET',body='',headers={}) {
  return new Promise((resolve,reject)=>{
    const req=request(base+path,{method,headers:{'content-length':Buffer.byteLength(body),...headers},timeout:3000},res=>{
      let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('request deadline')));req.end(body);
  });
}
async function fixture(t,extra={}) {
  const dir=await mkdtemp(join(tmpdir(),'gracz-maintenance-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  // Distribution consists only of these three files, no production code/dependencies.
  for(const name of ['server.mjs','build.sh','start.sh'])await copyFile(new URL(name,artifact),join(dir,name));
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const child=spawn('sh',[join(dir,'start.sh')],{env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:String(port),...extra},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
  const exited=once(child,'exit');t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}});
  const base='http://127.0.0.1:'+port;
  for(let i=0;i<200;i++){
    assert.equal(child.exitCode,null,'standalone startup: '+logs);
    try{if((await http(base,'/health')).status===200)return {child,exited,base,port,dir,logs:()=>logs};}catch{}
    await delay(10);
  }
  throw new Error('startup deadline');
}

test('F02 artifact exists independently of production server',async()=>{
  const source=await readFile(new URL('server.mjs',artifact),'utf8').catch(()=> '');
  assert.ok(source.includes('node:http'),'missing standalone HTTP artifact');
  const imports=[...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  assert.deepEqual(imports,['node:http']);
  assert.ok(!/\b(?:require|import)\s*\(|\b(?:eval|setInterval)\s*\(/.test(source));
});

test('F02 all valid business routes/methods fail closed without payload processing',async t=>{
  const f=await fixture(t);
  for(const path of ['/contact','/reply','/reply-context','/newsletter/subscribe','/newsletter/confirm','/newsletter/unsubscribe','/newsletter/status-request','/newsletter/status-check','/newsletter/ready','/unknown','/','/health/','/%68ealth','//health']){
    for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){
      const r=await http(f.base,path+'?token=private-token',method,'not JSON',{origin:'https://gracz.pl','content-type':'application/json'});
      assert.equal(r.status,503,method+' '+path);assert.equal(r.headers['cache-control'],'no-store');
      assert.equal(r.headers['x-gracz-api-mode'],'maintenance');assert.equal(r.headers['access-control-allow-origin'],'https://gracz.pl');
      assert.equal(r.text,method==='HEAD'?'':JSON.stringify(unavailable));
    }
  }
  for(const method of ['POST','PUT','OPTIONS','HEAD'])assert.equal((await http(f.base,'/health',method)).status,503);
  const h=await http(f.base,'/health?probe=1');assert.equal(h.status,200);
  assert.deepEqual(JSON.parse(h.text),{ok:true,mode:'maintenance',businessReady:false,artifact:'contact-api-maintenance-r1'});
  assert.equal((await http(f.base,'/contact','POST','', {origin:'https://untrusted.example'})).headers['access-control-allow-origin'],undefined);
  assert.ok(!f.logs().includes('private-token'));
});

test('F02 inherited provider/DB configuration cannot cause outbound connections',async t=>{
  let connections=0;const trap=createServer(socket=>{connections++;socket.destroy();});
  trap.listen(0,'127.0.0.1');await once(trap,'listening');t.after(()=>new Promise(r=>trap.close(r)));
  const port=trap.address().port;
  const f=await fixture(t,{DATABASE_URL:'postgres://secret:secret@127.0.0.1:'+port+'/fixture',RESEND_API_KEY:'synthetic-secret',NEWSLETTER_RESEND_API_KEY:'synthetic-secret',RESEND_API_BASE:'http://127.0.0.1:'+port,RESEND_ENDPOINT:'http://127.0.0.1:'+port+'/emails',NEWSLETTER_INTAKE_PAUSED:'false',NODE_OPTIONS:'--import=/absent-production-preload.mjs'});
  await Promise.all(['/contact','/reply','/reply-context','/newsletter/subscribe','/newsletter/confirm','/newsletter/unsubscribe','/newsletter/status-request','/newsletter/status-check','/newsletter/ready','/unknown'].map(path=>http(f.base,path,'POST',JSON.stringify({email:'private@example.test',newsletter:true}))));
  await delay(100);
  assert.equal(connections,0);assert.ok(!/private@example|synthetic-secret|postgres:\/\//.test(f.logs()));
  const build=spawn('sh',[join(f.dir,'build.sh')],{env:{PATH:process.env.PATH,NODE_OPTIONS:'--import=/absent-production-preload.mjs',DATABASE_URL:'postgres://secret@127.0.0.1:'+port+'/fixture'},stdio:'pipe'});
  const [code]=await once(build,'exit');assert.equal(code,0);assert.equal(connections,0);
});

for(const signal of ['SIGTERM','SIGINT'])test('F02 '+signal+' terminates only the inert process',async t=>{
  const f=await fixture(t);f.child.kill(signal);assert.deepEqual(await f.exited,[0,null]);
});

test('F02 Expect, upgrade and CONNECT never open another handler',async t=>{
  const f=await fixture(t);
  for(const raw of [
    'POST /contact HTTP/1.1\r\nHost: localhost\r\nExpect: 100-continue\r\nContent-Length: 100\r\n\r\n',
    'POST /contact HTTP/1.1\r\nHost: localhost\r\nExpect: unusual\r\nContent-Length: 100\r\n\r\n',
    'GET /newsletter/subscribe HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
    'CONNECT provider.example:443 HTTP/1.1\r\nHost: provider.example\r\n\r\n',
  ]){
    const result=await new Promise((resolve,reject)=>{
      const socket=connect(f.port,'127.0.0.1',()=>socket.write(raw));let data='';socket.setTimeout(3000,()=>socket.destroy(new Error('raw deadline')));
      socket.on('data',c=>data+=c);socket.on('error',reject);socket.on('end',()=>resolve(data));
    });
    assert.match(result,/^HTTP\/1\.1 503 /);assert.ok(!/100 Continue|101 Switching/.test(result));
  }
});

test('F02 invalid port fails startup without logging supplied configuration',async()=>{
  const child=spawn('sh',[new URL('start.sh',artifact).pathname],{env:{PATH:process.env.PATH,PORT:'secret-invalid-port'},stdio:['ignore','ignore','pipe']});let logs='';child.stderr.on('data',c=>logs+=c);
  assert.equal((await once(child,'exit'))[0],1);assert.ok(!logs.includes('secret-invalid-port'));
});

test('F02 refused upgrade cannot keep maintenance alive during shutdown',async t=>{
  const f=await fixture(t);
  const socket=connect({port:f.port,host:'127.0.0.1',allowHalfOpen:true});t.after(()=>socket.destroy());
  socket.on('error',()=>{});
  await once(socket,'connect');
  socket.write('GET /contact HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  await once(socket,'data'); // Peer deliberately never closes its half of the socket.
  f.child.kill('SIGTERM');
  let timer;
  try {
    const result=await Promise.race([f.exited,new Promise(resolve=>{timer=setTimeout(()=>resolve('deadline'),1000);})]);
    assert.deepEqual(result,[0,null]);
  } finally {clearTimeout(timer);}
});

test('F02 malformed pipeline never appends another response after Connection close',async t=>{
  const f=await fixture(t);
  const result=await new Promise(resolve=>{
    const socket=connect(f.port,'127.0.0.1',()=>socket.write('GET /health HTTP/1.1\r\nHost: localhost\r\n\r\nBOGUS\r\n\r\n'));
    let data='';socket.on('data',c=>data+=c);socket.on('error',()=>{});socket.on('close',()=>resolve(data));socket.setTimeout(2000,()=>socket.destroy());
  });
  assert.ok((result.match(/HTTP\/1\.1/g)||[]).length<=1,'do not append a second response on a closing connection');
});
