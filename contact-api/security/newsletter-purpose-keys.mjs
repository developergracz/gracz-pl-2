import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';

// Offline primitive only. No provider, environment, legacy key or ledger access.
// A valid envelope does NOT establish mailbox control, consent or a legacy alias.
const limits=Object.freeze({confirm:30*86400000,unsubscribe:5*365*86400000,status:600000});
const purposes=new Set([...Object.keys(limits),'identity']);
const identifier=/^[a-z][a-z0-9-]{0,47}$/;
const invalid=()=>Object.assign(new Error('Newsletter proof unavailable.'),{code:'NEWSLETTER_PROOF_INVALID'});
const aad=(id,purpose)=>Buffer.from(JSON.stringify(['n2',id,purpose,'gracz.pl/newsletter/'+purpose]));
function decode(value) {
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();
  const bytes=Buffer.from(value,'base64url');
  if(bytes.toString('base64url')!==value)throw invalid();
  return bytes;
}
function mailbox(value) {
  if(typeof value!=='string')throw invalid();
  const email=value.trim(),at=email.lastIndexOf('@'),local=email.slice(0,at),domain=email.slice(at+1);
  if(email.length>254||at<=0||at!==email.indexOf('@')||local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))throw invalid();
  return local+'@'+domain.toLowerCase();
}

export function createNewsletterPurposeKeys({keys,now=Date.now}={}) {
  if(!Array.isArray(keys)||keys.length>32||typeof now!=='function')throw invalid();
  const byId=new Map(),active=new Map(),materials=new Set();
  for(const entry of keys) {
    if(!entry||typeof entry.id!=='string'||!identifier.test(entry.id)||!purposes.has(entry.purpose)||
      !['active','retired','compromised'].includes(entry.state)||!Buffer.isBuffer(entry.key)||entry.key.length!==32||byId.has(entry.id))throw invalid();
    // Reject obvious placeholder material; this cannot prove CSPRNG provenance.
    if(entry.key.every(byte=>byte===entry.key[0]))throw invalid();
    const material=entry.key.toString('hex');
    if(materials.has(material))throw invalid();
    materials.add(material);
    const copy={id:entry.id,purpose:entry.purpose,state:entry.state,key:Buffer.from(entry.key)};
    byId.set(copy.id,copy);
    if(copy.state==='active'){
      if(active.has(copy.purpose))throw invalid();
      active.set(copy.purpose,copy);
    }
  }
  for(const purpose of purposes)if(!active.has(purpose))throw invalid();
  function clock(){const time=now();if(!Number.isSafeInteger(time)||time<0)throw invalid();return time;}
  return Object.freeze({
    seal(purpose,payload,ttlMs) {
      if(!Object.hasOwn(limits,purpose)||!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>limits[purpose]||
        !payload||typeof payload!=='object'||Array.isArray(payload))throw invalid();
      const entry=active.get(purpose),iat=clock(),exp=iat+ttlMs;
      if(!Number.isSafeInteger(exp))throw invalid();
      const plaintext=Buffer.from(JSON.stringify({iat,exp,payload}));
      if(plaintext.length>4096)throw invalid();
      const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',entry.key,nonce);
      cipher.setAAD(aad(entry.id,purpose));
      const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
      return ['n2',entry.id,nonce.toString('base64url'),ciphertext.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
    },
    open(purpose,token) {
      try {
        if(!Object.hasOwn(limits,purpose)||typeof token!=='string'||token.length>6000)throw invalid();
        const parts=token.split('.');
        // Reject n1/ns1 before key lookup; no grace period or fallback.
        if(parts.length!==5||parts[0]!=='n2')throw invalid();
        const entry=byId.get(parts[1]);
        if(!entry||entry.state!=='active'||entry.purpose!==purpose)throw invalid();
        const nonce=decode(parts[2]),ciphertext=decode(parts[3]),tag=decode(parts[4]);
        if(nonce.length!==12||tag.length!==16||ciphertext.length>4096)throw invalid();
        const decipher=createDecipheriv('aes-256-gcm',entry.key,nonce);
        decipher.setAAD(aad(entry.id,purpose));decipher.setAuthTag(tag);
        const data=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
        const time=clock();
        if(!Number.isSafeInteger(data.iat)||!Number.isSafeInteger(data.exp)||data.iat<0||data.iat>time||data.exp<=time||
          data.exp<=data.iat||data.exp-data.iat>limits[purpose]||!data.payload||typeof data.payload!=='object'||Array.isArray(data.payload))throw invalid();
        return data.payload;
      }catch{throw invalid();}
    },
    identity(email) {
      const entry=active.get('identity');
      const hash=createHmac('sha256',entry.key).update(JSON.stringify(['ni2',entry.id,'gracz.pl/newsletter/identity',mailbox(email)])).digest('hex');
      // Namespace is mandatory. A missing lookup NEVER authorizes a new identity.
      return 'ni2:'+entry.id+':'+hash;
    },
  });
}
