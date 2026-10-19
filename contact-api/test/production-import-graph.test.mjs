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
    const source=new Map([[root.href,"import './bridge.mjs'"],[new URL('./bridge.mjs',root).href,edge]]);
    await assert.rejects(auditProductionImports(root,{read:async url=>source.get(url.href),canonical:async url=>url}));
  });
}
