import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {discoverModules} from '../scripts/check-modules.mjs';
test('R3 syntax discovery covers JS variants, excludes dependencies, refuses symlinks',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'gracz-syntax-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  for(const name of ['a.js','b.cjs','c.mjs','ignored.txt'])await writeFile(join(dir,name),'');
  await mkdir(join(dir,'node_modules'));await writeFile(join(dir,'node_modules/ignored.js'),'');
  assert.equal(discoverModules(dir).length,3);
  await symlink(join(dir,'a.js'),join(dir,'alias.js'));
  assert.throws(()=>discoverModules(dir),/symlink/i);
});
