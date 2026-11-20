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
export const checkersHandCursorCss='/* Dłoń Premium: raster glove cursor, sized to the real pawn by data-checkers-hand. */\n'+rules.join('\n');

// Picks the glove size closest to the real pawn and warms the grip image so the first drag shows it.
export const checkersHandCursorJs="(()=>{const board=document.getElementById('board');\n"+
" if(!board||typeof ResizeObserver!=='function')return;\n"+
" const tiers="+JSON.stringify(CHECKERS_HAND_TIERS.map(t=>[t.name,Number.isFinite(t.below)?t.below:1e9,t.sizes[0]]))+";let current='';\n"+
" const update=()=>{\n"+
"  const piece=board.querySelector('.square .piece'),square=board.querySelector('.square');\n"+
"  // Pawns are 77% of a square and squares 1/8 of the board until the first render adds them.\n"+
"  const diameter=(piece&&piece.offsetWidth)||((square&&square.offsetWidth)||board.clientWidth/8)*.77;\n"+
"  if(!(diameter>0))return;\n"+
"  const tier=tiers.find(t=>diameter<t[1])||tiers[tiers.length-1];\n"+
"  if(tier[0]===current)return;current=tier[0];board.dataset.checkersHand=tier[0];\n"+
"  const warm=new Image();warm.decoding='async';warm.src='/checkers-hand/grip-'+tier[2]+((window.devicePixelRatio||1)>1?'-2x':'')+'.png';\n"+
" };\n"+
" new ResizeObserver(update).observe(board);update();\n"+
"})();";
