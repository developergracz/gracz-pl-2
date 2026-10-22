import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareCampaignDraft} from '../campaigns/prepare.mjs';
const read=relative=>readFile(new URL(relative,import.meta.url),'utf8');
test('ClamAV and converter may run manually only with read-only permissions',async()=>{
  const workflow=await read('../../.github/workflows/gracz-attachment-lab.yml');
  assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*\n/m);
  assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow,/secrets\./);
});
test('real newsletter attachments remain blocked in both UI and backend',async()=>{
  const js=await read('../admin-r1/ui/owner-dashboard.js');
  const html=await read('../admin-r1/ui/index.html');
  const route=await read('../admin-r1/owner-router.mjs');
  assert.match(js,/if\(targetedAttachment\.files\?\.length\)\{/);
  assert.match(html,/Skan antywirusowy: niedostępny/);
  assert.match(route,/\['subject','body','audience','handles'\]\.every/);
  assert.throws(()=>prepareCampaignDraft({
    subject:'Synthetic test',body:'Long enough synthetic campaign text',
    audience:'confirmed_active_new_only',attachments:[{name:'test.pdf'}]
  }),{code:'invalid_campaign'});
});
test('temporary runner guard and cleanup are required',async()=>{
  for(const file of ['clamav-smoke.sh','converter-smoke.sh']){
    const code=await read('../attachment-lab/'+file);
    assert.match(code,/GRACZ_ATTACHMENT_LAB_ONLY/);
    assert.match(code,/GITHUB_ACTIONS/);
    assert.match(code,/mktemp -d/);
    assert.match(code,/trap 'rm -rf -- "\$work"' EXIT/);
    assert.doesNotMatch(code,/gracz-contact-api\.onrender\.com/);
  }
});
