# Gracz.pl — SPF, DKIM i DMARC

Rekordy DNS zależą od faktycznego dostawcy poczty. Nie wpisuj przykładowych kluczy DKIM do produkcji.

## Kolejność
1. Skonfiguruj SPF zgodnie z dokumentacją rzeczywistego nadawcy (np. Resend/SMTP) i upewnij się, że domena ma tylko jeden rekord SPF.
2. Włącz DKIM u dostawcy i dodaj dokładnie wygenerowane przez niego rekordy DNS.
3. Dodaj DMARC w trybie obserwacji:
   `_dmarc.gracz.pl TXT "v=DMARC1; p=none; rua=mailto:dmarc@gracz.pl; adkim=s; aspf=s; pct=100"`
4. Obserwuj raporty co najmniej 1–2 tygodnie i potwierdź, że wszystkie legalne źródła przechodzą SPF/DKIM oraz alignment.
5. Następnie przejdź na `p=quarantine`, początkowo można użyć mniejszego `pct` i zwiększać go stopniowo.
6. Po potwierdzeniu wszystkich źródeł ustaw docelowo `p=reject; pct=100`.

## Ważne
- `rua` powinno prowadzić do skrzynki lub usługi obsługującej raporty agregowane DMARC.
- Nie przechodź do `reject`, dopóki mailing transakcyjny, newsletter i wszystkie legalne systemy wysyłkowe nie mają poprawnego alignment.
- Zmiana DMARC odbywa się w DNS (np. Cloudflare), a nie w kodzie aplikacji.
