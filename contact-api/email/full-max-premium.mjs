// Shared, presentation-only HTML for gracz.pl mail. Never embeds remote assets or tracking.
export function escapeEmailHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// Split visible brand text into separately styled inline spans so Gmail does not
// auto-link "gracz.pl" in a heading and turn it blue. URLs and email addresses
// must remain intact. All other user-controlled text is still escaped.
const BRAND_HTML='<span style="color:#ffffff !important;text-decoration:none">gracz</span>'+
  '<span style="color:#ef5261 !important;text-decoration:none">.pl</span>';
function brandText(value) {
  const input=String(value);
  const pattern=/(?<![a-z0-9@/.-])gracz\.pl(?![a-z0-9.-])/gi;
  let out='',last=0;
  for(const match of input.matchAll(pattern)){
    out+=escapeEmailHtml(input.slice(last,match.index));
    out+=BRAND_HTML;
    last=match.index+match[0].length;
  }
  return out+escapeEmailHtml(input.slice(last));
}
function safeLink(value) {
  if(typeof value!=='string') throw new TypeError('Valid email action URL required');
  const u=new URL(value);
  if(u.protocol!=='https:'||u.hostname!=='gracz.pl'||u.port||u.username||u.password)
    throw new TypeError('Only gracz.pl HTTPS email links are permitted');
  return escapeEmailHtml(u.href);
}
function copy(value) {
  return brandText(value).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
}
// Render only a constrained Markdown subset. Every content span and href is
// escaped, raw HTML is inert, and links require credential-free HTTPS.
function emailMarkdownInline(value){
  const source=String(value), pattern=/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\+\+([^+\n]+)\+\+|~~([^~\n]+)~~|\x60([^\x60\n]+)\x60|\*([^*\n]+)\*/g;
  let out='',offset=0,match;
  while((match=pattern.exec(source))!==null){
    out+=brandText(source.slice(offset,match.index));
    const wrapper=match[3]!==undefined?'strong':match[4]!==undefined?'u':
      match[5]!==undefined?'s':match[6]!==undefined?'code':match[7]!==undefined?'em':null;
    if(wrapper)out+='<'+wrapper+'>'+brandText(match[3]??match[4]??match[5]??match[6]??match[7])+'</'+wrapper+'>';
    else if(match[1]!==undefined){
      let url=null;
      try {
        const candidate=new URL(match[2]);
        if(candidate.protocol==='https:'&&!candidate.username&&!candidate.password&&
           candidate.hostname&&candidate.href.length<=2048)url=candidate.href;
      }catch{}
      out+=url?'<a href="'+escapeEmailHtml(url)+'" style="color:#8be6df;text-decoration:underline">'+brandText(match[1])+'</a>':brandText(match[0]);
    }else out+=escapeEmailHtml(match[0]);
    offset=pattern.lastIndex;
  }
  return out+brandText(source.slice(offset));
}
function emailMarkdownBody(value){
  let output='',list='';
  for(const line of String(value).replace(/\r\n?/g,'\n').split('\n')){
    const ul=line.match(/^\s*[-*]\s+(.+)$/u),ol=line.match(/^\s*\d+[.)]\s+(.+)$/u);
    const kind=ul?'ul':ol?'ol':'';
    if(list&&kind!==list){output+='</'+list+'>';list='';}
    if(kind){
      if(!list){list=kind;output+='<'+list+' style="padding-left:21px;margin:9px 0">';}
      output+='<li>'+emailMarkdownInline((ul||ol)[1])+'</li>';continue;
    }
    if(!line.trim()){output+='<div style="height:11px"></div>';continue;}
    const h=line.match(/^(#{1,3})\s+(.+)$/u);
    const text=h?h[2]:line.startsWith('> ')?line.slice(2):line;
    const style=h?'font-weight:800;color:#fff;font-size:'+(h[1].length===1?'22':h[1].length===2?'19':'17')+'px;margin:13px 0 7px'
      :line.startsWith('> ')?'border-left:3px solid #53dbc8;padding-left:12px;color:#c6dce0;margin:8px 0'
      :'margin:5px 0';
    const tag=h?'h'+h[1].length:line.startsWith('> ')?'blockquote':'p';
    if(/^\s*---\s*$/u.test(line)){output+='<hr style="border:0;border-top:1px solid #39636c;margin:13px 0">';continue;}
    output+='<'+tag+' style="'+style+'">'+emailMarkdownInline(text)+'</'+tag+'>';
  }
  if(list)output+='</'+list+'>';
  return output;
}
export function renderPremiumEmail({
  category='WIADOMOŚĆ SERWISOWA',title,preheader='',body='',
  actionUrl,actionLabel,code,unsubscribeUrl,footnote='',bodyMarkdown=false
}={}) {
  if(typeof title!=='string'||!title.trim()) throw new TypeError('Email title required');
  if((actionUrl===undefined)!==(actionLabel===undefined))
    throw new TypeError('Action URL and label must be paired');
  const button=actionUrl===undefined?'':`
    <tr><td align="center" style="padding:12px 28px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#19d9c4" style="background:#19d9c4;border-radius:12px">
        <a href="${safeLink(actionUrl)}" style="display:inline-block;background:#19d9c4;border-radius:12px;padding:16px 26px;color:#042026;font-size:16px;font-weight:800;text-decoration:none">${escapeEmailHtml(actionLabel)}</a>
      </td></tr></table>
    </td></tr>`;
  const codePanel=code===undefined?'':`
    <tr><td style="padding:10px 28px 25px;text-align:center">
      <div style="background:#061b22;border:1px solid #285c67;border-radius:12px;padding:18px 12px">
        <div style="font-size:11px;color:#92b5bd;letter-spacing:1px;margin-bottom:12px">KOD JEDNORAZOWY</div>
        <strong style="color:#fff;font-size:25px;letter-spacing:2px;overflow-wrap:anywhere;font-family:Consolas,'Courier New',monospace">${escapeEmailHtml(code)}</strong>
      </div>
    </td></tr>`;
  const unsubscribe=unsubscribeUrl===undefined?'':`<div style="padding-top:10px"><a href="${safeLink(unsubscribeUrl)}" style="color:#8be6df;text-decoration:underline">Wypisz się z newslettera</a></div>`;
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#061218;color:#effbfc;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(preheader||title)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#061218"><tr><td align="center" style="padding:30px 12px">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:620px;background:#10242d;border:1px solid #24505b;border-radius:18px">
<tr><td style="padding:28px;background:#0b1d25;border-bottom:1px solid #24434d;border-radius:18px 18px 0 0">
 <div style="font-size:32px;font-weight:900;letter-spacing:-1px;color:#fff">gracz<span style="color:#ef5261">.pl</span></div>
 <div style="margin-top:8px;font-size:11px;letter-spacing:1.4px;font-weight:700;color:#74dfd3">FULL MAX PREMIUM · ${escapeEmailHtml(category)}</div>
</td></tr>
<tr><td style="padding:30px 28px 15px">
 <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#fff;font-weight:800">${brandText(title)}</h1>
 <div style="font-size:15px;line-height:1.8;color:#c6dce0">${bodyMarkdown===true?emailMarkdownBody(body):copy(body)}</div>
</td></tr>
${codePanel}${button}
<tr><td style="padding:10px 28px 28px"><div style="border-top:1px solid #27505b;padding-top:18px;color:#a0bec4;font-size:13px;line-height:1.7">${copy(footnote)}</div></td></tr>
<tr><td style="padding:22px 28px;background:#0b1d25;border-top:1px solid #24434d;border-radius:0 0 18px 18px">
 <div style="color:#90aeb7;font-size:12px;line-height:1.7">${brandText("Wiadomość z gracz.pl")} · <a href="https://gracz.pl/" style="color:#8be6df;text-decoration:none">Strona główna</a> · <a href="https://gracz.pl/polityka-prywatnosci/" style="color:#8be6df;text-decoration:none">Polityka prywatności</a>${unsubscribe}</div>
 <div style="margin-top:9px;color:#7896a0;font-size:11px">© ${brandText("gracz.pl")} · Wszystkie prawa zastrzeżone</div>
</td></tr></table></td></tr></table></body></html>`;
}
