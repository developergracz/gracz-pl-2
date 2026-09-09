function positive(name,fallback){const n=Number(__ENV[name]||fallback);return Number.isFinite(n)&&n>0?Math.floor(n):fallback}
export function profile(){
  const vus=Math.max(1,Number(__ENV.WAVE_B_VUS||100));
  const warmup=positive('WAVE_B_WARMUP_SECONDS',120),steady=positive('WAVE_B_STEADY_SECONDS',300),cooldown=positive('WAVE_B_COOLDOWN_SECONDS',120);
  return {vus,warmup,steady,cooldown,scenarios:{
    warmup:{executor:'ramping-vus',startVUs:0,stages:[{duration:`${warmup}s`,target:vus}],gracefulRampDown:'5s'},
    steady:{executor:'constant-vus',vus,duration:`${steady}s`,startTime:`${warmup}s`,gracefulStop:'10s'},
    cooldown:{executor:'ramping-vus',startVUs:vus,stages:[{duration:`${cooldown}s`,target:0}],startTime:`${warmup+steady}s`,gracefulRampDown:'5s'},
  }};
}
