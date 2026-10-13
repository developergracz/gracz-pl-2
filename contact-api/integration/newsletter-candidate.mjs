import { readFile } from 'node:fs/promises';
import { assertDisposableDatabaseUrl } from './test-database-guard.mjs';

// Test-only candidate installation. Production migrator never scans candidates/.
export async function applyNewsletterCandidate(database, connectionString) {
  assertDisposableDatabaseUrl(connectionString);
  // Also validate the actual connection: callers cannot substitute a safe URL.
  const result=await database.query("SELECT current_database() AS name, inet_server_addr()::text AS host");
  if(result.rows[0]?.name!=='gracz_test'||!['127.0.0.1','::1','172.17.0.2'].includes(result.rows[0]?.host)) {
    // Docker bridge server addresses vary. The guarded connection is loopback;
    // require actual DB name and a private address, never a public DB host.
    if(result.rows[0]?.name!=='gracz_test'||!/^172\.(1[6-9]|2\d|3[01])\./.test(result.rows[0]?.host||''))throw new Error('Disposable DB identity mismatch');
  }
  if((await database.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name)return;
  const sql=await readFile(new URL('../persistence/candidates/005_newsletter_opt_in_requests.sql',import.meta.url),'utf8');
  await database.transaction(client=>client.query(sql));
}
