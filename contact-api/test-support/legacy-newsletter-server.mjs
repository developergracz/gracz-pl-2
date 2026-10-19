// Offline characterization entrypoint ONLY. Not imported by any runtime module.
// Preserve pre-compromise process/fence tests without a production hold bypass.
import {registerHooks} from 'node:module';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';
if(process.env.NODE_ENV!=='test'||process.env.HOST!=='127.0.0.1')throw new Error('Synthetic test process required');
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
for(const field of ['RESEND_API_BASE','RESEND_ENDPOINT']) {
  const url=new URL(process.env[field]);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw new Error('Loopback provider fixture required');
}
if(process.env.NEWSLETTER_SECRET!=='test-'+'n'.repeat(40)||process.env.NEWSLETTER_CONSENT_HASH_SECRET!=='test-consent-'+'h'.repeat(40))throw new Error('Synthetic keys required');
const heldUrl=new URL('../security/newsletter-recovery-hold.mjs',import.meta.url).href;
const fixtureUrl=new URL('./legacy-newsletter-manager.mjs',import.meta.url).href;
registerHooks({resolve(specifier,context,next){
  const result=next(specifier,context);
  return result.url===heldUrl?{...result,url:fixtureUrl}:result;
}});
await import('../server.mjs');
