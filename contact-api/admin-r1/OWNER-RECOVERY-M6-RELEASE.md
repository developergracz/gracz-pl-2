# M6 — odzyskiwanie dostępu OWNER przez e-mail

## Granice
Adres: `https://gracz.pl/paneladmina/` → istniejący formularz OWNER.
Istniejące hasło, nick i newsletter nie są zmieniane podczas wdrożenia.
Używamy istniejących Resend (transakcyjne wiadomości) i PostgreSQL; nie tworzymy nowego dostawcy ani kont.
Kod jednorazowy ma 144 bity losowości, 24 znaki base64url i ważność 10 minut.
Żaden adres e-mail ani kod nie trafia do audytu, URL, logów lub publicznej odpowiedzi.
E-mail odzyskiwania pozostaje nieaktywny do potwierdzenia kodem w panelu.

## Aktywacja — tylko niezbędne kroki

1. Wymagane: prywatne połączenie Render Shell do aktualnej produkcyjnej `DATABASE_URL`, odtwarzalny PITR i wdrożony kod po CI PASS. M6 musi pozostać wyłączone podczas migracji.
2. **Jednorazowo** w Shell z katalogu repozytorium wykonaj transakcyjne zastosowanie:
   ```bash
   node --input-type=module <<'NODE'
   import {readFileSync,existsSync} from 'node:fs';
   import {resolve} from 'node:path';
   import {createRequire} from 'node:module';
   const p=existsSync('contact-api/package.json')?resolve('contact-api/package.json'):resolve('package.json');
   const {Client}=createRequire(p)('pg');
   const sqlPath=existsSync('contact-api/persistence/new-only/owner-recovery-r1.sql')
     ?'contact-api/persistence/new-only/owner-recovery-r1.sql'
     :'persistence/new-only/owner-recovery-r1.sql';
   const client=new Client({connectionString:process.env.DATABASE_URL});
   await client.connect();
   try {
     await client.query('BEGIN');
     await client.query(readFileSync(sqlPath,'utf8'));
     await client.query('COMMIT');
     console.log('OWNER M6 RECOVERY SCHEMA INSTALLED');
   } catch(e) {
     await client.query('ROLLBACK').catch(()=>{});
     console.log('M6 SCHEMA HOLD:',e.code||'FAILED');
     process.exitCode=1;
   } finally {await client.end();}
   NODE
   ```
   Nie uruchamiaj ponownie: skrypt jest celowo single-install i odmówi duplikatu.
3. Sprawdź, czy `RESEND_API_KEY`, `EMAIL_FROM` i `CONTACT_DATA_ENCRYPTION_SECRET` są już prawidłowo ustawione (bez ujawniania ich wartości).
4. W Render `gracz-contact-api` ustaw `NEWSLETTER_OWNER_RECOVERY_ENABLED=1`; zapisz/deploy do aktywacji M6.
5. Po zalogowaniu na istniejące konto `graczowner` przejdź do „Ustawienia administratora → Odzyskiwanie hasła”, wpisz wybrany e-mail i bieżące hasło. Potwierdź skrzynkę kodem z e-maila.
6. Dopiero potem używaj „Zapomniałem hasła?” na stronie logowania. Prośba o kod nie zmienia hasła; dopiero jednorazowy kod wraz z nowym hasłem je zastępuje i unieważnia stare sesje.

## Wyłączenie / rollback
Ustaw `NEWSLETTER_OWNER_RECOVERY_ENABLED=0` i zastosuj ustawienie. Nie usuwaj tabeli, nie zmieniaj istniejących haseł i nie wyłączaj logowania OWNER.

## Ochrona przed nadużyciami
Publiczna odpowiedź na prośbę o kod zawsze wygląda tak samo niezależnie od dopasowania adresu. Każda skrzynka ma 5-minutową przerwę między kodami i maksymalnie 5 wysyłek dziennie. Kod może być wypróbowany maksymalnie 5 razy i wygasa po 10 minutach; po udanej zmianie zostaje usunięty. Jednorazowe kody nie zastępują żadnego hasła przed pomyślnym potwierdzeniem.
