// Owner-approved private repair of ONE address whose repeated verified opt-out
// was recorded before 005_repeat_withdrawal_state.sql (#354): that code closed
// the renewed DOI as state='pending' with no marker, so OWNER views still show
// "Oczekuje na DOI". 005 deliberately has no automatic backfill.
// Usage from /project/src (Render Shell), the address is read from stdin:
//   node contact-api/operations/repair-repeat-withdrawal-marker.mjs                    count only
//   node contact-api/operations/repair-repeat-withdrawal-marker.mjs --address          one address, read-only
//   node contact-api/operations/repair-repeat-withdrawal-marker.mjs --address --apply  after OWNER approval
// Sets only repeat_withdrawn_at from append-only newsletter_recovery evidence.
// Never prints an email, tag, key, challenge or raw error; never sends mail.
import {createHmac} from 'node:crypto';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createDatabase} from '../persistence/database.mjs';

// The first immutable revocation names its self-service challenge; the same
// recipient's later verified challenge is the documented repeat withdrawal.
// The pre-#354 statement set expires_at inside that very verification
// transaction, just before verified_at; a real DOI request keeps its own
// 30-minute link expiry and a NEW request (later requested_at) never matches.
const EVIDENCE=`
SELECT s.email_tag,max(v.verified_at) AS withdrawn_at
FROM newsletter_new.subscribers s
JOIN newsletter_new.revocations r
  ON r.email_tag=s.email_tag AND r.recorded_at<s.requested_at
JOIN newsletter_recovery.self_service_verified v0
  ON v0.challenge_id=r.challenge_id
JOIN newsletter_recovery.self_service_challenges c0
  ON c0.challenge_id=r.challenge_id
JOIN newsletter_recovery.self_service_challenges c
  ON c.recipient_tag=c0.recipient_tag
JOIN newsletter_recovery.self_service_verified v
  ON v.challenge_id=c.challenge_id
WHERE ($1::text IS NULL OR s.email_tag=$1::text)
  AND s.state='pending' AND s.confirmed_at IS NULL
  AND s.repeat_withdrawn_at IS NULL
  AND v.verified_at>=s.requested_at
  AND s.expires_at BETWEEN v.verified_at-interval '1 minute' AND v.verified_at
GROUP BY s.email_tag
`;
const CURRENT=`
SELECT s.state,s.requested_at,s.expires_at>clock_timestamp() AS open,
  COALESCE(r.recorded_at>=s.requested_at OR s.repeat_withdrawn_at>=s.requested_at,FALSE) AS revoked
FROM newsletter_new.subscribers s
LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
WHERE s.email_tag=$1
`;
const invalid=()=>new Error('REPEAT_WITHDRAWAL_REPAIR_UNAVAILABLE');

function emailTag(subjectKey,email){
  if(typeof subjectKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(subjectKey))throw invalid();
  const key=Buffer.from(subjectKey,'base64url');
  if(key.length!==32||key.toString('base64url')!==subjectKey)throw invalid();
  const mailbox=String(email||'').trim().toLowerCase();
  if(mailbox.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox))throw invalid();
  return createHmac('sha256',key).update('gracz-new-only:email\n'+mailbox).digest('hex');
}
const iso=value=>value instanceof Date?value.toISOString():new Date(String(value)).toISOString();

async function inspect(query,tag){
  const current=await query(CURRENT,[tag]);
  if(current.rows.length!==1)return Object.freeze({state:'BRAK_REKORDU'});
  const row=current.rows[0];
  const requestedAt=iso(row.requested_at);
  if(row.revoked)return Object.freeze({state:'WYPISANA',requestedAt});
  if(row.state==='active')return Object.freeze({state:'AKTYWNA',requestedAt});
  const evidence=await query(EVIDENCE,[tag]);
  if(evidence.rows.length===1)return Object.freeze({state:'HISTORYCZNE_WYPISANIE_BEZ_ZNACZNIKA',
    requestedAt,withdrawnAt:iso(evidence.rows[0].withdrawn_at)});
  // An expired DOI link alone is never a withdrawal.
  return Object.freeze({state:row.open?'OCZEKUJE_NA_DOI':'DOI_WYGASL_BEZ_DOWODU_WYPISANIA',requestedAt});
}

