// #280: no legacy key, ledger, provider or configuration dependency is accepted.
// Removing this hold requires a separately reviewed recovery implementation and GO.
export function createHeldNewsletterManager() {
  async function held() {
    throw Object.assign(new Error('Newsletter jest chwilowo niedostępny. Nie potwierdzono zmiany subskrypcji.'), {
      code: 'NEWSLETTER_RECOVERY_HOLD', status: 503,
    });
  }
  return Object.freeze({
    enabled: false,
    consentLedgerConfigured: false,
    intakePaused: true,
    requestOptIn: held, acceptOptIn: held,
    requestStatus: held, acceptStatus: held,
    confirm: held, unsubscribe: held, checkStatus: held,
    readiness: async () => ({ready:false,configured:false,intakePaused:true,schemaReady:false,recoveryHeld:true}),
    stopAccepting() {},
    async waitForPublicWork() {},
  });
}
