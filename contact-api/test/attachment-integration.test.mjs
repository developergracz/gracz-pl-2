import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getAttachmentCapabilities,scanAttachment,convertAttachment,sendAttachment} from '../attachment-lab/integration.mjs';

test('ClamAV and converter are integrated by contract but never enabled',()=>{
  const capabilities=getAttachmentCapabilities();
  assert.equal(capabilities.mode,'prepared_disabled');
  for(const key of ['uploadsEnabled','scanningEnabled','conversionEnabled','sendingEnabled'])
    assert.equal(capabilities[key],false);
  assert.deepEqual(capabilities.scanner,{engine:'clamav',interfaceReady:true,enabled:false});
  assert.equal(capabilities.converter.interfaceReady,true);
  assert.equal(capabilities.converter.enabled,false);
  assert.deepEqual(capabilities.converter.engines,['imagemagick','pandoc','ghostscript']);
  assert.equal(Object.isFrozen(capabilities),true);
});

test('integration functions always fail closed even when bytes are supplied',async()=>{
  const payload={name:'test.pdf',contents:Buffer.from('synthetic private data')};
  for(const op of [scanAttachment,convertAttachment,sendAttachment])
    await assert.rejects(op(payload),{code:'ATTACHMENTS_DISABLED',status:503});
});

test('authenticated UI reads disabled contract; owner server does not accept uploads',async()=>{
  const router=await readFile(new URL('../admin-r1/owner-router.mjs',import.meta.url),'utf8');
  const frontend=await readFile(new URL('../admin-r1/ui/owner-dashboard.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../admin-r1/ui/index.html',import.meta.url),'utf8');
  const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(router,/if\(req\.method==='GET'&&path===PREFIX\+'\/attachment-capabilities'\)/);
  assert.match(router,/getAttachmentCapabilities\(\)/);
  assert.match(frontend,/request\("\/owner\/newsletter\/attachment-capabilities"\)/);
  assert.match(frontend,/info\?\.uploadsEnabled===false/);
  assert.match(frontend,/if\(targetedAttachment\.files\?\.length\)\{/);
  for(const id of ['targeted-antivirus-state','targeted-converter-state','targeted-threat-state'])
    assert.ok(html.includes('id="'+id+'"'));
  assert.doesNotMatch(router,/method==='POST'&&path===PREFIX\+'\/attachment-(?:upload|scan|convert|send)'/);
  assert.match(router,/!\['subject','body','audience','handles'\]\.every/);
  assert.match(server,/url\.pathname\.startsWith\("\/owner\/newsletter"\)/);
});
