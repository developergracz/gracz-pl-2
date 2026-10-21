import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignDraftStore} from '../campaigns/draft-store.mjs';

test('draft persists atomically without approving or dispatching',async()=>{
  const calls=[];
  const db={transaction:async fn=>fn({query:async(sql,args)=>{
    calls.push({sql,args});return {rowCount:1,rows:[{id:args?.[0]}]};
  }})};
  const store=createCampaignDraftStore({database:db});
  const saved=await store.save({
    subject:'Nowości gracz.pl',body:'Nowe gry już w przygotowaniu.',
    audience:'confirmed_active_new_only'
  });
  assert.equal(saved.state,'draft');
  assert.match(calls[0].sql,/INSERT INTO newsletter_campaigns\.campaigns/);
  assert.match(calls[0].sql,/VALUES \(\$1,\$2,\$3,\$4,'draft'\)/);
  assert.equal(calls[0].args[1],'Nowości gracz.pl');
  assert.equal(calls.length,1);
});
test('draft rejects unapproved audience and header injection before SQL',async()=>{
  let calls=0;
  const store=createCampaignDraftStore({database:{transaction:async()=>{calls++;}}});
  for(const raw of [
    {subject:'Valid title',body:'Valid newsletter content',audience:'all'},
    {subject:'Hi\r\nBcc: x',body:'Valid newsletter content',audience:'confirmed_active_new_only'}
  ]) await assert.rejects(store.save(raw),{code:'invalid_campaign'});
  assert.equal(calls,0);
});
test('draft listing exposes no email or message body',async()=>{
  const store=createCampaignDraftStore({database:{transaction:async fn=>fn({
    query:async()=>({rows:[{id:'x',subject:'Nowe gry',created_at:'2026-10-21',body:'private'}]})
  })}});
  assert.deepEqual(await store.list(),[{id:'x',subject:'Nowe gry',createdAt:'2026-10-21'}]);
});

test('OWNER draft edit only updates rows still in draft state',async()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  const calls=[];
  let rowCount=1;
  const store=createCampaignDraftStore({database:{transaction:async fn=>fn({
    query:async(sql,params)=>{calls.push({sql,params});return {rowCount};}
  })}});
  const payload={subject:'Gry gracz.pl',body:'Newsletter z nowymi grami gracz.pl.',
    audience:'confirmed_active_new_only'};
  assert.deepEqual(await store.update(id,payload),{id,state:'draft'});
  assert.match(calls[0].sql,/WHERE id=\$4 AND state='draft'/);
  assert.equal(calls[0].params[3],id);
  rowCount=0;
  assert.equal(await store.update(id,payload),null);
  await assert.rejects(store.update('not-a-uuid',payload),{code:'invalid_campaign'});
  assert.equal(calls.length,2);
});

test('OWNER draft body is accessible only by identifier and draft state',async()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  const calls=[];
  const store=createCampaignDraftStore({database:{transaction:async fn=>fn({
    query:async(sql,params)=>{
      calls.push({sql,params});
      return {rows:[{id,subject:'Kampania',body:'Bez wysyłki.',
        audience:'confirmed_active_new_only',secret:'do-not-return'}]};
    }
  })}});
  assert.deepEqual(await store.get(id),{id,subject:'Kampania',body:'Bez wysyłki.',
    audience:'confirmed_active_new_only'});
  assert.match(calls[0].sql,/WHERE id=\$1 AND state='draft'/);
  await assert.rejects(store.get('invalid-id'),{code:'invalid_campaign'});
  assert.equal(calls.length,1);
});

test('OWNER approval is exactly-once and compares the complete current draft',async()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  const queries=[];
  let applied=true;
  const store=createCampaignDraftStore({database:{
    transaction:async fn=>fn({query:async(sql,params)=>{
      queries.push({sql,params});
      return {rowCount:applied?1:0,rows:applied?[{id,approved_at:'2026-10-21'}]:[]};
    }})
  }});
  const draft={subject:'Nowości gracz.pl',
    body:'Nowa wiadomość dla użytkowników serwisu gracz.pl.',
    audience:'confirmed_active_new_only'};
  assert.deepEqual(await store.approve(id,draft),{
    id,state:'approved',sendingEnabled:false
  });
  assert.match(queries[0].sql,/WHERE id=\$1 AND state='draft' AND approved_at IS NULL/);
  assert.match(queries[0].sql,/AND subject=\$2 AND body=\$3 AND audience=\$4/);
  assert.deepEqual(queries[0].params,[id,draft.subject,draft.body,draft.audience]);
  assert.doesNotMatch(queries[0].sql,/dispatch|resend|email_tag/i);
  applied=false;
  assert.equal(await store.approve(id,draft),null);
  await assert.rejects(store.approve('not-uuid',draft),{code:'invalid_campaign'});
});
test('approved list returns only headers and cannot return message body',async()=>{
  const store=createCampaignDraftStore({database:{
    transaction:async fn=>fn({query:async sql=>{
      assert.match(sql,/WHERE state='approved'/);
      assert.match(sql,/LIMIT 50/);
      return {rows:[{
        id:'1',subject:'Nowa kampania',approved_at:'2026-10-21',
        body:'SECRET BODY',email:'private@example.test'
      }]};
    }})
  }});
  assert.deepEqual(await store.listApproved(),[{
    id:'1',subject:'Nowa kampania',approvedAt:'2026-10-21',
    state:'approved',sendingEnabled:false
  }]);
});
