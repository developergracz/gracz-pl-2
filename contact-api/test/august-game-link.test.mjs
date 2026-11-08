import test from 'node:test';
import assert from 'node:assert/strict';
import {TournamentService} from '../auth/august/tournaments-service.mjs';

const tournament='11111111-1111-4111-8111-111111111111';
const board='22222222-2222-4222-8222-222222222222';
const white='33333333-3333-4333-8333-333333333333';
const black='44444444-4444-4444-8444-444444444444';
const challenge='55555555-5555-4555-8555-555555555555';
const owner='66666666-6666-4666-8666-666666666666';

async function harness({winner=1,format='swiss',linked=challenge,clock='5+0',
                         boundGame='gomoku',sender=white,recipient=black,
                         status='scheduled'}={}){
 const queries=[];
 const database={
  enabled:true,
  async query(sql,params=[]){
   queries.push({sql,params});
   if(sql.includes('CREATE TABLE IF NOT EXISTS'))return {rows:[],rowCount:0};
   if(sql.startsWith('SELECT game FROM gracz_public_identity.august_tournaments'))return {rows:[{game:'gomoku'}]};
   if(sql.includes('FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1 FOR UPDATE')){
    return {rows:[{owner_id:owner,game:'gomoku',format,status:'live',time_control:clock,current_round:1}]};
   }
   if(sql.includes('FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 AND match_id=$2 FOR UPDATE'))
    return {rows:[{white_id:white,black_id:black,round:1,status,game_challenge_id:linked}]};
   if(sql.includes('state->>'))return {rows:[{winner:String(winner)}]};
   if(sql.includes('count(*)::int AS count FROM gracz_public_identity.accounts'))return {rows:[{count:2}]};
   if(sql.includes('FROM gracz_public_identity.friend_blocks'))return {rows:[]};
   if(sql.includes('FROM gracz_public_identity.game_challenges c JOIN gracz_public_identity.game_matches m'))
    return {rows:[{status:'accepted',game:boundGame,sender_id:sender,recipient_id:recipient,state:{winner}}]};
   return {rows:[],rowCount:1};
  },
  async transaction(work){return work({query:(s,p)=>database.query(s,p)});}
 };
 const service=new TournamentService(database);
 await service.ready;
 service.recomputeStandings=async()=>{};
 service.advanceDatabase=async()=>{};
 service.detail=async()=>({ok:true});
 return {service,queries};
}

test('tournament participants launch accepted real game with stored pairing',async()=>{
 const {service,queries}=await harness({linked:null});
 const created=await service.launch({userId:white},tournament,board);
 assert.match(created.href,/^\/konto\/gomoku\/\?match=[0-9a-f-]{36}$/);
 const inserts=queries.filter(q=>q.sql.startsWith('INSERT INTO gracz_public_identity.game_challenges'));
 assert.equal(inserts.length,1);
 assert.equal(inserts[0].params[1],white);
 assert.equal(inserts[0].params[2],black);
 assert.equal(inserts[0].params[3],'gomoku');
 assert.equal(inserts[0].params[4],5);
 assert.equal(inserts[0].params[5],0);
 assert.equal(queries.some(q=>q.sql.includes('SET game_challenge_id=$3')),true);
});

test('third party cannot create game for another tournament pair',async()=>{
 const {service,queries}=await harness({linked:null});
 await assert.rejects(service.launch({userId:owner},tournament,board),e=>e.code==='MATCH_FORBIDDEN');
 assert.equal(queries.some(q=>q.sql.startsWith('INSERT INTO gracz_public_identity.game_challenges')),false);
});

test('existing pairing reopens the same game, without duplicate invitation',async()=>{
 const {service,queries}=await harness({linked:challenge});
 const existing=await service.launch({userId:black},tournament,board);
 assert.equal(existing.gameMatchId,challenge);
 assert.equal(queries.some(q=>q.sql.startsWith('INSERT INTO gracz_public_identity.game_challenges')),false);
});

test('match result is imported from server winner, never client score',async()=>{
 const {service,queries}=await harness({winner:2});
 await service.syncResult({userId:white},tournament,board);
 const update=queries.find(q=>q.sql.includes("SET result=$3,status='completed'"));
 assert.ok(update);
 assert.equal(update.params[2],'0-1');
});

test('unplayed or unfinished match never produces tournament points',async()=>{
 const {service,queries}=await harness({winner:0});
 await assert.rejects(service.syncResult({userId:white},tournament,board),e=>e.code==='MATCH_NOT_FINISHED');
 assert.equal(queries.some(q=>q.sql.includes("SET result=$3,status='completed'")),false);
});

test('foreign game cannot be used to validate tournament result',async()=>{
 const {service,queries}=await harness({sender:black,recipient:white});
 await assert.rejects(service.syncResult({userId:owner},tournament,board),e=>e.code==='MATCH_LINK_INVALID');
 assert.equal(queries.some(q=>q.sql.includes("SET result=$3,status='completed'")),false);
});

test('knockout draw requires replay rather than fictitious winner',async()=>{
 const {service,queries}=await harness({winner:3,format:'knockout'});
 await assert.rejects(service.syncResult({userId:black},tournament,board),e=>e.code==='MATCH_REPLAY_REQUIRED');
 assert.equal(queries.some(q=>q.sql.includes("SET result=$3,status='completed'")),false);
});

test('unsupported tournament clock is rejected rather than silently untimed',async()=>{
 const {service}=await harness();
 assert.throws(()=>service.validateCreate({title:'Puchar testowy',game:'gomoku',timeControl:'90+30'}),e=>e.code==='TOURNAMENT_TIME');
 assert.equal(service.validateCreate({title:'Puchar testowy',game:'gomoku',timeControl:'7+0'}).timeControl,'7+0');
});
