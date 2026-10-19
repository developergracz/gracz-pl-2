import {createOperatorAssertionVerifier} from './operator-assertion.mjs';
import {createOwnerApprovedOperatorEnrollment} from './operator-enrollment.mjs';
import {createWithdrawalEvidenceVerifier} from './withdrawal-evidence.mjs';
import {createVerifiedRecipientMapping} from './verified-recipient-mapping.mjs';
import {createWithdrawalOperatorService} from './operator-service.mjs';
import {createResendProviderOff} from './resend-provider-off.mjs';

// Private process factory, never imported from the public newsletter server.
// Uses REAL separately pinned signing authorities and independently supplied
// owner escrow. Fail closed on any missing key/configuration. No credentials,
// MFA devices, challenges or user identities are auto-created.
export function createPrivateWithdrawalOperatorRuntime({
  database,operatorAuthority,ownerApprovalAuthority,
  mailboxEvidenceAuthority,mappingEvidenceAuthority,
  operatorSubjectKey,legacyConsentSecret,ownerEscrowConsentSecret,
  mailboxTagKey,recipientEncryptionKey,resendApiKey
}={}) {
  if(typeof database?.transaction!=='function'||typeof database?.query!=='function'||
     !operatorAuthority||!ownerApprovalAuthority||
     !mailboxEvidenceAuthority||!mappingEvidenceAuthority||
     typeof resendApiKey!=='string'||!resendApiKey.trim()) {
    throw new TypeError('Private operator runtime requires all trusted services');
  }

  // MFA verifier rejects unsigned/stale assertions and requires WebAuthn MFA.
  // The operator DB account is additionally checked for every operation.
  const assertionVerifier=createOperatorAssertionVerifier({
    ...operatorAuthority,subjectTagKey:operatorSubjectKey
  });
  const enroll=createOwnerApprovedOperatorEnrollment({
    database,assertionVerifier,issuer:ownerApprovalAuthority.issuer,
    audience:ownerApprovalAuthority.audience,keyId:ownerApprovalAuthority.keyId,
    approvalPublicKeyPem:ownerApprovalAuthority.publicKeyPem
  });
  // Independent evidence issuers must have distinct keys, issuers and
  // audiences. No legacy compromised n1/ns1 token is accepted as proof.
  const evidenceVerifier=createWithdrawalEvidenceVerifier({
    mailbox:mailboxEvidenceAuthority,mapping:mappingEvidenceAuthority
  });
  // Only full, constant-time escrow equivalence unlocks *lookup* of
  // pre-existing legacy identity. This does NOT migrate or activate consent.
  const recipientMapping=createVerifiedRecipientMapping({
    database,legacyConsentSecret,escrowConsentSecret:ownerEscrowConsentSecret,
    mailboxTagKey,encryptionKey:recipientEncryptionKey
  });
  const providerOff=createResendProviderOff({apiKey:resendApiKey});
  const operator=createWithdrawalOperatorService({
    database,assertionVerifier,evidenceVerifier,recipientMapping,providerOff
  });
  return Object.freeze({enroll,operator});
}
