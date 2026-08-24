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
import { ThousandGameService } from "./thousand-service.js";
import { MemoryThousandRepository, PostgresThousandRepository } from "./thousand-repository.js";
import { ThousandRealtimeHub } from "./thousand-realtime.js";
import { createThousandHttpHandler } from "./thousand-http.js";
import { createGameHttpServer } from "./server.js";
import { FileSessionStore } from "./store.js";
import { PostgresSessionStore } from "./postgres-session-store.js";

const config = loadConfig();
const turnstileEnabled = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
const webRoot = fileURLToPath(new URL("../web", import.meta.url));
const store = config.databaseUrl ? new PostgresSessionStore(config.databaseUrl) : new FileSessionStore(join(config.dataDirectory, "sessions"));
if (config.databaseUrl && store.ready) await store.ready;
const baseAccounts = config.databaseUrl ? new PostgresAccountService(config.databaseUrl, config.authSecret) : new FileAccountService(join(config.dataDirectory, "accounts.json"));
if (config.databaseUrl && baseAccounts.ready) await baseAccounts.ready;
const accounts = config.databaseUrl ? new SecureAccountService(baseAccounts, config.databaseUrl) : baseAccounts;
if (config.databaseUrl && accounts.ready) await accounts.ready;
const authSessions = config.databaseUrl ? new PostgresAuthSessionStore(config.databaseUrl) : new MemoryAuthSessionStore();
if (authSessions.ready) await authSessions.ready;
const messageAttachments = config.databaseUrl ? new MessageAttachmentService(config.databaseUrl, config.authSecret) : null;
if (messageAttachments?.ready) await messageAttachments.ready;
const auth = new AuthService({ secret: config.authSecret });
const globalChat = new GlobalChatService(config.databaseUrl || null); await globalChat.ready;
const globalChatHandler = createGlobalChatHandler({ service: globalChat, auth, authSessions });
const tournaments = new TournamentService(config.databaseUrl || null); await tournaments.ready;
const tournamentHandler = createTournamentHandler({ service: tournaments, auth, authSessions });
const rankings = new RankingService(config.databaseUrl || null); await rankings.ready;
const rankingHandler = createRankingHandler({ service: rankings, auth, authSessions });
const newsletter = new NewsletterService(config.databaseUrl || null); await newsletter.ready;
const newsletterHandler = createNewsletterHandler(newsletter);

const thousandRepository = config.databaseUrl
  ? new PostgresThousandRepository(config.databaseUrl)
  : new MemoryThousandRepository();
if (thousandRepository.ready) await thousandRepository.ready;
const thousandService = new ThousandGameService({ repository: thousandRepository });
const thousandRealtime = new ThousandRealtimeHub({ service: thousandService });
const thousandHandler = createThousandHttpHandler({ service: thousandService, auth, authSessions, realtime: thousandRealtime });

const lobby = new LobbyService({ sessionStore: store, thousandService });
const platformLobbyHandler = createPlatformLobbyHttpHandler({ lobby, auth, authSessions });
const server = createGameHttpServer({ store, accounts, authSessions, messageAttachments, auth, lobby, webRoot, logger: console });

async function serveExtendedAsset(request, response) {
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = ({
    "/":"coming-soon.html","/coming-soon.html":"coming-soon.html","/coming-soon.css":"coming-soon.css","/coming-soon.js":"coming-soon.js",
    "/lobby.html":"lobby.html","/homepage-consoles.js":"homepage-consoles.js","/thousand-lobby.js":"thousand-lobby.js",
    "/tournaments.html":"tournaments.html","/tournaments.css":"tournaments.css","/tournaments.js":"tournaments.js",
    "/community.html":"community.html","/community.css":"community.css","/community.js":"community.js",
    "/ranking.html":"ranking.html","/ranking.css":"ranking.css","/ranking.js":"ranking.js",
    "/thousand.html":"thousand.html","/thousand.css":"thousand.css","/thousand-multiplayer.css":"thousand-multiplayer.css","/thousand.js":"thousand.js"
  })[pathname];
  if (!file) return false;
  const extension=file.split(".").at(-1);
  const contentType=({html:"text/html",css:"text/css",js:"text/javascript"})[extension]||"application/octet-stream";
  let content=await readFile(join(webRoot,file));
  if(file==="lobby.html") content=Buffer.from(content.toString("utf8").replace("</body>",'<script src="/thousand-lobby.js" defer></script></body>'),"utf8");
  response.writeHead(200,{"content-type":`${contentType}; charset=utf-8`,"cache-control":"no-store, no-cache, must-revalidate, proxy-revalidate","pragma":"no-cache","expires":"0","surrogate-control":"no-store"});
  response.end(content);
  return true;
}

