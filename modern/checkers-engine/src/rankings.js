import pg from "pg";
import { requireGameType } from "./game-types.js";
import {
  MAX_RANKING_PERIOD_EVENTS,
  applyNormalizedEvent,
  backfillLegacyRankingHistory,
  catchUpRankingMaterialization,
  emptyStat,
  eventFromLedgerRow,
  initializeRankingSchema,
} from "./ranking-materialization.js";

const { Pool } = pg;
const PERIODS = new Map([["7d",7],["30d",30],["90d",90],["season",180],["all",null]]);

export class RankingService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized:false }, max:3 }) : null;
    this.ready = this.pool ? this.#initialize() : Promise.resolve();
  }

  async #initialize(){
    await initializeRankingSchema(this.pool);
    await backfillLegacyRankingHistory(this.pool);
    await catchUpRankingMaterialization(this.pool,{drain:true,maxEvents:1000});
  }

  async leaderboard({ period="all", limit=100, query="", minGames=0, game="all" }={}) {
    const selectedGame=rankingGame(game),safePeriod=PERIODS.has(period)?period:"all";
    if (!this.pool) return { rankings:[], summary:summary([],0), generatedAt:new Date().toISOString(), period:safePeriod, game:selectedGame };
    await this.ready;
    const catchup=await catchUpRankingMaterialization(this.pool);
    if(catchup.backlog) throw rankingBusyError();
    if(safePeriod==="all") return this.#materializedLeaderboard({selectedGame,limit,query,minGames,period:safePeriod});
    return this.#periodLeaderboard({selectedGame,limit,query,minGames,period:safePeriod,days:PERIODS.get(safePeriod)});
  }

  async #materializedLeaderboard({selectedGame,limit,query,minGames,period}){
    const safeLimit=Math.max(10,Math.min(500,Number(limit)||100));
    const safeMinGames=Math.max(0,Math.min(1_000_000,Number(minGames)||0));
    const q=String(query||"").trim().slice(0,80);
    const pattern=`%${q.replace(/[\\%_]/g,"\\$&")}%`;
    const params=[selectedGame,safeMinGames];
    let where=`m.scope=$1 AND m.games >= $2`;
    if(q){params.push(pattern);where+=` AND (m.user_id ILIKE $${params.length} ESCAPE '\\' OR COALESCE(a.display_name,m.user_id) ILIKE $${params.length} ESCAPE '\\')`;}
    params.push(safeLimit);
    const {rows}=await this.pool.query(`
      WITH filtered AS (
        SELECT m.user_id,m.games,m.wins,m.draws,m.losses,m.streak,m.best_streak,m.last_played,m.rating,m.peak_rating,m.checkers_games,m.thousand_games,
               COALESCE(a.display_name,m.user_id) AS display_name,COALESCE(a.profile_data->>'country','') AS country
        FROM gracz_ranking_materialized m
        LEFT JOIN gracz_accounts a ON a.user_id=m.user_id
        WHERE ${where}
      ), ranked AS (
        SELECT *,ROW_NUMBER() OVER(ORDER BY rating DESC,wins DESC,losses ASC,display_name ASC,user_id ASC) AS rank
        FROM filtered
      )
      SELECT * FROM ranked ORDER BY rank LIMIT $${params.length}
    `,params);
    const list=rows.map(mapMaterialized);

    const summaryParams=params.slice(0,-1);
    const aggregate=await this.pool.query(`
      SELECT COUNT(*)::int AS players,COALESCE(MAX(m.rating),1200)::int AS highest_rating,
             COALESCE(ROUND(AVG(m.rating)),1200)::int AS average_rating
      FROM gracz_ranking_materialized m
      LEFT JOIN gracz_accounts a ON a.user_id=m.user_id
      WHERE ${where}
    `,summaryParams);
    const totals=await this.pool.query(`SELECT games FROM gracz_ranking_totals WHERE scope=$1`,[selectedGame]);
    const a=aggregate.rows[0]||{};
    return {
      rankings:list,
      summary:{players:Number(a.players||0),games:Number(totals.rows[0]?.games||0),highestRating:Number(a.highest_rating||1200),averageRating:Number(a.average_rating||1200)},
      generatedAt:new Date().toISOString(),period,game:selectedGame,
    };
  }

  async #periodLeaderboard({selectedGame,limit,query,minGames,period,days}){
    const params=[days];let where=`completed_at >= NOW()-($1::int * INTERVAL '1 day')`;
    if(selectedGame!=="all"){params.push(selectedGame);where+=` AND game_type=$${params.length}`;}
    params.push(MAX_RANKING_PERIOD_EVENTS+1);
    const {rows}=await this.pool.query(`SELECT event_id,game_type,game_id,completed_at,payload FROM gracz_ranking_events WHERE ${where} ORDER BY event_id ASC LIMIT $${params.length}`,params);
    if(rows.length>MAX_RANKING_PERIOD_EVENTS) throw periodCapacityError();
    const stats=new Map();for(const row of rows)applyNormalizedEvent(eventFromLedgerRow(row),stats);
    const ids=[...stats.keys()],names=new Map();
    if(ids.length){
      const accounts=await this.pool.query(`SELECT user_id,display_name,profile_data FROM gracz_accounts WHERE user_id=ANY($1::text[])`,[ids]);
      for(const a of accounts.rows)names.set(a.user_id,{displayName:a.display_name,profile:a.profile_data||{}});
    }
    let list=[...stats.values()].map(x=>decorateStat(x,names.get(x.userId))).filter(x=>x.games>=Math.max(0,Number(minGames)||0));
    const q=String(query||"").trim().toLocaleLowerCase('pl');if(q)list=list.filter(x=>`${x.displayName} ${x.userId}`.toLocaleLowerCase('pl').includes(q));
    list.sort((a,b)=>b.rating-a.rating||b.wins-a.wins||a.losses-b.losses||String(a.displayName).localeCompare(String(b.displayName),'pl'));
    list=list.map((x,index)=>({...x,rank:index+1}));
    const safeLimit=Math.max(10,Math.min(500,Number(limit)||100));
    return {rankings:list.slice(0,safeLimit),summary:summary(list,rows.length),generatedAt:new Date().toISOString(),period,game:selectedGame};
  }

  async player(userId, options={}) {
    const result=await this.leaderboard({...options,limit:500});
    return { player:result.rankings.find(x=>x.userId===userId)||null, summary:result.summary, period:result.period, game:result.game };
  }

  async close(){if(this.pool)await this.pool.end()}
}

