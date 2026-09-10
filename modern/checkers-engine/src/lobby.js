import { randomUUID } from "node:crypto";
import { requireGameDefinition } from "./game-types.js";
import { createGameSession } from "./session.js";
import { ensureLobbyGameInTransaction } from "./lobby-game-transaction.js";

const LOBBY_INIT_LOCK_ID = 731_004_202;
const PRESENCE_ACTIVE_MS = 45_000;
const TEST_AFTER_GAME_ENSURED = Symbol("Wave A lobby after-game-ensured test seam");

export class LobbyError extends Error{constructor(message,code){super(message);this.name="LobbyError";this.code=code}}

export function lobbyTestOptions(afterGameEnsured){
  if(typeof afterGameEnsured!=="function")throw new TypeError("Testowy hook afterGameEnsured musi być funkcją.");
  return{[TEST_AFTER_GAME_ENSURED]:afterGameEnsured};
}

export class LobbyService{
  #rooms=new Map();#presence=new Map();#invitations=new Map();
  constructor(options={}){
    if(!options||typeof options!=="object")throw new TypeError("Opcje Lobby muszą być obiektem.");
    if(Object.prototype.hasOwnProperty.call(options,"afterGameEnsured"))throw new TypeError("afterGameEnsured jest dostępny wyłącznie przez jawny seam testowy.");
    const{sessionStore,thousandService=null,gomokuService=null,idGenerator=randomUUID,pool=null}=options;
    if(!sessionStore)throw new TypeError("Magazyn sesji jest wymagany.");
    if(pool&&(typeof pool.query!=="function"||typeof pool.connect!=="function"))throw new TypeError("Pula PostgreSQL lobby jest nieprawidłowa.");
    const afterGameEnsured=options[TEST_AFTER_GAME_ENSURED]??null;
    this.sessionStore=sessionStore;this.thousandService=thousandService;this.gomokuService=gomokuService;this.idGenerator=idGenerator;this.pool=pool;this.afterGameEnsured=afterGameEnsured;
    this.ready=this.pool?this.#initializeDatabase():Promise.resolve();
  }

