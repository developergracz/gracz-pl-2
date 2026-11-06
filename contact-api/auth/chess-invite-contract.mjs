// Validates an optional scheduled invitation for Chess Online. No timezone guessing:
// browsers send an absolute ISO timestamp from the player's local date/time.
const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export function validateChessInviteSchedule(body,now=Date.now()){
 const scheduledAt=body?.scheduledAt;
 const note=body?.message===undefined?'':body.message;
 const reminder=body?.sendReminder===undefined?false:body.sendReminder;
 if(scheduledAt===undefined||scheduledAt===null||scheduledAt===''){
  if(note!==''||reminder!==false)return {error:'TERMIN_WYMAGANY'};
  return {scheduledAt:null,message:'',sendReminder:false};
 }
 if(body?.game!=='szachy'||typeof scheduledAt!=='string'||!ISO_UTC.test(scheduledAt)||typeof note!=='string'||typeof reminder!=='boolean')
  return {error:'BLEDNY_TERMIN'};
 const time=Date.parse(scheduledAt);
 if(!Number.isFinite(time)||new Date(time).toISOString()!==scheduledAt||time<now+5*60000||time>now+30*86400000)
  return {error:'BLEDNY_TERMIN'};
 const message=note.trim();
 if(message.length>280||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message))
  return {error:'BLEDNA_WIADOMOSC'};
 return {scheduledAt,message,sendReminder:reminder};
}
