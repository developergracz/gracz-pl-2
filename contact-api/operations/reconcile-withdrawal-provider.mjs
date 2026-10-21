// Owner-approved ONE-TIME private reconciliation of exactly one confirmed
// self-service opt-out. Run from Render Shell, never from a public route.
// No marketing sends. Does not clear the global newsletter egress HOLD.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createDatabase} from '../persistence/database.mjs';
import {createResendProviderOff} from '../persistence/recovery/resend-provider-off.mjs';
import {WITHDRAWAL_EGRESS_LOCK} from '../persistence/recovery/withdrawal-send-fence.mjs';
import {resolveWithdrawalRecipient} from './check-withdrawal-provider.mjs';

const CANDIDATES=`
SELECT c.challenge_id,c.recipient_tag,c.ciphertext,c.nonce,c.auth_tag
FROM newsletter_recovery.withdrawal_requests r
JOIN newsletter_recovery.self_service_verified v
 ON v.withdrawal_request_id=r.request_id
JOIN newsletter_recovery.self_service_provider_intents i
 ON i.challenge_id=v.challenge_id
JOIN newsletter_recovery.self_service_challenges c
 ON c.challenge_id=v.challenge_id
LEFT JOIN newsletter_recovery.self_service_provider_verified p
 ON p.challenge_id=v.challenge_id
WHERE r.intake_source='self_service' AND p.challenge_id IS NULL
LIMIT 2 FOR UPDATE OF v
`;
const refuse=()=>new Error('WITHDRAWAL_RECONCILIATION_UNAVAILABLE');

export async function reconcileOneProviderWithdrawal({
  database,encryptionKey,recipientTagKey,providerApiKey,
  providerFactory=createResendProviderOff
}={}){
  if(typeof database?.transaction!=='function'||
     typeof providerFactory!=='function'||typeof providerApiKey!=='string'||
     !providerApiKey.trim())throw refuse();
  return database.transaction(async client=>{
    // Synchronize with verified withdrawal intake and the marketing send fence.
    // Keep the exclusive lock while the external provider mutation is active.
    await client.query(
      'SELECT pg_advisory_xact_lock($1::int,$2::int)',
      WITHDRAWAL_EGRESS_LOCK
    );
    const result=await client.query(CANDIDATES);
    if(!Array.isArray(result?.rows)||result.rows.length>1)throw refuse();
    if(result.rows.length===0)
      return Object.freeze({state:'NO_PENDING_CONFIRMATION'});
    const row=result.rows[0];
    const email=resolveWithdrawalRecipient({row,encryptionKey,recipientTagKey});
    const provider=providerFactory({apiKey:providerApiKey});
    if(typeof provider?.ensureOff!=='function'||
       typeof provider?.verifyOff!=='function')throw refuse();

    // ensureOff always verifies current Resend state before any optional
    // suppression or contact mutation; uncertainty never gets a success marker.
    const off=await provider.ensureOff(email);
    if(off?.off!==true)throw refuse();
    const proof=await provider.verifyOff(email);
    if(proof?.off!==true)throw refuse();

    // Append-only confirmed marker only after a fresh provider readback.
    // A failed commit rolls back the marker; a repeat inspects Resend before
    // attempting another change, never blindly replays a mutation.
    const inserted=await client.query(
      'INSERT INTO newsletter_recovery.self_service_provider_verified (challenge_id) '+
      'VALUES ($1) ON CONFLICT DO NOTHING RETURNING challenge_id',
      [row.challenge_id]
    );
    if(inserted?.rowCount!==1)throw refuse();
    return Object.freeze({state:'PROVIDER_OFF_VERIFIED_AND_RECORDED'});
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){
    console.log('ODMOWA: PARAMETRY NIEDOZWOLONE');
    process.exitCode=1;
  }else{
    const database=createDatabase({logger:{error(){}}});
    try{
      const {state}=await reconcileOneProviderWithdrawal({
        database,
        encryptionKey:process.env.WITHDRAWAL_ENCRYPTION_KEY,
        recipientTagKey:process.env.WITHDRAWAL_RECIPIENT_TAG_KEY,
        providerApiKey:process.env.WITHDRAWAL_RESEND_API_KEY
      });
      console.log('WYNIK KOREKTY:',state);
      console.log('GLOBALNA BLOKADA MARKETINGOWA: BEZ ZMIAN');
    }catch{
      // Resend/pg errors can contain PII; never expose them in Shell logs.
      console.log('KOREKTA NIEPOTWIERDZONA — BLOKADA BEZ ZMIAN');
      process.exitCode=1;
    }finally{
      await database.close().catch(()=>{});
    }
  }
}
