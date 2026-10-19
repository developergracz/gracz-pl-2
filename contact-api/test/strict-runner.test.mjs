import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('R3 required gate rejects skipped/todo/empty/failed suites, accepts executed tests',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'gracz-runner-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const runner=new URL('../scripts/run-tests.mjs',import.meta.url).href;
  for(const [body,ok] of [["test('pass',()=>{})",true],["test.skip('skip',()=>{})",false],["test.todo('todo')",false],["test('fail',()=>{throw Error('fixture')})",false],['',false]]){
    const file=join(dir,'fixture.mjs');await writeFile(file,"import test from 'node:test';"+body);
    const launcher=join(dir,'launcher.mjs');
    await writeFile(launcher,`import {runStrictTests} from ${JSON.stringify(runner)};process.exitCode=await runStrictTests([${JSON.stringify(file)}])?0:1;`);
    const result=spawnSync(process.execPath,[launcher],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH}});
    assert.equal(result.status,ok?0:1,'required gate fixture disposition: '+body+' '+result.stdout+' '+result.stderr);
  }
});