  async #initializeDatabase(){
    const client=await this.pool.connect();
    try{
      await client.query("SELECT pg_advisory_lock($1)",[LOBBY_INIT_LOCK_ID]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_lobby_rooms (
          room_id TEXT PRIMARY KEY,
          room_name TEXT NOT NULL,
          game_type TEXT NOT NULL,
          game_label TEXT NOT NULL,
          max_players SMALLINT NOT NULL CHECK(max_players BETWEEN 2 AND 4),
          status TEXT NOT NULL CHECK(status IN ('waiting','playing')),
          seats JSONB NOT NULL,
          game_id TEXT NULL,
          owner_id TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS gracz_lobby_one_waiting_room_owner_game_idx
          ON gracz_lobby_rooms(owner_id,game_type) WHERE status='waiting';
        CREATE INDEX IF NOT EXISTS gracz_lobby_rooms_status_updated_idx
          ON gracz_lobby_rooms(status,updated_at DESC);

        CREATE TABLE IF NOT EXISTS gracz_lobby_invitations (
          invitation_id TEXT PRIMARY KEY,
          status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined')),
          room_id TEXT NOT NULL,
          room_name TEXT NOT NULL,
          game_type TEXT NOT NULL,
          game_label TEXT NOT NULL,
          from_id TEXT NOT NULL,
          from_name TEXT NOT NULL,
          to_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS gracz_lobby_invitations_recipient_idx
          ON gracz_lobby_invitations(to_id,status,created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS gracz_lobby_pending_invitation_idx
          ON gracz_lobby_invitations(from_id,to_id,room_id) WHERE status='pending';

        CREATE TABLE IF NOT EXISTS gracz_lobby_presence (
          user_id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS gracz_lobby_presence_seen_idx ON gracz_lobby_presence(seen_at DESC);
      `);
    }finally{
      await client.query("SELECT pg_advisory_unlock($1)",[LOBBY_INIT_LOCK_ID]).catch(()=>{});
      client.release();
    }
  }

  async readState({userId,displayName}){
    requireText(userId,"userId");requireText(displayName,"displayName");
    const normalized=normalizeDisplayName(displayName);
    if(!this.pool){
      this.#presence.set(userId,{userId,displayName:normalized,seenAt:Date.now()});
      return{rooms:this.listRooms(),players:this.listPlayers(),invitations:this.listInvitations(userId)};
    }
    return this.#readStateDatabase({userId,displayName:normalized});
  }

  touchUser({userId,displayName}){
    requireText(userId,"userId");requireText(displayName,"displayName");
    const normalized=normalizeDisplayName(displayName);
    if(!this.pool){this.#presence.set(userId,{userId,displayName:normalized,seenAt:Date.now()});return}
    return this.#touchUserDatabase({userId,displayName:normalized});
  }

  async #touchUserDatabase({userId,displayName},queryable=this.pool){
    await this.ready;
    await queryable.query(`INSERT INTO gracz_lobby_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=NOW()`,[userId,displayName]);
    await queryable.query(`DELETE FROM gracz_lobby_presence WHERE seen_at < NOW()-INTERVAL '5 minutes'`);
  }

  async #readStateDatabase({userId,displayName}){
    await this.ready;
    const{rows}=await this.pool.query(`
      WITH touched AS (
        INSERT INTO gracz_lobby_presence(user_id,display_name,seen_at)
        VALUES($1,$2,NOW())
        ON CONFLICT(user_id) DO UPDATE
          SET display_name=EXCLUDED.display_name,seen_at=NOW()
        RETURNING user_id,display_name,seen_at
      ), rooms AS (
        SELECT * FROM gracz_lobby_rooms ORDER BY updated_at DESC,created_at DESC LIMIT 500
      ), other_active_presence AS (
        SELECT user_id,display_name,seen_at FROM gracz_lobby_presence
        WHERE user_id<>$1 AND seen_at>=NOW()-INTERVAL '45 seconds'
        ORDER BY seen_at DESC LIMIT 499
      ), active_presence AS (
        SELECT user_id,display_name,seen_at FROM touched
        UNION ALL
        SELECT user_id,display_name,seen_at FROM other_active_presence
      ), player_rooms AS (
        SELECT * FROM gracz_lobby_rooms
        WHERE status IN ('waiting','playing')
        ORDER BY updated_at DESC LIMIT 500
      ), invitations AS (
        SELECT * FROM gracz_lobby_invitations
        WHERE to_id=$1 AND status='pending'
        ORDER BY created_at ASC LIMIT 200
      )
      SELECT
        COALESCE((SELECT jsonb_agg(to_jsonb(room_row) ORDER BY room_row.updated_at DESC,room_row.created_at DESC) FROM rooms room_row),'[]'::jsonb) AS rooms,
        COALESCE((SELECT jsonb_agg(to_jsonb(presence_row) ORDER BY presence_row.seen_at DESC,presence_row.user_id ASC) FROM active_presence presence_row),'[]'::jsonb) AS presence,
        COALESCE((SELECT jsonb_agg(to_jsonb(player_room_row) ORDER BY player_room_row.updated_at DESC) FROM player_rooms player_room_row),'[]'::jsonb) AS player_rooms,
        COALESCE((SELECT jsonb_agg(to_jsonb(invitation_row) ORDER BY invitation_row.created_at ASC) FROM invitations invitation_row),'[]'::jsonb) AS invitations
    `,[userId,displayName]);
    const stateRow=rows[0];
    if(!stateRow)throw new Error("PostgreSQL lobby nie zwrócił stanu.");
    const roomRows=requireRowArray(stateRow.rooms,"rooms");
    const presenceRows=requireRowArray(stateRow.presence,"presence");
    const playerRoomRows=requireRowArray(stateRow.player_rooms,"player_rooms");
    const invitationRows=requireRowArray(stateRow.invitations,"invitations");
    const rooms=roomRows.map(row=>publicRoom(databaseRoom(row)));
    const playerRooms=playerRoomRows.map(databaseRoom);
    const roomByPlayerId=new Map();
    for(const room of playerRooms)for(const seat of room.seats)if(seat&&!roomByPlayerId.has(seat.id))roomByPlayerId.set(seat.id,room);
    const players=presenceRows.map(row=>{
      const presence={userId:row.user_id,displayName:row.display_name,seenAt:new Date(row.seen_at).getTime()};
      return playerProjection(presence,roomByPlayerId.get(presence.userId));
    });
    const invitations=invitationRows.map(databaseInvitation);
    return{rooms,players,invitations};
  }

  listRooms(){
    if(!this.pool)return[...this.#rooms.values()].map(publicRoom);
    return this.#listRoomsDatabase();
  }

  async #listRoomsDatabase(queryable=this.pool){
    await this.ready;
    const{rows}=await queryable.query(`SELECT * FROM gracz_lobby_rooms ORDER BY updated_at DESC,created_at DESC LIMIT 500`);
    return rows.map(row=>publicRoom(databaseRoom(row)));
  }

  listPlayers(){
    if(!this.pool){const cutoff=Date.now()-PRESENCE_ACTIVE_MS;for(const[userId,presence]of this.#presence)if(presence.seenAt<cutoff)this.#presence.delete(userId);return[...this.#presence.values()].map(presence=>{const room=[...this.#rooms.values()].find(candidate=>candidate.seats.some(seat=>seat?.id===presence.userId));return playerProjection(presence,room)})}
    return this.#listPlayersDatabase();
  }

  async #listPlayersDatabase(queryable=this.pool){
    await this.ready;
    const presenceSql=`SELECT user_id,display_name,seen_at FROM gracz_lobby_presence WHERE seen_at>=NOW()-INTERVAL '45 seconds' ORDER BY seen_at DESC LIMIT 500`;
    const roomsSql=`SELECT * FROM gracz_lobby_rooms WHERE status IN ('waiting','playing') ORDER BY updated_at DESC LIMIT 500`;
    const[presenceResult,roomResult]=queryable===this.pool
      ?await Promise.all([queryable.query(presenceSql),queryable.query(roomsSql)])
      :[await queryable.query(presenceSql),await queryable.query(roomsSql)];
    const rooms=roomResult.rows.map(databaseRoom);
    return presenceResult.rows.map(row=>{
      const presence={userId:row.user_id,displayName:row.display_name,seenAt:new Date(row.seen_at).getTime()};
      const room=rooms.find(candidate=>candidate.seats.some(seat=>seat?.id===presence.userId));
      return playerProjection(presence,room);
    });
  }

  listInvitations(userId){
    if(!this.pool)return[...this.#invitations.values()].filter(inv=>inv.toId===userId&&inv.status==="pending").map(inv=>structuredClone({...inv,fromName:normalizeDisplayName(inv.fromName)}));
    return this.#listInvitationsDatabase(userId);
  }

  async #listInvitationsDatabase(userId,queryable=this.pool){
    await this.ready;
    const{rows}=await queryable.query(`SELECT * FROM gracz_lobby_invitations WHERE to_id=$1 AND status='pending' ORDER BY created_at ASC LIMIT 200`,[userId]);
    return rows.map(databaseInvitation);
  }

  createRoom(input){
    const{ownerId,ownerName,roomName="Nowy pokój",gameType="checkers",maxPlayers=null}=input;
    requireText(ownerId,"ownerId");requireText(ownerName,"ownerName");requireText(roomName,"roomName");
    const config=gameConfig(gameType);const canonicalGameType=config.id;const seatCount=resolveSeatCount(canonicalGameType,maxPlayers,config.players);
    if(this.pool)return this.#createRoomDatabase({ownerId,ownerName,roomName,config,canonicalGameType,seatCount});
    const ownedWaiting=[...this.#rooms.values()].filter(room=>room.gameType===canonicalGameType&&room.seats[0]?.id===ownerId&&room.status==="waiting");
    const exact=ownedWaiting.find(room=>room.maxPlayers===seatCount);if(exact)return publicRoom(exact);
    for(const oldRoom of ownedWaiting){
      const filled=oldRoom.seats.filter(Boolean).length;
      if(filled>1)throw new LobbyError(`Masz już stół ${oldRoom.maxPlayers}-osobowy z zaproszonymi graczami. Utwórz nowy wariant dopiero po zakończeniu tego stołu.`,"ROOM_VARIANT_LOCKED");
      this.#rooms.delete(oldRoom.roomId);
      for(const[id,inv]of this.#invitations)if(inv.roomId===oldRoom.roomId)this.#invitations.delete(id);
    }
    const seats=Array(seatCount).fill(null);seats[0]={id:ownerId,name:normalizeDisplayName(ownerName)};
    const room={roomId:this.idGenerator(),roomName,gameType:canonicalGameType,gameLabel:config.label,maxPlayers:seatCount,status:"waiting",seats,gameId:null};this.#rooms.set(room.roomId,room);return publicRoom(room)
  }

  async #createRoomDatabase({ownerId,ownerName,roomName,config,canonicalGameType,seatCount}){
    await this.ready;
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`lobby-owner:${ownerId}:${canonicalGameType}`]);
      const current=await client.query(`SELECT * FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type=$2 AND status='waiting' FOR UPDATE`,[ownerId,canonicalGameType]);
      const ownedWaiting=current.rows.map(databaseRoom);
      const exact=ownedWaiting.find(room=>room.maxPlayers===seatCount);
      if(exact){await client.query("COMMIT");return publicRoom(exact)}
      for(const oldRoom of ownedWaiting){
        const filled=oldRoom.seats.filter(Boolean).length;
        if(filled>1)throw new LobbyError(`Masz już stół ${oldRoom.maxPlayers}-osobowy z zaproszonymi graczami. Utwórz nowy wariant dopiero po zakończeniu tego stołu.`,"ROOM_VARIANT_LOCKED");
        await client.query(`DELETE FROM gracz_lobby_invitations WHERE room_id=$1`,[oldRoom.roomId]);
        await client.query(`DELETE FROM gracz_lobby_rooms WHERE room_id=$1`,[oldRoom.roomId]);
      }
      const roomId=this.idGenerator();const seats=Array(seatCount).fill(null);seats[0]={id:ownerId,name:normalizeDisplayName(ownerName)};
      const result=await client.query(`INSERT INTO gracz_lobby_rooms(room_id,room_name,game_type,game_label,max_players,status,seats,game_id,owner_id,owner_name) VALUES($1,$2,$3,$4,$5,'waiting',$6::jsonb,NULL,$7,$8) RETURNING *`,[roomId,roomName,canonicalGameType,config.label,seatCount,JSON.stringify(seats),ownerId,normalizeDisplayName(ownerName)]);
      await client.query("COMMIT");return publicRoom(databaseRoom(result.rows[0]));
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{client.release()}
  }

  createInvitation(input){
    const{fromId,fromName,toId,roomId}=input;
    requireText(fromId,"fromId");requireText(fromName,"fromName");requireText(toId,"toId");requireText(roomId,"roomId");if(fromId===toId)throw new LobbyError("Nie możesz zaprosić samego siebie.","INVALID_INVITATION");
    if(this.pool)return this.#createInvitationDatabase({fromId,fromName,toId,roomId});
    const room=this.#rooms.get(roomId);if(!room||room.status!=="waiting"||room.seats[0]?.id!==fromId)throw new LobbyError("Najpierw zajmij miejsce przy własnym stole.","ROOM_NOT_JOINABLE");
    if(room.seats.every(Boolean))throw new LobbyError("Przy tym stole nie ma już wolnych miejsc.","ROOM_FULL");
    if(room.seats.some(seat=>seat?.id===toId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
    const target=this.listPlayers().find(player=>player.userId===toId);if(!target)throw new LobbyError("Gracz nie jest już dostępny.","PLAYER_OFFLINE");if(target.status==="w grze")throw new LobbyError("Ten gracz jest już w grze.","PLAYER_BUSY");
    for(const inv of this.#invitations.values())if(inv.status==="pending"&&inv.fromId===fromId&&inv.toId===toId&&inv.roomId===roomId)return structuredClone(inv);
    const invitation={invitationId:this.idGenerator(),status:"pending",roomId,roomName:room.roomName,gameType:room.gameType,gameLabel:room.gameLabel,fromId,fromName:normalizeDisplayName(fromName),toId,createdAt:Date.now()};this.#invitations.set(invitation.invitationId,invitation);return structuredClone(invitation)
  }

  async #createInvitationDatabase({fromId,fromName,toId,roomId}){
    await this.ready;
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const roomResult=await client.query(`SELECT * FROM gracz_lobby_rooms WHERE room_id=$1 FOR UPDATE`,[roomId]);
      const room=roomResult.rows[0]?databaseRoom(roomResult.rows[0]):null;
      if(!room||room.status!=="waiting"||room.seats[0]?.id!==fromId)throw new LobbyError("Najpierw zajmij miejsce przy własnym stole.","ROOM_NOT_JOINABLE");
      if(room.seats.every(Boolean))throw new LobbyError("Przy tym stole nie ma już wolnych miejsc.","ROOM_FULL");
      if(room.seats.some(seat=>seat?.id===toId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
      const target=await client.query(`SELECT user_id FROM gracz_lobby_presence WHERE user_id=$1 AND seen_at>=NOW()-INTERVAL '45 seconds'`,[toId]);
      if(!target.rows[0])throw new LobbyError("Gracz nie jest już dostępny.","PLAYER_OFFLINE");
      const busy=await client.query(`SELECT 1 FROM gracz_lobby_rooms WHERE status='playing' AND EXISTS(SELECT 1 FROM jsonb_array_elements(seats) AS seat WHERE seat IS NOT NULL AND seat->>'id'=$1) LIMIT 1`,[toId]);
      if(busy.rows[0])throw new LobbyError("Ten gracz jest już w grze.","PLAYER_BUSY");
      const existing=await client.query(`SELECT * FROM gracz_lobby_invitations WHERE from_id=$1 AND to_id=$2 AND room_id=$3 AND status='pending' LIMIT 1`,[fromId,toId,roomId]);
      if(existing.rows[0]){await client.query("COMMIT");return databaseInvitation(existing.rows[0])}
      const invitationId=this.idGenerator();
      const inserted=await client.query(`INSERT INTO gracz_lobby_invitations(invitation_id,status,room_id,room_name,game_type,game_label,from_id,from_name,to_id) VALUES($1,'pending',$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[invitationId,room.roomId,room.roomName,room.gameType,room.gameLabel,fromId,normalizeDisplayName(fromName),toId]);
      await client.query("COMMIT");return databaseInvitation(inserted.rows[0]);
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{client.release()}
  }

  async respondInvitation({invitationId,userId,userName,accept}){
    if(!this.pool){const invitation=this.#invitations.get(invitationId);if(!invitation||invitation.toId!==userId||invitation.status!=="pending")throw new LobbyError("Zaproszenie nie jest już aktualne.","INVITATION_NOT_FOUND");invitation.status=accept?"accepted":"declined";if(!accept)return{accepted:false};const room=await this.joinRoom({roomId:invitation.roomId,playerId:userId,playerName:normalizeDisplayName(userName)});return{accepted:true,room}}
    await this.ready;
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const found=await client.query(`SELECT * FROM gracz_lobby_invitations WHERE invitation_id=$1 FOR UPDATE`,[invitationId]);
      const invitation=found.rows[0]?databaseInvitation(found.rows[0]):null;
      if(!invitation||invitation.toId!==userId||invitation.status!=="pending")throw new LobbyError("Zaproszenie nie jest już aktualne.","INVITATION_NOT_FOUND");
      if(!accept){await client.query(`UPDATE gracz_lobby_invitations SET status='declined' WHERE invitation_id=$1`,[invitationId]);await client.query("COMMIT");return{accepted:false}}
      const room=await this.#joinRoomDatabase({roomId:invitation.roomId,playerId:userId,playerName:normalizeDisplayName(userName)},client);
      await client.query(`UPDATE gracz_lobby_invitations SET status='accepted' WHERE invitation_id=$1`,[invitationId]);
      await client.query("COMMIT");return{accepted:true,room};
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{client.release()}
  }

  async joinRoom({roomId,playerId,playerName}){
    if(this.pool){await this.ready;const client=await this.pool.connect();try{await client.query("BEGIN");const room=await this.#joinRoomDatabase({roomId,playerId,playerName},client);await client.query("COMMIT");return room}catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}finally{client.release()}}
    const room=this.#rooms.get(roomId);if(!room)throw new LobbyError("Pokój nie istnieje.","ROOM_NOT_FOUND");if(room.status!=="waiting")throw new LobbyError("Pokój nie oczekuje na gracza.","ROOM_NOT_JOINABLE");if(room.seats.some(seat=>seat?.id===playerId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
    const freeSeat=room.seats.findIndex(seat=>seat===null);if(freeSeat<0)throw new LobbyError("Przy tym stole nie ma wolnych miejsc.","ROOM_FULL");room.seats[freeSeat]={id:playerId,name:normalizeDisplayName(playerName)};
    if(room.seats.every(Boolean)){
      const previousStatus=room.status,previousGameId=room.gameId;room.status="playing";
      try{await this.#startGame(room)}catch(error){room.seats[freeSeat]=null;room.status=previousStatus;room.gameId=previousGameId;throw error}
    }
    return publicRoom(room)
  }

  async #joinRoomDatabase({roomId,playerId,playerName},client){
    const result=await client.query(`SELECT * FROM gracz_lobby_rooms WHERE room_id=$1 FOR UPDATE`,[roomId]);
    const room=result.rows[0]?databaseRoom(result.rows[0]):null;
    if(!room)throw new LobbyError("Pokój nie istnieje.","ROOM_NOT_FOUND");if(room.status!=="waiting")throw new LobbyError("Pokój nie oczekuje na gracza.","ROOM_NOT_JOINABLE");if(room.seats.some(seat=>seat?.id===playerId))throw new LobbyError("Ten gracz już siedzi przy tym stole.","DUPLICATE_PLAYER");
    const freeSeat=room.seats.findIndex(seat=>seat===null);if(freeSeat<0)throw new LobbyError("Przy tym stole nie ma wolnych miejsc.","ROOM_FULL");room.seats[freeSeat]={id:playerId,name:normalizeDisplayName(playerName)};
    if(room.seats.every(Boolean)){room.status="playing";await this.#startGameDatabase(room,client)}
    await client.query(`UPDATE gracz_lobby_rooms SET seats=$2::jsonb,status=$3,game_id=$4,updated_at=NOW() WHERE room_id=$1`,[room.roomId,JSON.stringify(room.seats),room.status,room.gameId]);
    return publicRoom(room);
  }

  async #startGameDatabase(room,client){
    if(room.gameType==="thousand"&&!this.thousandService)throw new LobbyError("Silnik Tysiąca nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");
    if(room.gameType==="gomoku"&&!this.gomokuService)throw new LobbyError("Silnik Gomoku nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");
    try{
      room.gameId=await ensureLobbyGameInTransaction({client,room,thousandService:this.thousandService,gomokuService:this.gomokuService});
    }catch(error){
      if(error?.code==="LOBBY_GAME_IDENTITY_CONFLICT")throw new LobbyError(error.message,"GAME_IDENTITY_CONFLICT");
      if(error?.code==="GAME_SERVICE_UNAVAILABLE")throw new LobbyError(error.message,"GAME_SERVICE_UNAVAILABLE");
      throw error;
    }
    if(this.afterGameEnsured)await this.afterGameEnsured({room:publicRoom(room),client});
  }

  async #startGame(room){
    if(room.gameType==="thousand"){
      if(!this.thousandService)throw new LobbyError("Silnik Tysiąca nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");room.gameId=`thousand-${room.roomId}`;await this.thousandService.createGame({gameId:room.gameId,players:room.seats.map(seat=>({userId:seat.id,displayName:seat.name}))});return;
    }
    if(room.gameType==="gomoku"){
      if(!this.gomokuService)throw new LobbyError("Silnik Gomoku nie jest dostępny.","GAME_SERVICE_UNAVAILABLE");room.gameId=`gomoku-${room.roomId}`;await this.gomokuService.createGame({gameId:room.gameId,players:room.seats.map(seat=>({userId:seat.id,displayName:seat.name}))});return;
    }
    room.gameId=`game-${room.roomId}`;await this.sessionStore.create(createGameSession({gameId:room.gameId,whitePlayerId:room.seats[0].id,blackPlayerId:room.seats[1].id}));
  }

  async close(){return undefined}
}

function databaseRoom(row){const seats=Array.isArray(row.seats)?row.seats:JSON.parse(row.seats||"[]");return{roomId:row.room_id,roomName:row.room_name,gameType:row.game_type,gameLabel:row.game_label,maxPlayers:Number(row.max_players),status:row.status,seats:seats.map(seat=>seat?{id:seat.id,name:normalizeDisplayName(seat.name)}:null),gameId:row.game_id??null}}
function databaseInvitation(row){return{invitationId:row.invitation_id,status:row.status,roomId:row.room_id,roomName:row.room_name,gameType:row.game_type,gameLabel:row.game_label,fromId:row.from_id,fromName:normalizeDisplayName(row.from_name),toId:row.to_id,createdAt:new Date(row.created_at).getTime()}}
function playerProjection(presence,room){return{userId:presence.userId,displayName:normalizeDisplayName(presence.displayName),status:room?.status==="playing"?"w grze":room?.status==="waiting"?"przy stole":"dostępny",roomId:room?.roomId??null,roomName:room?.roomName??null,gameType:room?.gameType??null}}
function publicRoom(room){const seats=room.seats.map(seat=>seat?{id:seat.id,name:normalizeDisplayName(seat.name)}:null);return structuredClone({roomId:room.roomId,roomName:room.roomName,gameType:room.gameType,gameLabel:room.gameLabel,maxPlayers:room.maxPlayers,filledSeats:seats.filter(Boolean).length,status:room.status,seats,white:room.gameType==="checkers"?seats[0]:null,black:room.gameType==="checkers"?seats[1]:null,gameId:room.gameId})}
function requireRowArray(value,field){if(!Array.isArray(value))throw new Error(`PostgreSQL lobby zwrócił nieprawidłowe pole ${field}.`);return value}
function resolveSeatCount(gameType,requested,config){if(gameType!=="thousand")return config.max;const value=requested===null||requested===undefined?config.default:Number(requested);if(!Number.isInteger(value)||value<config.min||value>config.max)throw new LobbyError("Tysiąc obsługuje stoły dla 2, 3 lub 4 graczy.","INVALID_ROOM");return value}
function gameConfig(gameType){return requireGameDefinition(gameType,{capability:"lobby"})}
function normalizeDisplayName(value){if(typeof value!=="string")return value;if(value.localeCompare("Czeslaw","pl",{sensitivity:"base"})===0)return"Czesław";return value.normalize("NFC")}
function requireText(value,field){if(typeof value!=="string"||value.length<1||value.length>128)throw new LobbyError(`Pole ${field} jest nieprawidłowe.`,"INVALID_ROOM")}
