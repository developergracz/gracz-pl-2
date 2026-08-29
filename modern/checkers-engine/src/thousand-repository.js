import pg from 'pg';
const { Pool } = pg;

export class ThousandConcurrencyError extends Error {
  constructor(message='Stan gry został już zmieniony przez inną operację.') {
    super(message);
    this.name='ThousandConcurrencyError';
    this.code='THOUSAND_CONCURRENCY_CONFLICT';
  }
}

export class ThousandNotFoundError extends Error {
  constructor(gameId) {
    super(`Nie znaleziono gry Tysiąc: ${gameId}`);
    this.name='ThousandNotFoundError';
    this.code='THOUSAND_GAME_NOT_FOUND';
  }
}

export class MemoryThousandRepository {
  constructor(){ this.games=new Map(); }
  async create(record){
    if(this.games.has(record.gameId)) throw new Error('Gra o takim identyfikatorze już istnieje.');
    const stored=structuredClone({...record,revision:1,updatedAt:new Date().toISOString()});
    this.games.set(record.gameId,stored);
    return structuredClone(stored);
  }
  async get(gameId){
    const record=this.games.get(gameId);
    if(!record) throw new ThousandNotFoundError(gameId);
    return structuredClone(record);
  }
  async save(gameId,expectedRevision,nextRecord){
    const current=this.games.get(gameId);
    if(!current) throw new ThousandNotFoundError(gameId);
    if(current.revision!==expectedRevision) throw new ThousandConcurrencyError();
    const stored=structuredClone({...nextRecord,gameId,revision:expectedRevision+1,updatedAt:new Date().toISOString()});
    this.games.set(gameId,stored);
    return structuredClone(stored);
  }
  async close(){}
}

export class PostgresThousandRepository {
  constructor(connectionString){
    if(!connectionString) throw new TypeError('DATABASE_URL jest wymagany dla repozytorium PostgreSQL.');
    this.pool=new Pool({
      connectionString,
      ssl:connectionString.includes('localhost')||connectionString.includes('127.0.0.1')?false:{rejectUnauthorized:false},
      max:5,
    });
    this.ready=this.initialize();
  }
  async initialize(){
    await this.pool.query(`SELECT game_id,players,state,revision,created_at,updated_at FROM gracz_thousand_games LIMIT 0`);
  }
  async create(record){
    await this.ready;
    const result=await this.pool.query(
      `INSERT INTO gracz_thousand_games(game_id,players,state,revision) VALUES($1,$2::jsonb,$3::jsonb,1)
       RETURNING game_id,players,state,revision,created_at,updated_at`,
      [record.gameId,JSON.stringify(record.players),JSON.stringify(record.state)]
    );
    return fromRow(result.rows[0]);
  }
  async get(gameId){
    await this.ready;
    const result=await this.pool.query(
      `SELECT game_id,players,state,revision,created_at,updated_at FROM gracz_thousand_games WHERE game_id=$1`,
      [gameId]
    );
    if(result.rowCount===0) throw new ThousandNotFoundError(gameId);
    return fromRow(result.rows[0]);
  }
  async save(gameId,expectedRevision,nextRecord){
    await this.ready;
    const result=await this.pool.query(
      `UPDATE gracz_thousand_games
       SET players=$2::jsonb,state=$3::jsonb,revision=revision+1,updated_at=NOW()
       WHERE game_id=$1 AND revision=$4
       RETURNING game_id,players,state,revision,created_at,updated_at`,
      [gameId,JSON.stringify(nextRecord.players),JSON.stringify(nextRecord.state),expectedRevision]
    );
    if(result.rowCount===0){
      const exists=await this.pool.query(`SELECT 1 FROM gracz_thousand_games WHERE game_id=$1`,[gameId]);
      if(exists.rowCount===0) throw new ThousandNotFoundError(gameId);
      throw new ThousandConcurrencyError();
    }
    return fromRow(result.rows[0]);
  }
  async close(){ await this.pool.end(); }
}

function fromRow(row){
  return {
    gameId:row.game_id,
    players:row.players,
    state:row.state,
    revision:Number(row.revision),
    createdAt:new Date(row.created_at).toISOString(),
    updatedAt:new Date(row.updated_at).toISOString(),
  };
}
