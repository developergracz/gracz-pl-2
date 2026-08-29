import pg from "pg";
import { AuthError } from "./auth.js";
const { Pool } = pg;
const DEFAULT_IDLE_SECONDS = 30 * 60;

export class MemoryAuthSessionStore {
  #sessions = new Map();
  constructor({ idleSeconds = DEFAULT_IDLE_SECONDS } = {}) { this.idleSeconds = idleSeconds; }
  async create({ tokenId, userId, expiresAt }) { validateSessionRecord({ tokenId,userId,expiresAt }); this.#cleanup(); const now=nowSeconds(); this.#sessions.set(tokenId,{tokenId,userId,expiresAt,createdAt:now,lastSeenAt:now,revokedAt:null}); }
  async has(tokenId){if(!tokenId)return false;this.#cleanup();return this.#sessions.has(tokenId);}
  async assertActive({tokenId,userId,expiresAt}){validateSessionRecord({tokenId,userId,expiresAt});this.#cleanup();const session=this.#sessions.get(tokenId),now=nowSeconds();if(!session||session.userId!==userId||session.revokedAt||session.expiresAt<=now||session.lastSeenAt<=now-this.idleSeconds)throw new AuthError("Sesja logowania została zakończona.","SESSION_REVOKED");session.lastSeenAt=now;}
  async revoke(tokenId){if(!tokenId)return;const session=this.#sessions.get(tokenId);if(session)session.revokedAt=nowSeconds();}
  async revokeAll(userId){if(typeof userId!=="string"||!userId)return;const now=nowSeconds();for(const session of this.#sessions.values())if(session.userId===userId)session.revokedAt=now;}
  #cleanup(){const now=nowSeconds();for(const[tokenId,s]of this.#sessions)if(s.expiresAt<=now||s.lastSeenAt<=now-this.idleSeconds||(s.revokedAt&&s.revokedAt<now-86400))this.#sessions.delete(tokenId);}
}

export class PostgresAuthSessionStore {
  constructor(connectionString,{idleSeconds=DEFAULT_IDLE_SECONDS}={}){if(typeof connectionString!=="string"||!connectionString.trim())throw new TypeError("DATABASE_URL jest wymagany.");this.idleSeconds=idleSeconds;this.pool=new Pool({connectionString,ssl:connectionString.includes("localhost")||connectionString.includes("127.0.0.1")?false:{rejectUnauthorized:false},max:3});this.ready=this.#initializeRuntime();}
  async #initializeRuntime(){await this.pool.query(`SELECT token_id,user_id,created_at,last_seen_at,expires_at,revoked_at FROM gracz_auth_sessions LIMIT 0`);await this.cleanup();}
  async create({tokenId,userId,expiresAt}){await this.ready;validateSessionRecord({tokenId,userId,expiresAt});await this.pool.query(`INSERT INTO gracz_auth_sessions(token_id,user_id,expires_at,last_seen_at) VALUES($1,$2,to_timestamp($3),NOW()) ON CONFLICT(token_id) DO UPDATE SET user_id=EXCLUDED.user_id,expires_at=EXCLUDED.expires_at,revoked_at=NULL,last_seen_at=NOW()`,[tokenId,userId,expiresAt]);}
  async has(tokenId){await this.ready;if(!tokenId)return false;const{rows}=await this.pool.query(`SELECT 1 FROM gracz_auth_sessions WHERE token_id=$1 LIMIT 1`,[tokenId]);return Boolean(rows[0]);}
  async assertActive({tokenId,userId,expiresAt}){await this.ready;validateSessionRecord({tokenId,userId,expiresAt});const{rows}=await this.pool.query(`UPDATE gracz_auth_sessions SET last_seen_at=NOW() WHERE token_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() AND last_seen_at>NOW()-($3::int * INTERVAL '1 second') RETURNING token_id`,[tokenId,userId,this.idleSeconds]);if(!rows[0])throw new AuthError("Sesja logowania wygasła lub została zakończona.","SESSION_REVOKED");}
  async revoke(tokenId){await this.ready;if(!tokenId)return;await this.pool.query(`UPDATE gracz_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE token_id=$1`,[tokenId]);}
  async revokeAll(userId){await this.ready;if(typeof userId!=="string"||!userId)return;await this.pool.query(`UPDATE gracz_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`,[userId.toLowerCase()]);}
  async cleanup(){await this.pool.query(`DELETE FROM gracz_auth_sessions WHERE expires_at<NOW()-INTERVAL '1 day' OR revoked_at<NOW()-INTERVAL '7 days' OR last_seen_at<NOW()-INTERVAL '2 days'`);}
  async close(){await this.pool.end();}
}
function validateSessionRecord({tokenId,userId,expiresAt}){if(typeof tokenId!=="string"||!/^[0-9a-f-]{36}$/i.test(tokenId))throw new TypeError("Nieprawidłowy identyfikator sesji logowania.");if(typeof userId!=="string"||userId.length<1||userId.length>128)throw new TypeError("Nieprawidłowy użytkownik sesji logowania.");if(!Number.isInteger(expiresAt)||expiresAt<=nowSeconds())throw new TypeError("Nieprawidłowy czas wygaśnięcia sesji logowania.");}
function nowSeconds(){return Math.floor(Date.now()/1000);}
