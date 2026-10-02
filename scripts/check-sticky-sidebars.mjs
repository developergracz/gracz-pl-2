import fs from "node:fs";
import path from "node:path";

const root="maintenance-site";
const expected=[
  "gry-karciane/index.html",
  "gry/gomoku/index.html",
  "gry/gomoku/zasady/index.html",
  "gry/index.html",
  "gry/poker-treningowy/index.html",
  "gry/poker-treningowy/zasady/index.html",
  "gry/tysiac/index.html",
  "gry/tysiac/zasady/index.html",
  "gry/warcaby/index.html",
  "gry/warcaby/zasady/index.html",
  "o-gracz-pl/index.html",
  "poradniki/index.html"
];

const railRe=/<aside\b[^>]*class="[^"]*(?:side-column|poker-side-panel|warcaby-side-panel|gomoku-side-panel|rules-side-panel|rules-toc)[^"]*"/i;
const cssNeedle='/assets/sticky-sidebars.css?v=r4';
const jsNeedle='/assets/sticky-sidebars.js?v=r4';
const failures=[];
const discovered=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith(".html")){
      const html=fs.readFileSync(full,"utf8");
      if(railRe.test(html)){
        const rel=path.relative(root,full).replaceAll("\\","/");
        discovered.push(rel);
        const cssCount=html.split(cssNeedle).length-1;
        const jsCount=html.split(jsNeedle).length-1;
        if(cssCount!==1)failures.push(`${rel}: expected exactly one R4 CSS link, got ${cssCount}`);
        if(jsCount!==1)failures.push(`${rel}: expected exactly one R4 JS link, got ${jsCount}`);
      }
    }
  }
}

walk(root);
discovered.sort();

for(const rel of expected){
  if(!discovered.includes(rel))failures.push(`known right-rail page not discovered: ${rel}`);
}
for(const rel of discovered){
  if(!expected.includes(rel)){
    console.log(`INFO: new right-rail page discovered and covered: ${rel}`);
  }
}

if(!fs.existsSync(path.join(root,"assets/sticky-sidebars.css")))failures.push("sticky-sidebars.css missing");
if(!fs.existsSync(path.join(root,"assets/sticky-sidebars.js")))failures.push("sticky-sidebars.js missing");

if(failures.length){
  console.error("STICKY SIDEBARS COVERAGE: FAIL");
  failures.forEach(f=>console.error("- "+f));
  process.exit(1);
}

console.log("STICKY SIDEBARS COVERAGE: PASS");
console.log(`covered right-rail pages: ${discovered.length}`);
discovered.forEach(rel=>console.log("- "+rel));
