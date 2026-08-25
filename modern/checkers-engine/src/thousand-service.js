import { randomUUID } from 'node:crypto';
import {
  applyThousandAction,
  createThousandInitialState,
  getLegalThousandCards,
  shuffleThousandDeck,
  startNextThousandRound,
  thousandPublicView,
} from './thousand-engine.js';
import { MemoryThousandRepository } from './thousand-repository.js';

export class ThousandServiceError extends Error {
  constructor(message,code='THOUSAND_SERVICE_ERROR'){
    super(message);
    this.name='ThousandServiceError';
    this.code=code;
  }
}

export class ThousandGameService {
  constructor({repository=new MemoryThousandRepository(),random=Math.random}={}){
    this.repository=repository;
    this.random=random;
  }

  async createGame({players,gameId=randomUUID(),dealerIndex=0,rules}={}){
    const normalizedPlayers=normalizePlayers(players);
    const deck=shuffleThousandDeck(undefined,this.random);
    const state=createThousandInitialState({dealerIndex,deck,rules,playerCount:normalizedPlayers.length});
    return this.repository.create({gameId,players:normalizedPlayers,state});
  }

  async getView(gameId,userId){
    const record=await this.repository.get(assertGameId(gameId));
    const playerIndex=findPlayerIndex(record.players,userId);
    return buildView(record,playerIndex);
  }

  async performAction(gameId,userId,action,{expectedRevision=null}={}){
    const record=await this.repository.get(assertGameId(gameId));
    if(expectedRevision!==null&&record.revision!==Number(expectedRevision)){
      throw new ThousandServiceError('Widok gry jest nieaktualny. Odśwież stan partii.','STALE_GAME_REVISION');
    }
    const playerIndex=findPlayerIndex(record.players,userId);
    const safeAction={...structuredClone(action),playerIndex};
    const nextState=applyThousandAction(record.state,safeAction);
    const saved=await this.repository.save(record.gameId,record.revision,{...record,state:nextState});
    return buildView(saved,playerIndex);
  }

  async nextRound(gameId,userId,{expectedRevision=null}={}){
    const record=await this.repository.get(assertGameId(gameId));
    if(expectedRevision!==null&&record.revision!==Number(expectedRevision)){
      throw new ThousandServiceError('Widok gry jest nieaktualny. Odśwież stan partii.','STALE_GAME_REVISION');
    }
    const playerIndex=findPlayerIndex(record.players,userId);
    const nextState=startNextThousandRound(record.state,{deck:shuffleThousandDeck(undefined,this.random)});
    const saved=await this.repository.save(record.gameId,record.revision,{...record,state:nextState});
    return buildView(saved,playerIndex);
  }

  async close(){if(typeof this.repository.close==='function') await this.repository.close();}
}

function buildView(record,playerIndex){
  const state=thousandPublicView(record.state,playerIndex);
  state.history=[];
  const legalCardIds=record.state.status==='playing'&&record.state.currentPlayerIndex===playerIndex?getLegalThousandCards(record.state,playerIndex):[];
  return {
    gameId:record.gameId,
    revision:record.revision,
    playerCount:record.players.length,
    players:record.players.map((player,index)=>({userId:player.userId,displayName:player.displayName,seat:index})),
    viewerIndex:playerIndex,
    state,
    legalCardIds,
    updatedAt:record.updatedAt,
  };
}

function normalizePlayers(players){
  if(!Array.isArray(players)||players.length<2||players.length>4){
    throw new ThousandServiceError('Tysiąc obsługuje od dwóch do czterech graczy.','INVALID_PLAYER_COUNT');
  }
  const seen=new Set();
  return players.map((player,index)=>{
    const userId=String(player?.userId??'').trim().toLowerCase();
    const displayName=String(player?.displayName??'').trim();
    if(!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(userId)) throw new ThousandServiceError(`Nieprawidłowy identyfikator gracza na miejscu ${index+1}.`,'INVALID_PLAYER');
    if(displayName.length<1||displayName.length>64) throw new ThousandServiceError(`Nieprawidłowa nazwa gracza na miejscu ${index+1}.`,'INVALID_PLAYER');
    if(seen.has(userId)) throw new ThousandServiceError('Każde miejsce przy stole musi należeć do innego gracza.','DUPLICATE_PLAYER');
    seen.add(userId);
    return {userId,displayName};
  });
}

function findPlayerIndex(players,userId){
  const normalized=String(userId??'').trim().toLowerCase();
  const index=players.findIndex(player=>player.userId===normalized);
  if(index<0) throw new ThousandServiceError('Nie jesteś uczestnikiem tej partii.','NOT_GAME_PLAYER');
  return index;
}

function assertGameId(gameId){
  const value=String(gameId??'').trim();
  if(!/^[a-zA-Z0-9_-]{8,96}$/.test(value)) throw new ThousandServiceError('Nieprawidłowy identyfikator gry.','INVALID_GAME_ID');
  return value;
}
