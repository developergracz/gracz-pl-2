import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

import {DistributedGlobalChatService} from '../src/distributed-global-chat.js';

const {Pool}=pg;
const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
function unique(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`.toLowerCase()}

async function withTwoNodes(fn){
  const poolA=new Pool({connectionString:databaseUrl,ssl:databaseUrl.includes('localhost')||databaseUrl.includes('127.0.0.1')?false:{rejectUnauthorized:false},max:3});
  const poolB=new Pool({connectionString:databaseUrl,ssl:databaseUrl.includes('localhost')||databaseUrl.includes('127.0.0.1')?false:{rejectUnauthorized:false},max:3});
  const nodeA=new DistributedGlobalChatService({pool:poolA});
  const nodeB=new DistributedGlobalChatService({pool:poolB});
  try{await Promise.all([nodeA.ready,nodeB.ready]);await fn({nodeA,nodeB,poolA,poolB})}
  finally{await Promise.allSettled([nodeA.close(),nodeB.close()]);await Promise.allSettled([poolA.end(),poolB.end()])}
}

test('Wave A C5 PostgreSQL: identical concurrent message is rejected across two replicas',{skip:!databaseUrl},async()=>{
  await withTwoNodes(async({nodeA,nodeB,poolA})=>{
    const user={userId:unique('c5dup'),displayName:'C5 duplicate'};
    try{
      const results=await Promise.allSettled([
        nodeA.send(user,{body:'identyczna wiadomość'}),
        nodeB.send(user,{body:'identyczna wiadomość'}),
      ]);
      assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
      const rejected=results.find(x=>x.status==='rejected');
      assert.ok(rejected);
      assert.equal(rejected.reason.code,'CHAT_DUPLICATE');
      assert.equal(rejected.reason.status,429);
      const count=await poolA.query('SELECT COUNT(*)::int AS count FROM gracz_global_chat WHERE user_id=$1',[user.userId]);
      assert.equal(count.rows[0].count,1);
    }finally{
      await poolA.query('DELETE FROM gracz_global_chat WHERE user_id=$1',[user.userId]).catch(()=>{});
      await poolA.query('DELETE FROM gracz_global_chat_presence WHERE user_id=$1',[user.userId]).catch(()=>{});
    }
  });
});

test('Wave A C5 PostgreSQL: replica count does not multiply 5 messages per 10 seconds',{skip:!databaseUrl},async()=>{
  await withTwoNodes(async({nodeA,nodeB,poolA})=>{
    const user={userId:unique('c5rate'),displayName:'C5 rate'};
    try{
      for(let index=1;index<=5;index+=1){
        const node=index%2?nodeA:nodeB;
        const sent=await node.send(user,{body:`wiadomość ${index}`});
        assert.ok(sent.messageId);
      }
      await assert.rejects(
        ()=>nodeB.send(user,{body:'wiadomość 6'}),
        error=>error?.code==='CHAT_RATE_LIMIT'&&error?.status===429,
      );
      const count=await poolA.query('SELECT COUNT(*)::int AS count FROM gracz_global_chat WHERE user_id=$1',[user.userId]);
      assert.equal(count.rows[0].count,5);
    }finally{
      await poolA.query('DELETE FROM gracz_global_chat WHERE user_id=$1',[user.userId]).catch(()=>{});
      await poolA.query('DELETE FROM gracz_global_chat_presence WHERE user_id=$1',[user.userId]).catch(()=>{});
    }
  });
});
