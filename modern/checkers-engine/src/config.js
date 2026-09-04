import { resolve } from "node:path";

export function loadConfig(environment=process.env){
  const port=Number(environment.PORT??3000);if(!Number.isInteger(port)||port<1||port>65535)throw new TypeError("PORT musi być liczbą całkowitą od 1 do 65535.");
  const authSecret=requiredSecret(environment.AUTH_SECRET,"AUTH_SECRET");
  const databaseUrl=typeof environment.DATABASE_URL==="string"&&environment.DATABASE_URL.trim()?environment.DATABASE_URL.trim():null;
  const nodeEnv=String(environment.NODE_ENV||"development").toLowerCase();if(!["development","test","staging","production"].includes(nodeEnv))throw new TypeError("NODE_ENV musi być development, test, staging lub production.");
  const production=nodeEnv==="production";
  const messageEncryptionKey=dedicatedSecret(environment.MESSAGE_ENCRYPTION_KEY,"MESSAGE_ENCRYPTION_KEY",production);
  const attachmentEncryptionKey=dedicatedSecret(environment.ATTACHMENT_ENCRYPTION_KEY,"ATTACHMENT_ENCRYPTION_KEY",production);
  const mfaEncryptionKey=dedicatedSecret(environment.MFA_ENCRYPTION_KEY,"MFA_ENCRYPTION_KEY",production);
  assertSeparatedEncryptionKeys(authSecret,{MESSAGE_ENCRYPTION_KEY:messageEncryptionKey,ATTACHMENT_ENCRYPTION_KEY:attachmentEncryptionKey,MFA_ENCRYPTION_KEY:mfaEncryptionKey});
  return Object.freeze({host:environment.HOST||"0.0.0.0",port,dataDirectory:resolve(environment.DATA_DIR||"data"),authSecret,databaseUrl,nodeEnv,messageEncryptionKey,attachmentEncryptionKey,mfaEncryptionKey});
}
function requiredSecret(value,name){if(typeof value!=="string"||Buffer.byteLength(value,"utf8")<32)throw new TypeError(`${name} musi mieć co najmniej 32 bajty.`);return value;}
function dedicatedSecret(value,name,required){
  if(value===undefined||value===null||value===""){if(required)throw new TypeError(`${name} jest wymagany w production.`);return null;}
  if(typeof value!=="string"||Buffer.byteLength(value,"utf8")<32)throw new TypeError(`${name} musi mieć co najmniej 32 bajty.`);
  const trimmed=value.trim();
  if(!trimmed||/^(.)\1+$/su.test(value)||/^(?:change[_-]?me|replace[_-]?me|example|placeholder)/i.test(trimmed))throw new TypeError(`${name} nie spełnia minimalnych wymagań jakości.`);
  return value;
}
function assertSeparatedEncryptionKeys(authSecret,keys){
  const entries=Object.entries(keys).filter(([,value])=>value!==null);
  for(const[name,value]of entries)if(value===authSecret)throw new TypeError(`${name} nie może być równy AUTH_SECRET.`);
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(entries[i][1]===entries[j][1])throw new TypeError(`${entries[i][0]} i ${entries[j][0]} muszą być różne.`);
}
