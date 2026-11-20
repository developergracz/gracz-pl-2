// Warcaby "Dłoń Premium" cursor: real raster assets, hotspots, CSS wiring and served MIME types.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {CHECKERS_HAND_SIZES,CHECKERS_HAND_FALLBACK,CHECKERS_HAND_TIERS,CHECKERS_HAND_FILES,checkersHandCursorList} from '../auth/checkers-hand-cursor.mjs';

const asset=file=>readFileSync(new URL('../public/checkers-hand/'+file,import.meta.url));

// Minimal PNG reader (8-bit RGBA, non-interlaced) so the test needs no image dependency.
function decodePng(buffer){
 assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG signature');
 let offset=8,width=0,height=0;const idat=[];
 while(offset<buffer.length){
  const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);
  if(type==='IHDR'){
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   assert.equal(data[8],8,'8-bit channels');assert.equal(data[9],6,'RGBA: real alpha channel');assert.equal(data[12],0,'not interlaced');
  }else if(type==='IDAT')idat.push(data);
  else if(type==='IEND')break;
  offset+=12+length;
 }
 const raw=inflateSync(Buffer.concat(idat)),stride=width*4,pixels=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
  for(let x=0;x<stride;x++){
   const left=x>=4?pixels[y*stride+x-4]:0,up=y?pixels[(y-1)*stride+x]:0,upLeft=y&&x>=4?pixels[(y-1)*stride+x-4]:0;
   const p=left+up-upLeft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upLeft);
   const predictor=[0,left,up,(left+up)>>1,pa<=pb&&pa<=pc?left:pb<=pc?up:upLeft][filter];
   pixels[y*stride+x]=(line[x]+predictor)&255;
  }
 }
 return {width,height,at:(x,y)=>[...pixels.subarray((y*width+x)*4,(y*width+x)*4+4)]};
}
function stats(png){
 let opaque=0,partial=0,red=0,teal=0;
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const [r,g,b,a]=png.at(x,y);
  if(a===255)opaque++;else if(a>0)partial++;
  if(a>128&&r-Math.max(g,b)>60)red++;
  if(a>128&&(g+b)/2-r>60&&g>110)teal++;
 }
 return {opaque,partial,red,teal};
}

test('glove PNGs: browser-safe sizes, real transparency, white glove + turquoise cuff, no sketch pawn',()=>{
 assert.equal(CHECKERS_HAND_FILES.length,14);
 for(const [name,size] of Object.entries(CHECKERS_HAND_SIZES)){
  assert.ok(size.width<=128&&size.height<=128,name+': Chromium/Firefox reject cursors above 128 CSS px');
  for(const state of ['open','grip']){
   const one=decodePng(asset(state+'-'+name+'.png')),two=decodePng(asset(state+'-'+name+'-2x.png'));
   assert.deepEqual([one.width,one.height],[size.width,size.height],state+'-'+name+' canvas');
   assert.deepEqual([two.width,two.height],[size.width*2,size.height*2],state+'-'+name+'-2x is exactly double');
   for(const png of [one,two]){
    for(const [x,y] of [[0,0],[png.width-1,0],[0,png.height-1]])assert.equal(png.at(x,y)[3],0,'transparent corner');
    const s=stats(png);
    assert.ok(s.opaque>png.width*png.height*.3,'solid glove');
    assert.ok(s.partial>png.width+png.height,'anti-aliased edge, not a hard cut-out');
    assert.equal(s.red,0,'the red pawn from the sketch is not part of the cursor');
    assert.ok(s.teal>png.width*png.height*.04,'turquoise cuff kept');
   }
   const [hx,hy]=size.hotspot,r=size.pawn/2;
   assert.ok(hx>=0&&hy>=0&&hx<size.width&&hy<size.height,'hotspot inside the image');
   assert.equal(one.at(hx,hy)[3],0,state+'-'+name+': the real pawn shows through at the hotspot');
   // As in the sketch: palm at the pawn's right rim, fingers over its top, thumb just below the centre.
   const solid=(x,y)=>one.at(Math.round(x),Math.round(y))[3]===255;
   assert.ok(solid(hx+r*1.2,hy)&&!solid(hx+r*.9,hy),state+'-'+name+': palm at the pawn rim');
   assert.ok(solid(hx,hy-r*.8)&&!solid(hx,hy-r*.5),state+'-'+name+': fingers over the pawn');
   assert.ok(solid(hx,hy+r*.35),state+'-'+name+': thumb over the pawn');
  }
 }
 for(const state of ['open','grip']){
  const small=decodePng(asset(state+'.png'));
  assert.deepEqual([small.width,small.height],[CHECKERS_HAND_FALLBACK.width,CHECKERS_HAND_FALLBACK.height],'32px fallback stays usable at the viewport edge');
  assert.equal(stats(small).red,0);
 }
});

