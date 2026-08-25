import pg from "pg";

const { Pool } = pg;
const PERIODS = new Map([["7d",7],["30d",30],["90d",90],["season",180],["all",null]]);
const GAMES = new Set(["all","checkers","thousand"]);

export class RankingService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized:false }, max:3 }) : null;
    this.ready = Promise.resolve();
  }

  async leaderboard({ period="all", limit=100, query="", minGames=0, game="all" }={}) {
    const selectedGame=GAMES.has(game)?game:"all";
    if (!this.pool) return { rankings:[], summary:summary([],0), generatedAt:new Date().toISOString(), period, game:selectedGame };
    const days = PERIODS.has(period) ? PERIODS.get(period) : null;
    const events=[];

    if(selectedGame==="all"||selectedGame==="checkers"){
      const params=[];
      let where=`(state::jsonb->'game'->>'status') IN ('won','draw')`;
      if(days){params.push(days);where+=` AND updated_at >= NOW()-($${params.length}::int * INTERVAL '1 day')`;}
      const {rows}=await this.pool.query(`SELECT game_id,state,updated_at FROM gracz_game_sessions WHERE ${where} ORDER BY updated_at ASC`,params);
      for(const row of rows)events.push({type:"checkers",updatedAt:row.updated_at,state:parseJson(row.state)});
    }

    if(selectedGame==="all"||selectedGame==="thousand"){
      const params=[];
      let where=`state::jsonb->>'status'='game-ended'`;
      if(days){params.push(days);where+=` AND updated_at >= NOW()-($${params.length}::int * INTERVAL '1 day')`;}
      try{
        const {rows}=await this.pool.query(`SELECT game_id,players,state,updated_at FROM gracz_thousand_games WHERE ${where} ORDER BY updated_at ASC`,params);
        for(const row of rows)events.push({type:"thousand",updatedAt:row.updated_at,players:parseJson(row.players),state:parseJson(row.state)});
      }catch(error){
        if(error?.code!=="42P01")throw error;
      }
    }

    events.sort((a,b)=>new Date(a.updatedAt)-new Date(b.updatedAt));
    const stats=new Map();
    const ratings=new Map();
    const ensure=(id)=>{if(!stats.has(id))stats.set(id,{userId:id,games:0,wins:0,draws:0,losses:0,streak:0,bestStreak:0,lastPlayed:null,rating:1200,peakRating:1200,checkersGames:0,thousandGames:0});return stats.get(id)};

    for(const event of events){
      if(event.type==="checkers")applyCheckersEvent(event,ensure,ratings);
      else applyThousandEvent(event,ensure,ratings);
    }

    const ids=[...stats.keys()];
    const names=new Map();
    if(ids.length){const {rows:accounts}=await this.pool.query(`SELECT user_id,display_name,profile_data FROM gracz_accounts WHERE user_id=ANY($1::text[])`,[ids]);for(const a of accounts)names.set(a.user_id,{displayName:a.display_name,profile:a.profile_data||{}})}
    let list=[...stats.values()].map(x=>{const account=names.get(x.userId)||{};return{...x,displayName:account.displayName||x.userId,country:account.profile?.country||"",winRate:x.games?Math.round(x.wins/x.games*1000)/10:0,tier:tierFor(x.rating)}}).filter(x=>x.games>=Number(minGames||0));
    const q=String(query||"").trim().toLocaleLowerCase('pl');if(q)list=list.filter(x=>`${x.displayName} ${x.userId}`.toLocaleLowerCase('pl').includes(q));
    list.sort((a,b)=>b.rating-a.rating||b.wins-a.wins||a.losses-b.losses||String(a.displayName).localeCompare(String(b.displayName),'pl'));
    list=list.map((x,i)=>({...x,rank:i+1}));
    const safeLimit=Math.max(10,Math.min(500,Number(limit)||100));
    return { rankings:list.slice(0,safeLimit), summary:summary(list,events.length), generatedAt:new Date().toISOString(), period, game:selectedGame };
  }

  async player(userId, options={}) {
    const result=await this.leaderboard({...options,limit:500});
    return { player:result.rankings.find(x=>x.userId===userId)||null, summary:result.summary, period:result.period, game:result.game };
  }

  async close(){if(this.pool)await this.pool.end()}
}

function applyCheckersEvent(event,ensure,ratings){
  const s=event.state;const white=s?.players?.white?.id,black=s?.players?.black?.id;if(!white||!black)return;
  const w=ensure(white),b=ensure(black);const wr=ratings.get(white)??1200,br=ratings.get(black)??1200;
  const status=s?.game?.status,winner=s?.game?.winner;let ws=.5,bs=.5;
  if(status==='won'){if(winner==='white'){ws=1;bs=0}else if(winner==='black'){ws=0;bs=1}}
  const we=1/(1+10**((br-wr)/400)),be=1-we,k=32;const newWr=Math.round(wr+k*(ws-we)),newBr=Math.round(br+k*(bs-be));ratings.set(white,newWr);ratings.set(black,newBr);
  for(const [x,rating] of [[w,newWr],[b,newBr]]){x.games++;x.checkersGames++;x.lastPlayed=event.updatedAt;x.rating=rating;x.peakRating=Math.max(x.peakRating,rating)}
  applyOutcome(w,b,ws,bs);
}

