const params=new URLSearchParams(location.search);
const gameId=params.get("game")??"demo";
const playerId=params.get("player")??"alice";
const api=params.get("api")??"";
let loginSession=null;
try{loginSession=JSON.parse(sessionStorage.getItem("gracz-session")||"null")}catch{}
const localDev=["localhost","127.0.0.1","::1"].includes(location.hostname)&&!api;
const authHeaders=loginSession?.token&&typeof loginSession.token==="string"
 ?{authorization:`Bearer ${loginSession.token}`}
 :localDev?{"x-player-id":playerId}:{};
const boardElement=document.querySelector("#board"),statusElement=document.querySelector("#status"),historyBody=document.querySelector("#history-body"),usersList=document.querySelector("#users-list");document.querySelector("#identity").textContent="Gracz: —";
let snapshot=null,previousBoard=null,selected=null,moveNumber=0,connectionController=null,connectionEpoch=0,movePending=false;const history=[];
function playerLabel(color){return snapshot?.players?.[color]?.id??(color==="white"?"Białe":"Czarne")}
function notation(pos){return `${"ABCDEFGH"[pos.column]}${8-pos.row}`}
function detectMove(before,after,mover){if(!before)return;const removed=[],added=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(before[r][c]!==after[r][c]){if(before[r][c]?.startsWith(mover))removed.push({row:r,column:c});if(after[r][c]?.startsWith(mover))added.push({row:r,column:c});}}const from=removed[0],to=added.at(-1);if(from&&to){moveNumber++;history.push({number:moveNumber,player:playerLabel(mover),move:`${notation(from)}:${notation(to)}`});renderHistory();}}
function renderHistory(){historyBody.replaceChildren();if(!history.length){historyBody.innerHTML='<tr><td colspan="3">Brak ruchów</td></tr>';return}history.forEach(item=>{const row=document.createElement("tr");row.innerHTML=`<td>${item.number}</td><td></td><td>${item.move}</td>`;row.children[1].textContent=item.player;historyBody.append(row);});}
function renderUsers(){usersList.replaceChildren();for(const color of ["white","black"]){const player=snapshot?.players?.[color];const item=document.createElement("li");const name=document.createElement("strong");name.textContent=`${color==="white"?"Białe":"Czarne"}: ${player?.id??"wolne miejsce"}`;const state=document.createElement("span");state.textContent=player?.connected?"online":"offline";item.append(name,state);usersList.append(item);const playerElement=document.querySelector(`#${color}-player`);playerElement.textContent=player?.id??(color==="white"?"Białe":"Czarne");playerElement.closest(".player").querySelector(".seat-state").textContent=player?"zajęte":"usiądź";document.querySelector(`#${color}-light`).classList.toggle("online",Boolean(player?.connected));}}
function renderChat(){const log=document.querySelector("#chat-log");log.replaceChildren();const messages=snapshot?.messages??[];if(!messages.length){const p=document.createElement("p");p.className="system-message";p.textContent="Witaj w konsoli gry.";log.append(p)}for(const message of messages){const p=document.createElement("p");const name=document.createElement("strong");name.textContent=`${message.playerId}: `;p.append(name,document.createTextNode(message.text));log.append(p)}log.scrollTop=log.scrollHeight}
function renderOffer(){const offer=snapshot?.pendingOffer;document.querySelectorAll("[data-action]").forEach(button=>{const active=offer?.type===button.dataset.action;button.classList.toggle("attention",active);const currentPlayerId=snapshot?.players?.[snapshot.color]?.id??playerId;if(active)button.textContent=offer.playerId===currentPlayerId?"OCZEKIWANIE":button.dataset.action==="draw"?"PRZYJMIJ REMIS":"COFNIJ RUCH";else button.textContent={resign:"REZYGNUJ",draw:"REMIS",undo:"COFNIJ",block:(snapshot?.blockedPlayers??[]).includes(playerLabel(snapshot.color==="white"?"black":"white"))?"ODBLOKUJ":"ZABLOKUJ"}[button.dataset.action]})}
function render(){if(!snapshot)return;document.querySelector("#identity").textContent=`Gracz: ${snapshot.players?.[snapshot.color]?.id??"—"}`;boardElement.replaceChildren();const ownTurn=snapshot.game.turn===snapshot.color&&snapshot.game.status==="active";statusElement.textContent=snapshot.game.status==="draw"?"Remis":snapshot.game.status==="won"?`Wygrywa: ${snapshot.game.winner}`:snapshot.game.forcedPiece&&ownTurn?"Kontynuuj bicie tym samym pionkiem":ownTurn?"Twój ruch":"Ruch przeciwnika";renderUsers();renderChat();renderOffer();
snapshot.game.board.forEach((row,rowIndex)=>row.forEach((piece,columnIndex)=>{const square=document.createElement("button");square.type="button";square.className=`square ${(rowIndex+columnIndex)%2?"dark":"light"}`;square.dataset.row=rowIndex;square.dataset.column=columnIndex;square.setAttribute("role","gridcell");square.setAttribute("aria-label",`Pole ${notation({row:rowIndex,column:columnIndex})}${piece?`, ${piece}`:""}`);if(selected?.row===rowIndex&&selected?.column===columnIndex)square.classList.add("selected");if(piece){const token=document.createElement("span");token.className=`piece ${piece.startsWith("white")?"white":"black"} ${piece.endsWith("king")?"king":""}`;square.append(token)}square.addEventListener("click",()=>choose({row:rowIndex,column:columnIndex},piece,ownTurn));boardElement.append(square)}));}
async function choose(position,piece,ownTurn){
 if(!ownTurn||movePending)return;
 if(piece?.startsWith(snapshot.color)){selected=position;render();return}
 if(!selected)return;
 movePending=true;
 try{
  const response=await fetch(`${api}/games/${gameId}/moves`,{method:"POST",headers:{"content-type":"application/json",...authHeaders},body:JSON.stringify({requestId:crypto.randomUUID(),move:{from:selected,to:position}})});
  const result=await response.json();
  if(!response.ok){statusElement.textContent=result.error?.message??"Ruch odrzucony";return}
  selected=null;
 }catch(error){statusElement.textContent="Nie udało się wysłać ruchu. Sprawdź połączenie."}
 finally{movePending=false}
}
async function connect(){
 const epoch=++connectionEpoch;
 connectionController?.abort();
 let failures=0;
 while(epoch===connectionEpoch){
  const controller=new AbortController();
  connectionController=controller;
  try{
   statusElement.textContent="Łączenie z partią…";
   const response=await fetch(`${api}/games/${gameId}/events`,{headers:authHeaders,signal:controller.signal});
   if(!response.ok||!response.body){
    if([401,403,404].includes(response.status)){statusElement.textContent="Brak dostępu do partii lub sesja wygasła.";return}
    throw new Error("Nie udało się połączyć z partią.");
   }
   failures=0;
   const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
   let buffer="";
   while(epoch===connectionEpoch){
    const {value,done}=await reader.read();
    if(done)break;
    buffer+=value.replace(/\r\n/g,"\n");
    const events=buffer.split("\n\n");
    buffer=events.pop();
    for(const raw of events){
     const data=raw.split("\n").find(line=>line.startsWith("data: "));
     if(!data)continue;
     const next=JSON.parse(data.slice(6));
     if(snapshot&&JSON.stringify(snapshot.game.board)!==JSON.stringify(next.game.board))detectMove(snapshot.game.board,next.game.board,snapshot.game.turn);
     snapshot=next;previousBoard=structuredClone(next.game.board);render();
    }
   }
   if(epoch!==connectionEpoch)return;
   throw new Error("Połączenie z partią zostało przerwane.");
  }catch(error){
   if(epoch!==connectionEpoch||controller.signal.aborted)return;
   showError(error);
  }
  const pause=Math.min(30000,1000*2**Math.min(failures++,5))+Math.floor(Math.random()*500);
  await new Promise(resolve=>setTimeout(resolve,pause));
 }
}
function toast(message){const el=document.querySelector("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-tab],.tab-panel").forEach(el=>el.classList.remove("active"));button.classList.add("active");document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("active")}));
async function post(path,body){const response=await fetch(`${api}/games/${gameId}/${path}`,{method:"POST",headers:{"content-type":"application/json",...authHeaders},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??"Operacja nie powiodła się.");return result}
document.querySelector("#chat-form").addEventListener("submit",async event=>{event.preventDefault();const input=document.querySelector("#chat-input"),text=input.value.trim();if(!text)return;input.value="";try{await post("chat",{text})}catch(error){toast(error.message)}});
document.querySelector("#rotate-board").addEventListener("change",event=>boardElement.classList.toggle("rotated",event.target.checked));document.querySelector("#reconnect").addEventListener("click",async()=>{try{await post("reconnect",{});await connect()}catch(error){showError(error)}});document.querySelector("#start").addEventListener("click",()=>toast(snapshot?.game?.status==="active"?"Partia już trwa":"Partia została zakończona"));document.querySelector("#invite").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);toast("Link do stołu skopiowany")}catch{toast("Skopiuj adres strony z paska przeglądarki")}});document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",async()=>{const action=button.dataset.action;if(action==="resign"&&!confirm("Czy na pewno chcesz poddać partię?"))return;try{await post("actions",{action});toast({resign:"Partia została poddana",draw:"Propozycja remisu wysłana lub przyjęta",undo:"Prośba o cofnięcie wysłana lub przyjęta",block:"Ustawienie blokady zmienione"}[action])}catch(error){toast(error.message)}}));
const consoleElement=document.querySelector(".console"),fullscreenButton=document.querySelector("#fullscreen-console");function updateFullscreenButton(){const expanded=Boolean(document.fullscreenElement)||document.body.classList.contains("console-fullscreen");fullscreenButton.textContent=expanded?"↙":"⛶";fullscreenButton.setAttribute("aria-label",expanded?"Pomniejsz grę":"Powiększ grę");fullscreenButton.title=expanded?"Pomniejsz grę":"Powiększ grę"}fullscreenButton.addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(consoleElement.requestFullscreen)await consoleElement.requestFullscreen();else document.body.classList.toggle("console-fullscreen")}catch{document.body.classList.toggle("console-fullscreen")}updateFullscreenButton()});document.addEventListener("fullscreenchange",updateFullscreenButton);document.addEventListener("keydown",event=>{if(event.key==="Escape"&&document.body.classList.contains("console-fullscreen")){document.body.classList.remove("console-fullscreen");updateFullscreenButton()}});
connect().catch(showError);function showError(error){if(error.name!=="AbortError")statusElement.textContent=error.message}
