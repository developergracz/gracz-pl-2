import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { MessageAttachmentService } from "../src/message-attachments.js";
import { PostgresAuthSessionStore } from "../src/auth-sessions.js";
import { PostgresAccountService } from "../src/postgres-accounts.js";
import { SecureAccountService } from "../src/secure-accounts.js";
import poolBudget from "../src/postgres-pool-budget.cjs";

const {
  POSTGRES_RESOURCE_PROFILE,
  aggregatePoolMax,
  aggregateEmbeddedPersistentListeners,
  aggregateExternalPersistentClients,
  aggregateStartupTemporaryClients,
  connectionBudgetPlan,
  configuredPoolBudget,
} = poolBudget;

const DATABASE_URL = process.env.B1_C34_DATABASE_URL || "";
const MESSAGE_SECRET = "b1-c34-message-encryption-secret-material-2026";
const ATTACHMENT_SECRET = "b1-c34-attachment-encryption-secret-material-2026";
const USER_A = "c34alice";
const USER_B = "c34bob";
const USER_C = "c34mallory";
const PASSWORD = "C34-Strong-Password!2026";

const PNG = Buffer.from([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x43,0x33,0x34,0x2d,0x50,0x4e,0x47,0x21,
]);

test("B1-C34 static borrower contract removes MessageAttachment physical PostgreSQL ownership", async () => {
  const source = await readFile(new URL("../src/message-attachments.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /from\s+["']pg["']/);
  assert.doesNotMatch(source, /new\s+Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+Client\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Client\s*\(/);
  assert.doesNotMatch(source, /this\.pool\.end\s*\(/);
  assert.match(source, /this\.pool\s*=\s*pool/);
  assert.match(source, /POSTGRES_MESSAGE_ATTACHMENT_POOL_REQUIRED/);
  assert.match(source, /const MAX_ATTACHMENT_BYTES=1024\*1024;/);
  assert.match(source, /new Set\(\["image\/png","image\/jpeg"\]\)/);

  assert.throws(
    () => new MessageAttachmentService(undefined, ATTACHMENT_SECRET, { legacyEncryptionSecret: null }),
    (error) => error?.code === "POSTGRES_MESSAGE_ATTACHMENT_POOL_REQUIRED",
  );
  assert.throws(
    () => new MessageAttachmentService({}, ATTACHMENT_SECRET, { legacyEncryptionSecret: null }),
    (error) => error?.code === "POSTGRES_MESSAGE_ATTACHMENT_POOL_REQUIRED",
  );

  const accountReadyIndex = main.indexOf("if(config.databaseUrl&&baseAccounts.ready)await baseAccounts.ready;");
  const attachmentIndex = main.indexOf("new MessageAttachmentService(baseAccounts.pool,config.attachmentEncryptionKey)");
  assert.ok(accountReadyIndex >= 0 && attachmentIndex > accountReadyIndex, "MessageAttachment initialization must remain after PostgresAccountService.ready");
  assert.doesNotMatch(main, /new MessageAttachmentService\(config\.databaseUrl,/);

  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.length, 14);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "message-attachments"), false);
  assert.equal(aggregatePoolMax(), 48);
  assert.equal(aggregateEmbeddedPersistentListeners(), 3);
  assert.equal(aggregateExternalPersistentClients(), 1);
  assert.equal(aggregateStartupTemporaryClients(), 1);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "64" }), 48);
  assert.throws(
    () => configuredPoolBudget({ POSTGRES_POOL_BUDGET: "47" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED",
  );

  const expected = [
    [1, 49, 50, true],
    [2, 98, 100, false],
    [3, 147, 150, false],
    [4, 196, 200, false],
  ];
  for (const [replicaCount, steadyEnvelope, startupEnvelope, safe] of expected) {
    const plan = connectionBudgetPlan({
      replicaCount,
      maxConnections: 100,
      reservedConnections: 0,
      superuserReservedConnections: 3,
      environment: { POSTGRES_POOL_BUDGET: "64" },
    });
    assert.equal(plan.poolMaxPerReplica, 48);
    assert.equal(plan.externalDedicatedPerReplica, 1);
    assert.equal(plan.startupOverlapPerReplica, 1);
    assert.equal(plan.steadyEnvelope, steadyEnvelope);
    assert.equal(plan.startupEnvelope, startupEnvelope);
    assert.equal(plan.safeApplicationCapacity, 87);
    assert.equal(plan.safe, safe);
  }
});

