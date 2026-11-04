import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';

test('game identity accepts only verified active PostgreSQL-backed cookie sessions', async()=>{
 const sessionToken='a'.repeat(64);
 const validDigest=createHash('sha256').update(sessionToken).digest();
 const observed=[];
 const database={
  enabled:true,
  async query(sql,params=[]){
   observed.push({sql,params});
   if(!sql.includes('FROM gracz_public_identity.sessions s'))return {rows:[],rowCount:0};
   assert.equal(params.length,1);
   assert.ok(Buffer.isBuffer(params[0]));
   if(params[0].equals(validDigest))return {rows:[{id:'00000000-0000-4000-8000-000000000001',nickname:'Tester'}],rowCount:1};
   return {rows:[],rowCount:0};
  }
 };
 const router=createPublicIdentityRouter({database,emailFrom:'tester@example.invalid',resendKey:'test-only'});
 assert.equal(await router.authenticateGameRequest({headers:{cookie:''}}),null);
 assert.equal(await router.authenticateGameRequest({headers:{cookie:'__Host-gracz_session=bad-token'}}),null);
 assert.deepEqual(await router.authenticateGameRequest({headers:{cookie:'other=ignored; __Host-gracz_session='+sessionToken}}),
  {userId:'00000000-0000-4000-8000-000000000001',displayName:'Tester'});
 assert.equal(await router.authenticateGameRequest({headers:{cookie:'__Host-gracz_session='+ 'b'.repeat(64)}}),null);
 const checks=observed.filter(item=>item.sql.includes('FROM gracz_public_identity.sessions s'));
 assert.equal(checks.length,2);
 assert.ok(checks.every(item=>item.sql.includes('s.expires_at>now()')&&item.sql.includes('a.verified_at IS NOT NULL')));
});
