import assert from "node:assert/strict";
import test from "node:test";
import { AccountError, MemoryAccountService } from "../src/accounts.js";

test("account registration stores password hash and authenticates", async () => {
  const accounts = new MemoryAccountService();
  const user = await accounts.register({ userId: "Alice_1", displayName: "Alicja", password: "very-secret-123" });
  assert.deepEqual(user, { userId: "alice_1", displayName: "Alicja" });
  assert.deepEqual(await accounts.authenticate({ userId: "ALICE_1", password: "very-secret-123" }), user);
});

test("wrong password and duplicate account are rejected", async () => {
  const accounts = new MemoryAccountService();
  await accounts.register({ userId: "alice", displayName: "Alicja", password: "very-secret-123" });
  await assert.rejects(() => accounts.authenticate({ userId: "alice", password: "wrong-password" }), AccountError);
  await assert.rejects(() => accounts.register({ userId: "alice", displayName: "Inna", password: "another-secret" }), (error) => error.code === "ACCOUNT_EXISTS");
});
