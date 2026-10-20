// Private one-time Render Shell setup. Never invoke in the server startup.
import {randomBytes} from 'node:crypto';
import {newVerifier,encodeTotp,codeAt} from './owner-auth.mjs';
if(!process.stdin.isTTY||!process.stdout.isTTY||typeof process.stdin.setRawMode!=='function'){
  console.error('Use an interactive private Render Web Shell.');
  process.exit(1);
}
async function hidden(label) {
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value='';
  return new Promise((resolve,reject)=>{
    const finish=()=>{
      process.stdin.off('data',handle);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const handle=data=>{
      for(const byte of data){
        if(byte===3){finish();reject(new Error('Canceled'));return;}
        if(byte===13||byte===10){finish();resolve(value);return;}
        if(byte===127||byte===8){value=value.slice(0,-1);continue;}
        if(byte>=32&&byte<=126&&value.length<256)value+=String.fromCharCode(byte);
      }
    };
    process.stdin.on('data',handle);
  });
}
try {
  process.stdout.write('Konto właściciela gracz.pl — konfiguracja lokalna.\n');
  process.stdout.write('NIE wykonuj zrzutów ekranu i NIE wysyłaj poniższych wartości do czatu.\n');
  const password=await hidden('Podaj nowe hasło (min. 16 znaków; ukryte): ');
  if(password.length<16||password.length>128)throw new Error('Password length must be 16..128.');
  const again=await hidden('Powtórz hasło (ukryte): ');
  if(again!==password)throw new Error('Passwords do not match.');
  const totpBytes=randomBytes(20);
  const secret=encodeTotp(totpBytes);
  process.stdout.write('\nAuthenticator: Dodaj konto → Wpisz klucz konfiguracji ręcznie.\n');
  process.stdout.write('Nazwa konta: gracz.pl Owner\n');
  process.stdout.write('Klucz: '+secret+'\n');
  process.stdout.write('Algorytm SHA1, 6 cyfr, co 30 sekund.\n');
  const entered=await hidden('Wpisz aktualny kod z aplikacji (ukryty): ');
  const step=Math.floor(Date.now()/30000);
  if(!/^[0-9]{6}$/.test(entered)||
     ![-1,0,1].some(d=>codeAt(totpBytes,step+d)===entered))
    throw new Error('Incorrect code. No keys were installed.');
  const verifier=await newVerifier(password);
  process.stdout.write('\nW Render Environment ustaw dokładnie 3 zmienne:\n');
  process.stdout.write('NEWSLETTER_OWNER_PASSWORD_VERIFIER='+verifier+'\n');
  process.stdout.write('NEWSLETTER_OWNER_TOTP_SECRET='+secret+'\n');
  process.stdout.write('NEWSLETTER_OWNER_ADMIN_ENABLED=1\n');
  process.stdout.write('Po zapisaniu nie pokazuj nikomu sekretów. Panel uruchom dopiero po migracji 003.\n');
} catch(error) {
  console.error('Konfiguracja przerwana: '+(error?.message||'nieznany błąd'));
  process.exitCode=1;
} finally {
  if(process.stdin.isTTY)process.stdin.setRawMode(false);
}