test("B1-C34 real PostgreSQL shared account pool preserves attachment semantics concurrency and shutdown", { skip: !DATABASE_URL, timeout: 30_000 }, async () => {
  let base = null;
  let ownerClosed = false;
  try {
    const allocatedBefore = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    base = new PostgresAccountService(DATABASE_URL, MESSAGE_SECRET, { legacyEncryptionSecret: null });
    const allocatedAfterBase = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    assert.equal(allocatedAfterBase - allocatedBefore, 5);
    assert.equal(base.pool.options.max, 5);
    await base.ready;

    const secured = new SecureAccountService(base);
    await secured.ready;
    const authSessions = new PostgresAuthSessionStore(base.pool);
    await authSessions.ready;
    const messageAttachments = new MessageAttachmentService(base.pool, ATTACHMENT_SECRET, { legacyEncryptionSecret: null });
    await messageAttachments.ready;

    assert.equal(secured.pool, base.pool);
    assert.equal(authSessions.pool, base.pool);
    assert.equal(messageAttachments.pool, base.pool);
    assert.equal(Number(pg.Pool.graczAllocatedPoolMax ?? 0), allocatedAfterBase, "MessageAttachmentService must allocate no second pool");

    await base.pool.query("DELETE FROM gracz_auth_sessions WHERE user_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);
    await base.pool.query("DELETE FROM gracz_messages WHERE sender_id = ANY($1::text[]) OR recipient_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);

    await base.register({ userId: USER_A, displayName: "C34 Alicja", password: PASSWORD });
    await base.register({ userId: USER_B, displayName: "C34 Bob", password: PASSWORD });
    await base.register({ userId: USER_C, displayName: "C34 Mallory", password: PASSWORD });

    const message = await base.sendPrivateMessage(USER_A, { recipientId: USER_B, subject: "C34 attachment", body: "Shared pool attachment proof" });
    const saved = await messageAttachments.save(USER_A, message.messageId, {
      fileName: "proof.png",
      mimeType: "image/png",
      data: PNG.toString("base64"),
    });
    assert.equal(saved.messageId, message.messageId);
    assert.equal(saved.fileName, "proof.png");
    assert.equal(saved.mimeType, "image/png");
    assert.equal(saved.fileSize, PNG.length);

    const raw = (await base.pool.query(
      "SELECT storage_name,iv,auth_tag,ciphertext,file_size FROM gracz_message_attachments WHERE message_id=$1",
      [message.messageId],
    )).rows[0];
    assert.ok(raw.storage_name);
    assert.equal(raw.file_size, PNG.length);
    assert.ok(Buffer.isBuffer(raw.iv) && raw.iv.length === 12);
    assert.ok(Buffer.isBuffer(raw.auth_tag) && raw.auth_tag.length === 16);
    assert.notDeepEqual(raw.ciphertext, PNG, "database payload must remain encrypted");

    const metadata = await messageAttachments.getMetaForMessages([message.messageId]);
    assert.deepEqual(metadata.get(message.messageId), {
      fileName: "proof.png",
      mimeType: "image/png",
      fileSize: PNG.length,
    });

    const bySender = await messageAttachments.get(USER_A, message.messageId);
    const byRecipient = await messageAttachments.get(USER_B, message.messageId);
    assert.equal(bySender.data, PNG.toString("base64"));
    assert.equal(byRecipient.data, PNG.toString("base64"));
    assert.equal(Buffer.from(bySender.data, "base64").equals(PNG), true);

    await assert.rejects(
      () => messageAttachments.get(USER_C, message.messageId),
      (error) => error?.code === "MESSAGE_NOT_FOUND",
    );
    await assert.rejects(
      () => messageAttachments.save(USER_A, message.messageId, { fileName:"replacement.png", mimeType:"image/png", data:PNG.toString("base64") }),
      (error) => error?.code === "INVALID_ATTACHMENT",
    );

    const invalidMimeMessage = await base.sendPrivateMessage(USER_A, { recipientId: USER_B, subject: "mime", body: "mime rule" });
    await assert.rejects(
      () => messageAttachments.save(USER_A, invalidMimeMessage.messageId, { fileName:"bad.gif", mimeType:"image/gif", data:PNG.toString("base64") }),
      (error) => error?.code === "INVALID_ATTACHMENT",
    );

    const invalidSignatureMessage = await base.sendPrivateMessage(USER_A, { recipientId: USER_B, subject: "signature", body: "signature rule" });
    await assert.rejects(
      () => messageAttachments.save(USER_A, invalidSignatureMessage.messageId, { fileName:"bad.png", mimeType:"image/png", data:Buffer.from("not-a-png-file").toString("base64") }),
      (error) => error?.code === "INVALID_ATTACHMENT",
    );

    const oversizedMessage = await base.sendPrivateMessage(USER_A, { recipientId: USER_B, subject: "size", body: "size rule" });
    const oversized = Buffer.alloc(1024*1024+1);
    oversized.set(PNG.subarray(0,8),0);
    await assert.rejects(
      () => messageAttachments.save(USER_A, oversizedMessage.messageId, { fileName:"too-big.png", mimeType:"image/png", data:oversized.toString("base64") }),
      (error) => error?.code === "INVALID_ATTACHMENT",
    );

    const readMessage = await base.sendPrivateMessage(USER_A, { recipientId: USER_B, subject: "read", body: "read-state rule" });
    await base.pool.query("UPDATE gracz_messages SET read_at=NOW() WHERE message_id=$1", [readMessage.messageId]);
    await assert.rejects(
      () => messageAttachments.save(USER_A, readMessage.messageId, { fileName:"late.png", mimeType:"image/png", data:PNG.toString("base64") }),
      (error) => error?.code === "INVALID_ATTACHMENT",
    );

    const tokenId = randomUUID();
    const expiresAt = Math.floor(Date.now()/1000)+3600;
    await authSessions.create({ tokenId, userId: USER_A, expiresAt });

    const samples=[];
    const sampler=setInterval(()=>samples.push(base.pool.totalCount),1);
    try {
      await Promise.all(Array.from({length:80},(_,index)=>{
        switch(index%4){
          case 0: return base.getProfile(USER_A);
          case 1: return secured.checkAvailability({userId:USER_A,displayName:"C34 Alicja"});
          case 2: return authSessions.assertActive({tokenId,userId:USER_A,expiresAt});
          default: return messageAttachments.get(USER_B,message.messageId);
        }
      }));
    } finally {
      clearInterval(sampler);
      samples.push(base.pool.totalCount);
    }
    assert.ok(samples.every(count=>count<=5), "canonical shared pool exceeded max=5: "+samples.join(","));
    assert.equal((await base.getProfile(USER_A)).userId,USER_A);
    assert.equal(await authSessions.has(tokenId),true);
    assert.equal((await messageAttachments.get(USER_B,message.messageId)).data,PNG.toString("base64"));

    await base.pool.query("DELETE FROM gracz_auth_sessions WHERE user_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);
    await base.pool.query("DELETE FROM gracz_messages WHERE sender_id = ANY($1::text[]) OR recipient_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id = ANY($1::text[])", [[USER_A,USER_B,USER_C]]);
    await new Promise(resolve=>setTimeout(resolve,20));

    assert.equal(base.pool.waitingCount,0);
    assert.equal(base.pool.totalCount-base.pool.idleCount,0,"all shared clients must be released before shutdown");

    const physicalPool=base.pool;
    const originalEnd=physicalPool.end.bind(physicalPool);
    let poolEndCount=0;
    physicalPool.end=(...args)=>{poolEndCount+=1;return originalEnd(...args);};

    await messageAttachments.close();
    await messageAttachments.close();
    assert.equal(poolEndCount,0,"MessageAttachment borrower close must not end canonical pool");
    assert.equal((await physicalPool.query("SELECT 1 AS ok")).rows[0].ok,1);

    await authSessions.close();
    assert.equal(poolEndCount,0,"AuthSession borrower close must remain non-owning");

    await base.close();
    ownerClosed=true;
    assert.equal(poolEndCount,1,"PostgresAccountService owner must end canonical pool exactly once");
    assert.equal(physicalPool.totalCount,0);
    assert.equal(physicalPool.waitingCount,0);
  } finally {
    if(!ownerClosed&&base) await base.close().catch(()=>{});
  }
});
