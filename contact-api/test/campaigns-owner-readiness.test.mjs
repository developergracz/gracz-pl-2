import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const router=readFileSync(new URL('../admin-r1/owner-router.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../admin-r1/ui/owner-dashboard.js',import.meta.url),'utf8');
test('authenticated OWNER session precedes draft readiness route',()=>{
  assert.ok(router.indexOf("const session=await auth.session")<
    router.indexOf("path===PREFIX+'/campaign-drafts/availability'"));
  assert.match(router,/if\(campaignDraftsEnabled&&campaignDraftStore&&database\?\.enabled\)/);
  assert.match(router,/to_regclass\('newsletter_campaigns\.campaigns'\)/);
  assert.match(router,/has_schema_privilege\(current_user,'newsletter_campaigns','USAGE'\)/);
  assert.match(router,/has_table_privilege\(current_user,'newsletter_campaigns\.campaigns','SELECT,INSERT'\)/);
  assert.match(router,/enabled:ready/);
  assert.match(router,/campaignDraftsEnabled=false/);
});
test('draft controls remain disabled without verified readiness',()=>{
  assert.match(ui,/await checkCampaignDraftAvailability\(\)/);
  assert.match(ui,/if\(draftSaveButton\)draftSaveButton.disabled=true/);
  assert.match(ui,/if\(data.ok===true&&data.enabled===true\)/);
});
