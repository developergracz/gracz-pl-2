import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import test from "node:test";
import pg from "pg";

import { PostgresAccountService } from "../src/postgres-accounts.js";
import { MessageAttachmentService } from "../src/message-attachments.js";
import { MfaService } from "../src/mfa-service.js";

const { Pool } = pg;
const DATABASE_URL = process.env.P1_AUD3_03_DATABASE_URL || "";
const AUTH = "auth-secret-material-postgres-aud303-0001";
const MESSAGE = "message-dedicated-material-postgres-0001";
const ATTACHMENT = "attachment-dedicated-material-postgres-01";
const MFA = "mfa-dedicated-material-postgres-aud303-001";
const WRONG = "wrong-key-material-postgres-aud303-000001";
const WRONG2 = "second-wrong-key-material-aud303-postgres-01";
const USERS = ["aud303alice", "aud303bob", "aud303carol"];
const PNG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,0,0,0,0]);

test("P1-AUD3-03 real PostgreSQL dual-read/single-write persistence and restart", { skip: !DATABASE_URL }, async () => {
  const admin = new Pool({ connectionString: DATABASE_URL, ssl: sslFor(DATABASE_URL), max: 1 });
  const events = [];
  const audit = { record(event) { events.push(event); return Promise.resolve(event); } };
  let legacyMessages, currentMessages, legacyAttachments, currentAttachments, legacyMfa, currentMfa;
  try {
    await cleanup(admin);

    legacyMessages = new PostgresAccountService(DATABASE_URL, AUTH, { legacyEncryptionSecret: null });
    await legacyMessages.ready;
    await legacyMessages.register({ userId: USERS[0], displayName: "AUD303 Alice", password: "Audit303-Alice-pass!" });
    await legacyMessages.register({ userId: USERS[1], displayName: "AUD303 Bob", password: "Audit303-Bob-pass!" });
    await legacyMessages.register({ userId: USERS[2], displayName: "AUD303 Carol", password: "Audit303-Carol-pass!" });
    const legacyMessage = await legacyMessages.sendPrivateMessage(USERS[0], { recipientId: USERS[1], subject: "legacy subject", body: "legacy body" });
    await legacyMessages.close(); legacyMessages = null;

    currentMessages = new PostgresAccountService(DATABASE_URL, MESSAGE, { legacyEncryptionSecret: AUTH, audit });
    await currentMessages.ready;
    const currentMessage = await currentMessages.sendPrivateMessage(USERS[0], { recipientId: USERS[2], subject: "current subject", body: "current body" });
    const rawCurrent = (await currentMessages.pool.query("SELECT subject,body FROM gracz_messages WHERE message_id=$1", [currentMessage.messageId])).rows[0];
    assert.match(rawCurrent.subject, /^enc:v1:/);
    assert.equal(decryptMessage(rawCurrent.subject, MESSAGE, currentMessage.messageId, "subject"), "current subject");
    assert.throws(() => decryptMessage(rawCurrent.subject, AUTH, currentMessage.messageId, "subject"));

    const beforeCurrentRead = events.length;
    const carolInbox = await currentMessages.listPrivateMessages(USERS[2], "inbox");
    assert.equal(carolInbox.messages.find(m => m.messageId === currentMessage.messageId)?.body, "current body");
    assert.equal(events.length, beforeCurrentRead, "dedicated decrypt must not use legacy fallback");

    const bobInbox = await currentMessages.listPrivateMessages(USERS[1], "inbox");
    assert.equal(bobInbox.messages.find(m => m.messageId === legacyMessage.messageId)?.subject, "legacy subject");
    assert.ok(events.some(event => event.eventType === "crypto.legacy_decrypt" && event.metadata?.domain === "messages"));

    const wrongMessages = new PostgresAccountService(DATABASE_URL, WRONG, { legacyEncryptionSecret: WRONG2 });
    await wrongMessages.ready;
    const wrongInbox = await wrongMessages.listPrivateMessages(USERS[2], "inbox");
    assert.equal(wrongInbox.messages.find(m => m.messageId === currentMessage.messageId)?.body, "[Nie można odszyfrować tej wiadomości]");
    await wrongMessages.close();

    legacyAttachments = new MessageAttachmentService(DATABASE_URL, AUTH, { legacyEncryptionSecret: null });
    await legacyAttachments.ready;
    await legacyAttachments.save(USERS[0], legacyMessage.messageId, { fileName: "legacy.png", mimeType: "image/png", data: PNG.toString("base64") });
    await legacyAttachments.close(); legacyAttachments = null;

    currentAttachments = new MessageAttachmentService(DATABASE_URL, ATTACHMENT, { legacyEncryptionSecret: AUTH, audit });
    await currentAttachments.ready;
    await currentAttachments.save(USERS[0], currentMessage.messageId, { fileName: "current.png", mimeType: "image/png", data: PNG.toString("base64") });
    const rawAttachment = (await currentAttachments.pool.query("SELECT storage_name,mime_type,file_size,iv,auth_tag,ciphertext FROM gracz_message_attachments WHERE message_id=$1", [currentMessage.messageId])).rows[0];
    const currentAad = `${currentMessage.messageId}:${rawAttachment.storage_name}:${rawAttachment.mime_type}:${rawAttachment.file_size}`;
    assert.deepEqual(decryptGcm(rawAttachment, derive(ATTACHMENT, "gracz.pl/message-attachments/v1", "private-message-attachment-encryption"), currentAad), PNG);
    assert.throws(() => decryptGcm(rawAttachment, derive(AUTH, "gracz.pl/message-attachments/v1", "private-message-attachment-encryption"), currentAad));

    const beforeAttachmentRead = events.length;
    assert.equal((await currentAttachments.get(USERS[2], currentMessage.messageId)).data, PNG.toString("base64"));
    assert.equal(events.length, beforeAttachmentRead, "dedicated attachment decrypt must not use legacy fallback");
    assert.equal((await currentAttachments.get(USERS[1], legacyMessage.messageId)).data, PNG.toString("base64"));
    assert.ok(events.some(event => event.eventType === "crypto.legacy_decrypt" && event.metadata?.domain === "attachments"));

    const legacyAadMessage = await currentMessages.sendPrivateMessage(USERS[0], { recipientId: USERS[1], subject: "legacy aad", body: "legacy aad attachment" });
    const legacyAadKey = derive(AUTH, "gracz.pl/message-attachments/v1", "private-message-attachment-encryption");
    const legacyAad = `${legacyAadMessage.messageId}:image/png:${PNG.length}`;
    const legacyEnvelope = encryptGcm(PNG, legacyAadKey, legacyAad);
    await currentAttachments.pool.query(
      `INSERT INTO gracz_message_attachments(message_id,file_name,storage_name,mime_type,file_size,iv,auth_tag,ciphertext) VALUES($1,$2,NULL,$3,$4,$5,$6,$7)`,
      [legacyAadMessage.messageId, "legacy-aad.png", "image/png", PNG.length, legacyEnvelope.iv, legacyEnvelope.tag, legacyEnvelope.ciphertext],
    );
    assert.equal((await currentAttachments.get(USERS[1], legacyAadMessage.messageId)).data, PNG.toString("base64"));

    const wrongAttachments = new MessageAttachmentService(DATABASE_URL, WRONG, { legacyEncryptionSecret: WRONG2 });
    await wrongAttachments.ready;
    await assert.rejects(() => wrongAttachments.get(USERS[2], currentMessage.messageId), /odszyfrować załącznika/);
    await assert.rejects(() => wrongAttachments.get(USERS[1], legacyMessage.messageId), /odszyfrować załącznika/);
    await wrongAttachments.close();

    legacyMfa = new MfaService(DATABASE_URL, { encryptionSecret: AUTH, legacyEncryptionSecret: null });
    await legacyMfa.ready;
    const legacyMfaCreated = await legacyMfa.begin(USERS[0]);
    await legacyMfa.close(); legacyMfa = null;

    currentMfa = new MfaService(DATABASE_URL, { encryptionSecret: MFA, legacyEncryptionSecret: AUTH, audit });
    await currentMfa.ready;
    const legacyMfaRecord = await currentMfa.getRecord(USERS[0]);
    assert.equal(currentMfa.decrypt(legacyMfaRecord, USERS[0]), legacyMfaCreated.secret);
    assert.ok(events.some(event => event.eventType === "crypto.legacy_decrypt" && event.metadata?.domain === "mfa"));

    const newMfaCreated = await currentMfa.begin(USERS[2]);
    const newMfaRecord = await currentMfa.getRecord(USERS[2]);
    assert.equal(currentMfa.decrypt(newMfaRecord, USERS[2]), newMfaCreated.secret);
    const authOnlyMfa = new MfaService(null, { encryptionSecret: AUTH, legacyEncryptionSecret: null });
    assert.throws(() => authOnlyMfa.decrypt(newMfaRecord, USERS[2]), /MFA_DECRYPT_FAILED|odszyfrować/);
    await authOnlyMfa.close();
    const wrongMfa = new MfaService(null, { encryptionSecret: WRONG, legacyEncryptionSecret: WRONG2 });
    assert.throws(() => wrongMfa.decrypt(newMfaRecord, USERS[2]), /MFA_DECRYPT_FAILED|odszyfrować/);
    await wrongMfa.close();

    const leaked = JSON.stringify(events);
    for (const forbidden of [AUTH, MESSAGE, ATTACHMENT, MFA, "legacy body", "current body", legacyMfaCreated.secret, newMfaCreated.secret, rawAttachment.ciphertext.toString("base64")]) {
      assert.equal(leaked.includes(forbidden), false, `observability leaked forbidden material: ${forbidden.slice(0, 8)}`);
    }
    assert.ok(events.every(event => event.eventType !== "crypto.legacy_decrypt" || ["messages", "attachments", "mfa"].includes(event.metadata?.domain)));

    await currentMessages.close(); currentMessages = null;
    await currentAttachments.close(); currentAttachments = null;
    await currentMfa.close(); currentMfa = null;

    const restartedMessages = new PostgresAccountService(DATABASE_URL, MESSAGE, { legacyEncryptionSecret: AUTH });
    const restartedAttachments = new MessageAttachmentService(DATABASE_URL, ATTACHMENT, { legacyEncryptionSecret: AUTH });
    const restartedMfa = new MfaService(DATABASE_URL, { encryptionSecret: MFA, legacyEncryptionSecret: AUTH });
    try {
      await Promise.all([restartedMessages.ready, restartedAttachments.ready, restartedMfa.ready]);
      const restartedCarol = await restartedMessages.listPrivateMessages(USERS[2], "inbox");
      const restartedBob = await restartedMessages.listPrivateMessages(USERS[1], "inbox");
      assert.equal(restartedCarol.messages.find(m => m.messageId === currentMessage.messageId)?.body, "current body");
      assert.equal(restartedBob.messages.find(m => m.messageId === legacyMessage.messageId)?.body, "legacy body");
      assert.equal((await restartedAttachments.get(USERS[2], currentMessage.messageId)).data, PNG.toString("base64"));
      assert.equal((await restartedAttachments.get(USERS[1], legacyMessage.messageId)).data, PNG.toString("base64"));
      assert.equal(restartedMfa.decrypt(await restartedMfa.getRecord(USERS[0]), USERS[0]), legacyMfaCreated.secret);
      assert.equal(restartedMfa.decrypt(await restartedMfa.getRecord(USERS[2]), USERS[2]), newMfaCreated.secret);
    } finally {
      await restartedMessages.close();
      await restartedAttachments.close();
      await restartedMfa.close();
    }
  } finally {
    await legacyMessages?.close().catch(() => {});
    await currentMessages?.close().catch(() => {});
    await legacyAttachments?.close().catch(() => {});
    await currentAttachments?.close().catch(() => {});
    await legacyMfa?.close().catch(() => {});
    await currentMfa?.close().catch(() => {});
    await cleanup(admin).catch(() => {});
    await admin.end().catch(() => {});
  }
});

