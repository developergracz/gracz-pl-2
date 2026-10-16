import test from 'node:test';
import assert from 'node:assert/strict';
import {f03TlsOptions,F03_PRIVATE_TLS_APPROVAL} from '../persistence/render-private-tls.mjs';

const valid = 'postgresql://gracz_r4_staging_postgres_user:test-password@dpg-db38btt9fdbs73aadohg-a:5432/gracz_r4_staging_postgres';
const env = Object.freeze({
  F03_PRIVATE_RENDER_TLS_EXCEPTION:F03_PRIVATE_TLS_APPROVAL,
  RENDER_SERVICE_ID:'srv-db00m2u7bikc73fnsje0',
});
const denied = {message:'F03_PRIVATE_TLS_SCOPE_REJECTED'};

test('F03 keeps certificate verification by default',()=>{
  assert.deepEqual(f03TlsOptions(valid,{}),{rejectUnauthorized:true});
  assert.deepEqual(f03TlsOptions(valid,{F03_PRIVATE_RENDER_TLS_EXCEPTION:''}),{rejectUnauthorized:true});
});
test('F03 encrypted private-Render exception only with explicit Owner scope',()=>{
  assert.deepEqual(f03TlsOptions(valid,env),{rejectUnauthorized:false});
  assert.throws(()=>f03TlsOptions(valid,{...env,F03_PRIVATE_RENDER_TLS_EXCEPTION:'true'}),denied);
  assert.throws(()=>f03TlsOptions(valid,{...env,RENDER_SERVICE_ID:'srv-other'}),denied);
  assert.throws(()=>f03TlsOptions(valid,{F03_PRIVATE_RENDER_TLS_EXCEPTION:F03_PRIVATE_TLS_APPROVAL}),denied);
});
test('F03 refuses external DNS, alternate DB identities, wrong protocol and URL overrides',()=>{
  const changed = [
    valid.replace('dpg-db38btt9fdbs73aadohg-a:5432','dpg-db38btt9fdbs73aadohg-a.frankfurt-postgres.render.com:5432'),
    valid.replace('dpg-db38btt9fdbs73aadohg-a:5432','127.0.0.1:5432'),
    valid.replace(':5432/',':5433/'),
    valid.replace('/gracz_r4_staging_postgres','/another'),
    valid.replace('gracz_r4_staging_postgres_user:','another:'),
    valid.replace('postgresql://','http://'),
    valid+'?sslmode=disable',
    valid+'#override',
    valid.replace(':test-password@',':@'),
    'not-a-url',
  ];
  for(const url of changed)assert.throws(()=>f03TlsOptions(url,env),denied,url);
});
