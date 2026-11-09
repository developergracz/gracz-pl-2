// Local Warcaby training controller for the existing Gomoku Premium console shell.
// Training does not touch /auth/match, account sessions or remote chat.
import {initialGame,playMove,legalMoves,evaluate,chooseComputerMove} from './checkers-training-ai.mjs';

export function setupTraining(a){
 const $=a.$;
 let mode='online',generation=0,finished=false,recorded=false;
 let clocks={1:0,2:0},lastTick=0,clockStarted=false,snapshots=[],notes=[];
 const storageKey='gracz-warcaby-training-v1';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const current=()=>a.getCurrent();
 function game(){return current()?.state}
 function announce(t){a.message(t)}
 function format(ms){
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 }
 function displayClocks(){
  const online=mode==='online'?game()?.clock:null;
  const timedOnline=online&&Array.isArray(online.remaining)&&online.remaining.length===2;
  const training=mode==='training'&&Number($('training-time').value)>0;
  // White moves first; shared Gomoku clock-1 is black, clock-2 is white.
  for(const [player,id] of [[1,'clock-2'],[2,'clock-1']]){
   $(id).hidden=!training&&!timedOnline;
   if(training)$(id).textContent=format(clocks[player]);
   else if(timedOnline){
    let ms=online.remaining[player-1];
    if(!game().winner&&game().turn===player&&online.ready?.every(Boolean)&&online.since){
     const since=Date.parse(online.since);
     if(Number.isFinite(since))ms-=Math.max(0,Date.now()-since);
    }
    $(id).textContent=format(ms);
   }
  }
 }
 function readStats(){
  try{
   const d=JSON.parse(localStorage.getItem(storageKey)||'{}');
   return {win:Math.max(0,Number(d.win)||0),draw:Math.max(0,Number(d.draw)||0),loss:Math.max(0,Number(d.loss)||0)};
  }catch{return {win:0,draw:0,loss:0}}
 }
 function updateStats(){
  const stats=readStats(),total=stats.win+stats.draw+stats.loss;
  const rate=total?Math.round(stats.win/total*100):0;
  $('record-wins').textContent=stats.win;
  $('record-draws').textContent=stats.draw;
  $('record-losses').textContent=stats.loss;
  $('record-total').textContent=total;
  $('record-rate').textContent=rate+'%';
  $('records-progress-fill').style.width=rate+'%';
  $('records-progress').setAttribute('aria-valuenow',String(rate));
 }
 function addResult(result){
  const stats=readStats();stats[result]++;
  try{localStorage.setItem(storageKey,JSON.stringify(stats))}catch{}
  updateStats();
 }
 function hideResult(){$('game-result-modal').hidden=true}
 function showResult(winner){
  const result=winner===3?'draw':winner===1?'win':'loss';
  const card=$('game-result-modal').querySelector('.result-card');
  card.dataset.result=result;
  $('game-result-title').textContent=result==='win'?'Wygrałeś z komputerem!':result==='loss'?'Przegrałeś z komputerem.':'Partia zakończona remisem.';
  $('game-result-description').textContent='Warcaby · trening lokalny · '+$('ai-level').selectedOptions[0].textContent.trim();
  $('game-result-modal').hidden=false;
  $('game-result-review').focus();
 }
 function finish(){
  if(finished||!game()?.winner)return;
  finished=true;generation++;
  if(!recorded){recorded=true;addResult(game().winner===3?'draw':game().winner===1?'win':'loss')}
  displayClocks();a.renderBoard();showResult(game().winner);
 }
 function tick(){
  if(mode==='online'){displayClocks();return;}
  if(mode!=='training'||finished||!game()||!clockStarted||!Number($('training-time').value))return;
  const now=performance.now(),delta=Math.max(0,now-lastTick);lastTick=now;
  clocks[game().turn]=Math.max(0,clocks[game().turn]-delta);
  if(clocks[game().turn]===0){
   game().winner=3-game().turn;
   announce('Koniec czasu: '+(game().winner===1?'wygrywasz.':'wygrywa komputer.'));
   finish();
  }
  displayClocks();
 }
 function renderNotes(){
  const list=$('chat-messages');list.replaceChildren();
  if(!notes.length){
   const p=document.createElement('p');p.className='dock-empty';
   p.textContent='Napisz do GRACZ AI. Rozmowa nie jest zapisywana na serwerze.';list.append(p);
   $('chat-preview').textContent=p.textContent;
   return;
  }
  for(const note of notes){
   const p=document.createElement('p'),label=document.createElement('strong');label.textContent='Notatka: ';
   p.append(label,document.createTextNode(note));list.append(p);
  }
  $('chat-preview').textContent=notes[notes.length-1];
  list.scrollTop=list.scrollHeight;
 }
 function turnFinished(move,actor){
  if(mode!=='training'||finished||!game())return;
  const before=game(),response=playMove('warcaby',before,actor,move);
  if(response.error){announce(response.error);return}
  // White gets the full thinking time before the first legal move; never start on "New game".
  if(!clockStarted&&actor===1)clockStarted=true;
  if(before.turn!==response.state.turn&&Number($('training-time').value))
   clocks[actor]+=Number($('training-increment').value)*1000;
  const history=[...(before.history||[]),{player:actor,from:move.from,to:move.to}];
  a.setCurrent({type:'training',state:{...response.state,history},players:['Ty','Komputer'],player:1,playable:true});
  a.setSelected(response.state.forced!==null&&response.state.turn===1?response.state.forced:null);
  lastTick=performance.now();
  a.renderBoard();
  if(response.state.winner){finish();return}
  announce(response.state.turn===1?'Twój ruch — wybierz pionek.':'Komputer analizuje ruch…');
  if(response.state.turn===2)scheduleComputer(generation);
 }
 function scheduleComputer(version){
  if(mode!=='training'||finished)return;
  setTimeout(()=>{
   if(version!==generation||mode!=='training'||finished||!game()||game().turn!==2)return;
   tick();
   if(finished)return;
   let move;
   try{move=chooseComputerMove(game(),$('ai-level').value)}catch{announce('Nie udało się obliczyć ruchu komputera.');return}
   if(version!==generation||mode!=='training'||finished)return;
   if(!move){
    game().winner=1;finish();return;
   }
   turnFinished(move,2);
  },90);
 }
 async function startTraining(){
  if(mode!=='training')return;
  generation++;finished=false;recorded=false;clockStarted=false;snapshots=[];notes=[];
  hideResult();
  const minutes=Number($('training-time').value)||0;
  clocks={1:minutes*60000,2:minutes*60000};
  const state={...initialGame('warcaby'),history:[]};
  a.setCurrent({type:'training',state,players:['Ty','Komputer'],player:1,playable:true});
  a.setSelected(null);lastTick=performance.now();
  a.renderBoard();displayClocks();renderNotes();updateStats();
  $('chat-tab').click();
  announce('Nowa partia z komputerem. Grasz białymi, masz pierwszy ruch.');
 }
 function playTrainingMove(move){
  if(mode!=='training'||finished||!game()||game().turn!==1)return;
  if(game().forced==null){
   snapshots.push({state:clone(game()),clocks:{...clocks},clockStarted});
   if(snapshots.length>20)snapshots.shift();
  }
  tick();
  if(!finished)turnFinished(move,1);
 }
 function undoTraining(){
  if(mode!=='training'||finished||!snapshots.length){
   announce('Nie ma jeszcze tury do cofnięcia.');return;
  }
  generation++;
  const last=snapshots.pop();
  clocks={...last.clocks};clockStarted=last.clockStarted;
  a.setCurrent({type:'training',state:last.state,players:['Ty','Komputer'],player:1,playable:true});
  a.setSelected(null);lastTick=performance.now();
  a.renderBoard();displayClocks();
  announce('Cofnięto całą turę — Twój ruch i odpowiedź komputera.');
 }
 function hint(){
  if(mode!=='training'||finished||game()?.turn!==1){announce('Podpowiedź jest dostępna podczas Twojej tury.');return}
  const moves=legalMoves(game());
  if(!moves.length){announce('Brak dostępnych ruchów.');return}
  let best=moves[0],score=-Infinity;
  for(const move of moves){
   const r=playMove('warcaby',game(),1,move);
   if(r.error)continue;
   const value=evaluate(r.state,1)+(move.taken!==undefined?10:0);
   if(value>score){score=value;best=move}
  }
  a.setSelected(best.from);a.renderBoard();
  announce('Podpowiedź: '+a.squareLabel(best.from)+' → '+a.squareLabel(best.to)+'.');
 }
 function setMode(next){
  mode=next;generation++;finished=false;
  a.setMode(next);
  $('training-mode').classList.toggle('active',next==='training');
  $('online-mode').classList.toggle('active',next==='online');
  $('training-mode').setAttribute('aria-pressed',String(next==='training'));
  $('online-mode').setAttribute('aria-pressed',String(next==='online'));
  $('training-settings').hidden=next!=='training';
  $('training-records').hidden=next!=='training';
  $('online-settings').hidden=next!=='online';
  // Like Gomoku: the top "Odśwież partię" icon exists only for online matches.
  $('refresh-match').hidden=next!=='online';
  $('chat-status').textContent=next==='training'?'GRACZ AI · rozmowa prywatna':'Czat partii online';
  $('checkers-refresh').title=next==='training'?'Cofnij ruch':'Odśwież partię';
  $('checkers-refresh').setAttribute('aria-label',$('checkers-refresh').title);
  $('checkers-refresh').dataset.tooltip=$('checkers-refresh').title;
  $('chat-input').disabled=next==='online'&&!a.validMatch;
  $('chat-send').disabled=next==='online'&&!a.validMatch;
  hideResult();a.setCurrent(null);a.setSelected(null);
  if(next==='training')void startTraining();
  else {
   displayClocks();a.renderPreview();void a.loadRooms();
   if(a.validMatch)void a.refresh(true).then(()=>a.refreshChat());
   else announce('Zaproś znajomego lub wybierz przyjętą partię.');
  }
 }
 const hints={
  normal:'Normalny — podstawowa analiza ruchów, obowiązkowych bić i pionków.',
  hard:'Trudny — sprawdza odpowiedzi przeciwnika i taktykę kolejnych ruchów.',
  expert:'Ekspert — analizuje więcej wariantów, bić i odpowiedzi.',
  master:'Arcymistrz — najgłębsze dostępne przeszukiwanie lokalnego silnika Warcabów.'
 };
 function updateHint(){$('ai-hint').textContent=hints[$('ai-level').value]||hints.normal}
 $('training-mode').addEventListener('click',()=>setMode('training'));
 $('online-mode').addEventListener('click',()=>setMode('online'));
 $('restart').addEventListener('click',()=>void startTraining());
 $('training-undo').addEventListener('click',undoTraining);
 $('training-hint').addEventListener('click',hint);
 for(const id of ['training-time','training-increment'])
  $(id).addEventListener('change',()=>{if(mode==='training')void startTraining()});
 $('ai-level').addEventListener('change',updateHint);
 $('game-result-close').addEventListener('click',hideResult);
 $('game-result-review').addEventListener('click',hideResult);
 $('game-result-new').addEventListener('click',()=>void startTraining());
 setInterval(tick,250);
 updateHint();updateStats();
 return {startTraining,playTrainingMove,undoTraining,renderNotes,setMode,getMode:()=>mode};
}
