import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileAccountService } from "./accounts.js";
import { PostgresAccountService } from "./postgres-accounts.js";
import { SecureAccountService } from "./secure-accounts.js";
import { MessageAttachmentService } from "./message-attachments.js";
import { AuthService } from "./auth.js";
import { MemoryAuthSessionStore, PostgresAuthSessionStore } from "./auth-sessions.js";
import { loadConfig } from "./config.js";
import { LobbyService } from "./lobby.js";
import { createPlatformLobbyHttpHandler } from "./platform-lobby-http.js";
import { GlobalChatService, createGlobalChatHandler } from "./global-chat.js";
import { TournamentService, createTournamentHandler } from "./tournaments.js";
import { RankingService, createRankingHandler } from "./rankings.js";
import { NewsletterService, createNewsletterHandler } from "./newsletter.js";
import { NewsletterAdminService } from "./newsletter-admin-service.js";
import { createNewsletterAdminHandler } from "./newsletter-admin-handler.js";
import { NewsletterLifecycleRecorder } from "./newsletter-lifecycle-recorder.js";
import { withNewsletterLifecycleAnalytics } from "./newsletter-analytics-wrapper.js";
import { AuditService } from "./audit-service.js";
import { SecurityService } from "./security-service.js";
import { SecureMailService } from "./secure-mail-service.js";
import { RbacService } from "./rbac-service.js";
import { MfaService } from "./mfa-service.js";
import { withPrivilegedMfaAuth } from "./privileged-auth-wrapper.js";
import { createAdminSecurityHandler } from "./admin-security-handler.js";
import { ModerationService, withAccountModeration, withChatModeration } from "./moderation-service.js";
import { SecurityMonitor } from "./security-monitor.js";
import { ThousandGameService } from "./thousand-service.js";
import { MemoryThousandRepository, PostgresThousandRepository } from "./thousand-repository.js";
import { ThousandRealtimeHub } from "./thousand-realtime.js";
import { createThousandHttpHandler } from "./thousand-http.js";
import { GomokuService } from "./gomoku-service.js";
import { createGomokuHttpHandler } from "./gomoku-http.js";
import { createGameHttpServer } from "./server.js";
import { FileSessionStore } from "./store.js";
import { PostgresSessionStore } from "./postgres-session-store.js";

const config=loadConfig();
const turnstileEnabled=Boolean(process.env.TURNSTILE_SITE_KEY&&process.env.TURNSTILE_SECRET_KEY);
const webRoot=fileURLToPath(new URL("../web",import.meta.url));
const audit=new AuditService(config.databaseUrl||null);await audit.ready;
const security=new SecurityService({audit});
const monitor=new SecurityMonitor({audit});
const mail=new SecureMailService({audit});
const moderation=new ModerationService(config.databaseUrl||null,{audit});await moderation.ready;
const store=config.databaseUrl?new PostgresSessionStore(config.databaseUrl):new FileSessionStore(join(config.dataDirectory,"sessions"));if(config.databaseUrl&&store.ready)await store.ready;
const baseAccounts=config.databaseUrl?new PostgresAccountService(config.databaseUrl,config.messageEncryptionKey):new FileAccountService(join(config.dataDirectory,"accounts.json"));if(config.databaseUrl&&baseAccounts.ready)await baseAccounts.ready;
const securedAccounts=config.databaseUrl?new SecureAccountService(baseAccounts,config.databaseUrl):baseAccounts;if(config.databaseUrl&&securedAccounts.ready)await securedAccounts.ready;
let accounts=withAccountModeration(securedAccounts,moderation);
const authSessions=config.databaseUrl?new PostgresAuthSessionStore(config.databaseUrl):new MemoryAuthSessionStore();if(authSessions.ready)await authSessions.ready;
const messageAttachments=config.databaseUrl?new MessageAttachmentService(config.databaseUrl,config.attachmentEncryptionKey):null;if(messageAttachments?.ready)await messageAttachments.ready;
const auth=new AuthService({secret:config.authSecret,ttlSeconds:3600});
const rbac=new RbacService(config.databaseUrl||null,{audit});await rbac.ready;
const mfa=new MfaService(config.databaseUrl||null,{encryptionSecret:config.mfaEncryptionKey,audit});await mfa.ready;
accounts=withPrivilegedMfaAuth(accounts,{rbac,mfa,audit});
const adminSecurityHandler=createAdminSecurityHandler({auth,authSessions,rbac,mfa,audit,security});
const rawGlobalChat=new GlobalChatService(config.databaseUrl||null);await rawGlobalChat.ready;const globalChat=withChatModeration(rawGlobalChat,moderation);const globalChatHandler=createGlobalChatHandler({service:globalChat,auth,authSessions});
const tournaments=new TournamentService(config.databaseUrl||null);await tournaments.ready;const tournamentHandler=createTournamentHandler({service:tournaments,auth,authSessions});
const rankings=new RankingService(config.databaseUrl||null);await rankings.ready;const rankingHandler=createRankingHandler({service:rankings,auth,authSessions});
const newsletter=new NewsletterService(config.databaseUrl||null,{mail});await newsletter.ready;
const newsletterAdmin=new NewsletterAdminService(config.databaseUrl||null);await newsletterAdmin.ready;
const newsletterLifecycle=new NewsletterLifecycleRecorder(config.databaseUrl||null);
const newsletterWithAnalytics=withNewsletterLifecycleAnalytics(newsletter,newsletterLifecycle);
const newsletterHandler=createNewsletterHandler(newsletterWithAnalytics,{security,monitor});
const newsletterAdminHandler=createNewsletterAdminHandler({service:newsletterAdmin,auth,authSessions,rbac,mfa,audit,security});
const thousandRepository=config.databaseUrl?new PostgresThousandRepository(config.databaseUrl):new MemoryThousandRepository();if(thousandRepository.ready)await thousandRepository.ready;
const thousandService=new ThousandGameService({repository:thousandRepository});const thousandRealtime=new ThousandRealtimeHub({service:thousandService});const thousandHandler=createThousandHttpHandler({service:thousandService,auth,authSessions,realtime:thousandRealtime});
const gomokuService=new GomokuService();const gomokuHandler=createGomokuHttpHandler({service:gomokuService,auth,authSessions});
const lobby=new LobbyService({sessionStore:store,thousandService,gomokuService});const platformLobbyHandler=createPlatformLobbyHttpHandler({lobby,auth,authSessions});
const server=createGameHttpServer({store,accounts,authSessions,messageAttachments,auth,lobby,webRoot,logger:secureLogger(audit)});