const baseRequestHandler=server.listeners("request")[0]; server.removeAllListeners("request");
server.on("request",async(request,response)=>{try{
  if(await newsletterHandler(request,response))return;
  if(await thousandHandler(request,response))return;
  if(await platformLobbyHandler(request,response))return;
  if(await serveExtendedAsset(request,response))return;
  if(await globalChatHandler(request,response))return;
  if(await tournamentHandler(request,response))return;
  if(await rankingHandler(request,response))return;
  return baseRequestHandler(request,response);
}catch(error){console.error("Application request error:",error);if(!response.headersSent&&!response.writableEnded){response.writeHead(500,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify({error:{code:"APP_INTERNAL_ERROR",message:"Wewnętrzny błąd aplikacji."}}))}}});
server.prependListener("request",(_request,response)=>{response.setHeader("X-Content-Type-Options","nosniff");response.setHeader("X-Frame-Options","DENY");response.setHeader("X-Permitted-Cross-Domain-Policies","none");response.setHeader("Referrer-Policy","strict-origin-when-cross-origin");response.setHeader("Cross-Origin-Opener-Policy","same-origin");response.setHeader("Cross-Origin-Resource-Policy","same-origin");response.setHeader("Origin-Agent-Cluster","?1");response.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");const turnstileOrigin="https://challenges.cloudflare.com";const scriptSrc=turnstileEnabled?`'self' 'unsafe-inline' ${turnstileOrigin}`:"'self' 'unsafe-inline'";const connectSrc=turnstileEnabled?`'self' ${turnstileOrigin}`:"'self'";const frameSrc=turnstileEnabled?turnstileOrigin:"'none'";response.setHeader("Content-Security-Policy",`default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSrc}; frame-src ${frameSrc}; font-src 'self'; object-src 'none'; media-src 'none'; worker-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`);response.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains")});
server.requestTimeout=20_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;server.maxHeadersCount=100;
server.listen(config.port,config.host,()=>{console.log(`Gracz.pl działa na http://${config.host}:${config.port}`);console.log(`Publiczna strona: coming soon + newsletter`);console.log(`Newsletter: ${config.databaseUrl?"PostgreSQL":"pamięć procesu (tryb developerski)"}`);console.log(`Tysiąc: ${config.databaseUrl?"PostgreSQL + realtime SSE":"pamięć procesu + realtime SSE"}`)});
let shuttingDown=false;async function shutdown(signal){if(shuttingDown)return;shuttingDown=true;console.log(`Otrzymano ${signal}. Zamykanie serwera…`);server.close(async()=>{try{thousandRealtime.close();await thousandService.close();if(typeof store.close==="function")await store.close();if(typeof accounts.close==="function")await accounts.close();if(typeof authSessions.close==="function")await authSessions.close();if(messageAttachments&&typeof messageAttachments.close==="function")await messageAttachments.close();await globalChat.close();await tournaments.close();await rankings.close();await newsletter.close();process.exit(0)}catch(error){console.error("Błąd podczas zamykania aplikacji:",error);process.exit(1)}})}for(const signal of ["SIGINT","SIGTERM"])process.once(signal,()=>void shutdown(signal));
