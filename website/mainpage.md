Dokumentacja programistyczna
==============

Wprowadzenie
--------------

Serwis *Gracz* ma budowę modularną. Jest na tyle złożoną aplikacją, że można już mówić o nim jako o systemie, w którego skład wchodzą różne środowiska. System składa się z:
- Aplikacji serwerowej działającej w oparciu o PHP po stronie serwera
- Aplikacji klienckiej działającej w oparciu o JavaScript/Flash/HTML5/CSS po stronie klienta. 
- Bazy danych MySQL, która przechowuje i udostępnia wszelkie dane jakie wytwarzane są przez serwis (statystyki wygranych, przegranych gier, dane użytkowników, wpisy informacyjne o grach, itp). 
- Serwera gier Smartfox na którym uruchomione są tzw. rozszerzenia serwera (pisane w języku Java). 

Serwer gier Smartfox działa niezależnie od serwera WWW Apache (również niezależnie od serwera Apache generuje swój panel administracyjny w postaci usługi WWW - jednak oczywiście odbywa się to na innym porcie). Na każdą grę przypada obsługujące ją rozszerzenie serwera gier Smartfox (tzw. Room Extension). Rozszerzenie takie dba o prawidłową, zgodną z zasadami danej gry rozgrywkę, sprawdza czy użytkownicy nie oszukują i zapewnia całą funkcjonalność gry, która ze względów bezpieczeństwa nie może zostać umieszczona po stronie klienta. Oprócz tego, każda strefa serwera Smartfox (każda strefa serwera to inna gra [strefa = gra]) ma swoje globalne rozszerzenie (tzw. Zone Extension), które w przypadku systemu Gracz obsługuje np. powiązanie użytkownika serwera Smartfox z użytkownikiem aplikacji www Gracz.pl (w istocie wiąże użytkownika Smartfox z użytkownikiem WWW i dostarcza do serwera Smartfox informacje takie jak nick, płeć z bazy danych MySQL). 

Tutaj należy się małe wyjaśnienie: moduł aplikacji WWW po stronie serwera (PHP) jest izolowany od rozszerzeń serwera Smartfox. Nie można przesłać informacji pomiędzy PHP, a rozszerzeniem serwera Smartofx inaczej niż przez pośrednika - bazę danych - MySQL. Takie rozwiązanie zaprojektowano z kilku względów - przede wszystkim ze względów estetycznych (czytelność działania systemu, brak skomplikowanych zależności pomiędzy rozszerzeniami serwera Smartfox, a funkcjami PHP w przyszłości).


