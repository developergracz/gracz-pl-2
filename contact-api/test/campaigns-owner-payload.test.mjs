import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../admin-r1/owner-router.mjs',import.meta.url),'utf8');
test('OWNER keeps small limits for auth and separate bounded draft save input',()=>{
  assert.match(src,/const maxBody=2048;/);
  assert.match(src,/async function input\(req,limit=maxBody\)/);
  assert.match(src,/if\(Buffer\.byteLength\(body\)>limit\)throw Error\('too_large'\)/);
  assert.match(src,/input\(req,path\.endsWith\('\/save'\)\?65536:maxBody\)/);
  assert.match(src,/if\(!campaignDraftsEnabled\|\|!campaignDraftStore\)return reject\(res,503\)/);
});
