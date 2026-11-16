import * as R from '/home/user/gracz-pl-2/contact-api/auth/chess-rules.mjs';
import {chooseComputerMove} from '/home/user/gracz-pl-2/contact-api/auth/chess-computer.mjs';
const uci=m=>R.coord(m[0])+R.coord(m[1])+m[2];
const mate1=s=>R.legal(s).find(m=>R.result([R.apply(s,m)]).startsWith('Mat'));
const isM2=(s,m)=>{const a=R.apply(s,m);const rs=R.legal(a);return rs.length>0&&!R.result([a])&&rs.every(r=>!!mate1(R.apply(a,r)));};
let x=12345;const rnd=n=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x%n;};
const found=[];
const sets=[['K','k','R','R'],['K','k','Q','N'],['K','k','R','B','p','p']];
for(let it=0;it<200000&&found.length<6;it++){
 const pieces=sets[it%sets.length];const sq=new Set();const b=Array(128).fill('.');
 for(const p of pieces){let i;do{const r=rnd(8),c=rnd(8);i=r*16+c;}while(sq.has(i)||(p.toLowerCase()==='p'&&((i>>4)===0||(i>>4)===7)));sq.add(i);b[i]=p;}
 const s={b,t:1,c:0,ep:-1,half:0,full:1};
 if(R.check(s,-1))continue; if(R.result([s]))continue; if(mate1(s))continue;
 const sol=R.legal(s).find(m=>isM2(s,m));if(!sol)continue;
 const row={fen:b.join(''),solution:uci(sol)};
 for(const [ui,lvl,ms] of [['normal','beginner',450],['hard','normal',450],['expert','hard',450],['master','master',750]]){const c=chooseComputerMove(s,{level:lvl,maxMs:ms});row[ui]=(isM2(s,c)?'OK ':'MISS ')+uci(c);}
 found.push(row);
}
const fen=b=>{let rows=[];for(let r=0;r<8;r++){let row='',e=0;for(let c=0;c<8;c++){const p=b[r*16+c];if(p==='.')e++;else{if(e)row+=e;e=0;row+=p;}}if(e)row+=e;rows.push(row);}return rows.join('/')+' w - - 0 1';};
for(const f of found)f.fen=fen(f.fen.split(''));
console.log(JSON.stringify(found,null,1));
