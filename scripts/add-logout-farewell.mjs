import fs from 'node:fs';

const path = 'modern/checkers-engine/web/lobby.js';
let source = fs.readFileSync(path, 'utf8');
const oldLine = 'document.querySelector("#logout").addEventListener("click", () => { if (lobbyPoll) clearInterval(lobbyPoll); sessionStorage.clear(); location.reload(); });';
if (!source.includes(oldLine)) {
  console.log('Logout handler already changed or not found; nothing to patch.');
  process.exit(0);
}
const replacement = `function showLogoutFarewell(userName) {
  const safeName = String(userName || "Graczu").trim().slice(0, 40) || "Graczu";
  const style = document.createElement("style");
  style.textContent = \`
    .logout-farewell{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(2,7,11,.88);backdrop-filter:blur(9px)}
    .logout-farewell-card{width:min(540px,94vw);padding:34px 32px;text-align:center;border:1px solid #28513d;border-radius:18px;background:linear-gradient(180deg,#101c23,#091116);box-shadow:0 30px 90px #000b,0 0 45px #18db6c16;color:#edf6f1}
    .logout-farewell-logo{margin-bottom:18px;font-size:27px;font-weight:900;letter-spacing:-2px}.logout-farewell-logo span{font-size:14px;color:#ff3440;letter-spacing:-1px}
    .logout-farewell-icon{width:64px;height:64px;margin:0 auto 16px;display:grid;place-items:center;border-radius:50%;background:#0c2b1b;border:1px solid #226b43;color:#36e985;font-size:30px}
    .logout-farewell-card h2{margin:0 0 12px;font-size:28px}.logout-farewell-card h2 strong{color:#38e989}.logout-farewell-card p{margin:8px auto;color:#b9c8c1;line-height:1.65;max-width:430px}.logout-farewell-card .bye{margin-top:18px;color:#f2f8f5;font-size:17px;font-weight:800}.logout-farewell-card button{margin-top:22px;padding:12px 26px;border:0;border-radius:8px;background:linear-gradient(180deg,#22e779,#0db455);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 8px 24px #0db45535}
  \`;
  document.head.append(style);
  const overlay = document.createElement("div");
  overlay.className = "logout-farewell";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const card = document.createElement("section");
  card.className = "logout-farewell-card";
  card.innerHTML = '<div class="logout-farewell-logo">gracz<span>.PL</span></div><div class="logout-farewell-icon">✓</div><h2>Dziękujemy, <strong></strong>!</h2><p>Dziękujemy, że nas odwiedziłeś. Mamy nadzieję, że dobrze się bawiłeś i spędziłeś z nami miło czas.</p><p>Zapraszamy ponownie — czekają na Ciebie kolejne rozgrywki i gracze.</p><div class="bye">Do zobaczenia, <span></span>!</div><button type="button">Wróć do logowania</button>';
  card.querySelector('h2 strong').textContent = safeName;
  card.querySelector('.bye span').textContent = safeName;
  const finish = () => location.reload();
  card.querySelector('button').addEventListener('click', finish);
  overlay.append(card);
  document.body.append(overlay);
  setTimeout(finish, 6500);
}

document.querySelector("#logout").addEventListener("click", () => {
  const userName = session?.user?.displayName || session?.user?.userId || "Graczu";
  if (lobbyPoll) clearInterval(lobbyPoll);
  sessionStorage.clear();
  session = null;
  showLogoutFarewell(userName);
});`;
source = source.replace(oldLine, replacement);
fs.writeFileSync(path, source);
console.log('Logout farewell patched successfully.');
