// A green required gate means tests actually ran, with no skips/todos/cancellations.
import {run} from 'node:test';
import {spec} from 'node:test/reporters';
import {readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function runStrictTests(files){
  if(!files.length)throw new Error('Empty required test suite');
  const stream=run({files,execArgv:[],concurrency:1,timeout:180000});
  let final,invalid=false;
  const executed=new Set();
  stream.on('data',event=>{
    if(event.type==='test:pass'){
      if(event.data.skip||event.data.todo)invalid=true;
    }
    if(event.type==='test:fail')invalid=true;
    if(event.type==='test:summary'){
      if(!event.data.file)final=event.data;
      else if(event.data.counts.tests>0)executed.add(resolve(event.data.file));
    }
  });
  for await(const chunk of stream.compose(spec))process.stdout.write(chunk);
  const c=final?.counts;
  return Boolean(c&&files.every(file=>executed.has(resolve(file)))&&c.tests>0&&c.passed>0&&!c.failed&&!c.cancelled&&!c.skipped&&!c.todo&&!invalid);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2];
  if(!['unit','persistence'].includes(mode))throw new Error('Expected unit or persistence');
  if(mode==='persistence'){
    const {assertDisposableDatabaseUrl}=await import('../integration/test-database-guard.mjs');
    assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  }
  const dir=fileURLToPath(new URL(mode==='unit'?'../test/':'../integration/',import.meta.url));
  const files=readdirSync(dir).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>join(dir,name));
  if(!await runStrictTests(files)){console.error('Required suite must pass with zero skips, todos and cancellations.');process.exitCode=1;}
}
