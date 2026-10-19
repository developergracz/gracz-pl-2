import test from 'node:test';
import assert from 'node:assert/strict';
import {auditProductionImports} from '../test-support/production-import-graph.mjs';

test('R2 production server transitive imports exclude legacy and test code',async()=>{
  const visited=await auditProductionImports(new URL('../server.mjs',import.meta.url));
  assert.ok(visited.some(path=>path.endsWith('/security/newsletter-recovery-hold.mjs')));
  assert.ok(visited.some(path=>path.endsWith('/operations/newsletter-f03-readonly-diagnostics.mjs')));
});
for(const edge of ["import './newsletter.mjs'", "export * from './test-support/fixture.mjs'", "void import('./newsletter-status.mjs')", "import './tests/fixture.mjs'", "export * from './fixture.test.mjs'", "import('./' + name)"]){
  test('R2 graph rejects indirect forbidden/computed edge: '+edge,async()=>{
    const root=new URL('file:///synthetic/server.mjs');
    const source=new Map([[root.href,"import './lifecycle.mjs'"],[new URL('./lifecycle.mjs',root).href,edge]]);
    await assert.rejects(auditProductionImports(root,{read:async url=>source.get(url.href),canonical:async url=>url}));
  });
}

for(const prefix of ['file:///synthetic/','file:///C:/synthetic/']) {
  for(const source of ["import './unexpected.mjs'", "export * from './unexpected.mjs'", "void import('./unexpected.mjs')", "import 'node:child_process'", "import './security/newsletter-purpose-keys.mjs'"]) {
    test('R3 manifest rejects unknown edge '+prefix+' '+source,async()=>{
      const entry=new URL('server.mjs',prefix);
      await assert.rejects(auditProductionImports(entry,{canonical:async u=>u,read:async u=>u.href===entry.href?source:''}));
    });
  }
}

test('R3 symlinked checkout root is accepted, module symlink outside root rejected',async t=>{
  const {mkdtemp,mkdir,writeFile,symlink,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {pathToFileURL}=await import('node:url');
  const dir=await mkdtemp(join(tmpdir(),'gracz-graph-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await mkdir(join(dir,'real'));
  await writeFile(join(dir,'real/server.mjs'),"import './lifecycle.mjs'");
  await writeFile(join(dir,'real/lifecycle.mjs'),'');
  await symlink(join(dir,'real'),join(dir,'alias'),'junction');
  assert.equal((await auditProductionImports(pathToFileURL(join(dir,'alias/server.mjs')))).length,2);
  await rm(join(dir,'real/lifecycle.mjs'));
  await writeFile(join(dir,'outside.mjs'),'');
  await symlink(join(dir,'outside.mjs'),join(dir,'real/lifecycle.mjs'));
  await assert.rejects(auditProductionImports(pathToFileURL(join(dir,'alias/server.mjs'))));
});

for(const edge of ["import './security\\\\newsletter-recovery-hold.mjs'", "import './%6cifecycle.mjs'", "import './lifecycle.mjs?x'", "import './lifecycle.mjs#x'", "import 'https://example.test/module.mjs'"]) {
  test('R3 ambiguous specifier is rejected: '+edge,async()=>{
    const entry=new URL('file:///synthetic/server.mjs');
    await assert.rejects(auditProductionImports(entry,{canonical:async u=>u,read:async u=>u.href===entry.href?edge:''}));
  });
}
