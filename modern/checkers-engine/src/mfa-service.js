import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

export class MfaService {
  constructor(databaseUrl=null,{encryptionSecret=process.env.MFA_ENCRYPTION_KEY||"",legacyEncryptionSecret=process.env.AUTH_SECRET||null,audit=null}={}){
    assertSecret(encryptionSecret,"MFA_ENCRYPTION_KEY");if(legacyEncryptionSecret!==null)assertSecret(legacyEncryptionSecret,"Legacy AUTH_SECRET");
    this.key=deriveKey(String(encryptionSecret));this.legacyKey=legacyEncryptionSecret&&legacyEncryptionSecret!==encryptionSecret?deriveKey(String(legacyEncryptionSecret)):null;this.audit=audit;
    this.pool=databaseUrl?new Pool({connectionString:databaseUrl,ssl:databaseUrl.includes("localhost")||databaseUrl.includes("127.0.0.1")?false:{rejectUnauthorized:false},max:2}):null;this.memory=new Map();this.ready=this.pool?this.initialize():Promise.resolve();
  }
  async initialize(){await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_mfa(user_id VARCHAR(32) PRIMARY KEY REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,kind VARCHAR(16) NOT NULL DEFAULT 'totp',secret_iv BYTEA NOT NULL,secret_tag BYTEA NOT NULL,secret_ciphertext BYTEA NOT NULL,enabled BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),verified_at TIMESTAMPTZ)`);}
  generateSecret(){return base32Encode(randomBytes(20));}
  provisioningUri({userId,secret,issuer="Gracz.pl"}){return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userId)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;}
  async begin(userId){const id=normalizeId(userId),secret=this.generateSecret(),encrypted=this.encrypt(secret,id);if(this.pool){await this.ready;await this.pool.query(`INSERT INTO gracz_mfa(user_id,secret_iv,secret_tag,secret_ciphertext,enabled,created_at,verified_at) VALUES($1,$2,$3,$4,FALSE,NOW(),NULL) ON CONFLICT(user_id) DO UPDATE SET secret_iv=EXCLUDED.secret_iv,secret_tag=EXCLUDED.secret_tag,secret_ciphertext=EXCLUDED.secret_ciphertext,enabled=FALSE,created_at=NOW(),verified_at=NULL`,[id,encrypted.iv,encrypted.tag,encrypted.ciphertext]);}else this.memory.set(id,{...encrypted,enabled:false});return{secret,uri:this.provisioningUri({userId:id,secret})};}
  async enable(userId,code){const id=normalizeId(userId),record=await this.getRecord(id);if(!record)throw mfaError("MFA_NOT_CONFIGURED","MFA nie zostało skonfigurowane.");const secret=this.decrypt(record,id);if(!verifyTotp(secret,code))throw mfaError("MFA_INVALID","Nieprawidłowy kod MFA.");if(this.pool)await this.pool.query(`UPDATE gracz_mfa SET enabled=TRUE,verified_at=NOW() WHERE user_id=$1`,[id]);else record.enabled=true;await this.audit?.record({actorId:id,eventType:"mfa.enabled",targetType:"account",targetId:id});return{ok:true};}
  async verify(userId,code){const id=normalizeId(userId),record=await this.getRecord(id);if(!record?.enabled)throw mfaError("MFA_REQUIRED","Konto wymaga skonfigurowanego MFA.");const ok=verifyTotp(this.decrypt(record,id),code);await this.audit?.record({actorId:id,eventType:"mfa.challenge",outcome:ok?"success":"failure",targetType:"account",targetId:id});if(!ok)throw mfaError("MFA_INVALID","Nieprawidłowy kod MFA.");return true;}
  async isEnabled(userId){return Boolean((await this.getRecord(normalizeId(userId)))?.enabled);}
  async getRecord(id){if(!this.pool)return this.memory.get(id)||null;await this.ready;const{rows}=await this.pool.query(`SELECT secret_iv AS iv,secret_tag AS tag,secret_ciphertext AS ciphertext,enabled FROM gracz_mfa WHERE user_id=$1`,[id]);return rows[0]||null;}
  encrypt(secret,id){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",this.key,iv);cipher.setAAD(Buffer.from(id));const ciphertext=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);return{iv,tag:cipher.getAuthTag(),ciphertext};}
  decrypt(record,id){try{return decryptWithKey(record,id,this.key);}catch{if(this.legacyKey){try{const clear=decryptWithKey(record,id,this.legacyKey);this.#legacySignal();return clear;}catch{}}throw Object.assign(new Error("Nie można odszyfrować konfiguracji MFA."),{code:"MFA_DECRYPT_FAILED",status:500});}}
  #legacySignal(){const event={eventType:"crypto.legacy_decrypt",outcome:"success",metadata:{domain:"mfa"}};if(typeof this.audit?.record==="function")Promise.resolve(this.audit.record(event)).catch(()=>{});else console.info("[security] crypto.legacy_decrypt",{domain:"mfa"});}
  async close(){if(this.pool)await this.pool.end();}
}

export function verifyTotp(secret,code,{time=Date.now(),window=1}={}){const clean=String(code||"").trim();if(!/^\d{6}$/.test(clean))return false;const key=base32Decode(secret),counter=Math.floor(time/1000/30);for(let drift=-window;drift<=window;drift++){const expected=totp(key,counter+drift);const a=Buffer.from(clean),b=Buffer.from(expected);if(a.length===b.length&&timingSafeEqual(a,b))return true;}return false;}
function assertSecret(value,name){if(typeof value!=="string"||Buffer.byteLength(value,"utf8")<32)throw new TypeError(`${name} musi mieć co najmniej 32 bajty.`);}
function deriveKey(secret){return Buffer.from(hkdfSync("sha256",Buffer.from(secret),Buffer.from("gracz.pl/mfa/v1"),Buffer.from("totp-secret-encryption"),32));}
function decryptWithKey(record,id,key){const decipher=createDecipheriv("aes-256-gcm",key,record.iv);decipher.setAAD(Buffer.from(id));decipher.setAuthTag(record.tag);return Buffer.concat([decipher.update(record.ciphertext),decipher.final()]).toString("utf8");}
function totp(key,counter){const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));const h=createHmac("sha1",key).update(buf).digest(),offset=h[h.length-1]&15;const value=((h[offset]&127)<<24)|(h[offset+1]<<16)|(h[offset+2]<<8)|h[offset+3];return String(value%1_000_000).padStart(6,"0");}
const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buffer){let bits="";for(const byte of buffer)bits+=byte.toString(2).padStart(8,"0");let out="";for(let i=0;i<bits.length;i+=5)out+=ALPHABET[parseInt(bits.slice(i,i+5).padEnd(5,"0"),2)];return out;}
function base32Decode(value){const clean=String(value).toUpperCase().replace(/=+$/g,"").replace(/[^A-Z2-7]/g,"");let bits="";for(const char of clean)bits+=ALPHABET.indexOf(char).toString(2).padStart(5,"0");const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes);}
function normalizeId(value){const id=String(value||"").trim().toLowerCase();if(!/^[a-z0-9._-]{2,32}$/.test(id))throw new TypeError("Nieprawidłowy userId.");return id;}
function mfaError(code,message){return Object.assign(new Error(message),{code,status:403});}
