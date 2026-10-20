import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCampaignDraft,previewCampaign,dispatchCampaign} from '../campaigns/prepare.mjs';

const good={subject:'Nowości w gracz.pl',body:'Witaj! Zapraszamy do naszych nowych gier.',audience:'confirmed_active_new_only'};
test('accepts a safe OWNER campaign draft and does not send',()=>{
  const draft=prepareCampaignDraft(good);
  assert.equal(draft.audience,'confirmed_active_new_only');
  assert.equal(Object.isFrozen(draft),true);
  const preview=previewCampaign(good);
  assert.equal(preview.warning,'PREVIEW_ONLY_NO_SEND');
  assert.match(preview.html,/Podgląd kampanii/);
  assert.throws(()=>dispatchCampaign(),{code:'campaign_dispatch_not_enabled'});
});
test('refuses other audiences, malformed fields and header injection',()=>{
  for(const raw of [
    {...good,audience:'all'},
    {...good,audience:'legacy'},
    {...good,subject:'Hello\r\nBcc: other@example.com'},
    {...good,body:'short'},
    {...good,unknown:true},
    {...good,body:'<script>'},
    null
  ]){
    if(raw?.body==='<script>') {
      assert.match(previewCampaign({...raw,body:'Hello <script>world</script>'}).html,/&lt;script&gt;/);
    } else {
      assert.throws(()=>prepareCampaignDraft(raw),{code:'invalid_campaign'});
    }
  }
});
