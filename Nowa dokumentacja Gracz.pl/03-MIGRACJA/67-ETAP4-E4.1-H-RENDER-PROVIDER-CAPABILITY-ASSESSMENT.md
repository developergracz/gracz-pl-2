# ETAP 4 — E4.1-H Render Provider Capability Assessment

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **ASSESSMENT COMPLETE / CURRENT FREE PLAN BLOCKED / EXECUTION NOT AUTHORIZED**  
Production V3: **NO-GO**

> Dokument ocenia wyłącznie wykonalność techniczną kontroli E4.1-H na platformie Render. Nie autoryzuje zmiany planu, wznowienia usługi, utworzenia joba, użycia Shell/SSH, deployu, restartu, modyfikacji environment, odczytu sekretów ani połączenia operacyjnego z produkcją.

## 1. Stan wejściowy

Obowiązujący status:

```text
F0–F7 PASS / E4.1-H PENDING / FREEZE ACTIVE
```

Potwierdzone fakty projektowe:

- usługa `gracz-checkers-test` jest zawieszona przez operatora,
- usługa WWW korzysta z planu `Free`,
- produkcyjna baza Render pozostaje dostępna,
- PR #26 pozostaje `OPEN / DRAFT / NOT MERGED`,
- head PR #26 pozostaje `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`,
- nie ma zgody na wznowienie normalnej aplikacji ani kopiowanie kluczy poza Render,
- istniejący lokalny skrypt `crypto-decryptability-smoke.mjs` jest jawnie ograniczony do loopback i bazy restore, dlatego nie może być bezpiecznie użyty bez zmian jako kolektor produkcyjny.

## 2. Źródła dostawcy

Ocena wykorzystuje oficjalną dokumentację Render, odczytaną 31.08.2026:

1. Free instances: https://render.com/docs/free
2. One-Off Jobs: https://render.com/docs/one-off-jobs
3. Environment Variables and Secrets: https://render.com/docs/configure-environment-variables
4. Logs in the Render Dashboard: https://render.com/docs/logging
5. Render CLI: https://render.com/docs/cli
6. Services and Service Types: https://render.com/docs/service-types

Dokumentacja dostawcy jest źródłem dynamicznym. Przed przyszłym wykonaniem wymagany jest ponowny provider capability check.

## 3. Macierz możliwości

| Możliwość | Oficjalny kontrakt Render | Stan dla bieżącej usługi | Wniosek E4.1-H |
|---|---|---|---|
| Shell przez Dashboard lub SSH | Free web services nie obsługują Shell access | **NIEDOSTĘPNE** | nie może być ścieżką wykonania |
| One-Off Job | uruchamia zadany `startCommand` na artefakcie i konfiguracji usługi bazowej | funkcja niedostępna dla Free web services | obecnie zablokowane |
| Dziedziczenie environment przez One-Off Job | job otrzymuje snapshot wszystkich skonfigurowanych zmiennych bazowej usługi | funkcja istotna, lecz job jest niedostępny na planie Free | potencjalnie bez kopiowania sekretów dopiero po spełnieniu warunków planu |
| Dziedziczenie artefaktu | job używa ostatniego poprawnego artefaktu build bazowej usługi | aktywny artefakt nie zawiera zatwierdzonego kolektora E4.1-H | dodatkowy blocker wykonawczy |
| Oddzielny proces bez publicznego listenera | One-Off Job kończy się po wyjściu `startCommand` | architektonicznie zgodne z wymaganiem izolacji | preferowany wzorzec po autoryzacji |
| Logi joba | dostępne w Jobs/Logs i objęte retencją workspace | możliwy privacy-safe capture | kolektor musi wypisywać tylko kontrakt evidence |
| Persistent disk | One-Off Job nie ma dostępu do persistent disk bazowej usługi | brak wykazanego uzależnienia testu od dysku | brak blokady, wymaga potwierdzenia |
| Zmiana environment | zapis może wywołać deploy albo zachować zmianę do następnego deployu | zabroniona w freeze | nie używać |
| Background worker | proces ciągły bez publicznego ruchu | wymaga utworzenia/konfiguracji osobnej usługi i nie jest minimalnym jobem | odrzucone jako wariant domyślny |
| Cron job | osobna usługa uruchamiana harmonogramem | wprowadza nowy zasób i harmonogram | odrzucone dla jednorazowej kontroli |
| Lokalny test z produkcyjnymi kluczami | poza kontraktem Render | wymagałby eksportu sekretów | zabronione |

