<?php
/* Ten plik zawiera kody zwracane przez funkcje serwisu */

// Kody potwierdzeń
define('OK_WSZYSTKO',1); /* Stosowany gdy wszystkie zdefiniowane operacje zakończyły się pomyślnie */

// Kody błędów
define('BLAD_NIEPRZEWIDZIANY',100); /* Stosowany w przypadku gdy funkcja nie wychwyciła znanego błędu. */
define('BLAD_SQL',101); /* Jeśli wystapi błąd zapytania SQL lub błąd działania bazy danych */
define('BLAD_REKORD_JUZ_ISTNIEJE',102); /* Stosowany najczęściej gdy baza zwróciła błąd numer 1062 [zduplikowany rekord] lub w innych przypadkach jeśli dana wartość już istnieje, a musi być unikalna. */ 
define('BLAD_REKORD_NIE_ISTNIEJE',103); /* Jeśli żądana informacja nie może zostać odnaleziona */
define('BLAD_ADRESAT_CIE_ZABLOKOWAL',130); /* Błąd powiązany z modułem czarnej listy. Występuje na przykład w sytuacjach gdy blocked użytkownik chce wysłać list do użytkownika który go zablokował */
define('BLAD_BRAK_UPRAWNIEN',131); /* Błąd zwraca w przypadku posiadania niewystarczających uprawnień do wykonania danej operacji */
define('BLAD_WYCZERPANY_TRANSFER',132); /* Błąd występuje gdy wysłane przez użytkownika zdjęcie lub plik ma rozmiar większy niż pozostały dla użytkownika limit transferu */
define('BLAD_WYSYLANIA_WIADOMOSCI',133); /* Występuje w przypadkach gdy wysyłanie wiadomości nie powiodło się. */
define('BLAD_USER_NIE_ISTNIEJE',134); /* Występuje w przypadkach gdy operacja ma zostać wykonana na użytkowniku który nie istnieje w bazie (np. podano błędy identyfikator użytkownika dla funkcji */
define('BLAD_EMAIL_NIEPRAWIDLOWY',135); /* Występuje w przypadkach gdy podany adres e-mail jest nieprawidłowy */
define('BLAD_BRAK_SRODKOW_NA_KONCIE',136); /* Występuje w przypadkach gdy z konta ma zostać zabrane więcej środków niż na nim jest */
define('BLAD_WERYFIKACJA_AUTENTYCZNOSCI_NIE_POWIODLA_SIE',137); /* Występuje w przypadkach gdy weryfikowanie autentyczności danych lub żądania nie powiedzie się */
define('BLAD_PLIK_ZBYT_DUZY',138); /* Występuje w przypadkach gdy przesyłany plik jest zbyt duży */
define('BLAD_ROZSZERZENIE_NIEDOZWOLONE',139); /* Występuje w przypadkach gdy rozszerzenie pliku jest niedozwolone */
define('BLAD_ZMIANY_ROZDZIELCZOSCI',140); /* Występuje w przypadkach gdy operacja zmiany rozdzielczości pliku (np. do miniaturki) nie powiodła się z jakiś względów */
define('BLAD_PLIK_NIE_ISTNIEJE',141); /* Plik na który miała zostać przeprowadzona operacja nie istnieje */
define('BLAD_NIEPRAWIDLOWE_DANE',142); /* Jeśli podane do funkcji dane są nieprawidłowe */
define('BLAD_ZBYT_DUZO_WYNIKOW',143); /* Jeśli ilość uzyskanych wyników (rekordów z bazy danych) przekracza maks. dopuszczalną ilość */
define('BLAD_BRAK_WYNIKOW',144); /* Jeśli nie ma wyników (np. użytkownik nie ma zdjęć w galerii - powinien być zwrócony) */
define('BLAD_NIE_MOZESZ_OCENIAC_SWOICH_ZASOBOW',145); /* Jeśli użytkownik próbował ocenić swój zasób */



?>