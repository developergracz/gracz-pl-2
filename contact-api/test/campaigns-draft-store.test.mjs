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
