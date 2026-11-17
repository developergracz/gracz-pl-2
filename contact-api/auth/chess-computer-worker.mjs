// CHESS-007: run the existing bounded local chess engine off the UI thread.
// Dedicated same-origin module worker; no Stockfish or external service.
import {chooseComputerMove} from '/konto/szachy/computer.mjs';

self.onmessage=event=>{
 const {id,state,level,maxMs}=event.data||{};
 if(!Number.isSafeInteger(id)||id<1)return;
 try{
  const move=chooseComputerMove(state,{level,maxMs});
  self.postMessage({id,move});
 }catch{
  self.postMessage({id,error:'COMPUTER_WORKER_FAILURE'});
 }
};
