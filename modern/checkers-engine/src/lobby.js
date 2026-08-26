import { randomUUID } from "node:crypto";
import { createGameSession } from "./session.js";

const GAME_CONFIG=Object.freeze({checkers:Object.freeze({maxPlayers:2,minPlayers:2,label:"Warcaby"}),gomoku:Object.freeze({maxPlayers:2,minPlayers:2,label:"Gomoku"}),thousand:Object.freeze({maxPlayers:4,minPlayers:2,defaultPlayers:3,label:"Tysiąc"})});

export class LobbyError extends Error{constructor(message,code){super(message);this.name="LobbyError";this.code=code}}

export class LobbyService{
  #rooms=new Map();#presence=new Map();#invitations=new Map();
  constructor({sessionStore,thousandService=null,gomokuService=null,idGenerator=randomUUID}){if(!sessionStore)throw new TypeError("Magazyn sesji jest wymagany.");this.sessionStore=sessionStore;this.thousandService=thousandService;this.gomokuService=gomokuService;this.idGenerator=idGenerator}
  touchUser({userId,displayName}){requireText(userId,"userId");requireText(displayName,"displayName");this.#presence.set(userId,{userId,displayName:normalizeDisplayName(displayName),seenAt:Date.now()})}
  listRooms(){return[...this.#rooms.values()].map(publicRoom)}
  listPlayers(){const cutoff=Date.now()-45000;for(const[userId,presence]of this.#presence)if(presence.seenAt<cutoff)this.#presence.delete(userId);return[...this.#presence.values()].map(presence=>{const room=[...this.#rooms.values()].find(candidate=>candidate.seats.some(seat=>seat?.id===presence.userId));return{userId:presence.userId,displayName:normalizeDisplayName(presence.displayName),status:room?.status==="playing"?"w grze":room?.status==="waiting"?"przy stole":"dostępny",roomId:room?.roomId??null,roomName:room?.roomName??null,gameType:room?.gameType??null}})}
  listInvitations(userId){return[...this.#invitations.values()].filter(inv=>inv.toId===userId&&inv.status==="pending").map(inv=>structuredClone({...inv,fromName:normalizeDisplayName(inv.fromName)}))}

  createRoom({ownerId,ownerName,roomName="Nowy pokój",gameType="checkers",maxPlayers=null}){
    requireText(ownerId,"ownerId");requireText(ownerName,"ownerName");requireText(roomName,"roomName");
    const config=gameConfig(gameType);const seatCount=resolveSeatCount(gameType,maxPlayers,config);
    const ownedWaiting=[...this.#rooms.values()].filter(room=>room.gameType===gameType&&room.seats[0]?.id===ownerId&&room.status==="waiting");
    const exact=ownedWaiting.find(room=>room.maxPlayers===seatCount);if(exact)return publicRoom(exact);
    for(const oldRoom of ownedWaiting){
      const filled=oldRoom.seats.filter(Boolean).length;
      if(filled>1)throw new LobbyError(`Masz już stół ${oldRoom.maxPlayers}-osobowy z zaproszonymi graczami. Utwórz nowy wariant dopiero po zakończeniu tego stołu.`,"ROOM_VARIANT_LOCKED");
      this.#rooms.delete(oldRoom.roomId);
      for(const[id,inv]of this.#invitations)if(inv.roomId===oldRoom.roomId)this.#invitations.delete(id);
    }
    const seats=Array(seatCount).fill(null);seats[0]={id:ownerId,name:normalizeDisplayName(ownerName)};
    const room={roomId:this.idGenerator(),roomName,gameType,gameLabel:config.label,maxPlayers:seatCount,status:"waiting",seats,gameId:null};this.#rooms.set(room.roomId,room);return publicRoom(room)
  }

  createInvitation({fromId,fromName,toId,roomId}){
    requireText(fromId,"fromId");requireText(fromName,"fromName");requireText(toId,"toId");requireText(roomId,"roomId");if(fromId===toId)throw new LobbyError("Nie możesz zaprosić samego siebie.","INVALID_INVITATION");
    const room=this.#rooms.get(roomId);if(!room||room.status!=="waiting"||room.seats[0]?.id!==fromId)throw new LobbyError("Najpierw zajmij miejsce przy własnym stole.","ROOM_NOT_JOINABLE");
    if(room.seats.every(Boolean))throw new LobbyError("Przy tym stole nie ma już wolnych miejsc.","ROOM_FULL");
    if(room.seats.some(seat=>seat?.id===toId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
    const target=this.listPlayers().find(player=>player.userId===toId);if(!target)throw new LobbyError("Gracz nie jest już dostępny.","PLAYER_OFFLINE");if(target.status==="w grze")throw new LobbyError("Ten gracz jest już w grze.","PLAYER_BUSY");
    for(const inv of this.#invitations.values())if(inv.status==="pending"&&inv.fromId===fromId&&inv.toId===toId&&inv.roomId===roomId)return structuredClone(inv);
    const invitation={invitationId:this.idGenerator(),status:"pending",roomId,roomName:room.roomName,gameType:room.gameType,gameLabel:room.gameLabel,fromId,fromName:normalizeDisplayName(fromName),toId,createdAt:Date.now()};this.#invitations.set(invitation.invitationId,invitation);return structuredClone(invitation)
  }

  async respondInvitation({invitationId,userId,userName,accept}){const invitation=this.#invitations.get(invitationId);if(!invitation||invitation.toId!==userId||invitation.status!=="pending")throw new LobbyError("Zaproszenie nie jest już aktualne.","INVITATION_NOT_FOUND");invitation.status=accept?"accepted":"declined";if(!accept)return{accepted:false};const room=await this.joinRoom({roomId:invitation.roomId,playerId:userId,playerName:normalizeDisplayName(userName)});return{accepted:true,room}}

  async joinRoom({roomId,playerId,playerName}){
    const room=this.#rooms.get(roomId);if(!room)throw new LobbyError("Pokój nie istnieje.","ROOM_NOT_FOUND");if(room.status!=="waiting")throw new LobbyError("Pokój nie oczekuje na gracza.","ROOM_NOT_JOINABLE");if(room.seats.some(seat=>seat?.id===playerId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
    const freeSeat=room.seats.findIndex(seat=>seat===null);if(freeSeat<0)throw new LobbyError("Przy tym stole nie ma wolnych miejsc.","ROOM_FULL");room.seats[freeSeat]={id:playerId,name:normalizeDisplayName(playerName)};
    if(room.seats.every(Boolean)){
      room.status="playing";
      if(room.gameType==="thousand"){
        if(!this.thousandService)throw new LobbyError("Silnik Tysiąca nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");room.gameId=`thousand-${room.roomId}`;await this.thousandService.createGame({gameId:room.gameId,players:room.seats.map(seat=>({userId:seat.id,displayName:seat.name}))});
      }else if(room.gameType==="gomoku"){
        if(!this.gomokuService)throw new LobbyError("Silnik Gomoku nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");room.gameId=`gomoku-${room.roomId}`;this.gomokuService.createGame({gameId:room.gameId,players:room.seats.map(seat=>({userId:seat.id,displayName:seat.name}))});
      }else{
        room.gameId=`game-${room.roomId}`;await this.sessionStore.create(createGameSession({gameId:room.gameId,whitePlayerId:room.seats[0].id,blackPlayerId:room.seats[1].id}));
      }
    }
    return publicRoom(room)
  }
}

function publicRoom(room){const seats=room.seats.map(seat=>seat?{id:seat.id,name:normalizeDisplayName(seat.name)}:null);return structuredClone({roomId:room.roomId,roomName:room.roomName,gameType:room.gameType,gameLabel:room.gameLabel,maxPlayers:room.maxPlayers,filledSeats:seats.filter(Boolean).length,status:room.status,seats,white:room.gameType==="checkers"?seats[0]:null,black:room.gameType==="checkers"?seats[1]:null,gameId:room.gameId})}
function resolveSeatCount(gameType,requested,config){if(gameType!=="thousand")return config.maxPlayers;const value=requested===null||requested===undefined?config.defaultPlayers:Number(requested);if(!Number.isInteger(value)||value<config.minPlayers||value>config.maxPlayers)throw new LobbyError("Tysiąc obsługuje stoły dla 2, 3 lub 4 graczy.","INVALID_ROOM");return value}
function gameConfig(gameType){const config=GAME_CONFIG[gameType];if(!config)throw new LobbyError("Nieobsługiwany typ gry.","INVALID_GAME_TYPE");return config}
function normalizeDisplayName(value){if(typeof value!=="string")return value;if(value.localeCompare("Czeslaw","pl",{sensitivity:"base"})===0)return"Czesław";return value.normalize("NFC")}
function requireText(value,field){if(typeof value!=="string"||value.length<1||value.length>128)throw new LobbyError(`Pole ${field} jest nieprawidłowe.`,"INVALID_ROOM")}
