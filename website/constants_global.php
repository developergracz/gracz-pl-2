<?php
// PREDEFINED CONSTANTS - you shouldn't modify them
// Nie należy ich zmieniać w przypadku gdy została już utworzona baza danych, ponieważ w bazie danych znajdują się wartości powiązane z wartościami poniższych stałych. Podsumowując: nazwę stałych można zmienić, pod warunkiem, że zmieni się ją we wszystkich miejscach, w kodzie, natomiast wartości stałych lepiej nie zmieniać podczas gdy baza danych jest już wypełniona, ponieważ może to doprowadzić do rozbieżności.

define('SEX_FEMALE',1,false);
define('SEX_MALE',2,false);

define('ADMINISTRATOR',100);
define('USER',90);

define('ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT','Mr_Usuniety');

define('PRIORITY_LOW',1);
define('PRIORITY_NORMALNY',10);
define('PRIORITY_HIGH',20);

define('SORT_BY_NAME',1);
define('SORT_BY_DATE',2);
define('SORT_BY_ID',4);
define('SORT_BY_DESCRIPTION',8);
define('SORT_BY_ORDER_INDICATOR',16);

define('SORT_ASCENDING',1);
define('SORT_DESCENDING',2);

define('BLOCK',1);
define('UNBLOCK',2);

define('ADVERTISEMENT_MAIN',1);
define('ADVERTISEMENT_RIGHT_SIDE', 2);
define('ADVERTISEMENT_LEFT_SIDE', 3);
define('ADVERTISEMENT_BOTTOM', 4);

define('CODE_PASTE_HEAD', 1);
define('CODE_PASTE_BODY', 2);

define('MINIATURE_PROPORTIONAL', 1);
define('MINIATURE_SQUARE', 2);

define('LEVEL_INF', 1);
define('LEVEL_EVENT', 20);
define('LEVEL_ERROR', 30);