function applyThousandEvent(event,ensure,ratings){
  const players=Array.isArray(event.players)?event.players:[];const winnerIndex=Number(event.state?.winnerIndex);
  if(players.length!==3||!Number.isInteger(winnerIndex)||winnerIndex<0||winnerIndex>2)return;
  const ids=players.map(player=>String(player?.userId??'').trim()).filter(Boolean);if(ids.length!==3||new Set(ids).size!==3)return;
  const oldRatings=ids.map(id=>ratings.get(id)??1200);const deltas=[0,0,0];const k=32;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const expectedI=1/(1+10**((oldRatings[j]-oldRatings[i])/400));
    const actualI=i===winnerIndex?1:j===winnerIndex?0:.5;
    const delta=(k/2)*(actualI-expectedI);deltas[i]+=delta;deltas[j]-=delta;
  }
  ids.forEach((id,index)=>{
    const stat=ensure(id);const rating=Math.round(oldRatings[index]+deltas[index]);ratings.set(id,rating);stat.games++;stat.thousandGames++;stat.lastPlayed=event.updatedAt;stat.rating=rating;stat.peakRating=Math.max(stat.peakRating,rating);
    if(index===winnerIndex){stat.wins++;stat.streak=Math.max(1,stat.streak+1);stat.bestStreak=Math.max(stat.bestStreak,stat.streak)}else{stat.losses++;stat.streak=Math.min(-1,stat.streak-1)}
  });
}

function applyOutcome(w,b,ws,bs){
  if(ws===1){w.wins++;w.streak=Math.max(1,w.streak+1);w.bestStreak=Math.max(w.bestStreak,w.streak);b.losses++;b.streak=Math.min(-1,b.streak-1)}
  else if(bs===1){b.wins++;b.streak=Math.max(1,b.streak+1);b.bestStreak=Math.max(b.bestStreak,b.streak);w.losses++;w.streak=Math.min(-1,w.streak-1)}
  else{w.draws++;b.draws++;w.streak=0;b.streak=0}
}

export function createRankingHandler({service,auth,authSessions}){
  return async function handle(request,response){
    const url=new URL(request.url,'http://localhost');if(!url.pathname.startsWith('/rankings'))return false;
    try{
      const user=await trustedUser(request,auth,authSessions);const period=url.searchParams.get('period')||'all';const query=url.searchParams.get('q')||'';const minGames=Number(url.searchParams.get('minGames')||0);const game=url.searchParams.get('game')||'all';
      if(request.method==='GET'&&url.pathname==='/rankings')return json(response,200,await service.leaderboard({period,query,minGames,game,limit:Number(url.searchParams.get('limit')||100)}));
      if(request.method==='GET'&&url.pathname==='/rankings/me')return json(response,200,await service.player(user.userId,{period,game}));
      return json(response,404,{error:{code:'RANKING_NOT_FOUND',message:'Nie znaleziono funkcji rankingu.'}});
    }catch(error){return json(response,error.status||500,{error:{code:error.code||'RANKING_ERROR',message:error.message||'Błąd rankingu.'}})}
  }
}

function parseJson(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value)}catch{return null}}
function summary(list,games){return{players:list.length,games,highestRating:list[0]?.rating||1200,averageRating:list.length?Math.round(list.reduce((n,x)=>n+x.rating,0)/list.length):1200}}
function tierFor(r){if(r>=2200)return'Arcymistrz';if(r>=2000)return'Mistrz';if(r>=1800)return'Diament';if(r>=1600)return'Platyna';if(r>=1400)return'Złoto';if(r>=1200)return'Srebro';return'Brąz'}
async function trustedUser(request,auth,authSessions){const cookies=Object.fromEntries(String(request.headers.cookie||'').split(';').map(part=>{const i=part.indexOf('=');return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:['','']}).filter(([k])=>k));const token=cookies['__Host-gracz_session']||(String(request.headers.authorization||'').startsWith('Bearer ')?String(request.headers.authorization).slice(7):null);if(!token||token==='cookie'){const e=new Error('Zaloguj się, aby zobaczyć ranking.');e.status=401;e.code='UNAUTHENTICATED';throw e}const user=auth.verify(token);if(authSessions&&user.tokenId&&await authSessions.has(user.tokenId))await authSessions.assertActive(user);return user}
function json(response,status,body){if(response.writableEnded)return true;response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));return true}
