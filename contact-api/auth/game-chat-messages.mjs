// Presentation only: callers resolve ownership from player IDs or local message roles.
export function createGameChatMessage({sender,body,mine=false,createdAt,timestamps=true}){
 const bubble=document.createElement('div');
 bubble.className='chat-bubble game-chat-message'+(mine?' own':'');
 const title=document.createElement('strong');title.textContent=sender+':';
 const content=document.createElement('p');content.textContent=body;
 bubble.append(title,content);
 const date=new Date(createdAt);
 if(!Number.isNaN(date.getTime())){
  const time=document.createElement('time');
  time.dateTime=date.toISOString();
  time.textContent=date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
  time.hidden=!timestamps;
  bubble.append(time);
 }
 return bubble;
}
export const gameChatJs='window.GraczChat={createMessage:'+createGameChatMessage.toString()+'};';
export const gameChatCss=String.raw`
/* One bubble layout for player chat, training, private AI and conversation previews. */
#chat-panel .game-chat-message,
.chat-preview .game-chat-message{
 display:block;align-self:flex-start;box-sizing:border-box;
 width:95%;max-width:95%;min-width:0;margin:0;padding:8px 10px;
 border:1px solid #497775;border-radius:11px;
 background:#103e43;color:#fff;text-align:left;
 font-size:12px;line-height:1.45;overflow-wrap:anywhere;word-break:normal;
 box-shadow:none;
}
#chat-panel .game-chat-message.own,
.chat-preview .game-chat-message.own{
 align-self:flex-start;background:#503d29;border-color:#a98a55;
}
#chat-panel .game-chat-message strong,
.chat-preview .game-chat-message strong{
 display:inline;margin:0 .35em 0 0;font-size:inherit;line-height:inherit;color:#f2d39a;
}
#chat-panel .game-chat-message p,
.chat-preview .game-chat-message p{
 display:inline;margin:0;font-size:inherit;line-height:inherit;
 white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;color:#fff;
}
#chat-panel .game-chat-message time,
.chat-preview .game-chat-message time{
 display:inline-block;margin:0 0 0 .65em;font-size:10px;line-height:inherit;
 color:#c7d3d0;white-space:nowrap;vertical-align:baseline;
}
#chat-panel .game-chat-message time[hidden],
.chat-preview .game-chat-message time[hidden]{display:none}
#chat-panel .chat-compact .game-chat-message,.chat-preview.chat-compact .game-chat-message{padding:5px 7px}
#chat-panel .chat-font-small .game-chat-message,.chat-preview.chat-font-small .game-chat-message{font-size:10px}
#chat-panel .chat-font-large .game-chat-message,.chat-preview.chat-font-large .game-chat-message{font-size:15px;line-height:1.55}
.chess-console.chess-large-chat #chat-panel .game-chat-message{font-size:16px}
`;
