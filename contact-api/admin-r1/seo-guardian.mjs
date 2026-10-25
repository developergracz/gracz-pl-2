// SEO Guardian R1: read-only classification of existing public SEO and PageSpeed reports.
// No LLM calls, no persistence, no page mutations, no user-supplied URLs.
const ORIGIN="https://gracz.pl";
const MAX_ALERTS=12;
const FAULTS=Object.freeze({
  robots_or_sitemap_unavailable:["critical","Nie udało się odczytać robots.txt lub sitemap.xml"],
  robots_invalid:["critical","Nieprawidłowe reguły robots.txt"],
  sitemap_invalid:["critical","Nieprawidłowa mapa witryny"],
  noindex:["critical","Wykryto blokadę indeksowania"],
  unavailable:["critical","Publiczna podstrona jest niedostępna"],
  canonical:["warning","Nieprawidłowy adres canonical"],
  title:["warning","Brak prawidłowego tytułu strony"],
  description:["warning","Brak opisu strony"],
  h1:["warning","Nieprawidłowy nagłówek H1"]
});
const allowedUrl=value=>{
  try{
    const url=new URL(value);
    return url.origin===ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&
      url.href===value?value:ORIGIN;
  }catch{return ORIGIN;}
};
export function createSeoGuardian({readStatus,readSpeed,now=Date.now}={}){
  if(typeof readStatus!=="function"||typeof readSpeed!=="function")
    throw TypeError("Guardian requires the existing SEO and PageSpeed readers");
  return async function inspect(){
    const [siteResult,speedResult]=await Promise.allSettled([readStatus(),readSpeed("mobile")]);
    const site=siteResult.status==="fulfilled"?siteResult.value:null;
    const speed=speedResult.status==="fulfilled"?speedResult.value:null;
    const technicalReady=site?.scope==="public_live"&&Array.isArray(site.issues)&&
      Number.isInteger(site.total)&&Number.isInteger(site.passing)&&
      site.total>0&&site.passing>=0&&site.passing<=site.total;
    const performanceReady=speed?.state==="available"&&
      Number.isFinite(speed.lcpMs)&&speed.lcpMs>=0&&
      Number.isFinite(speed.score)&&speed.score>=0&&speed.score<=100;
    const alerts=[];
    const add=(severity,code,message,url=ORIGIN)=>alerts.push({
      severity,code,message,url:allowedUrl(url)
    });
    if(!technicalReady)add("unknown","site_unknown","Nie można potwierdzić stanu technicznego witryny");
    else {
      for(const issue of site.issues.slice(0,MAX_ALERTS)){
        const [severity,message]=FAULTS[issue.code]||["warning","Problem techniczny wymagający sprawdzenia"];
        add(severity,issue.code||"unknown_issue",message,issue.url);
      }
      if(site.issues.length>MAX_ALERTS)
        add("warning","more_issues","Pozostałe problemy są widoczne w sekcji Wykryte problemy");
      if(!site.ok&&site.issues.length===0)
        add("unknown","incomplete_status","Kontrola SEO nie potwierdziła poprawności wszystkich stron");
    }
    if(!performanceReady)add("unknown","speed_unknown",
      "Brak aktualnie dostępnego pomiaru Lighthouse LCP; nie oznacza to wolnej strony");
    else{
      if(speed.lcpMs>=2500)add("warning","lcp_high",
        "Laboratoryjny LCP wynosi co najmniej 2,5 s; sprawdź PageSpeed");
      if(speed.score<90)add("warning","lighthouse_low",
        "Lighthouse mobile poniżej 90 punktów; sprawdź PageSpeed");
    }
    // When any component is missing, never declare the whole system healthy.
    const state=alerts.some(a=>a.severity==="critical"||a.severity==="warning")?"attention":
      alerts.length?"unknown":"healthy";
    return {
      state,checkedAt:new Date(now()).toISOString(),scope:"owner_read_only",
      technical:{
        state:technicalReady?(site.ok?"healthy":"attention"):"unknown",
        checkedAt:technicalReady?site.checkedAt:null,
        total:technicalReady?site.total:null,
        passing:technicalReady?site.passing:null,
        issueCount:technicalReady?site.issues.length:null
      },
      performance:{
        state:performanceReady?(speed.lcpMs>=2500||speed.score<90?"attention":"healthy"):"unknown",
        checkedAt:performanceReady?speed.checkedAt:null,
        measuredAt:performanceReady?speed.measuredAt||null:null,
        lcpMs:performanceReady?speed.lcpMs:null,
        score:performanceReady?speed.score:null,
        source:"Lighthouse mobile · laboratoryjny"
      },
      alerts
    };
  };
}
