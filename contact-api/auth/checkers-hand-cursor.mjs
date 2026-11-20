// GRACZ.PL Warcaby — "Dłoń Premium" glove cursor. Visual only: no move, clock, bot, chat or layout logic.
//
// The PNGs in public/checkers-hand/ are cut from the approved sketch (01_WZOR_GLOWNY for the drag
// grip, its pawn-free companion 03 for hover) with real transparency and without the sketch's red
// pawn: the game keeps drawing its own white/black pawns underneath the glove.
//
// Both states of one size share a canvas, aligned on the cuff, and the hotspot is the centre of the
// held pawn. The drag ghost is centred on the pointer, so the glove closes in place over it.
//
// Browser limits: Chromium and Firefox ignore cursor images larger than 128 CSS px, and drop an
// image larger than 32 px whose rectangle would leave the viewport (e.g. the bottom board row).
// Each cursor list therefore steps down through smaller sizes, then a 32 px PNG, then the standard
// grab/grabbing keyword. 2x files are offered through image-set() for HiDPI screens.

// width/height in CSS px (2x files are exactly double), hotspot = held pawn centre, pawn = the
// pawn diameter the glove was cut around (CSS px).
export const CHECKERS_HAND_SIZES=Object.freeze({
 l:Object.freeze({width:120,height:128,hotspot:Object.freeze([16,61]),pawn:73.5}),
 m:Object.freeze({width:98,height:104,hotspot:Object.freeze([13,49]),pawn:59.7}),
 s:Object.freeze({width:79,height:84,hotspot:Object.freeze([11,40]),pawn:48.2})
});
export const CHECKERS_HAND_FALLBACK=Object.freeze({width:32,height:32,hotspot:Object.freeze([4,15]),pawn:18.4});

// Tier = real pawn diameter on the board (CSS px). Pawns larger than the 128 px glove can hold
// (big screens) keep the largest glove and move it to the pawn's palm-side rim instead of its centre.
export const CHECKERS_HAND_TIERS=Object.freeze([
 Object.freeze({name:'s',below:54,pawn:48.2,sizes:Object.freeze(['s'])}),
 Object.freeze({name:'m',below:66.5,pawn:59.7,sizes:Object.freeze(['m','s'])}),
 Object.freeze({name:'l',below:85,pawn:73.5,sizes:Object.freeze(['l','m','s'])}),
 Object.freeze({name:'xl',below:108,pawn:97,sizes:Object.freeze(['l','m','s'])}),
 Object.freeze({name:'xxl',below:Infinity,pawn:120,sizes:Object.freeze(['l','m','s'])})
]);
export const CHECKERS_HAND_DEFAULT_TIER='l';
export const CHECKERS_HAND_FILES=Object.freeze(['open.png','grip.png',
 ...Object.keys(CHECKERS_HAND_SIZES).flatMap(size=>['open','grip'].flatMap(state=>[state+'-'+size+'.png',state+'-'+size+'-2x.png']))]);

const shiftedHotspot=(entry,tierPawn)=>{
 const shift=Math.max(0,(tierPawn-entry.pawn)/2);
 return [Math.max(0,Math.round(entry.hotspot[0]-shift)),entry.hotspot[1]];
};
export function checkersHandCursorList(state,tierName){
 const tier=CHECKERS_HAND_TIERS.find(t=>t.name===tierName);
 if(!tier||(state!=='open'&&state!=='grip'))throw Error('Unknown checkers hand cursor '+state+'/'+tierName);
 return [...tier.sizes.map(size=>({file:state+'-'+size,hotspot:shiftedHotspot(CHECKERS_HAND_SIZES[size],tier.pawn)})),
  {file:state,hotspot:shiftedHotspot(CHECKERS_HAND_FALLBACK,tier.pawn),fallback:true}];
}

