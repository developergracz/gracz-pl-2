// Generate the mobile homepage candidate from actual local game-console renders.
// Run from an isolated, approved checkout with Playwright + Chromium already installed.
// No database, credentials, live HTTP requests, deployment or game source edits.
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

const games=[
 ['szachy','Szachy',64],
 ['warcaby','Warcaby',64],
 ['gomoku','Gomoku',225],
];
const out=await mkdtemp(join(tmpdir(),'gracz-mobile-candidate-'));
const assets=join(out,'assets');
await mkdir(assets);
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='GET' && (serveChessConsole(req,res,url)||serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url)))return;
 // Only serve console source assets; deliberately no account, chat or match API.
 res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
 browser=await chromium.launch({headless:true});
 for(const [slug,label,count] of games){
  const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin&&r.request().method()==='GET'?r.continue():r.abort();});
   await context.routeWebSocket('**/*',ws=>ws.close());
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/konto/'+slug+'/',{waitUntil:'load'});
   await page.waitForFunction(n=>document.querySelector('#board')?.children.length===n,count,{timeout:15000});
   await page.locator('#board').waitFor({state:'visible'});
   await page.locator('.side-dock').waitFor({state:'visible'});
   await page.locator('#chat-panel').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   const board=await page.locator('#board').boundingBox();
   const panel=await page.locator('.side-dock').boundingBox();
   if(!board||!panel||panel.x<board.x+board.width-2)throw Error(label+': original right-hand layout unavailable');
   if(errors.length)throw Error(label+': '+errors.join('; '));
   const x=Math.floor(board.x),y=Math.floor(Math.min(board.y,panel.y));
   const right=Math.ceil(panel.x+panel.width),bottom=Math.ceil(Math.max(board.y+board.height,panel.y+panel.height));
   if(x<0||y<0||right>1600||bottom>900)throw Error(label+': console does not fit capture viewport');
   await page.screenshot({path:join(assets,'mobile-original-'+slug+'.png'),clip:{x,y,width:right-x,height:bottom-y},animations:'disabled'});
  }finally{await context.close();}
 }
 const source=await readFile(new URL('../../maintenance-site/index.html',import.meta.url),'utf8');
 const start=source.indexOf('<section class="comic-mobile"');
 const end=source.indexOf('<div id="public-portal"',start);
 const old=source.slice(start,end);
 const auth=old.indexOf('<div class="comic-auth">'), game=old.indexOf('<section class="comic-games"'), news=old.indexOf('<section class="comic-newsletter"');
 if(start<0||end<0||!(auth>0&&game>auth&&news>game))throw Error('Mobile homepage source changed');
 const cards=games.map(([slug,label])=>'<a class="mobile-original-game" href="https://gracz-contact-api.onrender.com/konto/'+slug+'/" aria-label="Zagraj w '+label+'"><img src="/assets/mobile-original-'+slug+'.png" alt="Oryginalna konsola '+label+' — plansza i panel gry"><span>'+label+' · Graj</span></a>').join('\n');
 const replacement='<section class="comic-mobile" aria-labelledby="comic-mobile-title"><h1 id="comic-mobile-title">Najlepszym graczom!</h1><section id="comic-games" aria-label="Szybki dostęp do gier">'+cards+'</section>'+old.slice(auth,game)+old.slice(news);
 const link='<link rel="stylesheet" href="/assets/mobile-original-console.css" media="(max-width:680px)">\n';
 const html=source.slice(0,start)+replacement+source.slice(end);
 await writeFile(join(out,'index.html'),html.replace('</head>',link+'</head>'));
 await writeFile(join(assets,'mobile-original-console.css'),`
@media(max-width:680px){
 body.homepage-premium-max .r4-homepage>.comic-mobile{background:#fff!important;padding:10px!important;color:#173b3c!important}
 body.homepage-premium-max .comic-mobile #comic-mobile-title{font:700 20px/1.3 Arial,sans-serif!important;letter-spacing:normal!important;margin:0 0 10px!important;text-align:center;color:#173b3c!important}
 body.homepage-premium-max .comic-mobile #comic-games{display:grid;gap:10px}
 body.homepage-premium-max .comic-mobile .mobile-original-game{display:block;min-width:0;border:1px solid #d9e1e1;border-radius:6px;background:#fff;color:#173b3c;text-decoration:none;overflow:hidden;box-shadow:none}
 body.homepage-premium-max .comic-mobile .mobile-original-game img{display:block;width:100%;height:auto}
 body.homepage-premium-max .comic-mobile .mobile-original-game span{display:grid;place-items:center;min-height:44px;font:700 15px/1.2 Arial,sans-serif;color:#fff;background:#075c5e}
 body.homepage-premium-max .comic-mobile .mobile-original-game:focus-visible{outline:3px solid #173b3c;outline-offset:2px}
}`);
 console.log('Candidate generated, NOT deployed:',out);
 console.log('Review all three captures and desktop/mobile regression before copying assets.');
} finally {
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
