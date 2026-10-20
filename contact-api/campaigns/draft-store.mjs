import {randomUUID} from 'node:crypto';
import {prepareCampaignDraft} from './prepare.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function draftId(value){
  if(typeof value!=='string'||!UUID.test(value))
    throw Object.assign(new Error('invalid_campaign'),{code:'invalid_campaign'});
  return value;
}

// Drafts only. Never approves, reserves a recipient or sends mail.
export function createCampaignDraftStore({database}={}) {
  if(typeof database?.transaction!=='function') throw new TypeError('durable_database_required');
  return Object.freeze({
    async save(raw) {
      const draft=prepareCampaignDraft(raw);
      const id=randomUUID();
      await database.transaction(async client=>{
        const result=await client.query(
          'INSERT INTO newsletter_campaigns.campaigns (id,subject,body,audience,state) '+
          "VALUES ($1,$2,$3,$4,'draft') RETURNING id",
          [id,draft.subject,draft.body,draft.audience]);
        if(result.rowCount!==1) throw new Error('draft_not_saved');
      });
      return Object.freeze({id,state:'draft'});
    },
    async get(id) {
      draftId(id);
      const result=await database.transaction(async client=>client.query(
        "SELECT id,subject,body,audience FROM newsletter_campaigns.campaigns "+
        "WHERE id=$1 AND state='draft'",[id]));
      const row=result.rows?.[0];
      return row?Object.freeze({
        id:row.id,subject:row.subject,body:row.body,audience:row.audience
      }):null;
    },
    async update(id,raw) {
      draftId(id);
      const draft=prepareCampaignDraft(raw);
      return database.transaction(async client=>{
        const result=await client.query(
          "UPDATE newsletter_campaigns.campaigns "+
          "SET subject=$1,body=$2,audience=$3 "+
          "WHERE id=$4 AND state='draft' RETURNING id",
          [draft.subject,draft.body,draft.audience,id]);
        return result.rowCount===1?Object.freeze({id,state:'draft'}):null;
      });
    },
    async list() {
      const rows=await database.transaction(async client=>client.query(
        "SELECT id,subject,created_at FROM newsletter_campaigns.campaigns "+
        "WHERE state='draft' ORDER BY created_at DESC,id DESC LIMIT 50"));
      return Object.freeze((rows.rows||[]).map(row=>Object.freeze({
        id:row.id,subject:row.subject,createdAt:row.created_at
      })));
    }
  });
}