const url=file=>"url('/checkers-hand/"+file+".png')";
function cursorDeclarations(state,tierName,important){
 const list=checkersHandCursorList(state,tierName),keyword=state==='open'?'grab':'grabbing',flag=important?'!important':'';
 const value=image=>list.map(item=>(item.fallback?url(item.file):image(item.file))+' '+item.hotspot.join(' ')).join(',')+','+keyword+flag;
 // Plain 1x PNGs first; browsers that understand image-set() in cursor replace it with HiDPI pairs.
 return 'cursor:'+value(url)+';cursor:'+value(file=>'image-set('+url(file)+' 1x,'+url(file+'-2x')+' 2x)');
}
const boardSelector='.warcaby-console .board.checkers-grid:not(.preview)';
const tierAttr=name=>name===CHECKERS_HAND_DEFAULT_TIER?'':'[data-checkers-hand="'+name+'"]';
const rules=[];
for(const {name} of CHECKERS_HAND_TIERS){
 const at=boardSelector+tierAttr(name);
 rules.push(at+' .square.checkers-hand-ready{'+cursorDeclarations('open',name,false)+'}');
 rules.push(at+'.checkers-hand-grabbing,'+at+'.checkers-hand-grabbing .square{'+cursorDeclarations('grip',name,true)+'}');
}
// Keep the closed glove for the whole drag, also outside the board (illegal drop, snap-back).
// Separate rules: a browser without :has() drops only these and keeps the board rules above.
for(const {name} of CHECKERS_HAND_TIERS){
 const has='body.warcaby-console:has(.board.checkers-grid.checkers-hand-grabbing'+tierAttr(name)+')';
 rules.push(has+','+has+' *{'+cursorDeclarations('grip',name,true)+'}');
}
export const checkersHandCursorCss='/* Dłoń Premium: raster glove cursor, sized to the real pawn by data-checkers-hand. */\n'+rules.join('\n')+"\n/* Large premium glove is a separate non-interactive visual layer, not a browser cursor.\n   Only enable hiding the native hand after the DOM layer is mounted and a mouse is used. */\nbody.warcaby-console.checkers-hand-overlay-enabled #board .square.checkers-hand-ready,\nbody.warcaby-console.checkers-hand-overlay-enabled #board .square.checkers-hand-ready *,\nbody.warcaby-console.checkers-hand-overlay-enabled #board.checkers-hand-grabbing,\nbody.warcaby-console.checkers-hand-overlay-enabled #board.checkers-hand-grabbing *{cursor:none!important}\nbody.warcaby-console.checkers-hand-overlay-enabled:has(#board.checkers-hand-grabbing),\nbody.warcaby-console.checkers-hand-overlay-enabled:has(#board.checkers-hand-grabbing) *{cursor:none!important}\nbody.warcaby-console .checkers-hand-visual{\n position:fixed!important;left:0;top:0;z-index:100001!important;\n pointer-events:none!important;touch-action:none!important;\n width:0!important;height:0!important;overflow:visible!important;\n user-select:none!important;-webkit-user-select:none!important\n}\nbody.warcaby-console .checkers-hand-visual[hidden]{display:none!important}\nbody.warcaby-console .checkers-hand-visual img{\n position:absolute!important;max-width:none!important;max-height:none!important;\n pointer-events:none!important;display:block!important;filter:drop-shadow(0 2px 3px #001d2144)\n}\n"+String.raw`
body.warcaby-console .checkers-hand-visual img{
 transform-origin:36% 40%;transition:opacity 140ms ease-out,transform 155ms cubic-bezier(.2,.75,.25,1);will-change:opacity,transform
}
body.warcaby-console .checkers-hand-visual .checkers-hand-open{opacity:1;transform:translate(0,0) scale(1)}
body.warcaby-console .checkers-hand-visual .checkers-hand-grip{opacity:0;transform:translate(4%,-3%) scale(1.08)}
body.warcaby-console .checkers-hand-visual[data-state="grip"] .checkers-hand-open{opacity:0;transform:translate(-3%,1%) scale(.96)}
body.warcaby-console .checkers-hand-visual[data-state="grip"] .checkers-hand-grip{opacity:1;transform:translate(-2%,1%) scale(.96)}
`;

