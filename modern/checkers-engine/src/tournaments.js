import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const GAMES = new Set(["warcaby", "gomoku", "szachy"]);
const FORMATS = new Set(["swiss", "knockout", "round_robin"]);
const RESULTS = new Set(["1-0", "0-1", "1/2-1/2"]);

export class TournamentService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } }) : null;
    this.memory = new Map();
    this.ready = this.pool ? this.init() : Promise.resolve();
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_tournaments (
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
      CREATE INDEX IF NOT EXISTS gracz_tournaments_status_idx ON gracz_tournaments(status, starts_at);
      CREATE TABLE IF NOT EXISTS gracz_tournament_players (
        tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
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
      CREATE TABLE IF NOT EXISTS gracz_tournament_matches (
        match_id UUID PRIMARY KEY,
        tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS gracz_tournament_matches_idx ON gracz_tournament_matches(tournament_id, round, board);
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
    const timeControl = /^\d{1,3}(\+\d{1,2})?$/.test(String(input.timeControl || "")) ? String(input.timeControl) : "5+0";
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
    await this.pool.query(`INSERT INTO gracz_tournaments(tournament_id,owner_id,owner_name,title,description,game,format,visibility,max_players,rounds,time_control,rated,starts_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [item.tournamentId,item.ownerId,item.ownerName,item.title,item.description,item.game,item.format,item.visibility,item.maxPlayers,item.rounds,item.timeControl,item.rated,item.startsAt]);
    await this.pool.query(`INSERT INTO gracz_tournament_players(tournament_id,user_id,display_name,seed) VALUES($1,$2,$3,1)`, [item.tournamentId,user.userId,user.displayName]);
    return item;
  }

  async list(user, query = {}) {
    if (!this.pool) {
      let rows = [...this.memory.values()].map((x) => ({ ...x.tournament, playerCount:x.players.length, joined:x.players.some((p)=>p.userId===user.userId) }));
      return filterList(rows, query);
    }
    const { rows } = await this.pool.query(`SELECT t.*, COUNT(p.user_id)::int AS player_count, BOOL_OR(p.user_id=$1) AS joined FROM gracz_tournaments t LEFT JOIN gracz_tournament_players p ON p.tournament_id=t.tournament_id GROUP BY t.tournament_id ORDER BY CASE t.status WHEN 'live' THEN 0 WHEN 'registration' THEN 1 ELSE 2 END, COALESCE(t.starts_at,t.created_at) ASC LIMIT 200`, [user.userId]);
    return filterList(rows.map(mapTournament), query);
  }

  async detail(user, id) {
    if (!this.pool) {
      const data=this.memory.get(id); if(!data) throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
      return { tournament:{...data.tournament,playerCount:data.players.length,joined:data.players.some(p=>p.userId===user.userId)}, players:sortStandings(data.players), matches:data.matches };
    }
    const t = await this.pool.query(`SELECT t.*, COUNT(p.user_id)::int AS player_count, BOOL_OR(p.user_id=$2) AS joined FROM gracz_tournaments t LEFT JOIN gracz_tournament_players p ON p.tournament_id=t.tournament_id WHERE t.tournament_id=$1 GROUP BY t.tournament_id`, [id,user.userId]);
    if(!t.rows[0]) throw tournamentError("Nie znaleziono turnieju.","TOURNAMENT_NOT_FOUND",404);
    const p=await this.pool.query(`SELECT user_id,display_name,seed,points,wins,draws,losses,buchholz,status,joined_at FROM gracz_tournament_players WHERE tournament_id=$1 ORDER BY points DESC,buchholz DESC,wins DESC,seed ASC`,[id]);
    const m=await this.pool.query(`SELECT match_id,round,board,white_id,white_name,black_id,black_name,result,status,created_at,completed_at FROM gracz_tournament_matches WHERE tournament_id=$1 ORDER BY round,board`,[id]);
    return { tournament:mapTournament(t.rows[0]), players:p.rows.map(mapPlayer), matches:m.rows.map(mapMatch) };
  }

  async join(user,id){
    const detail=await this.detail(user,id); const t=detail.tournament;
    if(t.status!=="registration") throw tournamentError("Zapisy do tego turnieju są zamknięte.","REGISTRATION_CLOSED",409);
    if(t.joined) return {ok:true};
    if(t.playerCount>=t.maxPlayers) throw tournamentError("Brak wolnych miejsc.","TOURNAMENT_FULL",409);
    if(!this.pool){const d=this.memory.get(id);d.players.push({userId:user.userId,displayName:user.displayName,seed:d.players.length+1,points:0,wins:0,draws:0,losses:0,buchholz:0,status:"active",joinedAt:new Date().toISOString()});return{ok:true};}
    await this.pool.query(`INSERT INTO gracz_tournament_players(tournament_id,user_id,display_name,seed) VALUES($1,$2,$3,(SELECT COALESCE(MAX(seed),0)+1 FROM gracz_tournament_players WHERE tournament_id=$1)) ON CONFLICT DO NOTHING`,[id,user.userId,user.displayName]); return{ok:true};
  }

  async leave(user,id){
    const detail=await this.detail(user,id); if(detail.tournament.ownerId===user.userId) throw tournamentError("Organizator nie może opuścić własnego turnieju.","OWNER_CANNOT_LEAVE",409); if(detail.tournament.status!=="registration") throw tournamentError("Nie można wycofać się po rozpoczęciu turnieju.","TOURNAMENT_STARTED",409);
    if(!this.pool){const d=this.memory.get(id);d.players=d.players.filter(p=>p.userId!==user.userId);return{ok:true};}
    await this.pool.query(`DELETE FROM gracz_tournament_players WHERE tournament_id=$1 AND user_id=$2`,[id,user.userId]);return{ok:true};
  }

  async start(user,id){
    const detail=await this.detail(user,id); const t=detail.tournament;
    if(t.ownerId!==user.userId) throw tournamentError("Tylko organizator może rozpocząć turniej.","TOURNAMENT_FORBIDDEN",403);
    if(t.status!=="registration") throw tournamentError("Turniej został już rozpoczęty.","TOURNAMENT_STARTED",409);
    if(detail.players.length<2) throw tournamentError("Do rozpoczęcia potrzebnych jest co najmniej 2 graczy.","NOT_ENOUGH_PLAYERS",409);
    if(!this.pool){const d=this.memory.get(id);d.tournament.status="live";d.tournament.currentRound=1;d.matches=createPairings(d.players,[],1,t.format);return this.detail(user,id);}
    await this.pool.query(`UPDATE gracz_tournaments SET status='live',current_round=1 WHERE tournament_id=$1`,[id]);
    const pairings=createPairings(detail.players,[],1,t.format); await this.insertMatches(id,pairings); return this.detail(user,id);
  }

  async insertMatches(id,matches){
    for(const m of matches) await this.pool.query(`INSERT INTO gracz_tournament_matches(match_id,tournament_id,round,board,white_id,white_name,black_id,black_name,result,status,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[m.matchId,id,m.round,m.board,m.whiteId,m.whiteName,m.blackId,m.blackName,m.result,m.status,m.completedAt]);
  }

  async report(user,id,matchId,result){
    if(!RESULTS.has(result)) throw tournamentError("Nieprawidłowy wynik.","INVALID_RESULT",400);
    const detail=await this.detail(user,id); const t=detail.tournament; const match=detail.matches.find(m=>m.matchId===matchId);
    if(!match) throw tournamentError("Nie znaleziono pary turniejowej.","MATCH_NOT_FOUND",404);
    if(t.ownerId!==user.userId && match.whiteId!==user.userId && match.blackId!==user.userId) throw tournamentError("Nie możesz zgłosić wyniku tej partii.","MATCH_FORBIDDEN",403);
    if(match.status==="completed") throw tournamentError("Wynik tej partii został już zapisany.","MATCH_COMPLETED",409);
    if(!this.pool){match.result=result;match.status="completed";match.completedAt=new Date().toISOString();applyResult(this.memory.get(id).players,match,result);await this.advanceMemory(user,id);return this.detail(user,id);}
    await this.pool.query(`UPDATE gracz_tournament_matches SET result=$3,status='completed',reported_by=$4,completed_at=NOW() WHERE tournament_id=$1 AND match_id=$2 AND status<>'completed'`,[id,matchId,result,user.userId]);
    await this.recomputeStandings(id); await this.advanceDatabase(id); return this.detail(user,id);
  }

  async recomputeStandings(id){
    const matches=await this.pool.query(`SELECT white_id,black_id,result FROM gracz_tournament_matches WHERE tournament_id=$1 AND status='completed'`,[id]);
    const players=await this.pool.query(`SELECT user_id FROM gracz_tournament_players WHERE tournament_id=$1`,[id]); const scores=new Map(players.rows.map(p=>[p.user_id,{points:0,wins:0,draws:0,losses:0}]));
    for(const m of matches.rows){if(!m.white_id||!m.black_id)continue;const w=scores.get(m.white_id),b=scores.get(m.black_id);if(!w||!b)continue;if(m.result==="1-0"){w.points+=1;w.wins++;b.losses++;}else if(m.result==="0-1"){b.points+=1;b.wins++;w.losses++;}else{w.points+=.5;b.points+=.5;w.draws++;b.draws++;}}
    for(const [uid,s] of scores) await this.pool.query(`UPDATE gracz_tournament_players SET points=$3,wins=$4,draws=$5,losses=$6 WHERE tournament_id=$1 AND user_id=$2`,[id,uid,s.points,s.wins,s.draws,s.losses]);
    const standings=await this.pool.query(`SELECT user_id,points FROM gracz_tournament_players WHERE tournament_id=$1`,[id]); const pointMap=new Map(standings.rows.map(r=>[r.user_id,Number(r.points)])); const bh=new Map([...pointMap.keys()].map(k=>[k,0])); for(const m of matches.rows){if(m.white_id&&m.black_id){bh.set(m.white_id,(bh.get(m.white_id)||0)+(pointMap.get(m.black_id)||0));bh.set(m.black_id,(bh.get(m.black_id)||0)+(pointMap.get(m.white_id)||0));}} for(const [uid,v] of bh) await this.pool.query(`UPDATE gracz_tournament_players SET buchholz=$3 WHERE tournament_id=$1 AND user_id=$2`,[id,uid,v]);
  }

  async advanceDatabase(id){
    const t=(await this.pool.query(`SELECT format,rounds,current_round FROM gracz_tournaments WHERE tournament_id=$1`,[id])).rows[0]; const open=(await this.pool.query(`SELECT COUNT(*)::int c FROM gracz_tournament_matches WHERE tournament_id=$1 AND round=$2 AND status<>'completed'`,[id,t.current_round])).rows[0].c; if(open>0)return;
    const players=(await this.pool.query(`SELECT user_id,display_name,seed,points,wins,draws,losses,buchholz,status,joined_at FROM gracz_tournament_players WHERE tournament_id=$1 ORDER BY points DESC,buchholz DESC,wins DESC,seed`,[id])).rows.map(mapPlayer);
    if(t.format==="knockout"){const current=(await this.pool.query(`SELECT white_id,white_name,black_id,black_name,result FROM gracz_tournament_matches WHERE tournament_id=$1 AND round=$2 ORDER BY board`,[id,t.current_round])).rows;const winners=current.map(m=>m.result==="1-0"?{userId:m.white_id,displayName:m.white_name}:m.result==="0-1"?{userId:m.black_id,displayName:m.black_name}:null).filter(Boolean);if(winners.length<=1){await this.pool.query(`UPDATE gracz_tournaments SET status='finished',finished_at=NOW() WHERE tournament_id=$1`,[id]);return;}const next=t.current_round+1;await this.pool.query(`UPDATE gracz_tournaments SET current_round=$2 WHERE tournament_id=$1`,[id,next]);await this.insertMatches(id,createPairings(winners,[],next,"knockout"));return;}
    if(t.current_round>=t.rounds){await this.pool.query(`UPDATE gracz_tournaments SET status='finished',finished_at=NOW() WHERE tournament_id=$1`,[id]);return;}
    const previous=(await this.pool.query(`SELECT white_id,black_id FROM gracz_tournament_matches WHERE tournament_id=$1`,[id])).rows; const next=t.current_round+1; await this.pool.query(`UPDATE gracz_tournaments SET current_round=$2 WHERE tournament_id=$1`,[id,next]); await this.insertMatches(id,createPairings(players,previous,next,t.format));
  }

  async advanceMemory(user,id){const d=this.memory.get(id),t=d.tournament;if(d.matches.some(m=>m.round===t.currentRound&&m.status!=="completed"))return;if(t.format==="knockout"){const winners=d.matches.filter(m=>m.round===t.currentRound).map(m=>m.result==="1-0"?d.players.find(p=>p.userId===m.whiteId):m.result==="0-1"?d.players.find(p=>p.userId===m.blackId):null).filter(Boolean);if(winners.length<=1){t.status="finished";t.finishedAt=new Date().toISOString();return;}t.currentRound++;d.matches.push(...createPairings(winners,[],t.currentRound,"knockout"));return;}if(t.currentRound>=t.rounds){t.status="finished";t.finishedAt=new Date().toISOString();return;}t.currentRound++;d.matches.push(...createPairings(sortStandings(d.players),d.matches,t.currentRound,t.format));}
  async close(){if(this.pool)await this.pool.end();}
}

export function createTournamentHandler({service,auth,authSessions}){
  return async function tournamentHandler(request,response){const url=new URL(request.url,"http://localhost");if(!url.pathname.startsWith("/tournaments"))return false;if(url.pathname.endsWith(".html")||url.pathname.endsWith(".css")||url.pathname.endsWith(".js"))return false;try{const user=await trustedUser(request,auth,authSessions);if(request.method==="GET"&&url.pathname==="/tournaments")return json(response,200,{tournaments:await service.list(user,Object.fromEntries(url.searchParams))});if(request.method==="POST"&&url.pathname==="/tournaments")return json(response,201,{tournament:await service.create(user,await readJson(request))});const detail=url.pathname.match(/^\/tournaments\/([0-9a-f-]{36})$/i);if(detail&&request.method==="GET")return json(response,200,await service.detail(user,detail[1]));const action=url.pathname.match(/^\/tournaments\/([0-9a-f-]{36})\/(join|leave|start)$/i);if(action&&request.method==="POST"){const fn=action[2];return json(response,200,fn==="join"?await service.join(user,action[1]):fn==="leave"?await service.leave(user,action[1]):await service.start(user,action[1]));}const report=url.pathname.match(/^\/tournaments\/([0-9a-f-]{36})\/matches\/([0-9a-f-]{36})\/result$/i);if(report&&request.method==="POST")return json(response,200,await service.report(user,report[1],report[2],(await readJson(request)).result));return json(response,404,{error:{message:"Nie znaleziono funkcji turniejowej."}});}catch(error){return json(response,error.status||500,{error:{code:error.code||"TOURNAMENT_ERROR",message:error.message||"Błąd systemu turniejowego."}});}};
}

function createPairings(players,previous,round,format){const list=[...players];if(format!=="knockout")list.sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0)||(Number(b.buchholz)||0)-(Number(a.buchholz)||0)||(a.seed||0)-(b.seed||0));const played=new Set(previous.map(m=>[m.white_id||m.whiteId,m.black_id||m.blackId].sort().join("|")));const out=[];let board=1;while(list.length>1){const a=list.shift();let idx=format==="knockout"?0:list.findIndex(b=>!played.has([a.userId,b.userId].sort().join("|")));if(idx<0)idx=0;const b=list.splice(idx,1)[0];const swap=round%2===0;out.push({matchId:randomUUID(),round,board:board++,whiteId:swap?b.userId:a.userId,whiteName:swap?b.displayName:a.displayName,blackId:swap?a.userId:b.userId,blackName:swap?a.displayName:b.displayName,result:null,status:"scheduled",completedAt:null});}if(list.length){const a=list[0];out.push({matchId:randomUUID(),round,board:board++,whiteId:a.userId,whiteName:a.displayName,blackId:null,blackName:"BYE",result:"1-0",status:"completed",completedAt:new Date().toISOString()});}return out;}
function applyResult(players,m,result){const w=players.find(p=>p.userId===m.whiteId),b=players.find(p=>p.userId===m.blackId);if(!w||!b)return;if(result==="1-0"){w.points+=1;w.wins++;b.losses++;}else if(result==="0-1"){b.points+=1;b.wins++;w.losses++;}else{w.points+=.5;b.points+=.5;w.draws++;b.draws++;}}
function sortStandings(p){return [...p].sort((a,b)=>Number(b.points)-Number(a.points)||Number(b.buchholz)-Number(a.buchholz)||b.wins-a.wins||a.seed-b.seed);}
function filterList(rows,q){const status=q.status;const game=q.game;const text=String(q.q||"").toLowerCase();const mine=q.mine==="1";return rows.filter(t=>(!status||status==="all"||t.status===status)&&(!game||game==="all"||t.game===game)&&(!mine||t.joined)&&( !text||`${t.title} ${t.ownerName} ${t.description}`.toLowerCase().includes(text)));}
function mapTournament(r){return{tournamentId:r.tournament_id,ownerId:r.owner_id,ownerName:r.owner_name,title:r.title,description:r.description,game:r.game,format:r.format,status:r.status,visibility:r.visibility,maxPlayers:r.max_players,rounds:r.rounds,timeControl:r.time_control,rated:Boolean(r.rated),startsAt:r.starts_at,currentRound:r.current_round,createdAt:r.created_at,finishedAt:r.finished_at,playerCount:Number(r.player_count||0),joined:Boolean(r.joined)};}
function mapPlayer(r){return{userId:r.user_id,displayName:r.display_name,seed:r.seed,points:Number(r.points),wins:r.wins,draws:r.draws,losses:r.losses,buchholz:Number(r.buchholz),status:r.status,joinedAt:r.joined_at};}
function mapMatch(r){return{matchId:r.match_id,round:r.round,board:r.board,whiteId:r.white_id,whiteName:r.white_name,blackId:r.black_id,blackName:r.black_name,result:r.result,status:r.status,createdAt:r.created_at,completedAt:r.completed_at};}
async function trustedUser(request,auth,authSessions){const cookies=Object.fromEntries(String(request.headers.cookie||"").split(";").map(part=>{const i=part.indexOf("=");return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:["",""];}).filter(([k])=>k));const token=cookies["__Host-gracz_session"]||(String(request.headers.authorization||"").startsWith("Bearer ")?String(request.headers.authorization).slice(7):null);if(!token||token==="cookie")throw tournamentError("Zaloguj się, aby korzystać z turniejów.","UNAUTHENTICATED",401);const user=auth.verify(token);if(authSessions&&user.tokenId&&await authSessions.has(user.tokenId))await authSessions.assertActive(user);return{userId:user.userId,displayName:user.displayName,tokenId:user.tokenId};}
async function readJson(request){const chunks=[];let size=0;for await(const c of request){size+=c.length;if(size>32768)throw tournamentError("Żądanie jest za duże.","PAYLOAD_TOO_LARGE",413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");}catch{throw tournamentError("Nieprawidłowe dane.","INVALID_JSON",400);}}
function json(response,status,body){if(response.writableEnded)return true;response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));return true;}
function tournamentError(message,code,status){const e=new Error(message);e.code=code;e.status=status;return e;}
