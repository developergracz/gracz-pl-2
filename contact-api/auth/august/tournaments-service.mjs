import { randomUUID } from "node:crypto";
const GAMES = new Set(["warcaby", "gomoku", "szachy"]);
const FORMATS = new Set(["swiss", "knockout", "round_robin"]);
const TOURNAMENT_TIMES=new Set([0,1,2,3,5,7,10,15,30]);
const TOURNAMENT_INCREMENT=new Set([0,2,3,5,10]);
function parseTime(value){
  const matched=/^(0|[1-9]\d{0,2})\+(0|[1-9]\d?)$/.exec(String(value));
  if(!matched)throw tournamentError("Nieprawidłowe tempo partii.","TOURNAMENT_TIME",400);
  const minutes=Number(matched[1]),increment=Number(matched[2]);
  if(!TOURNAMENT_TIMES.has(minutes)||!TOURNAMENT_INCREMENT.has(increment)||(minutes===0&&increment!==0))
    throw tournamentError("Wybierz tempo obsługiwane przez obecne gry.","TOURNAMENT_TIME",400);
  return {minutes,increment};
}

export class TournamentService {
  constructor(database) {
    if (!database?.enabled) throw new Error("TOURNAMENT_DATABASE_REQUIRED");
    this.pool = database;
    this.memory = new Map();
    this.ready = this.init();
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_public_identity.august_tournaments (
        tournament_id UUID PRIMARY KEY,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        game TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'registration',
        visibility TEXT NOT NULL DEFAULT 'public',
        max_players INTEGER NOT NULL DEFAULT 16,
        rounds INTEGER NOT NULL DEFAULT 5,
        time_control TEXT NOT NULL DEFAULT '5+0',
        rated BOOLEAN NOT NULL DEFAULT TRUE,
        starts_at TIMESTAMPTZ NULL,
        current_round INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ NULL
      );
      CREATE INDEX IF NOT EXISTS gracz_public_identity.august_tournaments_status_idx ON gracz_public_identity.august_tournaments(status, starts_at);
      CREATE TABLE IF NOT EXISTS gracz_public_identity.august_tournament_players (
        tournament_id UUID NOT NULL REFERENCES gracz_public_identity.august_tournaments(tournament_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        seed INTEGER NOT NULL DEFAULT 0,
        points NUMERIC(6,2) NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        buchholz NUMERIC(8,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(tournament_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS gracz_public_identity.august_tournament_matches (
        match_id UUID PRIMARY KEY,
        tournament_id UUID NOT NULL REFERENCES gracz_public_identity.august_tournaments(tournament_id) ON DELETE CASCADE,
        round INTEGER NOT NULL,
        board INTEGER NOT NULL,
        white_id TEXT NULL,
        white_name TEXT NULL,
        black_id TEXT NULL,
        black_name TEXT NULL,
        result TEXT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        reported_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NULL
      );
      CREATE INDEX IF NOT EXISTS gracz_public_identity.august_tournament_matches_idx ON gracz_public_identity.august_tournament_matches(tournament_id, round, board);
      ALTER TABLE gracz_public_identity.august_tournament_matches
        ADD COLUMN IF NOT EXISTS game_challenge_id uuid
        REFERENCES gracz_public_identity.game_challenges(id) ON DELETE SET NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS august_tournament_game_challenge_unique
        ON gracz_public_identity.august_tournament_matches(game_challenge_id);
    `);
  }

  cleanText(value, max = 160) { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max); }

  validateCreate(input = {}) {
    const title = this.cleanText(input.title, 80);
    if (title.length < 3) throw tournamentError("Podaj nazwę turnieju (minimum 3 znaki).", "TOURNAMENT_TITLE", 400);
    const game = GAMES.has(input.game) ? input.game : "warcaby";
    const format = FORMATS.has(input.format) ? input.format : "swiss";
    const maxPlayers = Math.max(4, Math.min(128, Number(input.maxPlayers) || 16));
    const rounds = Math.max(1, Math.min(15, Number(input.rounds) || Math.ceil(Math.log2(maxPlayers)) + 1));
    const timeControl=String(input.timeControl||"5+0");
    parseTime(timeControl);
    const startsAt = input.startsAt && !Number.isNaN(new Date(input.startsAt).valueOf()) ? new Date(input.startsAt).toISOString() : null;
    return { title, description: this.cleanText(input.description, 600), game, format, maxPlayers, rounds, timeControl, startsAt, rated: input.rated !== false, visibility: input.visibility === "unlisted" ? "unlisted" : "public" };
  }

  async create(user, input) {
    const data = this.validateCreate(input);
    const item = { tournamentId: randomUUID(), ownerId: user.userId, ownerName: user.displayName, ...data, status: "registration", currentRound: 0, createdAt: new Date().toISOString(), finishedAt: null };
    if (!this.pool) {
      this.memory.set(item.tournamentId, { tournament: item, players: [{ userId:user.userId, displayName:user.displayName, seed:1, points:0, wins:0, draws:0, losses:0, buchholz:0, status:"active", joinedAt:new Date().toISOString() }], matches: [] });
      return item;
    }
    await this.pool.transaction(async db=>{
    await db.query(`INSERT INTO gracz_public_identity.august_tournaments(tournament_id,owner_id,owner_name,title,description,game,format,visibility,max_players,rounds,time_control,rated,starts_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [item.tournamentId,item.ownerId,item.ownerName,item.title,item.description,item.game,item.format,item.visibility,item.maxPlayers,item.rounds,item.timeControl,item.rated,item.startsAt]);
    await db.query(`INSERT INTO gracz_public_identity.august_tournament_players(tournament_id,user_id,display_name,seed) VALUES($1,$2,$3,1)`, [item.tournamentId,user.userId,user.displayName]);
    });
    return item;
  }

  async list(user, query = {}) {
    if (!this.pool) {
      let rows = [...this.memory.values()].map((x) => ({ ...x.tournament, playerCount:x.players.length, joined:x.players.some((p)=>p.userId===user.userId) }));
      return filterList(rows, query);
    }
    const { rows } = await this.pool.query(`SELECT t.*, COUNT(p.user_id)::int AS player_count, BOOL_OR(p.user_id=$1) AS joined FROM gracz_public_identity.august_tournaments t LEFT JOIN gracz_public_identity.august_tournament_players p ON p.tournament_id=t.tournament_id WHERE t.visibility='public' OR t.owner_id=$1 OR EXISTS(SELECT 1 FROM gracz_public_identity.august_tournament_players own WHERE own.tournament_id=t.tournament_id AND own.user_id=$1) GROUP BY t.tournament_id ORDER BY CASE t.status WHEN 'live' THEN 0 WHEN 'registration' THEN 1 ELSE 2 END, COALESCE(t.starts_at,t.created_at) ASC LIMIT 200`, [user.userId]);
    return filterList(rows.map(mapTournament), query);
  }

  async detail(user, id) {
    if (!this.pool) {
      const data=this.memory.get(id); if(!data) throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      return { tournament:{...data.tournament,playerCount:data.players.length,joined:data.players.some(p=>p.userId===user.userId)}, players:sortStandings(data.players), matches:data.matches };
    }
    const t = await this.pool.query(`SELECT t.*, COUNT(p.user_id)::int AS player_count, BOOL_OR(p.user_id=$2) AS joined FROM gracz_public_identity.august_tournaments t LEFT JOIN gracz_public_identity.august_tournament_players p ON p.tournament_id=t.tournament_id WHERE t.tournament_id=$1 GROUP BY t.tournament_id`, [id,user.userId]);
    if(!t.rows[0]) throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
    const p=await this.pool.query(`SELECT user_id,display_name,seed,points,wins,draws,losses,buchholz,status,joined_at FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1 ORDER BY points DESC,buchholz DESC,wins DESC,seed ASC`,[id]);
    const m=await this.pool.query(`SELECT match_id,round,board,white_id,white_name,black_id,black_name,result,status,created_at,completed_at,game_challenge_id FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 ORDER BY round,board`,[id]);
    return { tournament:mapTournament(t.rows[0]), players:p.rows.map(mapPlayer), matches:m.rows.map(mapMatch) };
  }


  async join(user,id){
    await this.pool.transaction(async db=>{
      const locked=await db.query('SELECT owner_id,status,max_players FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1 FOR UPDATE',[id]);
      if(!locked.rows.length)throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      const t=locked.rows[0];
      if(t.status!=='registration')throw tournamentError("Zapisy są zamknięte.","REGISTRATION_CLOSED",409);
      const total=await db.query('SELECT COUNT(*)::int AS count FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1',[id]);
      const already=await db.query('SELECT 1 FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1 AND user_id=$2',[id,user.userId]);
      if(already.rows.length)return;
      if(total.rows[0].count>=t.max_players)throw tournamentError("Brak wolnych miejsc.","TOURNAMENT_FULL",409);
      await db.query('INSERT INTO gracz_public_identity.august_tournament_players(tournament_id,user_id,display_name,seed) VALUES ($1,$2,$3,$4)',[id,user.userId,user.displayName,total.rows[0].count+1]);
    });
    return {ok:true};
  }
  async leave(user,id){
    await this.pool.transaction(async db=>{
      const locked=await db.query('SELECT owner_id,status FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1 FOR UPDATE',[id]);
      if(!locked.rows.length)throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      const t=locked.rows[0];
      if(t.owner_id===user.userId)throw tournamentError("Organizator nie może się wycofać.","OWNER_CANNOT_LEAVE",409);
      if(t.status!=='registration')throw tournamentError("Turniej już trwa.","TOURNAMENT_STARTED",409);
      await db.query('DELETE FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1 AND user_id=$2',[id,user.userId]);
    });
    return {ok:true};
  }
  async start(user,id){
    await this.pool.transaction(async db=>{
      const locked=await db.query('SELECT owner_id,status,format FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1 FOR UPDATE',[id]);
      if(!locked.rows.length)throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      const t=locked.rows[0];
      if(t.owner_id!==user.userId)throw tournamentError("Tylko organizator może rozpocząć turniej.","TOURNAMENT_FORBIDDEN",403);
      if(t.status!=='registration')throw tournamentError("Turniej już trwa.","TOURNAMENT_STARTED",409);
      const players=(await db.query('SELECT user_id,display_name,seed,points,wins,draws,losses,buchholz,status,joined_at FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1 ORDER BY seed ASC',[id])).rows.map(mapPlayer);
      if(players.length<2)throw tournamentError("Potrzebnych jest dwóch graczy.","NOT_ENOUGH_PLAYERS",409);
      for(const m of createPairings(players,[],1,t.format)){
        await db.query('INSERT INTO gracz_public_identity.august_tournament_matches(match_id,tournament_id,round,board,white_id,white_name,black_id,black_name,result,status,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [m.matchId,id,m.round,m.board,m.whiteId,m.whiteName,m.blackId,m.blackName,m.result,m.status,m.completedAt]);
      }
      await db.query("UPDATE gracz_public_identity.august_tournaments SET status='live',current_round=1 WHERE tournament_id=$1",[id]);
    });
    return this.detail(user,id);
  }
  async insertMatches(id,matches,db=this.pool){
    for(const m of matches) await db.query(`INSERT INTO gracz_public_identity.august_tournament_matches(match_id,tournament_id,round,board,white_id,white_name,black_id,black_name,result,status,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[m.matchId,id,m.round,m.board,m.whiteId,m.whiteName,m.blackId,m.blackName,m.result,m.status,m.completedAt]);
  }

  async report(user,id,matchId,result){
    if(!RESULTS.has(result))throw tournamentError("Nieprawidłowy wynik.","INVALID_RESULT",400);
    await this.pool.transaction(async db=>{
      // Lock the tournament first: simultaneous match reports cannot advance
      // the same round twice or recompute points from intermediate state.
      const t=await db.query('SELECT owner_id,status FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1 FOR UPDATE',[id]);
      if(!t.rows.length)throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      if(t.rows[0].owner_id!==user.userId)throw tournamentError("Wyniki ręczne zatwierdza organizator.","MATCH_FORBIDDEN",403);
      if(t.rows[0].status!=='live')throw tournamentError("Turniej nie jest w trakcie.","TOURNAMENT_NOT_LIVE",409);
      const m=await db.query('SELECT match_id,status,black_id FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 AND match_id=$2 FOR UPDATE',[id,matchId]);
      if(!m.rows.length)throw tournamentError("Nie znaleziono partii.","MATCH_NOT_FOUND",404);
      if(m.rows[0].status==='completed')throw tournamentError("Wynik już zapisany.","MATCH_COMPLETED",409);
      if(!m.rows[0].black_id)throw tournamentError("Wolny los nie wymaga zgłoszenia.","MATCH_BYE",409);
      await db.query("UPDATE gracz_public_identity.august_tournament_matches SET result=$3,status='completed',reported_by=$4,completed_at=now() WHERE tournament_id=$1 AND match_id=$2",[id,matchId,result,user.userId]);
      await this.recomputeStandings(id,db);
      await this.advanceDatabase(id,db);
    });
    return this.detail(user,id);
  }

  async recomputeStandings(id,db=this.pool){
    const matches=await db.query(`SELECT white_id,black_id,result FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 AND status='completed'`,[id]);
    const players=await db.query(`SELECT user_id FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1`,[id]); const scores=new Map(players.rows.map(p=>[p.user_id,{points:0,wins:0,draws:0,losses:0}]));
    for(const m of matches.rows){if(m.white_id&&!m.black_id&&m.result==='1-0'){const p=scores.get(m.white_id);if(p){p.points+=1;p.wins++;}}if(!m.white_id||!m.black_id)continue;const w=scores.get(m.white_id),b=scores.get(m.black_id);if(!w||!b)continue;if(m.result==="1-0"){w.points+=1;w.wins++;b.losses++;}else if(m.result==="0-1"){b.points+=1;b.wins++;w.losses++;}else{w.points+=.5;b.points+=.5;w.draws++;b.draws++;}}
    for(const [uid,s] of scores) await db.query(`UPDATE gracz_public_identity.august_tournament_players SET points=$3,wins=$4,draws=$5,losses=$6 WHERE tournament_id=$1 AND user_id=$2`,[id,uid,s.points,s.wins,s.draws,s.losses]);
    const standings=await db.query(`SELECT user_id,points FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1`,[id]); const pointMap=new Map(standings.rows.map(r=>[r.user_id,Number(r.points)])); const bh=new Map([...pointMap.keys()].map(k=>[k,0])); for(const m of matches.rows){if(m.white_id&&m.black_id){bh.set(m.white_id,(bh.get(m.white_id)||0)+(pointMap.get(m.black_id)||0));bh.set(m.black_id,(bh.get(m.black_id)||0)+(pointMap.get(m.white_id)||0));}} for(const [uid,v] of bh) await db.query(`UPDATE gracz_public_identity.august_tournament_players SET buchholz=$3 WHERE tournament_id=$1 AND user_id=$2`,[id,uid,v]);
  }

  async advanceDatabase(id,db=this.pool){
    const t=(await db.query(`SELECT format,rounds,current_round FROM gracz_public_identity.august_tournaments WHERE tournament_id=$1`,[id])).rows[0]; const open=(await db.query(`SELECT COUNT(*)::int c FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 AND round=$2 AND status<>'completed'`,[id,t.current_round])).rows[0].c; if(open>0)return;
    const players=(await db.query(`SELECT user_id,display_name,seed,points,wins,draws,losses,buchholz,status,joined_at FROM gracz_public_identity.august_tournament_players WHERE tournament_id=$1 ORDER BY points DESC,buchholz DESC,wins DESC,seed`,[id])).rows.map(mapPlayer);
    if(t.format==="knockout"){const current=(await db.query(`SELECT white_id,white_name,black_id,black_name,result FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1 AND round=$2 ORDER BY board`,[id,t.current_round])).rows;const winners=current.map(m=>m.result==="1-0"?{userId:m.white_id,displayName:m.white_name}:m.result==="0-1"?{userId:m.black_id,displayName:m.black_name}:null).filter(Boolean);if(winners.length<=1){await db.query(`UPDATE gracz_public_identity.august_tournaments SET status='finished',finished_at=NOW() WHERE tournament_id=$1`,[id]);return;}const next=t.current_round+1;await db.query(`UPDATE gracz_public_identity.august_tournaments SET current_round=$2 WHERE tournament_id=$1`,[id,next]);await this.insertMatches(id,createPairings(winners,[],next,"knockout"),db);return;}
    if(t.current_round>=t.rounds){await db.query(`UPDATE gracz_public_identity.august_tournaments SET status='finished',finished_at=NOW() WHERE tournament_id=$1`,[id]);return;}
    const previous=(await db.query(`SELECT white_id,black_id FROM gracz_public_identity.august_tournament_matches WHERE tournament_id=$1`,[id])).rows; const next=t.current_round+1; await db.query(`UPDATE gracz_public_identity.august_tournaments SET current_round=$2 WHERE tournament_id=$1`,[id,next]); await this.insertMatches(id,createPairings(players,previous,next,t.format),db);
  }

  async advanceMemory(user,id){const d=this.memory.get(id),t=d.tournament;if(d.matches.some(m=>m.round===t.currentRound&&m.status!=="completed"))return;if(t.format==="knockout"){const winners=d.matches.filter(m=>m.round===t.currentRound).map(m=>m.result==="1-0"?d.players.find(p=>p.userId===m.whiteId):m.result==="0-1"?d.players.find(p=>p.userId===m.blackId):null).filter(Boolean);if(winners.length<=1){t.status="finished";t.finishedAt=new Date().toISOString();return;}t.currentRound++;d.matches.push(...createPairings(winners,[],t.currentRound,"knockout"));return;}if(t.currentRound>=t.rounds){t.status="finished";t.finishedAt=new Date().toISOString();return;}t.currentRound++;d.matches.push(...createPairings(sortStandings(d.players),d.matches,t.currentRound,t.format));}
  async close(){}
}


function createPairings(players,previous,round,format){const list=[...players];if(format!=="knockout")list.sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0)||(Number(b.buchholz)||0)-(Number(a.buchholz)||0)||(a.seed||0)-(b.seed||0));const played=new Set(previous.map(m=>[m.white_id||m.whiteId,m.black_id||m.blackId].sort().join("|")));const out=[];let board=1;while(list.length>1){const a=list.shift();let idx=format==="knockout"?0:list.findIndex(b=>!played.has([a.userId,b.userId].sort().join("|")));if(idx<0)idx=0;const b=list.splice(idx,1)[0];const swap=round%2===0;out.push({matchId:randomUUID(),round,board:board++,whiteId:swap?b.userId:a.userId,whiteName:swap?b.displayName:a.displayName,blackId:swap?a.userId:b.userId,blackName:swap?a.displayName:b.displayName,result:null,status:"scheduled",completedAt:null});}if(list.length){const a=list[0];out.push({matchId:randomUUID(),round,board:board++,whiteId:a.userId,whiteName:a.displayName,blackId:null,blackName:"BYE",result:"1-0",status:"completed",completedAt:new Date().toISOString()});}return out;}
function applyResult(players,m,result){const w=players.find(p=>p.userId===m.whiteId),b=players.find(p=>p.userId===m.blackId);if(!w||!b)return;if(result==="1-0"){w.points+=1;w.wins++;b.losses++;}else if(result==="0-1"){b.points+=1;b.wins++;w.losses++;}else{w.points+=.5;b.points+=.5;w.draws++;b.draws++;}}
function sortStandings(p){return [...p].sort((a,b)=>Number(b.points)-Number(a.points)||Number(b.buchholz)-Number(a.buchholz)||b.wins-a.wins||a.seed-b.seed);}
function filterList(rows,q){const status=q.status;const game=q.game;const text=String(q.q||"").toLowerCase();const mine=q.mine==="1";return rows.filter(t=>(!status||status==="all"||t.status===status)&&(!game||game==="all"||t.game===game)&&(!mine||t.joined)&&( !text||`${t.title} ${t.ownerName} ${t.description}`.toLowerCase().includes(text)));}
function mapTournament(r){return{tournamentId:r.tournament_id,ownerId:r.owner_id,ownerName:r.owner_name,title:r.title,description:r.description,game:r.game,format:r.format,status:r.status,visibility:r.visibility,maxPlayers:r.max_players,rounds:r.rounds,timeControl:r.time_control,rated:Boolean(r.rated),startsAt:r.starts_at,currentRound:r.current_round,createdAt:r.created_at,finishedAt:r.finished_at,playerCount:Number(r.player_count||0),joined:Boolean(r.joined)};}
function mapPlayer(r){return{userId:r.user_id,displayName:r.display_name,seed:r.seed,points:Number(r.points),wins:r.wins,draws:r.draws,losses:r.losses,buchholz:Number(r.buchholz),status:r.status,joinedAt:r.joined_at};}
function mapMatch(r){return{matchId:r.match_id,round:r.round,board:r.board,whiteId:r.white_id,whiteName:r.white_name,blackId:r.black_id,blackName:r.black_name,result:r.result,status:r.status,gameMatchId:r.game_challenge_id||null,createdAt:r.created_at,completedAt:r.completed_at};}
function tournamentError(message,code,status){const e=new Error(message);e.code=code;e.status=status;return e;}
