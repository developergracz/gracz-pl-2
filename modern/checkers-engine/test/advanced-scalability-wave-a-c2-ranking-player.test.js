import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {RankingService} from '../src/rankings.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
function unique(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`.toLowerCase()}

test('Wave A C2 contract: personal ranking no longer delegates to leaderboard(limit:500)',async()=>{
  const source=await readFile(new URL('../src/rankings.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/player\([^)]*\)[\s\S]{0,300}leaderboard\([^)]*limit\s*:\s*500/);
  assert.match(source,/m\.scope=\$1 AND m\.user_id=\$2/);
  assert.match(source,/SELECT COUNT\(\*\)::bigint/);
});

test('Wave A C2 PostgreSQL: valid player below top 500 remains directly retrievable',{skip:!databaseUrl},async()=>{
  const prefix=unique('wa_c2');
  const target=`${prefix}_target`;
  const service=new RankingService(databaseUrl);
  try{
    await service.ready;
    const rows=[];
    for(let index=0;index<600;index+=1){
      rows.push({userId:`${prefix}_ahead_${String(index).padStart(4,'0')}`,rating:2000+Math.floor(index/100),wins:100-index%10,losses:index%5});
    }
    rows.push({userId:target,rating:1000,wins:0,losses:20});
    for(let offset=0;offset<rows.length;offset+=200){
      const batch=rows.slice(offset,offset+200),params=[];
      const values=batch.map((row,index)=>{
        const base=index*5;
        params.push(row.userId,row.rating,row.wins,row.losses,'all');
        return `($${base+1},1,$${base+3},0,$${base+4},0,0,$${base+2},$${base+2},0,0,$${base+5})`;
      }).join(',');
      await service.pool.query(`
        INSERT INTO gracz_ranking_materialized(user_id,games,wins,draws,losses,streak,best_streak,rating,peak_rating,checkers_games,thousand_games,scope)
        VALUES ${values}
        ON CONFLICT(scope,user_id) DO UPDATE SET
          games=EXCLUDED.games,wins=EXCLUDED.wins,draws=EXCLUDED.draws,losses=EXCLUDED.losses,
          streak=EXCLUDED.streak,best_streak=EXCLUDED.best_streak,rating=EXCLUDED.rating,peak_rating=EXCLUDED.peak_rating,
          checkers_games=EXCLUDED.checkers_games,thousand_games=EXCLUDED.thousand_games
      `,params);
    }

    const result=await service.player(target,{period:'all',game:'all'});
    assert.ok(result.player,'ranked player must not disappear beyond the first 500 rows');
    assert.equal(result.player.userId,target);
    assert.ok(result.player.rank>500,`expected rank > 500, received ${result.player.rank}`);
  }finally{
    await service.pool?.query('DELETE FROM gracz_ranking_materialized WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await service.close();
  }
});
