import { readFile } from 'node:fs/promises';

// Test-only candidate installation. Production migrator never scans candidates/.
export async function applyNewsletterCandidate(database, connectionString) {
  // Authorization comes from the actual driver's effective connection, never a
  // second caller-provided URL or the server's Docker bridge address.
  const identity = await database.getConnectionIdentity?.();
  if (!identity || !['127.0.0.1', '::1', 'localhost'].includes(identity.host) || identity.database !== 'gracz_test') {
    throw new Error('Disposable DB connection identity mismatch');
  }
  const result = await database.query('SELECT current_database() AS name');
  if (result.rows[0]?.name !== 'gracz_test') throw new Error('Disposable DB identity mismatch');
  if((await database.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name)return;
  const sql=await readFile(new URL('../persistence/candidates/005_newsletter_opt_in_requests.sql',import.meta.url),'utf8');
  await database.transaction(client=>client.query(sql));
}
