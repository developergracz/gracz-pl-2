# Legacy SmartFox security quarantine

Katalog `games-dev` zawiera historyczne rozszerzenia SmartFox, w tym biblioteki wymagające modernizacji (`log4j-1.2.15.jar`, `commons-collections-3.2.1.jar`, `mysql-connector-java-5.1.34-bin.jar`).

## Zasady bezpieczeństwa

1. `games-dev` NIE jest częścią wdrożenia aplikacji WWW (`website`).
2. Żaden plik JAR z `games-dev` nie może być kopiowany ani publikowany przez webroot.
3. Historycznych JAR-ów nie wolno aktualizować „w ciemno”. Rozszerzenia były budowane m.in. dla Java SE 6 i wymagają testu zgodności SmartFox/Java/MySQL przed wymianą zależności.
4. Każda zmiana pliku `.jar` w `games-dev` wymaga osobnego PR, testu uruchomienia serwera gry i testu multiplayer Warcaby/Gomoku.
5. Docelowo: wymienić Log4j 1.x na zgodny, utrzymywany zamiennik; Commons Collections zaktualizować po teście zgodności; sterownik MySQL dobrać do faktycznej wersji JVM i serwera DB.
6. Do czasu zakończenia migracji firewall/origin powinien ograniczać dostęp do usług SmartFox wyłącznie do portów i źródeł faktycznie potrzebnych graczom/administracji.

Ten plik nie oznacza akceptacji ryzyka na produkcji. Oznacza rozdzielenie starego runtime gier od współczesnej aplikacji WWW tak, aby podatne biblioteki nie były przypadkiem wdrażane razem z portalem.