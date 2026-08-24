import { resolve } from "node:path";

export function loadConfig(environment=process.env){
  const port=Number(environment.PORT??3000);if(!Number.isInteger(port)||port<1||port>65535)throw new TypeError("PORT musi być liczbą całkowitą od 1 do 65535.");
  const authSecret=requiredSecret(environment.AUTH_SECRET,"AUTH_SECRET");
  const databaseUrl=typeof environment.DATABASE_URL==="string"&&environment.DATABASE_URL.trim()?environment.DATABASE_URL.trim():null;
  const nodeEnv=String(environment.NODE_ENV||"development").toLowerCase();if(!["development","test","staging","production"].includes(nodeEnv))throw new TypeError("NODE_ENV musi być development, test, staging lub production.");
  const messageEncryptionKey=optionalSecret(environment.MESSAGE_ENCRYPTION_KEY,authSecret,"MESSAGE_ENCRYPTION_KEY");
  const attachmentEncryptionKey=optionalSecret(environment.ATTACHMENT_ENCRYPTION_KEY,authSecret,"ATTACHMENT_ENCRYPTION_KEY");
  const mfaEncryptionKey=optionalSecret(environment.MFA_ENCRYPTION_KEY,authSecret,"MFA_ENCRYPTION_KEY");
  if(nodeEnv==="production"&&(!environment.MESSAGE_ENCRYPTION_KEY||!environment.ATTACHMENT_ENCRYPTION_KEY||!environment.MFA_ENCRYPTION_KEY))console.warn("[security] Production should use separate MESSAGE_ENCRYPTION_KEY, ATTACHMENT_ENCRYPTION_KEY and MFA_ENCRYPTION_KEY secrets.");
  return Object.freeze({host:environment.HOST||"0.0.0.0",port,dataDirectory:resolve(environment.DATA_DIR||"data"),authSecret,databaseUrl,nodeEnv,messageEncryptionKey,attachmentEncryptionKey,mfaEncryptionKey});
}
function requiredSecret(value,name){if(typeof value!=="string"||value.length<32)throw new TypeError(`${name} musi mieć co najmniej 32 znaki.`);return value;}
function optionalSecret(value,fallback,name){if(value===undefined||value===null||value==="")return fallback;if(typeof value!=="string"||value.length<32)throw new TypeError(`${name} musi mieć co najmniej 32 znaki.`);return value;}