// Picks the glove size closest to the real pawn and warms the grip image so the first drag shows it.
export const checkersHandCursorJs="(()=>{\n const board=document.getElementById('board');\n if(!board||typeof ResizeObserver!=='function'||typeof window.PointerEvent!=='function')return;\n const tiers=[['s',54],['m',66.5],['l',85],['xl',108],['xxl',1e9]];\n const size={width:120,height:128,hotspotX:43,hotspotY:51,pawn:56};\n const url=state=>'/checkers-hand/'+state+'-l-2x.png';\n const visual=document.createElement('div');\n visual.className='checkers-hand-visual';visual.hidden=true;\n visual.setAttribute('aria-hidden','true');\n visual.dataset.state='open';\n const pictures={};\n for(const state of ['open','grip']){\n  const img=document.createElement('img');img.className='checkers-hand-'+state;\n  img.alt='';img.draggable=false;img.src=url(state);img.decoding='async';\n  visual.append(img);pictures[state]=img;\n }\n document.body.append(visual);\n let current='',lastX=-1,lastY=-1,mouseActive=false,pressed=false,raf=0;\n const diameter=()=>{\n  const piece=board.querySelector('.square .piece'),square=board.querySelector('.square');\n  return (piece&&piece.getBoundingClientRect().width)||\n   (((square&&square.getBoundingClientRect().width)||board.getBoundingClientRect().width/8)*.77);\n };\n const updateSize=()=>{\n  const d=diameter();if(!(d>0))return;\n  const tier=tiers.find(t=>d<t[1])||tiers[tiers.length-1];\n  if(tier[0]!==current){\n   current=tier[0];board.dataset.checkersHand=tier[0];\n  }\n };\n const hide=()=>{visual.hidden=true;document.body.classList.remove('checkers-hand-overlay-enabled');};\n const render=()=>{\n  raf=0;updateSize();\n  if(!mouseActive||lastX<0||lastY<0){hide();return;}\n  const dragging=board.classList.contains('checkers-hand-grabbing');\n  const hovered=document.elementFromPoint(lastX,lastY);\n  const square=hovered&&hovered.closest?hovered.closest('#board .square.checkers-hand-ready'):null;\n  const piece=square&&square.querySelector('.piece');\n  if(!dragging&&!piece){hide();return;}\n  const d=diameter();if(!(d>0)){hide();return;}\n  const scale=Math.min(2.7,Math.max(.4,d/size.pawn));\n  const state=(dragging||pressed)?'grip':'open';\n  const rect=piece&&!dragging?piece.getBoundingClientRect():null;\n  let x=rect?rect.left+rect.width/2:lastX;\n  let y=rect?rect.top+rect.height/2:lastY;\n  if(dragging){\n   const b=board.getBoundingClientRect(),half=d/2;\n   x=Math.min(b.right-half,Math.max(b.left+half,x));\n   y=Math.min(b.bottom-half,Math.max(b.top+half,y));\n  }\n  for(const img of Object.values(pictures)){\n   img.style.width=(size.width*scale)+'px';img.style.height=(size.height*scale)+'px';\n   img.style.left=(-size.hotspotX*scale)+'px';img.style.top=(-size.hotspotY*scale)+'px';\n  }\n  visual.style.left=x+'px';visual.style.top=y+'px';\n  visual.dataset.state=state;\n  document.body.classList.add('checkers-hand-overlay-enabled');\n  visual.hidden=false;\n };\n const schedule=()=>{if(!raf)raf=requestAnimationFrame(render);};\n const onPointer=event=>{\n  if(event.pointerType!=='mouse')return;\n  lastX=event.clientX;lastY=event.clientY;mouseActive=true;\n  schedule();\n };\n document.addEventListener('pointermove',onPointer,{passive:true,capture:true});\n document.addEventListener('pointerover',onPointer,{passive:true,capture:true});\n document.addEventListener('pointerdown',event=>{\n  if(event.pointerType!=='mouse')return;\n  onPointer(event);\n  const square=event.target&&event.target.closest?\n   event.target.closest('#board .square.checkers-hand-ready'):null;\n  pressed=Boolean(square&&square.querySelector('.piece'));schedule();\n },true);\n const release=event=>{\n  if(event.pointerType!=='mouse')return;\n  pressed=false;onPointer(event);\n };\n document.addEventListener('pointerup',release,true);\n document.addEventListener('pointercancel',release,true);\n document.addEventListener('pointerout',event=>{\n  if(event.pointerType==='mouse'&&!event.relatedTarget){\n   mouseActive=false;pressed=false;hide();\n  }\n },true);\n window.addEventListener('blur',()=>{mouseActive=false;pressed=false;hide();});\n window.addEventListener('scroll',schedule,{passive:true,capture:true});\n new ResizeObserver(schedule).observe(board);\n new MutationObserver(schedule).observe(board,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});\n updateSize();\n})();";
