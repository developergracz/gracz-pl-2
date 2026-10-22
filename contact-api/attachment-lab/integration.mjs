// Explicit, fail-closed integration seam for OWNER attachment modules.
// The manual GitHub lab tests tools in isolation; they are NOT Render services.
// A future production rollout must replace this policy under separate owner approval.
const CAPABILITIES=Object.freeze({
  mode:'prepared_disabled',
  uploadsEnabled:false,
  scanningEnabled:false,
  conversionEnabled:false,
  sendingEnabled:false,
  scanner:Object.freeze({engine:'clamav',interfaceReady:true,enabled:false}),
  converter:Object.freeze({
    engines:Object.freeze(['imagemagick','pandoc','ghostscript']),
    interfaceReady:true,enabled:false
  })
});
export function getAttachmentCapabilities(){return CAPABILITIES;}
function disabled(){
  const err=new Error('Attachment processing is disabled on gracz.pl');
  err.code='ATTACHMENTS_DISABLED';
  err.status=503;
  return err;
}
// Both integration interfaces reject all data before attempting any I/O.
// They do not read, serialize, transform, persist or transmit file contents.
export async function scanAttachment(){throw disabled();}
export async function convertAttachment(){throw disabled();}
export async function sendAttachment(){throw disabled();}
