import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboard=readFileSync(new URL('../admin-r1/ui/owner-dashboard.js',import.meta.url),'utf8');
const router=readFileSync(new URL('../admin-r1/owner-router.mjs',import.meta.url),'utf8');

test('targeted selection expiry is a deterministic pre-write error (never a send retry)',()=>{
  const save=router.slice(router.indexOf("path===PREFIX+'/campaign-targeted/save'"),
    router.indexOf("path===PREFIX+'/campaign-targeted/send'"));
  assert.match(save,/serviceFor\(session\.tokenHash\)\.resolveTargetHandles\(data\.handles\)/);
  assert.match(save,/if\(e\?\.code==='invalid_request'\)/);
  assert.match(save,/response\(res,409,\{ok:false,error:'recipient_selection_expired'\}\)/);
  assert.match(save,/campaignDraftStore\.saveTargeted\(draft,ids\)/);
  assert.doesNotMatch(save,/\.sendTargeted\(|\.send\(/);
});
test('refresh validates exact currently active owner-selected address, not raw send authority',()=>{
  assert.match(dashboard,/async function renewSingleTargetedSelection\(\)/);
  assert.match(dashboard,/selectedRecipientEmails\.length!==1\|\|selectedHandles\.length!==1/);
  assert.match(dashboard,/query:email,state:"active"/);
  assert.match(dashboard,/row\?\.state==="active"/);
  assert.match(dashboard,/row\.email\.trim\(\)\.toLowerCase\(\)===email/);
  assert.match(dashboard,/if\(exact\.length!==1\)/);
  assert.match(dashboard,/selectedHandles=\[exact\[0\]\.handle\]/);
  assert.match(dashboard,/error\?\.httpStatus!==409\|\|error\.code!=="recipient_selection_expired"/);
  assert.match(dashboard,/saved=await postTargeted\("campaign-targeted\/save"/);
  assert.match(dashboard,/stage="send"/);
  assert.match(dashboard,/Nie można potwierdzić wyniku wysyłki\. Nie ponawiaj wysyłki/);
});
test('specific prepare failure keeps editing possible without retrying an uncertain send',()=>{
  assert.match(dashboard,/Nie udało się zapisać szkicu/);
  assert.match(dashboard,/Nie udało się zatwierdzić szkicu/);
  assert.match(dashboard,/Wybór odbiorcy wygasł/);
  assert.match(dashboard,/targetedStarted=false/);
  assert.match(dashboard,/targeted-send"\)\.disabled=code/);
});
