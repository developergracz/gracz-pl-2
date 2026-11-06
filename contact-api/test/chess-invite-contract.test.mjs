import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChessInviteSchedule} from '../auth/chess-invite-contract.mjs';
const now=Date.parse('2026-11-06T20:00:00.000Z');
const date=new Date(now+2*86400000).toISOString();
test('Chess invites: immediate session stays immediate with no reminder metadata',()=>{
 assert.deepEqual(validateChessInviteSchedule({game:'szachy'},now),{scheduledAt:null,message:'',sendReminder:false});
 assert.equal(validateChessInviteSchedule({game:'szachy',message:'surprise'},now).error,'TERMIN_WYMAGANY');
});
test('Chess invites: validates offline scheduled time, message and reminder',()=>{
 assert.deepEqual(validateChessInviteSchedule({game:'szachy',scheduledAt:date,message:'  Zapraszam!  ',sendReminder:true},now),
  {scheduledAt:date,message:'Zapraszam!',sendReminder:true});
 for(const value of [new Date(now-1000).toISOString(),new Date(now+60000).toISOString(),
   new Date(now+31*86400000).toISOString(),'2026-11-31T20:00:00.000Z','2026-11-06','bad']){
  assert.equal(validateChessInviteSchedule({game:'szachy',scheduledAt:value},now).error,'BLEDNY_TERMIN');
 }
 assert.equal(validateChessInviteSchedule({game:'warcaby',scheduledAt:date},now).error,'BLEDNY_TERMIN');
 assert.equal(validateChessInviteSchedule({game:'szachy',scheduledAt:date,message:'a'.repeat(281)},now).error,'BLEDNA_WIADOMOSC');
 assert.equal(validateChessInviteSchedule({game:'szachy',scheduledAt:date,message:'\x00'},now).error,'BLEDNA_WIADOMOSC');
 assert.equal(validateChessInviteSchedule({game:'szachy',scheduledAt:date,sendReminder:'yes'},now).error,'BLEDNY_TERMIN');
});
