// Private Render Shell diagnostic; read-only PostgreSQL + read-only Resend.
// Usage from /project/src: node contact-api/operations/check-withdrawal-provider.mjs
// Never prints an email, challenge, ID, ciphertext, key, provider body or error detail.
import {createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createDatabase} from '../persistence/database.mjs';
import {createResendProviderOff} from '../persistence/recovery/resend-provider-off.mjs';

const QUERY=`
SELECT c.challenge_id,c.recipient_tag,c.ciphertext,c.nonce,c.auth_tag
FROM newsletter_recovery.withdrawal_requests r
JOIN newsletter_recovery.self_service_verified v
 ON v.withdrawal_request_id=r.request_id
JOIN newsletter_recovery.self_service_challenges c
 ON c.challenge_id=v.challenge_id
LEFT JOIN newsletter_recovery.self_service_provider_verified p
 ON p.challenge_id=v.challenge_id
WHERE r.intake_source='self_service' AND p.challenge_id IS NULL
LIMIT 2
`;
const invalid=()=>new Error('WITHDRAWAL_READONLY_CHECK_UNAVAILABLE');
function decodedKey(raw){
  if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))throw invalid();
  const bytes=Buffer.from(raw,'base64url');
  if(bytes.length!==32||bytes.toString('base64url')!==raw)throw invalid();
  return bytes;
}

export async function checkWithdrawalProviderReadOnly({
  database,encryptionKey,recipientTagKey,providerApiKey,providerFactory=createResendProviderOff
}={}){
  if(typeof database?.queryBounded!=='function'||typeof providerFactory!=='function'||
     typeof providerApiKey!=='string'||!providerApiKey.trim())throw invalid();
  const enc=decodedKey(encryptionKey);
  const tagKey=decodedKey(recipientTagKey);
  const {rows}=await database.queryBounded(QUERY,[],{timeoutMs:3000});
  if(!Array.isArray(rows)||rows.length!==1)throw invalid();
  const row=rows[0];
  if(!row||typeof row.challenge_id!=='string'||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.challenge_id)||
     !Buffer.isBuffer(row.nonce)||row.nonce.length!==12||
     !Buffer.isBuffer(row.auth_tag)||row.auth_tag.length!==16||
     !Buffer.isBuffer(row.ciphertext)||row.ciphertext.length<16||
     typeof row.recipient_tag!=='string'||!/^[0-9a-f]{64}$/.test(row.recipient_tag.trim()))
    throw invalid();

  let email;
  try{
    const d=createDecipheriv('aes-256-gcm',enc,row.nonce);
    d.setAAD(Buffer.from('gracz-withdrawal-recipient-v1\0'+row.challenge_id));
    d.setAuthTag(row.auth_tag);
    email=Buffer.concat([d.update(row.ciphertext),d.final()])
      .toString('utf8').replace(/\0+$/g,'');
  }catch{throw invalid();}
  if(email!==email.trim().toLowerCase()||
     email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw invalid();
  const tag=createHmac('sha256',tagKey)
    .update('gracz-withdrawal-v1\0recipient\0'+email).digest();
  if(!timingSafeEqual(tag,Buffer.from(row.recipient_tag.trim(),'hex')))throw invalid();
  const provider=providerFactory({apiKey:providerApiKey});
  if(typeof provider?.verifyOff!=='function')throw invalid();
  const verification=await provider.verifyOff(email); // ONLY GET suppression and contact
  if(typeof verification?.off!=='boolean')throw invalid();
  return verification.off===true?'RESEND_OFF_CONFIRMED':'RESEND_OFF_NOT_CONFIRMED';
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){
    console.log('KONTROLA NIEDOSTEPNA — ARGUMENTY NIEDOZWOLONE');
    process.exitCode=1;
  }else{
    const database=createDatabase({logger:{error(){}}});
    try{
      const status=await checkWithdrawalProviderReadOnly({
        database,
        encryptionKey:process.env.WITHDRAWAL_ENCRYPTION_KEY,
        recipientTagKey:process.env.WITHDRAWAL_RECIPIENT_TAG_KEY,
        providerApiKey:process.env.WITHDRAWAL_RESEND_API_KEY
      });
      console.log('WYNIK JEDNEGO WYPISANIA:',status);
    }catch{
      // No raw errors: provider/client errors may include private details.
      console.log('KONTROLA NIEDOSTEPNA — BLOKADA BEZ ZMIAN');
      process.exitCode=1;
    }finally{
      await database.close().catch(()=>{});
    }
  }
}
