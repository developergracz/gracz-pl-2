import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {TournamentService} from '../auth/august/tournaments-service.mjs';

const url=String(process.env.DATABASE_URL||'');
const digest=token=>createHash('sha256').update(token).digest();
async function gameRequest(router,token,method,path,body){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 req.method=method;
 req.socket={remoteAddress:'127.0.0.1'};
 req.headers={cookie:'__Host-gracz_session='+token,origin:'https://gracz-contact-api.onrender.com','sec-fetch-site':'same-origin'};
 const res={status:0,body:null,headers:{},
  writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},
  setHeader(k,v){this.headers[k]=v;},
  end(body=''){this.body=body?JSON.parse(String(body)):null;}
 };
 await router.handle(req,res,new URL(path,'https://gracz-contact-api.onrender.com'));
 assert.equal(res.status,200,JSON.stringify({method,path,response:res.body}));
 return res.body;
}

test('August tournament: two verified users play Gomoku and advance round in real PostgreSQL',
 {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});

  const identity=createPublicIdentityRouter({database:db,emailFrom:'test@example.test',resendKey:'disposable-test-only'});
  await identity.probe();
  const service=new TournamentService(db);
  await service.ready;
  const ids=[];
  async function newUser(){
   const id=randomUUID(),nonce=randomUUID().replaceAll('-','').slice(0,16),nick='t'+nonce;
   await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
    [id,nick,nick,nick+'@example.test',Buffer.alloc(16),Buffer.alloc(64)]);
   const token=randomBytes(32).toString('hex');
   await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES ($1,$2,now()+interval '1 day')",[digest(token),id]);
   ids.push(id);
   return {userId:id,displayName:nick,token};
  }
  let tournamentId=null;
  t.after(async()=>{
   if(tournamentId)await db.query('DELETE FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1',[tournamentId]);
   try { for(const id of ids)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[id]); }
   finally { await db.close(); }
  });
  const white=await newUser(),black=await newUser();
  const tournament=await service.create(white,{title:'Test PG dwie osoby',game:'gomoku',format:'swiss',rounds:2,maxPlayers:4,timeControl:'0+0',visibility:'unlisted',rated:false});
  tournamentId=tournament.tournamentId;
  await service.join(black,tournamentId);
  const started=await service.start(white,tournamentId);
  assert.equal(started.tournament.currentRound,1);
  assert.equal(started.matches.length,1);
  const pair=started.matches[0];
  assert.equal(pair.whiteId,white.userId);
  assert.equal(pair.blackId,black.userId);
  const [openedWhite,openedBlack]=await Promise.all([service.launch(white,tournamentId,pair.matchId),service.launch(black,tournamentId,pair.matchId)]);
  assert.equal(openedWhite.gameMatchId,openedBlack.gameMatchId,'both participants must share one game');
  const gameId=openedWhite.gameMatchId;
  assert.match(openedWhite.href,/^\/konto\/gomoku\/\?match=/);
  let match=(await gameRequest(identity,white.token,'GET','/auth/match?id='+gameId)).match;
  const whiteStones=[112,113,114,115,116],blackStones=[0,1,2,3];
  for(let n=0;n<9;n++){
   const actor=n%2===0?white:black;
   const to=n%2===0?whiteStones[n/2]:blackStones[(n-1)/2];
   match=(await gameRequest(identity,actor.token,'POST','/auth/match',{id:gameId,version:match.version,move:{to}})).match;
  }
  assert.equal(match.state.winner,1,'server must determine winner');
  const verified=await service.syncResult(white,tournamentId,pair.matchId);
  assert.equal(verified.tournament.currentRound,2);
  assert.equal(verified.matches.find(x=>x.matchId===pair.matchId).result,'1-0');
  assert.equal(verified.players.find(x=>x.userId===white.userId).points,1);
  assert.equal(verified.players.find(x=>x.userId===black.userId).points,0);
  assert.equal(verified.matches.filter(x=>x.round===2).length,1,'next round is created');
  await assert.rejects(service.syncResult(black,tournamentId,pair.matchId),e=>e.code==='MATCH_COMPLETED');
});
