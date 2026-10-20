// Resend transport outcome classifier; NO network calls, credentials or sender.
// A non-2xx response is not proof of non-delivery. Never automatically retry.
export function classifyResendResult({status,body}={}) {
  const accepted=Number.isInteger(status)&&status>=200&&status<300&&
    body!==null&&typeof body==='object'&&!Array.isArray(body)&&
    typeof body.id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(body.id);
  return Object.freeze({
    state:accepted?'accepted':'uncertain',
    providerMessageId:accepted?body.id:null,
    retryAllowed:false
  });
}
export function classifyResendFailure() {
  return Object.freeze({state:'uncertain',providerMessageId:null,retryAllowed:false});
}
