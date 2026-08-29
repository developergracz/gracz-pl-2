import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const ENDPOINT='/__g13_20260829_4f5f8c0b18bd4e12a0b9e74cc8fa43e1';
const databaseUrl=process.env.DATABASE_URL;
const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:databaseUrl,ssl:databaseUrl.includes('localhost')||databaseUrl.includes('127.0.0.1')?false:{rejectUnauthorized:false},max:1});

const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&path==='/health')return send(res,200,{status:'ok',mode:'gate14-readonly'});
  if(req.method!=='GET'||path!==ENDPOINT)return send(res,404,{error:'not_found'});
  try{return send(res,200,await collect());}
  catch(e){console.error('[gate14] collector error',{code:e?.code||'ERROR',name:e?.name||'Error'});return send(res,500,{error:'collector_failed'});}
});
server.listen(port,host,()=>console.log(`[gate14] read-only collector listening on ${host}:${port}`));

async function collect(){
  const c=await pool.connect();
  try{
    await c.query('BEGIN TRANSACTION READ ONLY');
    const meta=(await c.query("SELECT current_setting('transaction_read_only') ro,current_database() db,current_user usr,version() ver,NOW() captured_at")).rows[0];
    if(meta.ro!=='on')throw new Error('not read only');

    const connection=obj((await c.query(`SELECT metric,value FROM (
      SELECT 'transaction_read_only' metric,(current_setting('transaction_read_only')='on')::int::bigint value
      UNION ALL SELECT 'server_ssl_enabled',(current_setting('ssl')='on')::int::bigint
      UNION ALL SELECT 'current_connection_ssl',COALESCE((SELECT ssl::int::bigint FROM pg_stat_ssl WHERE pid=pg_backend_pid()),0)
      UNION ALL SELECT 'password_encryption_scram_sha_256',(current_setting('password_encryption')='scram-sha-256')::int::bigint
      UNION ALL SELECT 'row_security_on',(current_setting('row_security')='on')::int::bigint
    )q`)).rows);

    const role=obj((await c.query(`SELECT metric,value FROM (
      SELECT 'rolsuper' metric,rolsuper::int::bigint value FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'rolcreatedb',rolcreatedb::int::bigint FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'rolcreaterole',rolcreaterole::int::bigint FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'rolreplication',rolreplication::int::bigint FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'rolbypassrls',rolbypassrls::int::bigint FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'rolcanlogin',rolcanlogin::int::bigint FROM pg_roles WHERE rolname=current_user
      UNION ALL SELECT 'direct_role_memberships',COUNT(*)::bigint FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user
    )q`)).rows);

    const dbSchema=obj((await c.query(`SELECT metric,value FROM (
      SELECT 'database_connect' metric,has_database_privilege(current_user,current_database(),'CONNECT')::int::bigint value
      UNION ALL SELECT 'database_create',has_database_privilege(current_user,current_database(),'CREATE')::int::bigint
      UNION ALL SELECT 'database_temp',has_database_privilege(current_user,current_database(),'TEMP')::int::bigint
      UNION ALL SELECT 'database_owner_current',(d.datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))::int::bigint FROM pg_database d WHERE d.datname=current_database()
      UNION ALL SELECT 'public_schema_usage',has_schema_privilege(current_user,'public','USAGE')::int::bigint
      UNION ALL SELECT 'public_schema_create',has_schema_privilege(current_user,'public','CREATE')::int::bigint
    )q`)).rows);

    const tables=obj((await c.query(`WITH t AS(SELECT c.oid,c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')) SELECT metric,value FROM(
      SELECT 'public_tables_total' metric,COUNT(*)::bigint value FROM t
      UNION ALL SELECT 'tables_owned_by_current',COUNT(*)::bigint FROM t WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      UNION ALL SELECT 'tables_select',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'SELECT')
      UNION ALL SELECT 'tables_insert',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'INSERT')
      UNION ALL SELECT 'tables_update',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'UPDATE')
      UNION ALL SELECT 'tables_delete',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'DELETE')
      UNION ALL SELECT 'tables_truncate',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'TRUNCATE')
      UNION ALL SELECT 'tables_references',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'REFERENCES')
      UNION ALL SELECT 'tables_trigger',COUNT(*)::bigint FROM t WHERE has_table_privilege(current_user,oid,'TRIGGER')
    )q`)).rows);

    const sequences=obj((await c.query(`WITH s AS(SELECT c.oid,c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S') SELECT metric,value FROM(
      SELECT 'public_sequences_total' metric,COUNT(*)::bigint value FROM s
      UNION ALL SELECT 'sequences_owned_by_current',COUNT(*)::bigint FROM s WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      UNION ALL SELECT 'sequences_usage',COUNT(*)::bigint FROM s WHERE has_sequence_privilege(current_user,oid,'USAGE')
      UNION ALL SELECT 'sequences_select',COUNT(*)::bigint FROM s WHERE has_sequence_privilege(current_user,oid,'SELECT')
      UNION ALL SELECT 'sequences_update',COUNT(*)::bigint FROM s WHERE has_sequence_privilege(current_user,oid,'UPDATE')
    )q`)).rows);

    const publicGrants=obj((await c.query(`WITH sa AS(
      SELECT a.privilege_type FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner)))a WHERE n.nspname='public' AND a.grantee=0
    ),ta AS(
      SELECT c.oid,a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner)))a WHERE n.nspname='public' AND c.relkind IN('r','p') AND a.grantee=0
    ) SELECT metric,value FROM(
      SELECT 'public_schema_create_grants' metric,COUNT(*)::bigint value FROM sa WHERE privilege_type='CREATE'
      UNION ALL SELECT 'public_table_select_grants',COUNT(DISTINCT oid)::bigint FROM ta WHERE privilege_type='SELECT'
      UNION ALL SELECT 'public_table_write_grants',COUNT(DISTINCT oid)::bigint FROM ta WHERE privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
    )q`)).rows);

    const rls=obj((await c.query(`SELECT metric,value FROM(
      SELECT 'rls_enabled_tables' metric,COUNT(*)::bigint value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relrowsecurity
      UNION ALL SELECT 'rls_forced_tables',COUNT(*)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relforcerowsecurity
    )q`)).rows);

    const defaultAcl=obj((await c.query(`SELECT metric,value FROM(
      SELECT 'default_acl_rows_current_owner' metric,COUNT(*)::bigint value FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole WHERE r.rolname=current_user
      UNION ALL SELECT 'default_acl_public_write_entries',COUNT(*)::bigint FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole CROSS JOIN LATERAL aclexplode(d.defaclacl)a WHERE r.rolname=current_user AND a.grantee=0 AND a.privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','CREATE')
    )q`)).rows);

    await c.query('ROLLBACK');
    return{
      test:'gate13-active-state-runtime-v1',gate14Test:'gate14-security-credentials-permissions-v1',captureStatus:'PASS-COLLECTOR',readOnly:true,normalApplicationStarted:false,
      meta:{captured_at:meta.captured_at,database_name:meta.db,current_user:meta.usr,server_version:meta.ver},
      db:{connection,role,dbSchema,tables,sequences,publicGrants,rls,defaultAcl},
      runtime:runtimeSecuritySummary(process.env)
    };
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}

function runtimeSecuritySummary(env){
  const auth=String(env.AUTH_SECRET||'');
  const msg=String(env.MESSAGE_ENCRYPTION_KEY||'');
  const att=String(env.ATTACHMENT_ENCRYPTION_KEY||'');
  const mfa=String(env.MFA_ENCRYPTION_KEY||'');
  const tsSite=String(env.TURNSTILE_SITE_KEY||'').trim(),tsSecret=String(env.TURNSTILE_SECRET_KEY||'').trim(),tsHost=String(env.TURNSTILE_HOSTNAME||'').trim();
  const tw=[env.TWILIO_ACCOUNT_SID,env.TWILIO_AUTH_TOKEN,env.TWILIO_FROM_NUMBER].map(v=>Boolean(String(v||'').trim()));
  const publicBase=String(env.PUBLIC_BASE_URL||'').trim();
  return{
    node_env_production:String(env.NODE_ENV||'').toLowerCase()==='production',
    database_url_present:Boolean(String(env.DATABASE_URL||'').trim()),
    auth_secret_present:auth.length>0,auth_secret_min32:auth.length>=32,
    message_key_present:msg.length>0,message_key_min32:msg.length>=32,message_key_distinct_from_auth:Boolean(msg)&&msg!==auth,
    attachment_key_present:att.length>0,attachment_key_min32:att.length>=32,attachment_key_distinct_from_auth:Boolean(att)&&att!==auth,
    mfa_key_present:mfa.length>0,mfa_key_min32:mfa.length>=32,mfa_key_distinct_from_auth:Boolean(mfa)&&mfa!==auth,
    crypto_keys_all_dedicated:Boolean(msg&&att&&mfa),
    crypto_keys_pairwise_distinct:Boolean(msg&&att&&mfa&&auth&&new Set([auth,msg,att,mfa]).size===4),
    resend_api_key_present:Boolean(String(env.RESEND_API_KEY||'').trim()),
    explicit_email_from_present:Boolean(String(env.EMAIL_FROM||env.NEWSLETTER_FROM||'').trim()),
    turnstile_site_key_present:Boolean(tsSite),turnstile_secret_key_present:Boolean(tsSecret),turnstile_hostname_present:Boolean(tsHost),turnstile_pair_complete:Boolean(tsSite&&tsSecret),turnstile_partial:Boolean(tsSite)!==Boolean(tsSecret),
    twilio_complete:tw.every(Boolean),twilio_disabled:tw.every(v=>!v),twilio_partial:tw.some(Boolean)&&!tw.every(Boolean),
    public_base_url_present:Boolean(publicBase),public_base_url_https:!publicBase||/^https:\/\//i.test(publicBase)
  };
}
function obj(rows){return Object.fromEntries(rows.map(r=>[r.metric,Number(r.value)]));}
function send(res,status,payload){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload));}
let closing=false;async function shutdown(){if(closing)return;closing=true;server.close(async()=>{await pool.end().catch(()=>{});process.exit(0);});}for(const s of['SIGTERM','SIGINT'])process.once(s,()=>void shutdown());