test('cursor lists: same glove canvas for hover and drag, largest first, 32px PNG and keyword last',()=>{
 for(const tier of CHECKERS_HAND_TIERS){
  const open=checkersHandCursorList('open',tier.name),grip=checkersHandCursorList('grip',tier.name);
  assert.deepEqual(open.map(i=>i.hotspot),grip.map(i=>i.hotspot),tier.name+': the glove does not jump when it closes');
  assert.equal(open.at(-1).file,'open');assert.equal(grip.at(-1).file,'grip');
  const heights=open.slice(0,-1).map(i=>CHECKERS_HAND_SIZES[i.file.slice(5)].height);
  assert.deepEqual(heights,[...heights].sort((a,b)=>b-a),tier.name+': browser picks the largest glove that fits');
  if(tier.pawn<=CHECKERS_HAND_SIZES.l.pawn)assert.deepEqual(open[0].hotspot,[...CHECKERS_HAND_SIZES[open[0].file.slice(5)].hotspot],'hotspot = held pawn centre');
  else assert.ok(open[0].hotspot[0]<CHECKERS_HAND_SIZES.l.hotspot[0],tier.name+': big pawns are held at their rim');
 }
});

test('Warcaby console serves the glove cursor CSS and tier script in both consoles',()=>{
 for(const query of ['','?konsola=klasyczna']){
  let body='',headers={};
  serveCheckersConsole({method:'GET'},{writeHead(_,h){headers=h},end(v){body=String(v)}},new URL('https://example.com/konto/warcaby/styl.css'+query));
  assert.match(headers['Content-Type'],/^text\/css/);
  assert.doesNotMatch(body,/open-large\.svg|grip-large\.svg/,'old vector glove no longer used');
  for(const tier of CHECKERS_HAND_TIERS){
   const attr=tier.name==='l'?'':'[data-checkers-hand="'+tier.name+'"]';
   for(const [state,selector,keyword] of [['open',attr+' .square.checkers-hand-ready{','grab}'],['grip',attr+'.checkers-hand-grabbing .square{','grabbing!important}']]){
    const at=body.indexOf('.warcaby-console .board.checkers-grid:not(.preview)'+selector);
    assert.ok(at>=0,tier.name+' '+state+' rule');
    const rule=body.slice(at,body.indexOf('}',at+selector.length+60)+1);
    const list=checkersHandCursorList(state,tier.name);
    for(const item of list)assert.ok(rule.includes("url('/checkers-hand/"+item.file+".png')"+(item.fallback?' ':'')),item.file);
    assert.ok(rule.includes("url('/checkers-hand/"+list[0].file+".png') "+list[0].hotspot.join(' ')),'1x hotspot');
    assert.ok(rule.includes("image-set(url('/checkers-hand/"+list[0].file+".png') 1x,url('/checkers-hand/"+list[0].file+"-2x.png') 2x) "+list[0].hotspot.join(' ')),'HiDPI hotspot');
    assert.ok(rule.endsWith(keyword),'standard cursor keyword fallback');
   }
  }
  assert.match(body,/body\.warcaby-console:has\(\.board\.checkers-grid\.checkers-hand-grabbing\) \*\{cursor:/,'grip kept outside the board while dragging');
  serveCheckersConsole({method:'GET'},{writeHead(){},end(v){body=String(v)}},new URL('https://example.com/konto/warcaby/app.js'+query));
  assert.ok(body.includes("board.dataset.checkersHand=tier[0]"),'tier script mounted');
 }
});

test('server.mjs serves every glove PNG as image/png and nothing else from /checkers-hand/',{timeout:30000},async t=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const port=probe.address().port;probe.close();await once(probe,'close');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','pipe'],env:{...process.env,
  NODE_ENV:'test',PORT:String(port),HOST:'127.0.0.1',EMAIL_FROM:'Gracz.pl <kontakt@gracz.pl>',CONTACT_TO:'admin@gracz.pl',
  CONTACT_REPLY_SECRET:'test-'+'x'.repeat(40),PREMIUM_REPLY_TEST_MEMORY_STORE:'1',CONTACT_IDEMPOTENCY_TEST_MEMORY_STORE:'1',DATABASE_URL:''}});
 t.after(()=>child.kill('SIGTERM'));
 const base='http://127.0.0.1:'+port;
 for(let i=0;;i++){
  try{if((await fetch(base+'/health')).status)break}catch{}
  assert.ok(i<100,'server started');await new Promise(r=>setTimeout(r,100));
 }
 for(const file of CHECKERS_HAND_FILES){
  const response=await fetch(base+'/checkers-hand/'+file);
  assert.equal(response.status,200,file);
  assert.equal(response.headers.get('content-type'),'image/png',file);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('cache-control'),/public, max-age=\d+/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),asset(file),file+' bytes');
 }
 for(const path of ['/checkers-hand/open-xl.png','/checkers-hand/../server.mjs','/checkers-hand/open-l-3x.png'])
  assert.notEqual((await fetch(base+path)).headers.get('content-type'),'image/png',path);
});