async function serveExtendedAsset(request,response){if(request.method!=="GET")return false;const pathname=new URL(request.url,"http://localhost").pathname;const file=({"/":"lobby.html","/coming-soon.html":"coming-soon.html","/coming-soon.css":"coming-soon.css","/homepage-scale.css":"homepage-scale.css","/coming-soon.js":"coming-soon.js","/privileged-mfa-login.js":"privileged-mfa-login.js","/auth-form.js":"auth-form.js","/auth-cookie-migration.js":"auth-cookie-migration.js","/adaptive-challenge.js":"adaptive-challenge.js","/aktualnosci.html":"aktualnosci.html","/polityka-prywatnosci.html":"polityka-prywatnosci.html","/lobby.html":"lobby.html","/homepage-consoles.js":"homepage-consoles.js","/thousand-lobby.js":"thousand-lobby.js","/tournaments.html":"tournaments.html","/tournaments.css":"tournaments.css","/tournaments.js":"tournaments.js","/community.html":"community.html","/community.css":"community.css","/community.js":"community.js","/ranking.html":"ranking.html","/ranking.css":"ranking.css","/ranking.js":"ranking.js","/thousand.html":"thousand.html","/thousand.css":"thousand.css","/thousand-multiplayer.css":"thousand-multiplayer.css","/thousand.js":"thousand.js"})[pathname];if(!file)return false;const extension=file.split(".").at(-1),contentType=({html:"text/html",css:"text/css",js:"text/javascript"})[extension]||"application/octet-stream";let content=await readFile(join(webRoot,file));if(file==="lobby.html"){let text=content.toString("utf8");text=text.replace("</head>",'<script src="/privileged-mfa-login.js"></script></head>').replace("</body>",'<script src="/auth-form.js"></script><script src="/auth-cookie-migration.js?v=20260827-six-digit-code-1" defer></script><script src="/adaptive-challenge.js" defer></script><script src="/thousand-lobby.js" defer></script></body>');content=Buffer.from(text,"utf8");}response.writeHead(200,{"content-type":`${contentType}; charset=utf-8`,"cache-control":"no-store, no-cache, must-revalidate, proxy-revalidate","pragma":"no-cache","expires":"0","surrogate-control":"no-store"});response.end(content);return true;}

