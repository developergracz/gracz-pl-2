/** Bounded drain; a hard deadline never clears durable send reservations. */
export function installShutdown({server,newsletter,database,signals=process,exit=code=>process.exit(code),timeoutMs=25000,logger=console}) {
  let stopping=false;
  async function shutdown() {
    if(stopping)return;
    stopping=true;
    newsletter.stopAccepting();
    const deadline=setTimeout(()=>{
      logger.error('[shutdown] deadline exceeded',{code:'API_DRAIN_TIMEOUT'});
      server.closeAllConnections?.();
      exit(1);
    },Math.max(50,Math.min(Number(timeoutMs)||25000,25000)));
    try {
      const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      server.closeIdleConnections?.();
      await Promise.all([closed,newsletter.waitForPublicWork()]);
      await database.close();
      clearTimeout(deadline);
      exit(0);
    }catch {
      clearTimeout(deadline);
      logger.error('[shutdown] drain failed',{code:'API_DRAIN_FAILED'});
      exit(1);
    }
  }
  signals.on('SIGTERM',shutdown);
  signals.on('SIGINT',shutdown);
  return {get stopping(){return stopping;},shutdown};
}
