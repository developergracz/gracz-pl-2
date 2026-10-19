// Isolated regression fixtures only; never imported by the production graph.
import {createCipheriv,createHash,hkdfSync,randomBytes} from 'node:crypto';
export const syntheticNewsletterSecret='test-'+'n'.repeat(40);
export function syntheticLegacyEnvelopes(email='unmapped@example.test'){
  const iat=Date.now(),exp=iat+60000;
  function seal(prefix,key,payload,aad){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
    if(aad)cipher.setAAD(aad);
    const bytes=Buffer.concat([cipher.update(JSON.stringify(payload)),cipher.final()]);
    const fields=[nonce,cipher.getAuthTag(),bytes];
    if(prefix==='ns1')fields.splice(1,2,bytes,cipher.getAuthTag());
    return [prefix,...fields.map(b=>b.toString('base64url'))].join('.');
  }
  const key=createHash('sha256').update(syntheticNewsletterSecret).digest();
  const aad=Buffer.from('gracz.pl/newsletter/STATUS_CHECK/v1');
  return {
    confirm:seal('n1',key,{v:1,purpose:'confirm',jti:'synthetic-confirm',email,iat,exp}),
    unsubscribe:seal('n1',key,{v:1,purpose:'unsubscribe',jti:'synthetic-unsubscribe',email,iat,exp}),
    status:seal('ns1',Buffer.from(hkdfSync('sha256',syntheticNewsletterSecret,aad,Buffer.from('mailbox-proof-key'),32)),{purpose:'STATUS_CHECK',aud:'gracz.pl/newsletter/status-check',email,nonce:randomBytes(32).toString('hex'),iat,exp:iat+600000},aad),
  };
}