function sslFor(url) { return url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false }; }
async function cleanup(pool) {
  await pool.query("DELETE FROM gracz_mfa WHERE user_id = ANY($1::varchar[])", [USERS]).catch(() => {});
  await pool.query("DELETE FROM gracz_messages WHERE sender_id = ANY($1::varchar[]) OR recipient_id = ANY($1::varchar[])", [USERS]).catch(() => {});
  await pool.query("DELETE FROM gracz_accounts WHERE user_id = ANY($1::varchar[])", [USERS]).catch(() => {});
}
function derive(secret, salt, info) { return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(salt, "utf8"), Buffer.from(info, "utf8"), 32)); }
function decryptMessage(value, secret, messageId, field) {
  const text = String(value);
  const [ivPart, tagPart, cipherPart] = text.slice("enc:v1:".length).split(".");
  return decryptGcm({ iv: Buffer.from(ivPart, "base64url"), auth_tag: Buffer.from(tagPart, "base64url"), ciphertext: Buffer.from(cipherPart, "base64url") }, derive(secret, "gracz.pl/messages/v1", "private-message-encryption"), `${messageId}:${field}`).toString("utf8");
}
function encryptGcm(clear, key, aad) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(clear), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}
function decryptGcm(row, key, aad) {
  const decipher = createDecipheriv("aes-256-gcm", key, row.iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(row.auth_tag ?? row.tag);
  return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]);
}
