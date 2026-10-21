import {randomUUID} from 'node:crypto';

// Internal draft adapter. Its construction does not enable campaign sending.
// PostgreSQL stored functions enforce consent, withdrawal and one-way states.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(value) {
  if(typeof value!=='string'||!UUID.test(value)) throw new TypeError('invalid_campaign_id');
  return value;
}
export function createCampaignPgDispatchStore({database}={}) {
  if(typeof database?.transaction!=='function')
    throw new TypeError('durable_postgres_required');
  return Object.freeze({
    async reserve({campaignId,emailTag}) {
      validId(campaignId);
      if(typeof emailTag!=='string'||!/^[0-9a-f]{64}$/.test(emailTag))
        throw new TypeError('invalid_recipient_tag');
      const dispatchId=randomUUID();
      const reserved=await database.transaction(async client=>{
        const r=await client.query(
          'SELECT newsletter_campaigns.reserve_confirmed($1::uuid,$2::uuid,$3::uuid,$4::char(64)) AS reserved',
          [campaignId,dispatchId,randomUUID(),emailTag]);
        return r.rows?.[0]?.reserved===true;
      });
      return reserved?dispatchId:null;
    },
    async claim({campaignId,dispatchId}) {
      validId(campaignId);validId(dispatchId);
      return database.transaction(async client=>{
        const r=await client.query(
          'SELECT newsletter_campaigns.claim_delivery($1::uuid,$2::uuid,$3::uuid) AS claimed',
          [campaignId,dispatchId,randomUUID()]);
        return r.rows?.[0]?.claimed===true;
      });
    },
    async recordOutcome({campaignId,dispatchId,accepted}) {
      validId(campaignId);validId(dispatchId);
      if(typeof accepted!=='boolean') throw new TypeError('invalid_delivery_outcome');
      return database.transaction(async client=>{
        const r=await client.query(
          'SELECT newsletter_campaigns.record_delivery_result($1::uuid,$2::uuid,$3::uuid,$4::boolean) AS recorded',
          [campaignId,dispatchId,randomUUID(),accepted]);
        return r.rows?.[0]?.recorded===true;
      });
    }
  });
}
