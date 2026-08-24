import pg from "pg";

const { Pool } = pg;
const PERIODS = new Map([["7d",7],["30d",30],["90d",90],["season",180],["all",null]]);

export class RankingService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized:false }, max:3 }) : null;
    this.ready = Promise.resolve();
  }

  async leaderboard({ period="all", limit=100, query="", minGames=0 }={}) {
    if (!this.pool) return { rankings:[], summary:summary([]), generatedAt:new Date().toISOString(), period };
    const days = PERIODS.has(period) ? PERIODS.get(period) : null;
    const params=[];
    let where=`(state::jsonb->'game'->>'status') IN ('won','draw')`;
    if (days) { params.push(days); where += ` AND updated_at >= NOW()-($${params.length}::int * INTERVAL '1 day')`; }
    const { rows } = await this.pool.query(`SELECT game_id,state,updated_at FROM gracz_game_sessions WHERE ${where} ORDER BY updated_at ASC`,params);
    const stats = new Map();
    const ratings = new Map();
    const ensure=(id)=>{ if(!stats.has(id)) stats.set(id,{userId:id,games:0,wins:0,draws:0,losses:0,streak:0,bestStreak:0,lastPlayed:null,rating:1200,peakRating:1200}); return stats.get(id); };
    for (const row of rows) {
      let s; try{s=JSON.parse(row.state)}catch{continue}
      const white=s?.players?.white?.id, black=s?.players?.black?.id; if(!white||!black)continue;
      const w=ensure(white), b=ensure(black); const wr=ratings.get(white)??1200, br=ratings.get(black)??1200;
      const status=s?.game?.status, winner=s?.game?.winner;
      let ws=.5, bs=.5;
      if(status==='won'){if(winner==='white'){ws=1;bs=0}else if(winner==='black'){ws=0;bs=1}}
      const we=1/(1+10**((br-wr)/400)), be=1-we; const k=32;
      const newWr=Math.round(wr+k*(ws-we)), newBr=Math.round(br+k*(bs-be));
      ratings.set(white,newWr);ratings.set(black,newBr);
      for(const x of [w,b]){x.games++;x.lastPlayed=row.updated_at}
      if(ws===1){w.wins++;w.streak=Math.max(1,w.streak+1);w.bestStreak=Math.max(w.bestStreak,w.streak);b.losses++;b.streak=Math.min(-1,b.streak-1)}
      else if(bs===1){b.wins++;b.streak=Math.max(1,b.streak+1);b.bestStreak=Math.max(b.bestStreak,b.streak);w.losses++;w.streak=Math.min(-1,w.streak-1)}
      else {w.draws++;b.draws++;w.streak=0;b.streak=0}
      w.rating=newWr;b.rating=newBr;w.peakRating=Math.max(w.peakRating,newWr);b.peakRating=Math.max(b.peakRating,newBr);
    }
    const ids=[...stats.keys()];
    const names=new Map();
    if(ids.length){const {rows:accounts}=await this.pool.query(`SELECT user_id,display_name,profile_data FROM gracz_accounts WHERE user_id=ANY($1::text[])`,[ids]);for(const a of accounts)names.set(a.user_id,{displayName:a.display_name,profile:a.profile_data||{}})}
    let list=[...stats.values()].map(x=>{const account=names.get(x.userId)||{};return{...x,displayName:account.displayName||x.userId,country:account.profile?.country||"",winRate:x.games?Math.round(x.wins/x.games*1000)/10:0,tier:tierFor(x.rating)}}).filter(x=>x.games>=Number(minGames||0));
    const q=String(query||"").trim().toLocaleLowerCase('pl');if(q)list=list.filter(x=>`${x.displayName} ${x.userId}`.toLocaleLowerCase('pl').includes(q));
    list.sort((a,b)=>b.rating-a.rating||b.wins-a.wins||a.losses-b.losses||String(a.displayName).localeCompare(String(b.displayName),'pl'));
    list=list.map((x,i)=>({...x,rank:i+1}));
    const safeLimit=Math.max(10,Math.min(500,Number(limit)||100));
    return { rankings:list.slice(0,safeLimit), summary:summary(list), generatedAt:new Date().toISOString(), period };
  }

  async player(userId, options={}) {
    const result=await this.leaderboard({...options,limit:500});
    return { player:result.rankings.find(x=>x.userId===userId)||null, summary:result.summary, period:result.period };
  }

  async close(){if(this.pool)await this.pool.end()}
}

export function createRankingHandler({service,auth,authSessions}){
  return async function handle(request,response){
    const url=new URL(request.url,'http://localhost');
    if(!url.pathname.startsWith('/rankings'))return false;
    try{
      const user=await trustedUser(request,auth,authSessions);
      const period=url.searchParams.get('period')||'all';
      const query=url.searchParams.get('q')||'';
      const minGames=Number(url.searchParams.get('minGames')||0);
      if(request.method==='GET'&&url.pathname==='/rankings')return json(response,200,await service.leaderboard({period,query,minGames,limit:Number(url.searchParams.get('limit')||100)}));
      if(request.method==='GET'&&url.pathname==='/rankings/me')return json(response,200,await service.player(user.userId,{period}));
      return json(response,404,{error:{code:'RANKING_NOT_FOUND',message:'Nie znaleziono funkcji rankingu.'}});
    }catch(error){return json(response,error.status||500,{error:{code:error.code||'RANKING_ERROR',message:error.message||'Błąd rankingu.'}})}
  }
}

function summary(list){return{players:list.length,games:Math.floor(list.reduce((n,x)=>n+x.games,0)/2),highestRating:list[0]?.rating||1200,averageRating:list.length?Math.round(list.reduce((n,x)=>n+x.rating,0)/list.length):1200}}
function tierFor(r){if(r>=2200)return'Arcymistrz';if(r>=2000)return'Mistrz';if(r>=1800)return'Diament';if(r>=1600)return'Platyna';if(r>=1400)return'Złoto';if(r>=1200)return'Srebro';return'Brąz'}
async function trustedUser(request,auth,authSessions){const cookies=Object.fromEntries(String(request.headers.cookie||'').split(';').map(part=>{const i=part.indexOf('=');return i>0?[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]:['','']}).filter(([k])=>k));const token=cookies['__Host-gracz_session']||(String(request.headers.authorization||'').startsWith('Bearer ')?String(request.headers.authorization).slice(7):null);if(!token||token==='cookie'){const e=new Error('Zaloguj się, aby zobaczyć ranking.');e.status=401;e.code='UNAUTHENTICATED';throw e}const user=auth.verify(token);if(authSessions&&user.tokenId&&await authSessions.has(user.tokenId))await authSessions.assertActive(user);return user}
function json(response,status,body){if(response.writableEnded)return true;response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));return true}
