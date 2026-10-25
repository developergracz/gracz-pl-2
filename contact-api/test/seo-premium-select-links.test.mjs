import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("only canonical https gracz.pl public URLs become navigable links",async()=>{
  const js=await read("../admin-r1/ui/seo.js");
  const fn=js.slice(js.indexOf("function safePublicPageUrl("),js.indexOf("function publicPageCell("));
  const safe=runInNewContext(fn+"\nsafePublicPageUrl;",{URL});
  assert.equal(safe("https://gracz.pl/gry/warcaby/"),"https://gracz.pl/gry/warcaby/");
  assert.equal(safe("https://gracz.pl/"),"https://gracz.pl/");
  for(const value of ["javascript:alert(1)","http://gracz.pl/","https://evil.tld/",
    "https://gracz.pl.evil.tld/", "https://gracz.pl:8080/","https://gracz.pl@evil.tld/",
    "https://gracz.pl/?utm_source=test","https://gracz.pl/#seo",{},null]){
    assert.equal(safe(value),null,String(value));
  }
  assert.equal(safe("x".repeat(2049)),null);
});

test("SEO status table renders exactly one safe URL link in address cell",async()=>{
  const js=await read("../admin-r1/ui/seo.js");
  assert.match(js,/publicPageCell\(tr,item\.url\);cell\(tr,item\.ok\?"OK":"BŁĄD"\)/);
  assert.match(js,/link\.href=url;/);
  assert.match(js,/link\.target="_blank";/);
  assert.match(js,/link\.rel="noopener noreferrer";/);
  assert.match(js,/link\.textContent=raw;/);
  assert.doesNotMatch(js,/innerHTML\s*=/);
  const html=await read("../admin-r1/ui/seo.html");
  assert.match(html,/<tbody id="seo-rows"><\/tbody>/);
});

test("required select displays Premium accessible validation, clears on change, keeps native selection",async()=>{
  const js=await read("../admin-r1/ui/seo.js");
  const css=await read("../admin-r1/ui/seo.css");
  assert.match(js,/document\.addEventListener\("invalid",event=>\{/);
  assert.match(js,/event\.preventDefault\(\)/);
  assert.match(js,/document\.addEventListener\("change",event=>\{/);
  assert.match(js,/warning\.setAttribute\("role","alert"\)/);
  assert.match(js,/aria-describedby/);
  assert.match(css,/\.seo-shell \.seo-premium-select-warning\{/);
  assert.match(css,/\.seo-shell select\[aria-invalid="true"\]/);
  assert.match(css,/\.seo-shell select:focus-visible/);
  assert.match(css,/\.seo-shell #seo-rows \.seo-public-page-link:is\(:hover,:focus-visible\)/);
  const testForms=await read("../admin-r1/ui/seo.html");
  assert.match(testForms,/<select id="seo-inspect-url" required>/);
  const controls=await read("../admin-r1/ui/index.html");
  assert.doesNotMatch(controls,/<select[^>]*required/,"SEO select is the only required dropdown in the owner admin pages");
});

test("custom selection warning prevents the native bubble and disappears when selection is valid",async()=>{
  const js=await read("../admin-r1/ui/seo.js");
  const slice=js.slice(js.indexOf("function clearSelectWarning("),js.indexOf("async function load()"));
  const listeners={},byId=new Map();
  class HTMLSelectElement{
    constructor(){this.id="seo-inspect-url";this.required=true;this.validity={valid:false};this.attrs={};this.sibling=null;}
    closest(selector){return selector===".seo-shell"?{}:null;}
    getAttribute(k){return this.attrs[k]??null;}
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k];}
    insertAdjacentElement(_where,element){this.sibling=element;byId.set(element.id,element);}
  }
  const document={
    addEventListener:(type,fn)=>{listeners[type]=fn;},
    createElement:tag=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},
      remove(){byId.delete(this.id);},textContent:""}),
    getElementById:id=>byId.get(id)||null
  };
  runInNewContext(slice,{document,HTMLSelectElement});
  const select=new HTMLSelectElement();
  let prevented=false;
  listeners.invalid({target:select,preventDefault(){prevented=true;}});
  assert.ok(prevented,"native unstyled browser tooltip must not appear");
  const message=select.sibling;
  assert.equal(message.attrs.role,"alert");
  assert.equal(message.textContent,"Wybierz element z listy, aby kontynuować.");
  assert.equal(select.attrs["aria-invalid"],"true");
  assert.equal(select.attrs["aria-describedby"],"seo-inspect-url-premium-warning");
  select.validity.valid=true;
  listeners.change({target:select});
  assert.equal(byId.size,0);
  assert.equal(select.attrs["aria-invalid"],undefined);
  assert.equal(select.attrs["aria-describedby"],undefined);
});
