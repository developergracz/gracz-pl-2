import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID, sign} from 'node:crypto';
import {createOperatorAssertionVerifier} from '../persistence/recovery/operator-assertion.mjs';

const keys=generateKeyPairSync('ed25519');
const issuer='https://synthetic-id.example.test';
const audience='gracz-newsletter-operator-private';
const keyId='synthetic-only-key';
const clock=1_800_000_000_000;
const nowSeconds=Math.floor(clock/1000);
const key=Buffer.alloc(32,0x17); // test fixture, never a production key
const verifier=createOperatorAssertionVerifier({
  issuer,audience,keyId,publicKeyPem:keys.publicKey.export({type:'spki',format:'pem'}),
  subjectTagKey:key,now:()=>clock
});
const makeClaims=()=>({iss:issuer,aud:audience,sub:randomUUID(),jti:randomUUID(),
  iat:nowSeconds-15,auth_time:nowSeconds-40,exp:nowSeconds+240,
  amr:['pwd','mfa','webauthn']});
function makeToken(claims=makeClaims(),head={}) {
  const header={alg:'EdDSA',typ:'JWT',kid:keyId,...head};
  const joined=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+
    Buffer.from(JSON.stringify(claims)).toString('base64url');
  return joined+'.'+sign(null,Buffer.from(joined),keys.privateKey).toString('base64url');
}
const denied={code:'OPERATOR_ACCESS_DENIED'};

test('#282 pinned Ed25519 MFA attestation yields only opaque subject and single-use tags',()=>{
  const claims=makeClaims(),token=makeToken({...claims,role:'primary',admin:true});
  const verified=verifier.verify(token);
  assert.deepEqual(Object.keys(verified),['subjectTag','tokenUse']);
  assert.match(verified.subjectTag,/^[0-9a-f]{64}$/);
  assert.match(verified.tokenUse,/^[0-9a-f]{64}$/);
  assert.deepEqual(verifier.verify(token),verified);
  assert.notEqual(verifier.verify(makeToken({...claims,jti:randomUUID()})).tokenUse,verified.tokenUse);
  assert.notEqual(verifier.verify(makeToken({...claims,sub:randomUUID()})).subjectTag,verified.subjectTag);
});

test('#282 token tampering, wrong algorithm/kid, remote keys and invalid signatures are rejected',()=>{
  const token=makeToken(),parts=token.split('.');
  const tampered={...makeClaims(),role:'primary'};
  assert.throws(()=>verifier.verify(parts[0]+'.'+Buffer.from(JSON.stringify(tampered)).toString('base64url')+'.'+parts[2]),denied);
  assert.throws(()=>verifier.verify(makeToken(makeClaims(),{alg:'HS256'})),denied);
  assert.throws(()=>verifier.verify(makeToken(makeClaims(),{kid:'attacker'})),denied);
  assert.throws(()=>verifier.verify(makeToken(makeClaims(),{jku:'https://untrusted.test/jwks'})),denied);
  assert.throws(()=>verifier.verify(token.slice(0,-2)+'XX'),denied);
  assert.throws(()=>verifier.verify('not-a-jwt'),denied);
});

test('#282 missing MFA, weak authentication, stale session, wrong issuer and audience are rejected',()=>{
  const claims=makeClaims();
  for(const bad of [
    {...claims,amr:['pwd']},
    {...claims,amr:['mfa']},
    {...claims,amr:['webauthn']},
    {...claims,auth_time:nowSeconds-1200},
    {...claims,iat:nowSeconds+120},
    {...claims,exp:nowSeconds-1},
    {...claims,exp:nowSeconds+1000},
    {...claims,iss:'https://other.test'},
    {...claims,aud:'other-client'},
    {...claims,sub:'victim@example.test'},
    {...claims,jti:'replay'},
    {...claims,nbf:nowSeconds+120}
  ])assert.throws(()=>verifier.verify(makeToken(bad)),denied);
});

test('#282 does not accept weak operator key config or non-Ed25519 identity key',()=>{
  assert.throws(()=>createOperatorAssertionVerifier({
    issuer,audience,keyId,publicKeyPem:keys.publicKey.export({type:'spki',format:'pem'}),
    subjectTagKey:Buffer.alloc(8),now:()=>clock
  }),TypeError);
  const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
  assert.throws(()=>createOperatorAssertionVerifier({
    issuer,audience,keyId,publicKeyPem:rsa.publicKey.export({type:'spki',format:'pem'}),
    subjectTagKey:key,now:()=>clock
  }),TypeError);
});
