import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCampaignAudienceProofCount,CAMPAIGN_CONSENT_VERSION
} from '../campaigns/audience-proof-count.mjs';

test('count is bounded, read-only and filters by exact consent evidence',async()=>{
  const calls=[];
  const count=createCampaignAudienceProofCount({database:{
    queryBounded:async(sql,params,options)=>{
      calls.push({sql,params,options});
      return {rows:[{confirmed:'2'}]};
    }
  }});
  assert.deepEqual(await count(),{
    ok:true,confirmed:2,scope:'new_only_doi_evidence_no_revocation',
    advisoryOnly:true
  });
  assert.equal(calls.length,1);
  const {sql,params,options}=calls[0];
  assert.deepEqual(params,[CAMPAIGN_CONSENT_VERSION]);
  assert.deepEqual(options,{timeoutMs:3000});
  assert.match(sql,/s\.state='active'/);
  assert.match(sql,/s\.confirmed_at IS NOT NULL/);
  assert.match(sql,/e\.challenge_id=s\.challenge_id/);
  assert.match(sql,/e\.consent_version=s\.consent_version/);
  assert.match(sql,/NOT EXISTS[\s\S]*newsletter_new\.revocations/);
  assert.doesNotMatch(sql,/newsletter_campaigns|legacy|INSERT|UPDATE|DELETE/i);
});
test('invalid or unavailable count cannot be mistaken for zero',async()=>{
  for(const response of [null,{}, {rows:[]}, {rows:[{confirmed:-1}]},
    {rows:[{confirmed:'1.5'}]},{rows:[{confirmed:'9007199254740992'}]},
    {rows:[{confirmed:'1'},{confirmed:'2'}]}]){
    const count=createCampaignAudienceProofCount({database:{
      queryBounded:async()=>response
    }});
    await assert.rejects(count(),/campaign_consent_evidence_unavailable/);
  }
});
test('database error is propagated; no simulated eligibility',async()=>{
  assert.throws(()=>createCampaignAudienceProofCount({database:{}}),/read_only_database_required/);
  const count=createCampaignAudienceProofCount({database:{
    queryBounded:async()=>{throw new Error('postgres unavailable');}
  }});
  await assert.rejects(count(),/postgres unavailable/);
});
