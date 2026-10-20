import {randomUUID} from 'node:crypto';
import {prepareCampaignDraft} from './prepare.mjs';

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
