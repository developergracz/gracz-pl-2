// Used only through guarded legacy-newsletter-server.mjs in synthetic process tests.
import {createNewsletterManager} from '../newsletter.mjs';
import {createDatabase} from '../persistence/database.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createNewsletterProofStore} from '../persistence/newsletter-proof-store.mjs';
import {parseNewsletterIntakePaused} from '../newsletter-config.mjs';
export function createHeldNewsletterManager(){
  const database=createDatabase();
  const manager=createNewsletterManager({
    intakePaused:parseNewsletterIntakePaused(process.env.NEWSLETTER_INTAKE_PAUSED),
    secret:process.env.NEWSLETTER_SECRET,consentHashSecret:process.env.NEWSLETTER_CONSENT_HASH_SECRET,
    resendApiKey:process.env.NEWSLETTER_RESEND_API_KEY,resendApiBase:process.env.RESEND_API_BASE,
    emailEndpoint:process.env.RESEND_ENDPOINT,emailFrom:process.env.EMAIL_FROM,replyTo:process.env.CONTACT_TO,
    consentStore:createPersistenceRepositories(database).newsletter,proofStore:createNewsletterProofStore(database),
  });
  const wait=manager.waitForPublicWork;
  return {...manager,waitForPublicWork:async()=>{await wait();await database.close();}};
}