export function createRankingHandler({service,auth,authSessions}){
  return async function handle(request,response){
    const url=new URL(request.url,'http://localhost');if(!url.pathname.startsWith('/rankings'))return false;
    try{
      const user=await trustedUser(request,auth,authSessions);const period=url.searchParams.get('period')||'all';const query=url.searchParams.get('q')||'';const minGames=Number(url.searchParams.get('minGames')||0);const gameParam=url.searchParams.get('game');const game=gameParam===null?'all':gameParam;
      if(request.method==='GET'&&url.pathname==='/rankings')return json(response,200,await service.leaderboard({period,query,minGames,game,limit:Number(url.searchParams.get('limit')||100)}));
      if(request.method==='GET'&&url.pathname==='/rankings/me')return json(response,200,await service.player(user.userId,{period,game}));
      return json(response,404,{error:{code:'RANKING_NOT_FOUND',message:'Nie znaleziono funkcji rankingu.'}});
    }catch(error){return json(response,error.status||500,{error:{code:error.code||'RANKING_ERROR',message:error.message||'Błąd rankingu.'}})}
  }
}

function mapMaterialized(row){return decorateStat({userId:row.user_id,games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),streak:Number(row.streak),bestStreak:Number(row.best_streak),lastPlayed:row.last_played,rating:Number(row.rating),peakRating:Number(row.peak_rating),checkersGames:Number(row.checkers_games),thousandGames:Number(row.thousand_games)},{displayName:row.display_name,profile:{country:row.country}},Number(row.rank))}
function decorateStat(stat,account={},rank=null){const result={...stat,displayName:account?.displayName||stat.userId,country:account?.profile?.country||"",winRate:stat.games?Math.round(stat.wins/stat.games*1000)/10:0,tier:tierFor(stat.rating)};return rank===null?result:{...result,rank}}
function rankingGame(value){if(value==="all")return"all";return requireGameType(value,{capability:"rankings"})}
function summary(list,games){return{players:list.length,games,highestRating:list[0]?.rating||1200,averageRating:list.length?Math.round(list.reduce((n,x)=>n+x.rating,0)/list.length):1200}}
function tierFor(r){if(r>=2200)return'Arcymistrz';if(r>=2000)return'Mistrz';if(r>=1800)return'Diament';if(r>=1600)return'Platyna';if(r>=1400)return'Złoto';if(r>=1200)return'Srebro';return'Brąz'}
function rankingBusyError(){const e=new Error('Ranking nadrabia świeże wyniki. Spróbuj ponownie za chwilę.');e.code='RANKING_CATCHUP_BACKLOG';e.status=503;return e}
function periodCapacityError(){const e=new Error('Wybrany okres zawiera zbyt wiele wyników do bezpiecznego przeliczenia na żądanie.');e.code='RANKING_PERIOD_CAPACITY';e.status=503;return e}
async function trustedUser(request,auth,authSessions){const cookies=Object.fromEntries(String(request.headers.cookie||'').split(';').map(part=>{const i=part.indexOf('=');return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:['','']}).filter(([k])=>k));const token=cookies['__Host-gracz_session']||(String(request.headers.authorization||'').startsWith('Bearer ')?String(request.headers.authorization).slice(7):null);if(!token||token==='cookie'){const e=new Error('Zaloguj się, aby zobaczyć ranking.');e.status=401;e.code='UNAUTHENTICATED';throw e}const user=auth.verify(token);if(authSessions&&user.tokenId&&await authSessions.has(user.tokenId))await authSessions.assertActive(user);return user}
function json(response,status,body){if(response.writableEnded)return true;response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));return true}
