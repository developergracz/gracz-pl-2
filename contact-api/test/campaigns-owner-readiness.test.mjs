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
  assert.match(router,/has_table_privilege\(current_user,'newsletter_campaigns\.campaigns','SELECT,INSERT,UPDATE'\)/);
  assert.match(router,/enabled:ready/);
  assert.match(router,/campaignDraftsEnabled=false/);
});
test('draft controls remain disabled without verified readiness',()=>{
  assert.match(ui,/await checkCampaignDraftAvailability\(\)/);
  assert.match(ui,/if\(draftSaveButton\)draftSaveButton.disabled=true/);
  assert.match(ui,/if\(data.ok===true&&data.enabled===true\)/);
});

test('OWNER saved-draft read and update require CSRF and do not expose sending',()=>{
  assert.match(router,/PREFIX\+'\/campaign-drafts\/get'/);
  assert.match(router,/PREFIX\+'\/campaign-drafts\/update'/);
  assert.match(router,/auth\.checkCsrf\(session,req\.headers\['x-owner-csrf'\]\)/);
  assert.match(router,/campaignDraftStore\.get\(data\.id\)/);
  assert.match(router,/campaignDraftStore\.update\(id,draft\)/);
  assert.doesNotMatch(router,/campaign-drafts\/send/);
});

test('consent evidence count is OWNER-only, CSRF-checked and non-sending',()=>{
  assert.ok(router.indexOf("const session=await auth.session") <
    router.indexOf("path===PREFIX+'/campaign-drafts/audience'"));
  assert.match(router,/path===PREFIX\+'\/campaign-drafts\/audience'/);
  assert.match(router,/!campaignDraftsEnabled\|\|!campaignDraftStore\|\|/);
  assert.match(router,/typeof campaignAudienceProofCount!=='function'/);
  assert.match(router,/auth\.checkCsrf\(session,req\.headers\['x-owner-csrf'\]\)/);
  assert.match(router,/await campaignAudienceProofCount\(\)/);
  assert.match(ui,/await draftRequest\("audience",\{\}\)/);
  assert.match(ui,/result\.advisoryOnly!==true/);
});
