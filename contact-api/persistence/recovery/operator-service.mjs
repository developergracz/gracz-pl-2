import {randomUUID} from 'node:crypto';

// Restricted internal operator operations. Not exposed to any HTTP listener.
// Requires a separately deployed trusted identity gateway and purpose-separated
// signed MFA assertions. Role always comes from DB, never from JWT claims.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS=new Set(['UNVERIFIED','UNMAPPED','AMBIGUOUS','PROVIDER_UNKNOWN','OTHER']);
function deny() {const e=new Error('OPERATOR_ACCESS_DENIED');e.code='OPERATOR_ACCESS_DENIED';return e;}
function fail(code){const e=new Error(code);e.code=code;return e;}
function validUuid(value){return typeof value==='string'&&UUID.test(value);}

export function createWithdrawalOperatorService({database,assertionVerifier,evidenceVerifier,providerOff,resolveVerifiedRecipient,recipientMapping}={}) {
  if(typeof database?.transaction!=='function'||typeof assertionVerifier?.verify!=='function')
    throw new TypeError('Durable database and pinned assertion verifier required');

  async function authorized(signedToken,work){
    const verified=assertionVerifier.verify(signedToken);
    return database.transaction(async client=>{
      const actor=await client.query(
        "SELECT operator_ref,role FROM newsletter_recovery.operator_accounts " +
        "WHERE subject_tag=$1 AND disabled_at IS NULL AND role IN ('primary','backup') FOR SHARE",
        [verified.subjectTag]
      );
      if(actor.rowCount!==1)throw deny();
      const operatorRef=actor.rows[0].operator_ref;
      // jti fence: one signed MFA token can authorize one action only,
      // even with simultaneous requests or process restarts.
      return work(client,{operatorRef,tokenUse:verified.tokenUse});
    });
  }
  async function audit(client,actor,action,requestId){
    await client.query(
      "INSERT INTO newsletter_recovery.operator_actions(token_use,operator_ref,action_kind,request_id) " +
      "VALUES ($1,$2,$3,$4)",
      [actor.tokenUse,actor.operatorRef,action,requestId]
    );
  }
  return Object.freeze({
    async inspectPending({signedToken,limit=20}={}) {
      if(!Number.isInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid page size');
      return authorized(signedToken,async(client,actor)=>{
        await audit(client,actor,'INSPECT_PENDING',null);
        const result=await client.query(
          "SELECT r.request_id,r.intake_source,r.received_at," +
          " (SELECT e.event_kind FROM newsletter_recovery.withdrawal_events e " +
          "  WHERE e.request_id=r.request_id ORDER BY e.event_id DESC LIMIT 1) AS latest_state " +
          "FROM newsletter_recovery.withdrawal_requests r " +
          "ORDER BY r.received_at DESC,r.request_id DESC LIMIT $1",
          [limit]
        );
        // Never return evidence_ref, dedupe_tag or any mailbox evidence.
        return result.rows.map(r=>Object.freeze({
          requestId:r.request_id,source:r.intake_source,
          receivedAt:r.received_at,state:r.latest_state==='PROVIDER_OFF_VERIFIED'?'PROVIDER_OFF_VERIFIED':r.latest_state==='VERIFIED_PENDING'?'VERIFIED_PENDING':r.latest_state==='QUARANTINED'?'QUARANTINED':'PENDING'
        }));
      });
    },
    async recordVerifiedPending({signedToken,requestId,mailboxToken,mappingToken}={}) {
      // No trusted proof authority configured: explicitly fail closed.
      if(typeof evidenceVerifier?.verifyPair!=='function')throw fail('WITHDRAWAL_PROOF_PROVIDER_UNAVAILABLE');
      if(!validUuid(requestId))throw new TypeError('Invalid request identifier');
      // Role/MFA verification alone never establishes mailbox control or an
      // unambiguous one-to-one mapping to a historical subject.
      const proof=evidenceVerifier.verifyPair({
        expectedRequestId:requestId,mailboxToken,mappingToken
      });
      return authorized(signedToken,async(client,actor)=>{
        const locked=await client.query(
          "SELECT request_id FROM newsletter_recovery.withdrawal_requests WHERE request_id=$1 FOR UPDATE",
          [requestId]
        );
        if(locked.rowCount!==1)throw fail('WITHDRAWAL_REQUEST_NOT_FOUND');
        const latest=await client.query(
          "SELECT event_kind FROM newsletter_recovery.withdrawal_events "+
          "WHERE request_id=$1 ORDER BY event_id DESC LIMIT 1",[requestId]
        );
        if(!['RECEIVED','QUARANTINED'].includes(latest.rows[0]?.event_kind))
          throw fail('WITHDRAWAL_VERIFICATION_STATE_CONFLICT');
        const obligationId=randomUUID();
        await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_verified_evidence "+
          "(request_id,actor_ref,legacy_subject_ref,mailbox_tag,mailbox_proof_ref,mapping_proof_ref,mailbox_proof_tag,mapping_proof_tag) "+
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [requestId,actor.operatorRef,proof.legacySubjectRef,proof.mailboxTag,proof.mailboxProofRef,
           proof.mappingProofRef,proof.mailboxProofTag,proof.mappingProofTag]
        );
        await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_no_send_obligations "+
          "(obligation_id,request_id,legacy_subject_ref) VALUES ($1,$2,$3)",
          [obligationId,requestId,proof.legacySubjectRef]
        );
        await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_events "+
          "(request_id,event_kind,actor_ref) VALUES ($1,'VERIFIED_PENDING',$2)",
          [requestId,actor.operatorRef]
        );
        await audit(client,actor,'RECORD_VERIFIED_PENDING',requestId);
        // Provider-off and legally effective suppression remain unverified.
        // Never return CONFIRMED or trigger any provider operation.
        return Object.freeze({requestId,state:'VERIFIED_PENDING',
          providerState:'RECONCILIATION_PENDING',confirmed:false});
      });
    },
    async linkVerifiedRecipient({signedToken,requestId,email}={}) {
      if(!validUuid(requestId)||typeof recipientMapping?.linkVerified!=='function')
        throw fail('WITHDRAWAL_IDENTITY_MAPPING_UNAVAILABLE');
      return authorized(signedToken,async(client,actor)=>{
        const evidence=await client.query(
          "SELECT legacy_subject_ref,mailbox_tag FROM newsletter_recovery.withdrawal_verified_evidence " +
          "WHERE request_id=$1 FOR SHARE",[requestId]
        );
        if(evidence.rowCount!==1)throw fail('WITHDRAWAL_VERIFIED_EVIDENCE_REQUIRED');
        const outcome=await recipientMapping.linkVerified({
          client,requestId,email,operatorRef:actor.operatorRef,
          legacySubjectRef:evidence.rows[0].legacy_subject_ref,
          mailboxTag:evidence.rows[0].mailbox_tag
        });
        await audit(client,actor,'LINK_VERIFIED_RECIPIENT',requestId);
        return outcome;
      });
    },
    async reconcileProviderOff({signedToken,requestId}={}) {
      if(!validUuid(requestId))throw new TypeError('Invalid withdrawal ID');
      if(typeof providerOff?.ensureOff!=='function'||
         typeof providerOff?.verifyOff!=='function'||
         typeof (recipientMapping?.resolveVerifiedRecipient || resolveVerifiedRecipient)!=='function')
        throw fail('WITHDRAWAL_PROVIDER_OFF_NOT_CONFIGURED');

      // Phase 1: commit an immutable OFF intent BEFORE touching Resend.
      // A lost response/crash leaves an unresolved intent and a global send HOLD.
      const reserved=await authorized(signedToken,async(client,actor)=>{
        const item=await client.query(
          "SELECT v.legacy_subject_ref,v.mailbox_tag FROM newsletter_recovery.withdrawal_verified_evidence v " +
          "JOIN newsletter_recovery.withdrawal_no_send_obligations n ON n.request_id=v.request_id " +
          "WHERE v.request_id=$1 FOR UPDATE OF v",[requestId]
        );
        if(item.rowCount!==1)throw fail('WITHDRAWAL_VERIFIED_EVIDENCE_REQUIRED');
        const latest=await client.query(
          "SELECT event_kind FROM newsletter_recovery.withdrawal_events " +
          "WHERE request_id=$1 ORDER BY event_id DESC LIMIT 1",[requestId]
        );
        if(!['VERIFIED_PENDING','PROVIDER_OFF_VERIFIED'].includes(latest.rows[0]?.event_kind))
          throw fail('WITHDRAWAL_VERIFICATION_STATE_CONFLICT');
        await audit(client,actor,'RECONCILE_PROVIDER_OFF',requestId);
        return Object.freeze({
          actorRef:actor.operatorRef,
          mailboxTag:item.rows[0].mailbox_tag,
          legacySubjectRef:item.rows[0].legacy_subject_ref,
          alreadyOff:latest.rows[0].event_kind==='PROVIDER_OFF_VERIFIED'
        });
      });

      // The resolver is a separate TRUSTED identity service; the operator
      // cannot submit a recipient directly. It must present a mailbox tag
      // matching both independently signed proofs stored in PostgreSQL.
      let target;
      try {target=await (recipientMapping?.resolveVerifiedRecipient || resolveVerifiedRecipient)({
        requestId,legacySubjectRef:reserved.legacySubjectRef
      });} catch {throw fail('WITHDRAWAL_RECIPIENT_UNRESOLVED');}
      if(!target||typeof target.email!=='string'||
         target.email!==target.email.trim().toLowerCase()||
         !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)||
         target.mailboxTag!==reserved.mailboxTag||
         target.legacySubjectRef!==reserved.legacySubjectRef)
        throw fail('WITHDRAWAL_RECIPIENT_UNRESOLVED');

      // Identity must be resolved BEFORE creating an immutable provider intent.
      // Otherwise an early unmapped request could permanently consume the
      // one permitted provider mutation before the recipient is known.
      const newIntent=await database.transaction(async client=>{
        const item=await client.query(
          "SELECT v.legacy_subject_ref,v.mailbox_tag FROM newsletter_recovery.withdrawal_verified_evidence v " +
          "WHERE v.request_id=$1 FOR UPDATE OF v",[requestId]
        );
        if(item.rowCount!==1||item.rows[0].legacy_subject_ref!==reserved.legacySubjectRef||
           item.rows[0].mailbox_tag!==reserved.mailboxTag)
          throw fail('WITHDRAWAL_RECIPIENT_UNRESOLVED');
        const inserted=await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_provider_off_intents(request_id,actor_ref) " +
          "VALUES($1,$2) ON CONFLICT(request_id) DO NOTHING RETURNING request_id",
          [requestId,reserved.actorRef]
        );
        return inserted.rowCount===1;
      });
      // An existing intent may mean a timed-out mutation. Inspect its state;
      // NEVER blindly perform the same external side effect a second time.
      if(!newIntent) {
        let existing;
        try {existing=await providerOff.verifyOff(target.email);}catch {
          throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');
        }
        if(existing?.off!==true)throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');
      } else {
        try {const done=await providerOff.ensureOff(target.email);
          if(done?.off!==true)throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');
        } catch {throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');}
      }
      // Independent read-after-write; no success from provider ACK alone.
      let observed;
      try {observed=await providerOff.verifyOff(target.email);}catch {
        throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');
      }
      if(observed?.off!==true)throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');

      return database.transaction(async client=>{
        const locked=await client.query(
          "SELECT request_id FROM newsletter_recovery.withdrawal_requests " +
          "WHERE request_id=$1 FOR UPDATE",[requestId]
        );
        if(locked.rowCount!==1)throw fail('WITHDRAWAL_REQUEST_NOT_FOUND');
        const intent=await client.query(
          "SELECT request_id FROM newsletter_recovery.withdrawal_provider_off_intents WHERE request_id=$1",
          [requestId]
        );
        if(intent.rowCount!==1)throw fail('WITHDRAWAL_PROVIDER_UNCERTAIN');
        const wrote=await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_provider_off_verified(request_id,actor_ref) " +
          "VALUES($1,$2) ON CONFLICT(request_id) DO NOTHING RETURNING request_id",
          [requestId,reserved.actorRef]
        );
        if(wrote.rowCount===1) {
          await client.query(
            "INSERT INTO newsletter_recovery.withdrawal_events " +
            "(request_id,event_kind,actor_ref) VALUES($1,'PROVIDER_OFF_VERIFIED',$2)",
            [requestId,reserved.actorRef]
          );
        }
        // First-party historic consent ledger remains unresolved. Global
        // no-send obligation is NOT cleared, and CONFIRMED is never returned.
        return Object.freeze({
          requestId,state:'PROVIDER_OFF_VERIFIED',
          confirmed:false,firstPartyConsentReconciliation:'PENDING'
        });
      });
    },
    async quarantine({signedToken,requestId,reason}={}) {
      if(!validUuid(requestId)||!REASONS.has(reason))throw new TypeError('Invalid quarantine request');
      return authorized(signedToken,async(client,actor)=>{
        const locked=await client.query(
          "SELECT request_id FROM newsletter_recovery.withdrawal_requests WHERE request_id=$1 FOR UPDATE",
          [requestId]
        );
        if(locked.rowCount!==1)throw fail('WITHDRAWAL_REQUEST_NOT_FOUND');
        const last=await client.query(
          "SELECT event_kind,reason_code FROM newsletter_recovery.withdrawal_events " +
          "WHERE request_id=$1 ORDER BY event_id DESC LIMIT 1",[requestId]
        );
        const state=last.rows[0];
        if(!state||!['RECEIVED','QUARANTINED'].includes(state.event_kind))
          throw fail('WITHDRAWAL_UNKNOWN_STATE');
        if(state.event_kind==='QUARANTINED'&&state.reason_code!==reason)
          throw fail('WITHDRAWAL_QUARANTINE_CONFLICT');
        await audit(client,actor,'QUARANTINE',requestId);
        if(state.event_kind==='RECEIVED'){
          await client.query(
            "INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind,actor_ref,reason_code) " +
            "VALUES ($1,'QUARANTINED',$2,$3)",
            [requestId,actor.operatorRef,reason]
          );
        }
        // A quarantine is NOT a confirmed unsubscribe, and does NOT call Resend.
        return Object.freeze({requestId,state:'QUARANTINED',created:state.event_kind==='RECEIVED'});
      });
    }
  });
}
