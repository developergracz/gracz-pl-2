import { AccountError } from "./accounts.js";

export function withPrivilegedMfaAuth(accounts,{rbac,mfa,audit=null}={}){
  if(!accounts||!rbac||!mfa)throw new TypeError("Privileged MFA dependencies are required.");
  return new Proxy(accounts,{get(target,prop){const original=target[prop];if(prop!=="authenticate")return typeof original==="function"?original.bind(target):original;
    return async function authenticateWithMfa(input={}){
      let account;
      try{account=await target.authenticate(input);}catch(error){await audit?.record({actorId:input?.userId||null,eventType:input?.verificationCode!==undefined?"account.activation.failed":"auth.login",outcome:"failure",targetType:"account",targetId:input?.userId||null,metadata:{code:error?.code||"ERROR"}});throw error;}
      if(input?.verificationCode!==undefined){await audit?.record({actorId:account.userId,eventType:"account.activation.verified",outcome:"success",targetType:"account",targetId:account.userId});return account;}
      const role=await rbac.getRole(account.userId);
      if(role==="player"){await audit?.record({actorId:account.userId,eventType:"auth.login",outcome:"success",targetType:"account",targetId:account.userId,metadata:{role}});return account;}
      const enabled=await mfa.isEnabled(account.userId);
      if(!enabled){await audit?.record({actorId:account.userId,eventType:"auth.login",outcome:"success",targetType:"account",targetId:account.userId,metadata:{role,mfaSetupRequired:true}});await audit?.record({actorId:account.userId,eventType:"privileged.mfa.setup-required",outcome:"failure",targetType:"account",targetId:account.userId,metadata:{role}});return Object.freeze({...account,mfaSetupRequired:true});}
      if(!input?.mfaCode){await audit?.record({actorId:account.userId,eventType:"auth.login",outcome:"failure",targetType:"account",targetId:account.userId,metadata:{role,reason:"mfa-required"}});throw new AccountError("Konto uprzywilejowane wymaga 6-cyfrowego kodu MFA.","MFA_REQUIRED");}
      try{await mfa.verify(account.userId,input.mfaCode);}catch{await audit?.record({actorId:account.userId,eventType:"auth.login",outcome:"failure",targetType:"account",targetId:account.userId,metadata:{role,reason:"mfa-invalid"}});throw new AccountError("Nieprawidłowy kod MFA.","MFA_INVALID");}
      await audit?.record({actorId:account.userId,eventType:"auth.login",outcome:"success",targetType:"account",targetId:account.userId,metadata:{role,mfa:true}});
      return account;
    };
  }});
}
