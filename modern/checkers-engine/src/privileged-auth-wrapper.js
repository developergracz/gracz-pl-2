import { AccountError } from "./accounts.js";

export function withPrivilegedMfaAuth(accounts,{rbac,mfa,audit=null}={}){
  if(!accounts||!rbac||!mfa)throw new TypeError("Privileged MFA dependencies are required.");
  return new Proxy(accounts,{get(target,prop){const original=target[prop];if(prop!=="authenticate")return typeof original==="function"?original.bind(target):original;
    return async function authenticateWithMfa(input={}){
      const account=await target.authenticate(input);
      if(input?.verificationCode!==undefined)return account;
      const role=await rbac.getRole(account.userId);
      if(role==="player")return account;
      const enabled=await mfa.isEnabled(account.userId);
      if(!enabled){await audit?.record({actorId:account.userId,eventType:"privileged.mfa.setup-required",outcome:"failure",targetType:"account",targetId:account.userId,metadata:{role}});return Object.freeze({...account,mfaSetupRequired:true});}
      if(!input?.mfaCode)throw new AccountError("Konto uprzywilejowane wymaga 6-cyfrowego kodu MFA.","MFA_REQUIRED");
      try{await mfa.verify(account.userId,input.mfaCode);}catch(error){throw new AccountError("Nieprawidłowy kod MFA.","MFA_INVALID");}
      await audit?.record({actorId:account.userId,eventType:"privileged.login.mfa",outcome:"success",targetType:"account",targetId:account.userId,metadata:{role}});
      return account;
    };
  }});
}
