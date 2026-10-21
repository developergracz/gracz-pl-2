import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const router=readFileSync(new URL('../admin-r1/owner-router.mjs',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../admin-r1/ui/owner-dashboard.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../admin-r1/ui/index.html',import.meta.url),'utf8');
const body=router.slice(router.indexOf("PREFIX+'/campaign-drafts/save'"),
  router.indexOf("if(req.method==='POST'&&path===PREFIX+'/settings')"));

test('approval route lives only behind OWNER session, same-origin and CSRF',()=>{
  assert.match(body,/PREFIX\+'\/campaign-drafts\/approve'/);
  assert.match(body,/PREFIX\+'\/campaign-drafts\/approved'/);
  assert.match(body,/safePost\(req,origin\)/);
  assert.match(body,/auth\.checkCsrf\(session,req\.headers\['x-owner-csrf'\]\)/);
  assert.match(body,/writing\?65536:maxBody/);
  assert.match(body,/Object\.keys\(data\)\.length!==5/);
  assert.match(body,/data\.confirmation!=='ZATWIERDZAM TREŚĆ'/);
  assert.match(body,/campaignDraftStore\.approve\(id,draft\)/);
  assert.match(body,/error:'campaign_changed_or_approved'/);
  assert.doesNotMatch(body,/createCampaignDispatchCoordinator|\.sendOnce\(|\.withSendPermit\(/);
});
test('UI clearly separates content approval from marketing delivery',()=>{
  assert.match(html,/id="campaign-approve-content" disabled/);
  assert.match(html,/Zatwierdź treść \(bez wysyłki\)/);
  assert.match(html,/id="campaign-approved-list"/);
  assert.match(dashboard,/window\.prompt\(/);
  assert.match(dashboard,/ZATWIERDZAM TREŚĆ/);
  assert.match(dashboard,/savedCampaignSnapshot\.subject/);
  assert.match(dashboard,/savedCampaignSnapshot\.body/);
  assert.match(dashboard,/sendingEnabled!==false/);
  assert.match(dashboard,/Treść zatwierdzona\. Wysyłka nie została uruchomiona\./);
});
