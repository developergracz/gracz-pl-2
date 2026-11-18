// Warcaby: pure, two-party consent transition. Match authorization, version CAS,
// room ownership and notification are enforced by the existing /auth/match route.
import {randomUUID} from 'node:crypto';

export function applyCheckersDrawAgreement(state,player,action,offerId=null,
  createId=randomUUID,now=()=>new Date().toISOString()){
  if(!state||state.winner)return {error:'PARTIA_ZAKONCZONA'};
  if(player!==1&&player!==2)return {error:'BRAK_GRACZA'};
  const pending=state.drawOffer;
  const next={...state};
  if(action==='offerDraw'){
    if(pending)return {error:'PROPOZYCJA_JUZ_ISTNIEJE'};
    if(!Number.isInteger(next.moves)||next.moves<1)return {error:'PARTIA_NIE_ROZPOCZETA'};
    next.drawOffer={id:createId(),requester:player,createdAt:now()};
  }else if(['acceptDraw','rejectDraw','cancelDraw'].includes(action)){
    if(!pending||typeof pending.id!=='string'||pending.id!==offerId)
      return {error:'PROPOZYCJA_NIEAKTUALNA'};
    if(action==='cancelDraw'&&pending.requester!==player)
      return {error:'NIE_TWOJA_PROPOZYCJA'};
    if(action!=='cancelDraw'&&pending.requester===player)
      return {error:'BRAK_ZGODY_PRZECIWNIKA'};
    delete next.drawOffer;
    if(action==='acceptDraw'){
      next.winner=3;next.drawReason='ZGODA_GRACZY';
      if(next.clock)next.clock={...next.clock,since:null};
    }
  }else return {error:'BLEDNA_AKCJA'};
  return {state:next};
}