const baseRequestHandler=server.listeners("request")[0];server.removeAllListeners("request");
server.on("request",async(request,response)=>{try{security.assertSameOrigin(request);if(await newsletterHandler(request,response))return;if(await adminSecurityHandler(request,response))return;if(await newsletterAdminHandler(request,response))return;if(await thousandHandler(request,response))return;if(await gomokuHandler(request,response))return;if(await platformLobbyHandler(request,response))return;if(await serveExtendedAsset(request,response))return;if(await globalChatHandler(request,response))return;if(await tournamentHandler(request,response))return;if(await rankingHandler(request,response))return;return baseRequestHandler(request,response);}catch(error){console.error("Application request error:",safeError(error));if(!response.headersSent&&!response.writableEnded){response.writeHead(error?.status||500,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify({error:{code:error?.code||"APP_INTERNAL_ERROR",message:error?.status&&error.status<500?error.message:"Wewnętrzny błąd aplikacji."}}));}}});

server.prependListener("request",(request,response)=>{response.setHeader("X-Content-Type-Options","nosniff");response.setHeader("X-Frame-Options","DENY");response.setHeader("X-Permitted-Cross-Domain-Policies","none");response.setHeader("Referrer-Policy","no-referrer");response.setHeader("Cross-Origin-Opener-Policy","same-origin");response.setHeader("Cross-Origin-Resource-Policy","same-origin");response.setHeader("Origin-Agent-Cluster","?1");response.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
const turnstileOrigin="https://challenges.cloudflare.com";
const scriptSrc=turnstileEnabled?`'self' ${turnstileOrigin}`:"'self'";
const connectSrc=turnstileEnabled?`'self' ${turnstileOrigin}`:"'self'";const frameSrc=turnstileEnabled?turnstileOrigin:"'none'";response.setHeader("Content-Security-Policy",`default-src 'self'; script-src ${scriptSrc}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSrc}; frame-src ${frameSrc}; font-src 'self'; object-src 'none'; media-src 'none'; worker-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`);response.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains; preload");response.on("finish",()=>{const path=new URL(request.url,"http://localhost").pathname,source=security.source(request),status=response.statusCode;if(status>=400)audit.record({eventType:"http.error",outcome:"failure",source,userAgent:request.headers["user-agent"],metadata:{method:request.method,path,status}}).catch(()=>{});if(status<400&&request.method==="POST"&&path==="/auth/logout"){const actor=actorFromRequest(request,auth);audit.record({actorId:actor,eventType:"auth.logout",source,userAgent:request.headers["user-agent"],targetType:"account",targetId:actor}).catch(()=>{});}monitor.observeHttp({status,source,path}).catch(()=>{});});});
server.requestTimeout=20_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;server.maxHeadersCount=100;
server.listen(config.port,config.host,()=>{console.log(`Gracz.pl działa na http://${config.host}:${config.port}`);console.log(`Środowisko: ${config.nodeEnv}`);console.log(`Newsletter: ${config.databaseUrl?"PostgreSQL + double opt-in":"pamięć procesu (dev)"}`);console.log("Security: central SecurityService + Audit + RBAC + MFA + Moderation + Monitor");});
let shuttingDown=false;async function shutdown(signal){if(shuttingDown)return;shuttingDown=true;console.log(`Otrzymano ${signal}. Zamykanie serwera…`);server.close(async()=>{try{thousandRealtime.close();await thousandService.close();if(typeof store.close==="function")await store.close();if(typeof accounts.close==="function")await accounts.close();if(typeof authSessions.close==="function")await authSessions.close();if(messageAttachments&&typeof messageAttachments.close==="function")await messageAttachments.close();await globalChat.close();await tournaments.close();await rankings.close();await newsletterLifecycle.close();await newsletterAdmin.close();await newsletter.close();await moderation.close();await mfa.close();await rbac.close();await audit.close();process.exit(0);}catch(error){console.error("Błąd podczas zamykania aplikacji:",safeError(error));process.exit(1);}});}for(const signal of["SIGINT","SIGTERM"])process.once(signal,()=>void shutdown(signal));
function safeError(error){return{code:String(error?.code||"ERROR").slice(0,80),name:String(error?.name||"Error").slice(0,80),message:String(error?.message||"Internal error").replace(/token|password|secret|authorization|cookie/gi,"[redacted]").slice(0,300)};}
function secureLogger(auditService){return{error(error){console.error("Server error:",safeError(error));auditService.record({eventType:"server.error",outcome:"failure",metadata:{code:error?.code||"ERROR",name:error?.name||"Error"}}).catch(()=>{});}};}
function actorFromRequest(request,authService){try{const raw=String(request.headers.cookie||"");const part=raw.split(";").map(x=>x.trim()).find(x=>x.startsWith("__Host-gracz_session="));if(!part)return null;const token=decodeURIComponent(part.slice(part.indexOf("=")+1));return authService.verify(token).userId;}catch{return null;}}
