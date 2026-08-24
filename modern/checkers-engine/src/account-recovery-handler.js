export function createAccountRecoveryHandler({accounts,mail,security,audit=null,baseUrl=process.env.PUBLIC_BASE_URL||"https://gracz.pl"}={}){
  if(!accounts||!mail||!security)throw new TypeError("Recovery dependencies are required.");
  const publicBase=String(baseUrl).replace(/\/$/,"");
  return async function accountRecoveryHandler(request,response){
    const url=new URL(request.url,"http://localhost");
    if(request.method!=="POST"||url.pathname!=="/auth/request-password-reset")return false;
    try{
      security.assertSameOrigin(request);
      const body=await readJson(request,10_000);
      const userId=String(body.userId||"").trim().toLowerCase().slice(0,32);
      const email=String(body.email||"").trim().toLowerCase().slice(0,254);
      security.limit(request,"password-reset-request",`${userId}:${email}`,{limit:4,windowMs:30*60_000});
      await security.verifyTurnstile(request,body.challengeToken,{required:isProduction()});
      let result={ok:true,token:null,channel:"email"};
      try{result=await accounts.createPasswordResetToken({userId,email,verificationChannel:"email"});}catch{/* deliberately neutral to prevent account enumeration */}
      if(result?.token){
        const link=`${publicBase}/password-reset.html?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&token=${encodeURIComponent(result.token)}`;
        await mail.send({to:email,subject:"Gracz.pl — reset hasła",purpose:"password-reset",text:`Otwórz link, aby ustawić nowe hasło: ${link}\n\nLink jest ważny przez 15 minut. Jeżeli to nie Ty zleciłeś reset, zignoruj wiadomość.`,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>Reset hasła Gracz.pl</h1><p><a href="${escapeHtml(link)}">Ustaw nowe hasło</a></p><p>Link jest ważny przez 15 minut. Jeżeli to nie Ty zleciłeś reset, zignoruj wiadomość.</p></div>`}).catch(()=>{});
      }
      await audit?.record({actorId:userId||null,eventType:"account.password.reset.requested",outcome:"success",source:security.source(request),userAgent:request.headers["user-agent"],targetType:"account",targetId:userId||null});
      return json(response,202,{ok:true,message:"Jeżeli dane są prawidłowe, wyślemy wiadomość z dalszymi instrukcjami."});
    }catch(error){
      await audit?.record({eventType:"account.password.reset.requested",outcome:"failure",source:security.source(request),userAgent:request.headers["user-agent"],metadata:{code:error?.code||"RECOVERY_ERROR"}}).catch(()=>{});
      const status=error?.status||429;return json(response,status,{error:{code:error?.code||"RECOVERY_ERROR",message:error?.message||"Spróbuj ponownie później."}});
    }
  };
}
async function readJson(request,limit){let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>limit)throw Object.assign(new Error("Żądanie jest zbyt duże."),{code:"REQUEST_TOO_LARGE",status:413});}try{return JSON.parse(raw||"{}");}catch{throw Object.assign(new Error("Nieprawidłowe dane."),{code:"INVALID_JSON",status:400});}}
function json(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));return true;}
function isProduction(){return String(process.env.NODE_ENV||"").toLowerCase()==="production";}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