Globalne rozszerzenie strefy nosi nazwę GraczZoneExtension i - w przypadku tworzenia nowej strefy (np. dodawania nowej gry przez administratora) - musi być ono wskazane w panelu administracyjnym Smartfox jako rozszerzenie obsługujące nowo dodawaną strefę. Analogicznie, do każdego nowoutworzonego pokoju w danej strefie musi zostać przypisane rozszerzenie go osbługujące (RoomExtension). Dla przykładu, obecnie strefę Checkers (warcaby) obsługuje rozszerzenie GraczZoneExtension, a każdy pokój zawarty w tej strefie obsługiwany jest przez CheckersExtension. Analogicznie, w przypadku gry Gomoku, strefa Gomoku obsługiwana jest przez GraczZoneExtension (to samo rozszerzenie, które obsługuje strefę Checkers), a pokoje w strefie Gomoku obsługiwane są przez rozszerzenie GomokuExtension.
Można więc przyjąć, że rozszerzenie typu ZoneExtension (rozszerzenie obsługujące strefę) jest uniwersalne dla wszystkich stref (obsługuje ono ogólne, wspólne dla wszystkich stref akcje, takie jak:

- logowanie w danej strefie (standardowa zdarzenie Smartfox: USER_LOGIN)
- tworzenie nowego pokoju w danej strefie (polecenie "createRoom")
- wysyłanie listy graczy zalogowanych w danej strefie (polecenie "getAllUsers") 
- wysyłanie listy przyjaciół (polecenie "getFriendsList")
- wysyłanie właściwości danego stołu (polecenie "getOptions")
- przesyłanie zaproszeń (polecenie "sendInvitation")



Przykład działania
--------------
Aby nie przedłużać (człowiek najlepiej uczy się na przykładach), prześledźmy co się dzieje kiedy zalogowany Użytkownik (dla czytelności przykładu pomijamy teraz proces logowania użytkownika) chce zagrać w grę.
Wybierając grę z katalogu Użytkownik zostaje przeniesiony na stronę wyboru pokoju gry. Może stworzyć swój własny pokój, albo dołączyć do już istniejącego. Funkcje zawarte na tym ekranie takie jak pobieranie listy pokoi lub pobieranie listy graczy w danej strefie realizowane są za pomocą Smartfox API for JavaScript. Biblioteka Smartofx API for Javascript wykorzystuje nową technikę WebSockets, która pozwala na bezpośrednią komunikację z serwerem Smartfox na odpowiednim porcie (port 8888). Wszystkie wywołania odbywają się asynchronicznie, a odpowiedzi otrzymywane są poprzez technikę callback.

Jedyną funkcją na tym ekranie nie wykorzystującą Smartfox API for JavaScript jest funkcja tworzenia nowego stołu gry. W jej przypadku, po wpisaniu nazwy nowego stołu Użytkownik przekierowywany jest do strony z grą (Flash lub HTML5), a w adresie URL przekazywany jest parametr "roomName" z nazwą stołu który chce utworzyć/do którego chce dołączyć. Takie rozwiązanie zostało zaprojektowane z uwagi na możliwość "dzielenia się" przez użytkowników linkami do danej rozgrywki (np. przez komunikatory internetowe).

// UWAGA! W dokumentacji serwera Smartfox zamiast "stół" używane jest pojęcie "pokój" (od ang. room) [stół = pokój]

Po przejściu do strony rozgrywki zostaje załadowana aplikacja kliencka gry (Flash lub HTML5) do której zostają przekazane parametry (nazwa pokoju i dodatkowe opcje takie jak: czy uwzględniać grę w rankingu, czas trwania gry, a także - co ważne - identyfikator sesji PHP gracza). Przekazanie identyfikatora sesji do aplikacji klienckiej gry pozwala jej na wysłanie tego identyfikatora w momencie logowania do rozszerzenia serwera obsługującego daną grę i tym samym powiązanie użytkownika Smartfox z użytkownikiem PHP (pozwala to rozszerzeniu serwera na pobranie dodatkowych informacji o użytkowniku z bazy danych MySQL - takich jak:

- login/nick (*login*)
- identyfikator użytkownika w tabeli użytkowników w bazie MySQL (*php_user_id*)
- płeć (*sex*)
- ilość wygranych/przegranych rozgrywek (*won* / *lost*)
- całkowita zgromadzona ilość punktów (*scores_sum*)
- aktualne miejsce w rankingu (*place*)
- ilość rozgrywek (*plays_count*)
- data rejestracji użytkownika (*date_register*)

Możliwość powiązania użytkownika Smartfox z użytkownikiem PHP istnieje, ponieważ w tabeli użytkowników (*prefix_users*), w bazie MySQL, każdy użytkownik ma przypisany aktualny identyfikator sesji PHP.

Po zalogowaniu do strefy i pobraniu informacji o użytkowniku z bazy danych, rozszerzenie serwera jest już nie wykorzystywane w trakcie normalnej rozgrywki. Obsługa gry przenosi się do rozszerzenia typu Room Extension odpowiadajacego danej grze - w przypadku gry Warcaby/Checkers obsługa przenosi się do rozszerzenia CheckersExtension.
Tam osbługiwane są żądania, jakie przychodzą od strony klienta (np. żądanie wykonania ruchu na planszy - *move*). Gra zaczyna się toczyć pomiędzy aplikacją kliencką (Flash lub HTML5) a rozszerzeniem serwera Smartfox typu RoomExtension. Rozszerzenie serwera, po wykonaniu żądania zwraca aplikacji klienckiej jego rezultat, który ta obsługuje w callbacku.
W przypadku Flasha, całość rozgrywki realizowana jest za pomocą języka ActionScript, który odpowiednio reaguje na otrzymywane od serwera informacje zwrotne. W przypadku HTML5 całość realizowana jest za pomocą języka JavaScript w przeglądarce internetowej. 
Ważne jest aby aplikacja kliencka zawsze czekała z np. wykonaniem ruchu na potwierdzenie ze strony serwera, że dany ruch faktycznie można wykonać. W innym przypadku zachodzi uzasadniona obawa o niespójność rozgrywki pomiędzy graczami (jeden gracz widzi co innego niż inny). Pewność transmisji gwarantowana jest przez standardowy protokół TCP, który w przypadku niedostarczenia pakietu, wysyła go jeszcze raz lub informuje aplikację kliencką, że połączenie zostało przerwane.

Po wygranej jednej ze stron (a więc zajściu warunków kończących rozgrywkę), w bazie danych aktualizowane są informacje o rozgrywce i jej wyniku.


Budowa i działanie serwisu WWW
--------------
Aplikacja WWW jest napisana w paradygmacie strukturalno-proceduralnym. Najważniejszą rolę odgrywają biblioteki:
- library_main.php    (przechowuje ogólne funkcje zapewniające funkcjonowanie serwisu)
- library_games.php   (przechowuje funkcje związane z obsługą gier, ich wyświetlaniem i listowaniem)
- library_facebook.php  (przechowuje funkcje związane z mechanizmem logowania do serwisu za pomocą konta Facebook)

Które zawierają wszystkie funkcje wykorzystywane przez podstrony serwisu. Można więc przyjąć, że jeśli jakiejś funkcji nie ma w tych bibliotekach ona po prostu nie istnieje. Innymi słowy, projekt zakłada, że w plikach podstron, takich jak kontakt.php nie można definiować własnych, lokalnych funkcji. W ten sposób zachowana jest estetyka i czytelność kodu. Podstrony takie jak kontakt.php po prostu wywołują pożądane funkcje zawarte w bibliotekach, a wynik wyświetlany jest na wyjściu. W podstronach mogą być oczywiście umieszczane instrukcje warunkowe, reagujące na wartości zwrócone przez wywoływane funkcje.

Kolejnym ważnym plikiem jest:
- variables_global.php
Zawiera on wszystkie ustawienia aplikacji PHP, w tym ścieżki do poszczególnych podstron, hasła dostępu do bazy danych, ziarno i inne newralgiczne dane. Dlatego, plik ten jest umieszczony na FTP poza katalogiem publicznym (public_html).

Następnymi ważnymi plikami są:
- wykonanie_procedur_startowych.php
- naglowek.php
- stopka.php
- wykonanie_procedur_koncowych.php


W pliku wykonanie_procedur_startowych.php znajdują się instrukcje wykonywane zaraz po każdym wywołaniu strony serwisu.Można powiedzieć, że stanowi on punkt startowy procesu renderowania strony. Plik ten nie zwraca na wyjście ani jednego bajtu (nie może!) - tak aby po jego wykonaniu możliwe było jeszcze wysłanie nagłówków HTTP (poprzez funkcje header()). 

Prześledźmy zatem jak wygląda struktura podstrony serwisu w dwóch przypadkach - w przypadku kiedy chcemy generować stronę wraz z całą szatą graficzną i w przypadku kiedy chcemy obsłużyć jedynie wywołanie AJAX (a więc nie chcemy zwracać szaty graficznej, a jedynie np. pustkę lub prostą odpowiedź w formacie JSON).

<br />

**Podstrona generująca szatę graficzną**
<br />
<code>
<?php include("variables_local.php"); include_once($header); ?>

	// Jakaś treść strony

<?php include_once($footer); ?>
</code>
<br />

**Podstrona bez szaty graficznej lub podstrona AJAX**
<br />
<code>
<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

	// Zawartość lub blok instrukcji SWITCH reagującej na określone akcje AJAX

<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>
</code>
<br />


Dodawanie funkcjonalności
----------
Przypuśćmy, że chcemy stworzyć nową podstronę, pobierającą informację przez AJAX, obrabiającą je i umożliwiającą wysłanie formularza metodą POST. Wówczas musimy dodać do biblioteki library_main.php funkcję która będzie obrabiała dane, utworzyć plik obsługujący zapytania AJAX (tak jak w sekcji powyżej), utworzyć podstronę graficzną (właściwą - tą która będzie posiadała szatę graficzną i formularz wysyłany metodą POST) wraz ze skryptem ściągającym dane poprzez AJAX - również tak jak w przykładzie w sekcji powyżej. Do wysyłki/odbierania danych AJAX można (a nawet należy) wykorzystać ładowaną zawsze w serwisie (w przypadku strony posiadającej szatę graficzną) bibliotekę jQuery i jQuery UI.
Należy również pamiętać o ważnej rzeczy - jeśli stworzyliśmy podstronę o nazwie *wielka_promocja.php* oraz *ajax_wielka_promocja.php*, wówczas trzeba dodać te dwie nazwy plików do tablicy *path[]* zawartej w pliku "variables_global.php", tak aby później - chcąc uzyskać ścieżkę do pliku - można było się odwoływać do rekordu w tablicy. Wpisywanie statycznej ścieżki w każdym miejscu w którym chcemy jej użyć jest złym pomysłem. Takie wpisy w pliku "variables_global.php" powinny wyglądać więc następująco:
<br /><br />
<code>
	$path['ajax_wielka_promocja'] = $directory['base'].'ajax_wielka_promocja';<br />
	$path['wielka_promocja'] = $directory['base'].'wielka_promocja';<br />
</code>
<br />
A ich późniejsze wykorzystanie w podstronie: <br /><br />
<code>
<?php echo($path['wielka_promocja']); ?><br />
</code>
<br />
<br />

Baza danych
------------
Zarówno aplikacja WWW jak i serwer gier Smartfox wykorzystują jedną i tą samą bazę danych, wymieniając za jej pomocą informacje. Baza danych stanowi centrum informacyjne integrując, a jednocześnie izolując od siebie poszczególne moduły systemu. Spójrzmy zatem przez chwilę na strukturę bazy danych:<br/>
<img src="./../database_schema.png" width="900" alt="Schemat bazy danych" />
<br /><br />
Baza danych jest znormalizowana do trzeciej postaci normalnej.<br />
Jak widzimy, baza składa się zarówno z tabel jak i widoków, które ułatwiają i ujednolicają zapytania pomiędzy poszczególnymi modułami systemu. Widoki dostarczają aktualnych informacji o rankingu graczy, ilości zdobytych punktów, ilości zwycięstw i przegranych, ilości rozgrywek itp... Dane zawarte w widokach są generowane na bieżąco - tj... widoki nie korzystają z żadnych pól typu "ilość wygranych", ale wyciągają te informacje na bieżąco (dla każdego użytkowniak) z tabeli przechowującej historie rozgrywek. Wbrew pozorom mechanizm jest bardzo sprawny, ponieważ aktualizuje się jedynie w momentach, w których jest to niezbędne (nie częściej).


Omówmy zatem kolejne tabele:
- *prefix_games_categories* - przechowuje strukturę kategorii do jakiej należą gry (np. zawiera katalogi "zręcznościowe", "logiczne", "edukacyjne", "bijatyki", "retro", itp...) wraz z opisami tych kategorii
- *prefix_games* - przechowuje rekordy zainstalowanych w serwisie gier. Zawiera informacje dotyczące nazw plików do wczytania, nazwy stref serwera Smartfox w których funkcjonuje dana gra, opis i tytuł gry, a także identyfikator kategorii do której jest zaliczana gra (patrz wyżej).
- *prefix_conversation* - przechowuje historie konwersacji na serwisowym czacie
- *prefix_friends* - przechowuje relacje znajomości zawartych pomiędzy użytkownikami serwisu
- *prefix_invitations* - przechowuje informacje o zaproszeniach do rozgrywek wysłanych przez graczy do innych graczy (użytkownicy mogą zapraszać się do poszczególnych pokoi)
- *prefix_blacklist* - przechowuje informacje o użytkownikach dodanych do czarnej listy przez innych użytkowników
- *prefix_abuse_notifications* - przechowuje zgłoszenia nadużyć jakich dokonali użytkownicy serwisu
- *prefix_bug_notifications* - przechowuje zgłoszenia błędów dokonywane przez użytkowników serwisu
- *prefix_gameplays* - zawiera informacje o historycznych rozgrywkach graczy. Powiązana jest z tabelą prefix_moves.
- *prefix_moves* - przechowuje listę ruchów jakie wykonał gracz w danej rozgrywce
- *prefix_users* - główna tabela przechowująca informacje o zarejestrowanych w serwisie użytkownikach
- *prefix_codepaste* - tabela przechowująca kody (np. skryptów reklamowych lub reklam) wklejane przez administratora serwisu
- *prefix_advertisements* - składuje informacje o bannerach reklamowych wyświetlanych w serwisie


Powiązane dokumentacje
------------
- Dokumentacja serwera Smartfox (wprowadzenie)
http://docs2x.smartfoxserver.com/
- Dokumentacja API serwera Smartfox - Java (dla rozszerzeń serwera)
http://docs2x.smartfoxserver.com/api-docs/javadoc/server/
- Dokumentacja API serwera Smartfox - Java (dla aplikacji klienckich - na razie nie ma w serwisie gry w postaci apletu Java, która by wykorzystywała to API)
http://docs2x.smartfoxserver.com/api-docs/javadoc/client/
- Dokumentacja API serwera Smartfox - JavaScript (dla aplikacji klienckich HTML5)
http://docs2x.smartfoxserver.com/api-docs/jsdoc/
- Dokumentacja API serwera Smartfox - ActionScript (dla aplikacji klienckich Flash)
http://docs2x.smartfoxserver.com/api-docs/asdoc/
- Dokumentacja jQuery
https://api.jquery.com/
- Dokumentacja jQuery UI
http://api.jqueryui.com/
- Dokumentacja PHP
http://php.net/manual/en/
- Dokumentacja MySQL
https://dev.mysql.com/doc/refman/5.5/en/
- Dokumentacja Facebook API
https://developers.facebook.com/docs/reference/php