## 4. Ustalenia potwierdzone

### 4.1. Bieżący plan Free nie spełnia wymagań

Render jawnie wskazuje, że Free web services nie obsługują:

- One-Off Jobs,
- Shell access przez SSH lub Dashboard.

Obie ścieżki, które pozwoliłyby uruchomić pojedynczy proces diagnostyczny bez normalnego entrypointu aplikacji, są więc obecnie niedostępne.

### 4.2. One-Off Job jest właściwym wzorcem docelowym, ale nie jest obecnie dostępny

Po przyszłym spełnieniu warunków planu One-Off Job ma korzystne właściwości:

- otrzymuje ostatni udany artefakt build bazowej usługi,
- otrzymuje snapshot environment bazowej usługi,
- wykonuje jawny `startCommand`,
- kończy się i jest automatycznie usuwany po zakończeniu komendy,
- posiada osobny status i log,
- nie wymaga publicznego endpointu.

To odpowiada wzorcowi `provider-side isolated diagnostic execution`, o ile wszystkie bramki bezpieczeństwa są spełnione.

### 4.3. Samo udostępnienie One-Off Job nie wystarczy

Aktualny artefakt nie może zostać uznany za execution-ready tylko dlatego, że zawiera kod aplikacji. Wcześniejsza tymczasowa ścieżka runtime self-check została poprawnie usunięta. Obecny lokalny skrypt smoke-testu:

- wymusza host loopback,
- wymusza nazwę lokalnej bazy restore,
- używa lokalnego kontraktu połączenia,
- nie jest zatwierdzonym kolektorem provider-side E4.1-H.

Uruchomienie go przeciw produkcji przez obejście zabezpieczeń jest zabronione.

## 5. Fakty niepotwierdzone i wymagające ponownej kontroli

Poniższe elementy nie mogą być przyjęte jako pewnik:

1. czy One-Off Job można utworzyć z bazowej usługi już zawieszonej,
2. jaki dokładnie płatny plan i `planId` będzie dostępny w workspace w dniu wykonania,
3. czy przejście z Free na plan obsługujący job spowoduje automatyczne wznowienie lub inne zdarzenie runtime,
4. czy ostatni poprawny artefakt będzie dokładnie odpowiadał zatwierdzonemu source SHA,
5. czy prywatne połączenie z bazą będzie dostępne dla wybranego joba w tym samym regionie,
6. czy log retention i uprawnienia reviewerów będą wystarczające dla capture evidence.

Brak potwierdzenia któregokolwiek punktu oznacza `HOLD`.

## 6. Ocenione warianty

### Wariant A — One-Off Job na autoryzowanej bazowej usłudze

Status: **WARUNKOWO PREFEROWANY / OBECNIE ZABLOKOWANY**

Warunki:

- formalne zdjęcie lub kontrolowane zawieszenie freeze dla ściśle określonego zakresu,
- plan obsługujący One-Off Jobs,
- potwierdzenie braku automatycznego startu normalnego writera,
- zatwierdzony artefakt zawierający dedykowany kolektor,
- jawny `startCommand`,
- read-only DB guard,
- privacy-safe log,
- cleanup i powrót do zatwierdzonego stanu.

### Wariant B — Shell/SSH w bazowej usłudze

