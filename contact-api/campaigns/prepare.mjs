// OWNER campaign composition only. No provider calls or subscriber reads here.
// Sending is deliberately unavailable until consent/withdrawal fences and durable
// idempotent dispatch are implemented and separately approved.
const reject = code => Object.assign(new Error(code), {code});
const escapeHtml = value => value.replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);

export function prepareCampaignDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['subject','body','audience'].includes(key)))
    throw reject('invalid_campaign');
  const {subject, body, audience} = raw;
  if (typeof subject !== 'string' || typeof body !== 'string' ||
      subject !== subject.trim() || body !== body.trim() ||
      subject.length < 3 || subject.length > 160 ||
      body.length < 10 || body.length > 20000 ||
      /[\r\n\x00-\x1f\x7f]/.test(subject) ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body) ||
      audience !== 'confirmed_active_new_only')
    throw reject('invalid_campaign');
  return Object.freeze({subject, body, audience});
}

export function previewCampaign(raw) {
  const draft = prepareCampaignDraft(raw);
  const safeBody = escapeHtml(draft.body).replace(/\n/g, '<br>');
  return Object.freeze({
    subject: draft.subject,
    html: '<!doctype html><html lang="pl"><meta charset="utf-8">' +
      '<body style="font-family:Arial,sans-serif;background:#0e1724;color:#fff;padding:24px">' +
      '<h1>gracz<span style="color:#f66">.pl</span></h1><p>' + safeBody + '</p>' +
      '<p>Podgląd kampanii — wiadomość nie została wysłana.</p></body></html>',
    warning: 'PREVIEW_ONLY_NO_SEND'
  });
}

// Fail closed: no integration may treat this module as an enabled sender.
export function dispatchCampaign() {
  throw reject('campaign_dispatch_not_enabled');
}