export async function countRepeatWithdrawalsWithoutMarker({database}={}){
  if(typeof database?.queryBounded!=='function')throw invalid();
  const result=await database.queryBounded(
    'SELECT count(*)::int AS n FROM ('+EVIDENCE+') e',[null],{timeoutMs:5000});
  const n=result?.rows?.[0]?.n;
  if(!Number.isSafeInteger(n)||n<0)throw invalid();
  return n;
}

export async function inspectRepeatWithdrawal({database,subjectKey,email}={}){
  if(typeof database?.queryBounded!=='function')throw invalid();
  const tag=emailTag(subjectKey,email);
  return inspect((sql,params)=>database.queryBounded(sql,params,{timeoutMs:3000}),tag);
}

export async function repairRepeatWithdrawal({database,subjectKey,email}={}){
  if(typeof database?.transaction!=='function')throw invalid();
  const tag=emailTag(subjectKey,email);
  return database.transaction(async client=>{
    // Same lock order as DOI, confirmation and verified withdrawal; the
    // evidence is read as a separate statement after the row lock.
    await client.query(
      'SELECT 1 FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',[tag]);
    const updated=await client.query(`
      UPDATE newsletter_new.subscribers s SET repeat_withdrawn_at=e.withdrawn_at
      FROM (${EVIDENCE}) e
      WHERE s.email_tag=e.email_tag AND s.repeat_withdrawn_at IS NULL
      RETURNING s.repeat_withdrawn_at
    `,[tag]);
    if(updated.rowCount>1)throw invalid();
    const after=await inspect((sql,params)=>client.query(sql,params),tag);
    if(updated.rowCount===0)return Object.freeze({repaired:false,...after});
    if(after.state!=='WYPISANA')throw invalid();
    return Object.freeze({repaired:true,...after,
      withdrawnAt:iso(updated.rows[0].repeat_withdrawn_at)});
  });
}

async function readAddress(){
  process.stdout.write('Adres e-mail (nie zostanie wypisany): ');
  const lines=createInterface({input:process.stdin,terminal:false});
  for await(const line of lines){lines.close();return line;}
  return '';
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2).join(' ');
  if(!['','--address','--address --apply'].includes(args)){
    console.log('ODMOWA: PARAMETRY NIEDOZWOLONE');
    process.exitCode=1;
  }else{
    const database=createDatabase({logger:{error(){}}});
    try{
      if(!args){
        const n=await countRepeatWithdrawalsWithoutMarker({database});
        console.log('HISTORYCZNE WYPISANIA BEZ ZNACZNIKA:',n);
      }else{
        const input={database,subjectKey:process.env.NEWSLETTER_NEW_SUBJECT_KEY,email:await readAddress()};
        const result=args.endsWith('--apply')?await repairRepeatWithdrawal(input):
          await inspectRepeatWithdrawal(input);
        console.log('STAN:',result.state);
        if(result.requestedAt)console.log('OSTATNI ZAPIS (requested_at):',result.requestedAt);
        if(result.withdrawnAt)console.log('ZWERYFIKOWANE WYPISANIE:',result.withdrawnAt);
        if('repaired' in result)console.log('WYNIK NAPRAWY:',result.repaired?'ZNACZNIK ZAPISANY':'BEZ ZMIAN');
      }
    }catch{
      // pg errors can contain private details; never expose them in Shell logs.
      console.log('KONTROLA NIEDOSTEPNA — BEZ ZMIAN');
      process.exitCode=1;
    }finally{
      await database.close().catch(()=>{});
    }
  }
}