Status: **ODRZUCONY JAKO DOMYŚLNY**

Powody:

- niedostępny na Free,
- zwiększa powierzchnię manualnego błędu,
- utrudnia powtarzalność i niezależny review,
- może zachęcać do interaktywnego odczytu environment.

Może być rozważany tylko awaryjnie po osobnym ADR i formalnej zgodzie.

### Wariant C — nowy worker, cron lub private service

Status: **ODRZUCONY DLA E4.1-H**

Powody:

- tworzy nowy zasób,
- wymaga konfiguracji i dystrybucji environment,
- rozszerza zakres zmiany,
- komplikuje cleanup,
- nie jest konieczny dla pojedynczej kontroli.

### Wariant D — wznowienie normalnej aplikacji

Status: **ZABRONIONY W FREEZE**

Normalny entrypoint może uruchomić listener, bootstrap, cleanup, seedy lub background jobs. Nie spełnia zasady minimalnego procesu diagnostycznego.

### Wariant E — eksport kluczy do lokalnego środowiska

Status: **BEZWZGLĘDNIE ODRZUCONY**

Narusza granicę sekretów i nie jest wymagany przez preferowany wzorzec provider-side.

## 7. Decyzja architektoniczna

```text
CURRENT RENDER FREE PLAN = NOT CAPABLE
SHELL = UNAVAILABLE
ONE-OFF JOB = UNAVAILABLE
APP RESUME = NOT AUTHORIZED
SECRET EXPORT = PROHIBITED
E4.1-H = PENDING / SAFE HOLD
```

Docelowym wzorcem pozostaje One-Off Job, ale dopiero po:

1. formalnej autoryzacji okna,
2. ponownej weryfikacji możliwości Render,
3. zatwierdzeniu dedykowanego kolektora,
4. przygotowaniu niezmiennego artefaktu,
5. niezależnym review runbooka i evidence contract.

Ta decyzja nie autoryzuje zakupu ani zmiany planu.

## 8. Kryteria provider capability PASS

Warstwa dostawcy może otrzymać `PASS` wyłącznie, gdy reviewer potwierdzi:

- plan obsługuje One-Off Jobs,
- job może działać bez startu normalnej aplikacji,
- job otrzyma wyłącznie zatwierdzony artefakt,
- job otrzyma istniejące sekrety bez ich ujawnienia lub kopiowania,
- job może połączyć się z właściwą bazą,
- proces wymusi DB read-only,
- log może zostać ograniczony do kontraktu evidence,
- job można jednoznacznie zakończyć/anulować,
- cleanup nie wymaga pozostawienia nowego trwałego zasobu,
- plan rollbacku i STOP/ABORT jest zatwierdzony.

## 9. Kryteria natychmiastowego HOLD

- wymagany upgrade automatycznie uruchamia normalną usługę,
- nie można przypiąć source/build identity,
- konieczne jest ręczne ujawnienie sekretu,
- kolektor nie istnieje w artefakcie,
- job nie może wymusić read-only,
- target DB nie jest jednoznaczny,
- output może zawierać plaintext, ciphertext, AAD albo sekret,
- koszt lub zakres planu nie został zaakceptowany,
- wymagane jest utworzenie nieuzgodnionego trwałego zasobu.

## 10. Następny krok dokumentacyjny

Przygotować oddzielną specyfikację dedykowanego kolektora E4.1-H. Specyfikacja ma pozostać dokumentacją; nie wolno jeszcze dodawać kodu do aktywnego artefaktu ani wykonywać deployu.

## 11. Wpływ na status projektu

```text
F0–F7 = PASS
E4.1-H = PENDING
PROVIDER CAPABILITY = BLOCKED BY CURRENT FREE PLAN
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER CONFIGURATION = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Ocena wyjaśnia techniczną przyczynę HOLD. Nie zmienia statusu E4.1-H na FAIL i nie stanowi autoryzacji wykonawczej.
