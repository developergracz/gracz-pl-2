import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("OWNER header/footer is shared across protected pages and login stays Premium",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const shellCss=await read("../admin-r1/ui/systemadmin.css");
  const adminCss=await read("../admin-r1/ui/admin.css");
  const loginJs=await read("../admin-r1/ui/login.js");
  const visualHtml=await read("../../maintenance-site/systemadmin/index.html");
  assert.match(router,/class="owner-premium-identity"/);
  assert.match(router,/class="owner-premium-heading">Panel Admin <span>gracz\.pl<\/span>/);
  assert.match(router,/FULL MAX PREMIUM · CENTRUM WŁAŚCICIELA/);
  assert.match(router,/Bezpieczne logowanie do Centrum administracyjnego gracz\.pl/);
  assert.match(router,/class="owner-premium-footer"/);
  assert.match(router,/class="owner-premium-login-footer"/);
  assert.match(router,/class="owner-login-security-note"/);
  assert.match(router,/Prywatne centrum administracyjne · Wszystkie prawa zastrzeżone/);
  assert.match(router,/const layoutClass='owner-admin-layout'\+\(current==='hub'\?' owner-admin-hub-layout':''\)/);
  assert.match(router,/\.replace\('<body>','<body class="'\+layoutClass\+'">'\+bar\+identity\)/);
  assert.match(router,/\.replace\('<\/body>',footer\+'<\/body>'\)/);
  assert.match(shellCss,/\.owner-premium-heading span\{color:#ff536c\}/);
  assert.match(shellCss,/\.owner-premium-footer\{/);
  assert.match(shellCss,/\.owner-admin-layout \.shell\{flex:1 0 auto;min-height:0\}/);
  assert.match(adminCss,/\.owner-premium-login-footer\{/);
  assert.match(adminCss,/\.owner-login-security-note\{/);
  assert.match(adminCss,/#login-status\[data-state="error"\]/);
  assert.match(loginJs,/setAttribute\?\.\('data-state','error'\)/);
  assert.match(visualHtml,/class="public-admin-footer"/);
  assert.match(visualHtml,/Formularz wysyła dane bezpośrednio szyfrowanym połączeniem/);
  assert.match(visualHtml,/id="admin-login-validation"/);
  assert.match(loginJs,/fetch\('\/owner\/newsletter\/login'/);
  assert.match(loginJs,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
});


test("login page places the original two-panel Centrum header above existing OWNER credentials",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const css=await read("../admin-r1/ui/admin.css");
  const hub=await read("../admin-r1/ui/systemadmin.html");
  const first=router.indexOf('<h1>Panel Admin <span>gracz.pl</span></h1>');
  const intro=router.indexOf('class="owner-login-center-intro"');
  const heading=router.indexOf('id="owner-login-center-title">Centrum administracyjne</h2>');
  const fields=router.indexOf('<form id="login-form" autocomplete="off">');
  assert.ok(first>=0&&intro>first&&heading>intro&&fields>heading);
  assert.match(router,/GRACZ\.PL · FULL MAX PREMIUM/);
  assert.match(router,/Wybierz system, którym chcesz zarządzać\. Oba panele są dostępne w ramach jednej sesji właściciela\./);
  assert.match(router,/aria-labelledby="owner-login-center-title"/);
  assert.match(css,/\.owner-login-page \.owner-login-center-intro\{/);
  assert.match(css,/\.owner-login-page \.owner-login-center-intro h2\{/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/@media\(max-height:740px\) and \(min-width:521px\)/);
  assert.match(hub,/id="systemadmin-heading">Centrum administracyjne/);
  assert.equal((hub.match(/class="systemadmin-tile" href=/g)||[]).length,2);
  assert.doesNotMatch(router.slice(intro,fields),/class="systemadmin-tile"/);
  assert.match(router,/id="username"/);
  assert.match(router,/id="password"/);
  assert.match(router,/id="login-button"/);
  assert.match(router,/class="owner-premium-login-footer"/);
});

test("OWNER login uses the approved Full Max Premium design with no side gold lines or new authentication code",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const css=await read("../admin-r1/ui/admin.css");
  const login=await read("../admin-r1/ui/login.js");
  assert.match(router,/<body class="owner-login-page"><main class="owner-login"><h1>Panel Admin <span>gracz.pl<\/span><\/h1>/);
  const loginOnly=router.slice(router.indexOf('const loginHtml='),router.indexOf('export function createOwnerRouter'));
  assert.doesNotMatch(loginOnly,/owner-login-brand|owner-login-eyebrow/,
    'No duplicate logo or tagline above Panel Admin heading');
  assert.match(loginOnly,/class="owner-login-center-overline">GRACZ.PL · FULL MAX PREMIUM/);
  assert.match(router,/<h1>Panel Admin <span>gracz\.pl<\/span><\/h1>/);
  assert.match(router,/Bezpieczne logowanie do Centrum administracyjnego gracz\.pl\./);
  assert.match(css,/\.owner-login-page \.owner-login h1 span\{color:#ff536c;\}/);
  assert.match(router,/\.replace\('<h1>Panel Admin <span>gracz\.pl<\/span><\/h1>',/);
  assert.doesNotMatch(router,/<h1>Logowanie <span>właściciela<\/span><\/h1>/);
  assert.match(router,/gracz<span>\.pl<\/span>/);
  assert.match(router,/class="owner-login-card"/);
  assert.match(router,/class="owner-login-diamond"/);
  assert.match(router,/id="username"/);
  assert.match(router,/id="password"/);
  assert.match(router,/id="forgot-open"/);
  assert.match(router,/id="login-form"/);
  assert.match(router,/id="forgot-dialog"/);
  assert.match(css,/body\.owner-login-page\{/);
  assert.match(css,/\.owner-login-page \.owner-login #login-form #login-button\{/);
  assert.match(css,/\.owner-login-page \.owner-login #login-form #forgot-open\{/);
  assert.match(css,/\.owner-login-page \.owner-login-brand \.logo span\{color:#ff536c;\}/);
  assert.doesNotMatch(css.slice(css.indexOf("Full Max Premium OWNER login: approved")),
    /side-line|side-ornament|background-image:\s*url|linear-gradient\([^\n]*golden-line/);
  assert.match(login,/fetch\('\/owner\/newsletter\/login'/);
  assert.match(login,/credentials:'same-origin'/);
  assert.doesNotMatch(login,/location\.replace\('\/owner\/newsletter\/'\)/);
  assert.match(login,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
});

test("public gracz.pl/systemadmin entry has private noindex and only a backend login handoff",async()=>{
  const html=await read("../../maintenance-site/systemadmin/index.html");
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html,/<meta name="referrer" content="strict-origin">/);
  assert.match(html,/<meta http-equiv="refresh" content="0; url=https:\/\/gracz-contact-api\.onrender\.com\/owner\/newsletter\/login\/visual">/);
  assert.match(html,/action="https:\/\/gracz-contact-api\.onrender\.com\/owner\/newsletter\/login\/public-form"/);
  assert.match(html,/<form class="admin-login-form" method="post"/);
  assert.match(html,/id="login-failed" class="admin-login-feedback" role="alert"/);
  assert.match(css,/\.admin-login-feedback:target\{display:block\}/);
  assert.match(html,/name="username" autocomplete="username"/);
  assert.match(html,/name="password" autocomplete="current-password"/);
  assert.match(html,/type="submit">Zaloguj się/);
  assert.match(html,/Zapomniałem hasła<\/a>/);
  assert.match(html,/login\/systemadmin#forgot/);
  assert.match(html,/href="\/systemadmin\/systemadmin\.css"/);
  assert.match(html,/Logowanie administratora/);
  assert.match(html,/<script src="\/systemadmin\/systemadmin-login\.js" defer><\/script>/);
  assert.equal((html.match(/<script\b/gi)||[]).length,1);
  assert.match(html,/id="admin-login-validation" class="admin-login-validation" role="alert" aria-live="polite" hidden/);
  assert.match(css,/\.access-button/);
  assert.match(css,/\.admin-login-field input:focus-visible/);
  assert.match(css,/\.admin-login-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Full Max Premium form permits only trusted backend and keeps other pages locked",async()=>{
  const page=await read("../../maintenance-site/systemadmin/index.html");
  const headers=await read("../../maintenance-site/render.yaml");
  const gate=await read("../../scripts/check-security-headers.mjs");
  const router=await read("../admin-r1/owner-router.mjs");
  const client=await read("../admin-r1/ui/login.js");
  assert.match(page,/form-action 'self' https:\/\/gracz-contact-api\.onrender\.com/);
  assert.match(headers,/form-action 'self' https:\/\/gracz-contact-api\.onrender\.com/);
  assert.match(gate,/rel === 'maintenance-site\/systemadmin\/index.html'/);
  // Chrome also checks the return redirect of the cross-origin HTML POST.
  // Only gracz.pl itself and the fixed OWNER backend may appear in form-action.
  assert.match(router,/Location:'https:\/\/gracz\.pl\/systemadmin\/#login-failed'/);
  assert.doesNotMatch(page,/form-action \*/);
  assert.doesNotMatch(headers,/form-action \*/);
  assert.match(router,/PUBLIC_OWNER_FORM_ORIGIN='https:\/\/gracz.pl'/);
  assert.match(router,/req.headers.origin!==PUBLIC_OWNER_FORM_ORIGIN/);
  assert.match(router,/publicOwnerFormInput\(req\)/);
  assert.match(router,/Set-Cookie':newCookie\(outcome.token\)/);
  assert.match(router,/if\(!passwordOnly \|\|/);
  assert.match(client,/location.hash==='#forgot'/);
});

test("Premium System Admin authenticates only on the OWNER origin without a second credential store",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const js=await read("../admin-r1/ui/visual-login.js");
  const page=await read("../../maintenance-site/systemadmin/index.html");
  assert.match(router,/path===PREFIX\+'\/login\/visual'/);
  assert.match(router,/path===PREFIX\+'\/login\/visual\.css'/);
  assert.match(router,/path===PREFIX\+'\/login\/visual\.js'/);
  assert.match(router,/readFile\(new URL\('\.\.\/\.\.\/maintenance-site\/systemadmin\/index\.html'/);
  assert.match(router,/\.replace\(\/<meta http-equiv="refresh"/);
  assert.match(router,/\.replace\(\/<meta http-equiv="Content-Security-Policy"/);
  assert.match(router,/action="#"/);
  assert.match(js,/event\.preventDefault\(\)/);
  assert.match(js,/fetch\('\/owner\/newsletter\/login'/);
  assert.match(js,/credentials:'same-origin'/);
  assert.match(js,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|console\./);
  assert.match(page,/login\/visual/);
});

test("Panel Admin reuses OWNER login and returns to the existing two-tile choice after login",async()=>{
  const panel=await read("../../maintenance-site/paneladmin/index.html");
  const router=await read("../admin-r1/owner-router.mjs");
  const js=await read("../admin-r1/ui/visual-login.js");
  assert.match(panel,/http-equiv="refresh" content="0; url=https:\/\/gracz-contact-api\.onrender\.com\/owner\/newsletter\/login\/visual\/paneladmin"/);
  assert.match(panel,/rel="noreferrer noopener"/);
  assert.match(panel,/form-action 'none'/);
  assert.match(panel,/noindex,nofollow,noarchive/);
  assert.match(router,/path===PREFIX\+'\/login\/visual\/paneladmin'/);
  assert.match(router,/data-after-login="systemadmin"/);
  assert.match(router,/<h1>Panel Admin <span>gracz\.pl<\/span><\/h1>/);
  assert.doesNotMatch(js,/form\.dataset\.afterLogin==='newsletter'/);
  assert.match(js,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
  const tiles=await read("../admin-r1/ui/systemadmin.html");
  assert.equal((tiles.match(/class="systemadmin-tile" href=/g)||[]).length,2);
  assert.match(tiles,/href="\/owner\/newsletter\/seo"/);
  assert.match(tiles,/href="\/owner\/newsletter\/"/);
  assert.doesNotMatch(js,/location\.replace\('\/owner\/newsletter\/'\)/);
  assert.match(js,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
  assert.match(js,/credentials:'same-origin'/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|console\./);
});

test("Panel Admin login success opens two-tile hub rather than the newsletter dashboard",async()=>{
  const script=await read("../admin-r1/ui/visual-login.js");
  const registered=new Map();
  const username={value:"syntheticowner"};
  const password={value:"synthetic-test-password"};
  const button={disabled:false};
  const form={
    dataset:{afterLogin:"systemadmin"},
    elements:{username},
    querySelector:()=>button,
    reportValidity:()=>true,
    addEventListener:(type,handler)=>registered.set(type,handler)
  };
  const feedback={textContent:"",hidden:true};
  const destinations=[];
  let authRequest;
  const document={
    querySelector:selector=>selector===".admin-login-form"?form:null,
    getElementById:id=>id==="admin-login-validation"?feedback:
      id==="admin-password"?password:null
  };
  runInNewContext(script,{
    document,
    fetch:async(url,options)=>{authRequest={url,options};return {ok:true,status:200};},
    location:{replace:destination=>destinations.push(destination)},
    AbortController, setTimeout, clearTimeout
  });
  await registered.get("submit")({preventDefault(){}});
  assert.equal(authRequest.url,"/owner/newsletter/login");
  assert.equal(authRequest.options.credentials,"same-origin");
  assert.deepEqual(destinations,["/owner/newsletter/systemadmin"]);
  assert.equal(button.disabled,false);
  assert.equal(password.value,"");
});

test("all OWNER login entries lead to the same protected two-tile selection page",async()=>{
  const script=await read("../admin-r1/ui/login.js");
  const tiles=await read("../admin-r1/ui/systemadmin.html");
  assert.equal((tiles.match(/class="systemadmin-tile" href=/g)||[]).length,2);
  assert.match(tiles,/href="\/owner\/newsletter\/seo"/);
  assert.match(tiles,/href="\/owner\/newsletter\/"/);
  for(const afterLogin of [undefined,"/owner/newsletter/","/owner/newsletter/systemadmin"]){
    for(const ok of [true,false]){
      const listeners=new Map();
      const username={value:"testowner",validity:{valid:true}};
      const password={value:"synthetic-placeholder-password",validity:{valid:true}};
      const submit={disabled:false};
      const form={dataset:{afterLogin},addEventListener:(event,handler)=>listeners.set(event,handler)};
      const status={textContent:""};
      const locations=[];
      const fields={
        "login-form":form,"login-status":status,
        username,password,"login-button":submit
      };
      let request;
      runInNewContext(script,{
        document:{
          querySelectorAll:()=>[],
          getElementById:id=>fields[id]||null
        },
        fetch:async(url,options)=>{request={url,options};return {ok};},
        location:{replace:url=>locations.push(url)}
      });
      assert.equal(typeof listeners.get("submit"),"function");
      await listeners.get("submit")({preventDefault(){}});
      assert.equal(request.url,"/owner/newsletter/login");
      assert.equal(request.options.method,"POST");
      assert.equal(request.options.credentials,"same-origin");
      assert.deepEqual(locations,ok?["/owner/newsletter/systemadmin"]:[]);
      assert.equal(password.value,"");
      assert.equal(submit.disabled,false);
      if(!ok)assert.match(status.textContent,/Logowanie nie powiodło się/);
    }
  }
});

test("OWNER premium login matches the approved wide reference without changing auth or mobile flow",async()=>{
  const css=await read("../admin-r1/ui/admin.css");
  const router=await read("../admin-r1/owner-router.mjs");
  const script=await read("../admin-r1/ui/login.js");
  assert.match(css,/width:min\(100%,900px\)/);
  assert.match(css,/max-width:815px/);
  assert.match(css,/max-width:836px/);
  assert.match(css,/@media \(min-width:651px\) and \(max-height:900px\)/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.doesNotMatch(css.slice(css.indexOf("OWNER login: preserve the approved reference")),
    /overflow:hidden|height:100dvh/);
  assert.match(router,/id="login-button" type="submit">Zaloguj się/);
  assert.match(router,/id="forgot-open" type="button">Zapomniałem hasła\?/);
  assert.match(router,/id="username" type="text"/);
  assert.match(router,/id="password" type="password"/);
  assert.match(script,/fetch\('\/owner\/newsletter\/login'/);
});

test("Full Max Premium complete login fits laptop view without clipping smaller screens",async()=>{
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  assert.match(css,/\.public-admin-shell\{min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:auto minmax\(0,1fr\) auto\}/);
  assert.match(css,/\.public-admin-main\{margin:auto;padding:10px 0;/);
  assert.match(css,/\.public-admin-main \.admin-login-field input\{min-height:44px;/);
  assert.match(css,/@media\(max-height:670px\) and \(min-width:541px\)/);
  assert.doesNotMatch(css,/overflow:hidden/);
});

test("System Admin removes decorative spade and fits desktop viewport while mobile can scroll",async()=>{
  const entry=await read("../../maintenance-site/systemadmin/index.html");
  const entryCss=await read("../../maintenance-site/systemadmin/systemadmin.css");
  const dashboard=await read("../admin-r1/ui/systemadmin.html");
  const css=await read("../admin-r1/ui/systemadmin.css");
  assert.doesNotMatch(entry,/♠|class="signet"/);
  assert.doesNotMatch(dashboard,/♠|class="systemadmin-symbol"/);
  assert.doesNotMatch(css,/\.systemadmin-symbol\{/);
  assert.doesNotMatch(entryCss,/\.signet\{/);
  assert.match(css,/\.systemadmin-center\{[^}]*min-height:0/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.systemadmin-tiles\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Full Max Premium hub fits laptop with two full cards and footer, without clipping smaller screens",async()=>{
  const html=await read("../admin-r1/ui/systemadmin.html");
  const css=await read("../admin-r1/ui/systemadmin.css");
  const router=await read("../admin-r1/owner-router.mjs");
  assert.match(router,/current==='hub'\?' owner-admin-hub-layout':''/);
  assert.equal((html.match(/class="systemadmin-tile" href=/g)||[]).length,2);
  assert.match(html,/Przejdź do panelu SEO/);
  assert.match(html,/Przejdź do Newslettera/);
  assert.match(html,/class="systemadmin-secure-note"/);
  assert.match(css,/@media \(min-width:761px\) and \(max-height:900px\)/);
  for(const selector of [
    '.owner-admin-hub-layout .owner-premium-identity',
    '.owner-admin-hub-layout .systemadmin-center',
    '.owner-admin-hub-layout .systemadmin-tiles',
    '.owner-admin-hub-layout .systemadmin-tile',
    '.owner-admin-hub-layout .systemadmin-tile-action',
    '.owner-admin-hub-layout .systemadmin-secure-note',
    '.owner-admin-hub-layout .owner-premium-footer'
  ]){
    assert.ok(css.includes(selector+'{'),"Missing compact laptop rule "+selector);
  }
  const compact=css.slice(css.indexOf('/* Premium two-tile hub: keep BOTH'));
  assert.match(compact,/\.owner-admin-hub-layout \.systemadmin-tile\{[\s\S]*?min-height:260px/);
  assert.match(compact,/\.owner-admin-hub-layout \.systemadmin-tile-action\{[\s\S]*?min-height:43px/);
  assert.doesNotMatch(compact,/overflow\s*:\s*hidden|display\s*:\s*none|position\s*:\s*fixed/,
    "Never hide content or pin the footer over cards");
  assert.match(css,/@media\(max-width:760px\)/,
    "Mobile must keep its normal single-column scrollable layout");
});

test("both Premium gold tile actions hug their labels without stretching or losing bottom alignment",async()=>{
  const html=await read("../admin-r1/ui/systemadmin.html");
  const css=await read("../admin-r1/ui/systemadmin.css");
  const actions=html.match(/class="systemadmin-tile-action"/g)||[];
  assert.equal(actions.length,2);
  assert.match(html,/Przejdź do panelu SEO/);
  assert.match(html,/Przejdź do Newslettera/);
  const rule=css.match(/\.systemadmin-tile-action\{([^}]+)\}/)?.[1];
  assert.ok(rule,"Gold tile action style must exist");
  assert.match(rule,/margin-top:auto/,"Place both actions at the card bottom");
  assert.match(rule,/align-self:flex-start/,"Do not stretch to full card width");
  assert.match(rule,/width:fit-content/);
  assert.match(rule,/max-width:100%/,"Avoid mobile overflow");
  assert.match(rule,/justify-content:flex-start/,"Keep arrow next to the label");
  assert.doesNotMatch(rule,/(?:^|;)width:100%(?:;|$)|justify-content:space-between/);
  assert.match(rule,/background:linear-gradient\(120deg,#f2d38f,#d5a84f\)/,
    "Preserve original Full Max Premium gold styling");
  assert.match(css,/\.owner-admin-hub-layout \.systemadmin-tile-action\{[\s\S]*?min-height:43px/);
});

test("SEO Premium Podstrony starts folded and toggles full LIVE list with POKAŻ / ZWIŃ",async()=>{
  const html=await read("../admin-r1/ui/seo.html");
  const script=await read("../admin-r1/ui/seo.js");
  const css=await read("../admin-r1/ui/seo.css");
  assert.match(html,/id="seo-pages-toggle" aria-controls="seo-pages-list" aria-expanded="false">POKAŻ<\/button>/);
  assert.match(html,/<div id="seo-pages-list" hidden>/);
  assert.match(html,/<tbody id="seo-rows"><\/tbody>/);
  assert.match(html,/id="seo-inspect-url"/,"Indexation selector remains available independently");
  assert.match(css,/#seo-pages \.seo-pages-heading\{/);
  assert.match(css,/#seo-pages #seo-pages-list\[hidden\]\{display:none\}/);
  assert.match(css,/#seo-pages #seo-pages-toggle:focus-visible/);
  assert.match(script,/\$\("seo-rows"\)\.replaceChildren\(rows\)/,
    "The LIVE response must keep rendering all pages even while folded");
  const toggleCode=script.slice(script.indexOf('const pagesToggle='),script.indexOf('const terms='));
  assert.ok(toggleCode.includes('addEventListener("click"'),"Button must have a click handler");
  const list={hidden:true};
  let click;
  const attrs={};
  const button={
    textContent:"POKAŻ",
    addEventListener:(name,callback)=>{if(name==="click")click=callback;},
    setAttribute:(name,value)=>{attrs[name]=value;}
  };
  runInNewContext('const $=id=>document.getElementById(id);'+toggleCode,{
    document:{getElementById:id=>id==="seo-pages-toggle"?button:
      id==="seo-pages-list"?list:null}
  });
  assert.equal(typeof click,"function");
  assert.equal(list.hidden,true);
  click();
  assert.equal(list.hidden,false);
  assert.equal(button.textContent,"ZWIŃ");
  assert.equal(attrs["aria-expanded"],"true");
  click();
  assert.equal(list.hidden,true);
  assert.equal(button.textContent,"POKAŻ");
  assert.equal(attrs["aria-expanded"],"false");
});

test("protected hub contains exactly the two OWNER target panels",async()=>{
  const html=await read("../admin-r1/ui/systemadmin.html");
  assert.match(html,/SEO Control Center/);
  assert.match(html,/Panel administracyjny Newslettera/);
  assert.match(html,/href="\/owner\/newsletter\/seo"/);
  assert.match(html,/href="\/owner\/newsletter\/"/);
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.doesNotMatch(html,/<form|<input|data-demo/i);
});

test("login redirect is allowlisted to the server-owned hub path, not user input",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const login=await read("../admin-r1/ui/login.js");
  const session=router.indexOf("const session=await auth.session(cookie,kind)");
  const hub=router.indexOf("path===OWNER_HUB)",session);
  assert.ok(session>0&&hub>session,"hub HTML is authenticated");
  assert.match(router,/data-after-login/);
  assert.match(router,/System Admin — logowanie/);
  assert.match(router,/replaceAll\('Prywatny panel admina newslettera serwisu gracz.pl'/);
  assert.match(router,/path===OWNER_HUB\?OWNER_HUB_LOGIN:PREFIX\+'\/login'/);
  assert.match(login,/location\.replace\('\/owner\/newsletter\/systemadmin'\)/);
  assert.doesNotMatch(login,/location\.replace\('\/owner\/newsletter\/'\)/);
  assert.match(router,/if\(url\.search&&!speedRefresh\)return denyAdmin\(req,res\)/);
  assert.match(router,/url\.pathname===PREFIX\+'\/seo\/speed'&&url\.search==='\?refresh=1'/);
  assert.doesNotMatch(router,/url\.searchParams\.get\(['"]redirect['"]\)/);
  assert.match(router,/X-Robots-Tag|privateHeaders/);
});

test("shared Full Max Premium toolbar contains one far-right logout on all three private pages",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const css=await read("../admin-r1/ui/systemadmin.css");
  const dashboard=await read("../admin-r1/ui/owner-dashboard.js");
  assert.match(router,/id="systemadmin-logout" class="systemadmin-logout">Wyloguj<\/button>/);
  assert.match(router,/id="systemadmin-logout-status"[^>]+role="status"/);
  assert.match(router,/systemadmin-logout\.js" defer/);
  assert.match(router,/path===PREFIX\+'\/systemadmin-logout\.js'/);
  assert.match(router,/withAdminSwitchBar\(html,'newsletter'\)/);
  assert.match(router,/withAdminSwitchBar\([\s\S]*?'seo'\)/);
  assert.match(router,/withAdminSwitchBar\([\s\S]*?'hub'\)/);
  assert.doesNotMatch(router,/replace\('<\/header>','<button type="button" id="logout"/);
  assert.doesNotMatch(dashboard,/\$\("logout"\)\.addEventListener/);
  assert.match(css,/\.systemadmin-topnav>\.systemadmin-logout\{/);
  assert.match(css,/margin:0 0 0 10px/);
  assert.match(css,/\.systemadmin-topnav>\.systemadmin-logout:focus-visible/);
  assert.match(css,/\.systemadmin-topnav>\.systemadmin-logout-status:empty\{display:none\}/);
});

test("shared logout requires live CSRF and redirects only after confirmed success",async()=>{
  const script=await read("../admin-r1/ui/systemadmin-logout.js");
  assert.doesNotMatch(script,/localStorage|sessionStorage|document\.cookie/);
  for(const scenario of ["success","session401","session503","logout403"]){
    let handler;
    const calls=[],destinations=[];
    const button={
      disabled:false,
      addEventListener:(name,cb)=>{if(name==="click")handler=cb;}
    };
    const message={textContent:""};
    runInNewContext(script,{
      document:{getElementById:id=>id==="systemadmin-logout"?button:
        id==="systemadmin-logout-status"?message:null},
      location:{replace:url=>destinations.push(url)},
      fetch:async(url,options)=>{
        calls.push({url,options});
        if(url==="/owner/newsletter/session"){
          if(scenario==="session401")return {ok:false,status:401};
          if(scenario==="session503")return {ok:false,status:503};
          return {ok:true,status:200,json:async()=>({ok:true,csrf:"synthetic-csrf-token"})};
        }
        if(url==="/owner/newsletter/logout"){
          return {ok:scenario!=="logout403",status:scenario==="logout403"?403:200};
        }
        throw Error("Unexpected endpoint");
      }
    });
    assert.equal(typeof handler,"function");
    await handler();
    assert.equal(button.disabled,false);
    assert.equal(calls[0].url,"/owner/newsletter/session");
    assert.equal(calls[0].options.credentials,"same-origin");
    assert.equal(calls[0].options.cache,"no-store");
    if(scenario==="success" || scenario==="logout403"){
      assert.equal(calls.length,2);
      assert.equal(calls[1].url,"/owner/newsletter/logout");
      assert.equal(calls[1].options.method,"POST");
      assert.equal(calls[1].options.headers["X-Owner-CSRF"],"synthetic-csrf-token");
      assert.equal(calls[1].options.credentials,"same-origin");
    }else{
      assert.equal(calls.length,1,"No unauthenticated logout POST");
    }
    assert.deepEqual(destinations,
      scenario==="success"?["/owner/newsletter/logged-out"]:
        scenario==="session401"?["/owner/newsletter/login"]:[]);
    if(scenario==="logout403" || scenario==="session503")
      assert.match(message.textContent,/Nie udało się wylogować/);
  }
});

test("switch navigation routes to hub, SEO, and newsletter without a second login",async()=>{
  const router=await read("../admin-r1/owner-router.mjs");
  const css=await read("../admin-r1/ui/systemadmin.css");
  assert.match(router,/Przełączanie paneli administracyjnych/);
  assert.match(router,/withAdminSwitchBar\(html,'newsletter'\)/);
  assert.match(router,/withAdminSwitchBar\([\s\S]*?'seo'\)/);
  assert.match(css,/\.systemadmin-topnav/);
});

test("blocked native form validation shows a visible message without handling credentials",async()=>{
  const script=await read("../../maintenance-site/systemadmin/systemadmin-login.js");
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  const listeners=new Map();
  const password={name:"password",validity:{valueMissing:false}};
  const feedback={textContent:"",hidden:true};
  const form={
    addEventListener:(type,fn)=>listeners.set(type,fn),
    querySelector:()=>password
  };
  runInNewContext(script,{document:{
    querySelector:()=>form,
    getElementById:id=>id==='admin-login-validation'?feedback:null
  }});
  listeners.get("invalid")({target:password});
  assert.equal(feedback.hidden,false);
  assert.match(feedback.textContent,/co najmniej 9 znaków/);
  listeners.get("input")();
  assert.equal(feedback.hidden,true);
  listeners.get("submit")();
  assert.equal(feedback.hidden,false);
  assert.match(feedback.textContent,/Sprawdzanie danych logowania/);
  assert.match(css,/\.admin-login-validation\[hidden\]\{display:none\}/);
  assert.doesNotMatch(script,/preventDefault|\.disabled\s*=|fetch\(|localStorage|sessionStorage|console\./);
});

test("System Admin toggles password reveal and conceal without submitting or copying it",async()=>{
  const html=await read("../../maintenance-site/systemadmin/index.html");
  const css=await read("../../maintenance-site/systemadmin/systemadmin.css");
  const script=await read("../../maintenance-site/systemadmin/systemadmin-login.js");
  assert.match(html,/class="password-with-toggle"/);
  assert.match(html,/<button type="button" class="password-visibility-toggle" id="toggle-admin-password"/);
  assert.match(html,/aria-controls="admin-password" aria-pressed="false">Pokaż<\/button>/);
  assert.match(css,/\.password-visibility-toggle:focus-visible/);
  assert.match(css,/\.password-with-toggle\{position:relative/);
  assert.match(css,/\.password-with-toggle input\{padding-right:100px/);
  const field={type:"password"};
  let click;
  const toggle={
    textContent:"Pokaż",attributes:{},
    addEventListener:(event,handler)=>{if(event==="click")click=handler;},
    setAttribute:(key,val)=>{toggle.attributes[key]=val;}
  };
  runInNewContext(script,{document:{
    querySelector:()=>null,
    getElementById:id=>id==="admin-password"?field:
      id==="toggle-admin-password"?toggle:null
  }});
  assert.equal(typeof click,"function");
  click();
  assert.equal(field.type,"text");
  assert.equal(toggle.textContent,"Ukryj");
  assert.equal(toggle.attributes["aria-pressed"],"true");
  click();
  assert.equal(field.type,"password");
  assert.equal(toggle.textContent,"Pokaż");
  assert.equal(toggle.attributes["aria-pressed"],"false");
  assert.doesNotMatch(script,/passwordInput\.value|preventDefault|fetch\(|localStorage|sessionStorage/);
});


test("SEO sitemap selector displays Full Max Premium validation instead of a native popup",async()=>{
  const [html,script,css]=await Promise.all([
    read("../admin-r1/ui/seo.html"),read("../admin-r1/ui/seo.js"),
    read("../admin-r1/ui/seo.css")
  ]);
  assert.match(html,/<select id="seo-inspect-url" required>/);
  assert.match(html,/id="seo-inspect-validation" class="seo-select-validation" role="alert" hidden/);
  assert.match(html,/id="seo-inspect-validation-message">Wybierz podstronę z listy/);
  assert.match(css,/#seo-inspect \.seo-select-validation\[hidden\]\{display:none\}/);
  assert.match(css,/#seo-inspect #seo-inspect-url\[aria-invalid="true"\]/);
  const start=script.indexOf('const inspectChoice=$("seo-inspect-url");');
  const stop=script.indexOf("async function inspectGoogle(event)",start);
  assert.ok(start>=0&&stop>start);
  const handlers=new Map();
  const attributes=new Map();
  const choice={
    validity:{valid:false},
    addEventListener:(name,callback)=>handlers.set(name,callback),
    setAttribute:(key,value)=>attributes.set(key,value),
    removeAttribute:key=>attributes.delete(key)
  };
  const notice={hidden:true};
  runInNewContext('const $=id=>document.getElementById(id);\n'+script.slice(start,stop),{
    document:{getElementById:id=>id==="seo-inspect-url"?choice:
      id==="seo-inspect-validation"?notice:null}
  });
  let cancelled=false;
  handlers.get("invalid")({preventDefault(){cancelled=true;}});
  assert.equal(cancelled,true);
  assert.equal(notice.hidden,false);
  assert.equal(attributes.get("aria-invalid"),"true");
  assert.equal(attributes.get("aria-describedby"),"seo-inspect-validation-message");
  choice.validity.valid=true;
  handlers.get("change")();
  assert.equal(notice.hidden,true);
  assert.equal(attributes.has("aria-invalid"),false);
  assert.equal(attributes.has("aria-describedby"),false);
});

test("SEO public pages URLs open safe gracz.pl destinations from the left column",async()=>{
  const [html,script,css]=await Promise.all([
    read("../admin-r1/ui/seo.html"),read("../admin-r1/ui/seo.js"),
    read("../admin-r1/ui/seo.css")
  ]);
  assert.match(html,/<tbody id="seo-rows"><\/tbody>/);
  assert.match(script,/pageCell\(tr,item\.url\)/);
  assert.match(css,/#seo-pages \.seo-page-link:hover/);
  assert.match(css,/#seo-pages \.seo-page-link:focus-visible/);
  const start=script.indexOf("function pageCell(row,value)");
  const stop=script.indexOf("async function load()",start);
  assert.ok(start>=0&&stop>start);
  const make=tagName=>({
    tagName,children:[],append(child){this.children.push(child);}
  });
  const pageCell=runInNewContext(script.slice(start,stop)+"\npageCell",{
    document:{createElement:make},URL
  });
  const render=value=>{
    const row=make("tr");
    pageCell(row,value);
    return row.children[0];
  };
  const good=render("https://gracz.pl/warcaby/");
  const anchor=good.children[0];
  assert.equal(anchor.tagName,"a");
  assert.equal(anchor.href,"https://gracz.pl/warcaby/");
  assert.equal(anchor.target,"_blank");
  assert.equal(anchor.rel,"noopener noreferrer");
  assert.equal(anchor.textContent,"https://gracz.pl/warcaby/");
  for(const value of ["javascript:alert(1)","https://gracz.pl.evil.test/",
    "https://evil.test/","https://gracz.pl/?q=x",
    "https://gracz.pl/#private","https://gracz.pl@evil.test/"]){
    const cell=render(value);
    assert.equal(cell.children.length,0,"Unsafe URLs must be plain text");
    assert.equal(cell.textContent,value);
  }
});
