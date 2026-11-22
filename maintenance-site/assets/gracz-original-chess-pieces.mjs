// Original Gracz.pl vectors, drawn for #741; no third-party artwork or fonts.
// Six silhouettes × two opaque palettes = twelve SVG variants. Coordinates share
// a 96×96 canvas and baseline. Keep every body closed and fully filled.
const shapes={
 k:{name:'król',body:'M44 8H52V15H59V23H52V31C58 27 65 28 69 32C75 39 68 49 60 53L64 68H69V74L77 80V87H19V80L27 74V68H32L36 53C28 49 21 39 27 32C31 28 38 27 44 31V23H37V15H44Z',detail:'M35 36Q41 34 48 39Q55 34 61 36M36 53H60M33 62H63M28 69H68M28 75H68M24 81H72',light:'M30 38Q29 43 36 47M40 57L37 64M25 83H70'},
 q:{name:'hetman',body:'M26 22C20 23 18 15 23 12C28 9 33 15 29 20L37 38L44 16C38 12 41 5 48 5C55 5 58 12 52 16L59 38L67 20C63 15 68 9 73 12C78 15 76 23 70 22L65 49H61L65 68H70V74L78 80V87H18V80L26 74V68H31L35 49H31Z',detail:'M32 43Q48 48 64 43M35 49H61M34 61H62M27 69H69M27 75H69M23 81H73',light:'M34 29L38 40M40 53L37 64M24 83H71'},
 r:{name:'wieża',body:'M23 14H35V24H42V14H54V24H61V14H73V36L65 43H62V67H69V74L77 80V87H19V80L27 74V67H34V43H31L23 36Z',detail:'M25 34H71M32 42H64M35 50H61M35 61H61M28 68H68M28 75H68M24 81H72',light:'M28 18V30M39 47V63M25 83H70'},
 b:{name:'goniec',body:'M44 8Q48 4 52 8Q56 12 52 16C56 23 69 32 69 42C69 49 63 53 57 55L62 68H68V74L76 80V87H20V80L28 74V68H34L39 55C33 53 27 49 27 42C27 32 40 23 44 16Q40 12 44 8Z',detail:'M51 24L41 40M34 48Q48 54 62 48M39 56H57M29 69H67M29 75H67M25 81H71',light:'M39 30Q32 37 33 42M43 58L39 65M26 83H69'},
 n:{name:'skoczek',body:'M33 68C34 58 42 50 50 43L40 39L29 47L18 42L22 30L35 20L38 10L48 16L57 14C73 20 78 37 74 51L68 68H71V74L79 80V87H17V80L25 74V68Z',detail:'M38 23L46 27M26 35L29 34M21 40L29 42L39 34L51 39M56 23C67 29 69 42 64 53L58 65M26 69H70M26 75H70M22 81H74',light:'M40 15L42 21M59 19C72 29 74 40 69 51M23 83H72'},
 p:{name:'pionek',body:'M48 20C38 20 32 27 32 35C32 42 36 47 41 49L38 55H34V61H39C38 68 34 73 29 76L23 81V87H73V81L67 76C62 73 58 68 57 61H62V55H58L55 49C60 47 64 42 64 35C64 27 58 20 48 20Z',detail:'M41 49Q48 52 55 49M35 56H61M40 61H56M32 76H64M28 81H68',light:'M38 34C38 28 42 26 47 26M44 64L40 72M29 83H66'}
};
const palettes={
 white:{stops:['#cbd4d6','#ffffff','#f4f1e7','#c3ced2'],edge:'#35464e',detail:'#829299',light:'#ffffff'},
 black:{stops:['#101b24','#566674','#293743','#111c26'],edge:'#0b1720',detail:'#8194a0',light:'#b8c9d1'}
};
let nextPieceId=0;
export function chessPieceLabel(piece){
 if(typeof piece!=='string'||!/^[kqrbnpKQRBNP]$/.test(piece))return 'puste';
 const type=piece.toLowerCase(),white=piece===piece.toUpperCase();
 return (type==='r'?(white?'biała ':'czarna '):(white?'biały ':'czarny '))+shapes[type].name;
}
export function createChessPiece(document,piece){
 if(typeof piece!=='string'||!/^[kqrbnpKQRBNP]$/.test(piece))return null;
 const color=piece===piece.toUpperCase()?'white':'black',palette=palettes[color],shape=shapes[piece.toLowerCase()];
 const element=(tag,attrs)=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  return node;
 };
 // Unique even when the board and promotion choices coexist or are redrawn.
 const id='chess-piece-'+(++nextPieceId);
 const svg=element('svg',{class:'chess-piece',viewBox:'0 0 96 96',width:96,height:96,'aria-hidden':'true',focusable:'false','data-piece':piece,'data-color':color});
 const defs=element('defs',{}),gradient=element('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'25%'});
 for(const [i,offset] of ['0%','32%','61%','100%'].entries())gradient.append(element('stop',{offset,'stop-color':palette.stops[i]}));
 defs.append(gradient);
 const body=element('path',{d:shape.body,fill:'url(#'+id+')',stroke:palette.edge,'stroke-width':2.2,'stroke-linejoin':'round','data-body':'true'});
 const detail=element('path',{d:shape.detail,fill:'none',stroke:palette.detail,'stroke-width':1.8,'stroke-linejoin':'round','stroke-linecap':'round'});
 const light=element('path',{d:shape.light,fill:'none',stroke:palette.light,'stroke-width':1.7,'stroke-linecap':'round'});
 svg.append(defs,body,detail,light);
 return svg;
}
// Same controlled local source for Node tests and the existing browser asset map.
export const chessPiecesSource=`const shapes=${JSON.stringify(shapes)};\nconst palettes=${JSON.stringify(palettes)};\nlet nextPieceId=0;\nexport ${chessPieceLabel.toString()}\nexport ${createChessPiece.toString()}\n`;
