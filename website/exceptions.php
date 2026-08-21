<?php
/* This file contains exceptions */

define('FORMAT_HTML',1);
define('FORMAT_TEKST',2);

class ExceptionRoot extends Exception {
  protected $error_type;
  protected $statement_format = FORMAT_HTML;
  protected $statement_default = 'Wystąpił błąd.';
  protected $default_error_type = E_ERROR;

  // parametr "error_type" przybiera PHPowskie E_ERROR lub E_WARNING
  public function __construct($error_statement=null, $error_type=null, $error_code=-1)
  {
    if ($error_statement==null)
    {
      $error_statement = $this->statement_default;
    };
    if ($error_type==null)
    {
      $error_type = $this->default_error_type;
    };

    parent::__construct($error_statement, $error_code);
    $this->error_type = $error_type;
  }

  public function setStatementFormat($statement_format)
  {
    switch ($statement_format)
    {
      case FORMAT_TEKST:
        $this->statement_format = FORMAT_TEKST;
      break;

      case FORMAT_HTML:
        $this->statement_format = FORMAT_HTML;
      break;

      default:
        $this->statement_format = FORMAT_HTML;
      break;
    }
  }

  public function __toString()
  {
    switch ($this->statement_format)
    {
      case FORMAT_TEKST:
        return $this->getMessage()."\r\n\r\n";
      break;

      case FORMAT_HTML:
        switch ($this->error_type)
        {
          case E_ERROR:
            return '<div class="error">'.$this->getMessage().'</div>'."\r\n\r\n";
          break;

          case E_WARNING:
            return '<div class="warning">'.$this->getMessage().'</div>'."\r\n\r\n";
          break;
        }
      break;

      default:
        return $this->getMessage()."\r\n\r\n";
      break;
    }
  }
}

// Klasy błędów dziedziczące po klasie Exception
class ExceptionUnexpected extends ExceptionRoot {
  protected $statement_default = 'Wystąpił nieprzewidziany błąd.';
} /* Stosowany w przypadku gdy funkcja nie wychwyciła znanego błędu. */

class ExceptionSQL extends ExceptionRoot {
  protected $statement_default = 'Wystąpił błąd bazy danych.';
} /* Jeśli wystapi błąd zapytania SQL lub błąd działania bazy danych */

class ExceptionRecordAlreadyExists extends ExceptionRoot {
  protected $statement_default = 'Taki rekord już istnieje';
} /* Stosowany najczęściej gdy baza zwróciła błąd numer 1062 [zduplikowany rekord] lub w innych przypadkach jeśli dana wartość już istnieje, a musi być unikalna. */

class ExceptionRecordDoesntExists extends ExceptionRoot {
  protected $statement_default = 'Rekord nie istnieje.';
}  /* Jeśli żądana informacja nie może zostać odnaleziona */

class ExceptionAccessDenied extends ExceptionRoot {
  protected $statement_default = 'Nie masz wystarczających uprawnień do wykonania tej operacji.';
} /* Błąd zwraca w przypadku posiadania niewystarczających uprawnień do wykonania danej operacji */

class ExceptionSendingMessage extends ExceptionRoot {
  protected $statement_default = 'Wystąpił błąd przy próbie wysłania wiadomości';
} /* Występuje w przypadkach gdy wysyłanie wiadomości nie powiodło się. */

class ExceptionUserDoesntExists extends ExceptionRoot {
  protected $statement_default = 'Taki użytkownik nie istnieje.';
} /* Występuje w przypadkach gdy operacja ma zostać wykonana na użytkowniku który nie istnieje w bazie (np. podano błędy identyfikator użytkownika dla funkcji */

class ExceptionUserAccountIsNotActive extends ExceptionRoot {
  protected $statement_default = 'Konto o podanym loginie nie jest aktywne. Na podany adres e-mail został wysłany list z linkiem aktywującym. Kliknij w niego aby aktywować niniejsze konto.';
} /* Występuje w przypadkach gdy użytkownik chce wykonać akcję (np. logowania) a jego konto nie jest aktywne. */

class ExceptionUserAccountIsAlreadyActive extends ExceptionRoot {
  protected $statement_default = 'Konto o podanym loginie zostało już kiedyś aktywowane.';
} /* Występuje w przypadkach gdy użytkownik chce ponownie aktywować, aktywne już konto. */

class ExceptionInvalidEmail extends ExceptionRoot {
  protected $statement_default = 'Podany adres e-mail jest nieprawidłowy.';
} /* Występuje w przypadkach gdy podany adres e-mail jest nieprawidłowy */

class ExceptionFileTooBig extends ExceptionRoot {
  protected $statement_default = 'Plik jest zbyt duży.';
} /* Występuje w przypadkach gdy przesyłany plik jest zbyt duży */

class ExceptionInvalidFileExtension extends ExceptionRoot {
  protected $statement_default = 'Nieprawidłowe rozszerzenie pliku.';
} /* Występuje w przypadkach gdy przesyłany plik ma nieakceptowane rozszerzenie */

class ExceptionFileDoesntExists extends ExceptionRoot {
  protected $statement_default = 'Wskazany plik nie istnieje.';
} /* Plik na który miała zostać przeprowadzona operacja nie istnieje */

class ExceptionInvalidExtension extends ExceptionRoot {
  protected $statement_default = 'Niedozwolone rozszerzenie pliku.';
} /* Występuje w przypadkach gdy rozszerzenie pliku jest niedozwolone */

class ExceptionResolutionChange extends ExceptionRoot {
  protected $statement_default = 'Wystąpił błąd przy próbie zmiany rodzielczości obrazka. Prawdopodobnie obrazek ma nieprawidłowy lub nieobsługiwany format.';
} /* Występuje w przypadkach gdy operacja zmiany rozdzielczości pliku (np. do miniaturki) nie powiodła się z jakiś względów */

class ExceptionInvalidData extends ExceptionRoot {
  protected $statement_default = 'Nieprawidłowe dane.';
} /* Jeśli podane do funkcji dane są nieprawidłowe */

class ExceptionInvalidToken extends ExceptionRoot {
  protected $statement_default = 'Nieprawidłowy token.';
} /* Jeśli token jest nieprawidłowy */

class ExceptionTooMuchResults extends ExceptionRoot {
  protected $statement_default = 'Zbyt dużo wyników';
} /* Jeśli ilość uzyskanych wyników (rekordów z bazy danych) przekracza maks. dopuszczalną ilość */

class ExceptionNoResults extends ExceptionRoot {
  protected $statement_default = 'Brak wyników.';
  protected $default_error_type = E_WARNING;
} /* Jeśli nie ma wyników (np. użytkownik nie ma zdjęć w galerii - powinien być zwrócony) */

class ExceptionSendingEmail extends ExceptionRoot {
  protected $statement_default = 'Wystąpił błąd podczas próby wysłania wiadomości e-mail.';
} /* Jeśli wystąpił błąd przy wysyłce e-mail */

class ExceptionMethodDoesntExists extends ExceptionRoot {
  protected $statement_default = 'Żądana metoda (funkcja) nie istnieje w tej klasie.';
} /* Jeśli metoda danej klasy nie istnieje. */

class ExceptionEmailAlreadyExists extends ExceptionRoot
{
  protected $statement_default = 'Istnieje już w serwisie konto o podanym adresie e-mail. Jeśli zapomniałeś do niego hasła, skorzystaj z opcji `Przypomnij hasło`.';
} /* If account with the given email address already exists. */

class ExceptionEmailSend extends ExceptionRoot
{
  protected $statement_default = 'Wystąpił błąd podczas wysyłania wiadomości e-mail.';
} /* If there was an error while sending e-mail message. */

class ExceptionInvalidPassword extends ExceptionRoot {
  protected $statement_default = 'Wprowadzone hasło jest nieprawidłowe.';
} /* Jeśli hasło jest nieprawidłowe. */

class ExceptionPasswordTooShort extends ExceptionRoot {
  protected $statement_default = 'Wprowadzone hasło jest zbyt krótkie. Hasło powinno mieć przynajmniej 6 znaków.';
} /* Jeśli hasło jest nieprawidłowe. */

class ExceptionPasswordsAreIdentical extends ExceptionRoot {
  protected $statement_default = 'Nowe hasło musi różnić się od obecnego.';
} /* Jeśli hasła: nowe i obecne są takie same. */

class ExceptionEmailFormatInvalid extends ExceptionRoot
{
  protected $statement_default = 'Wprowadzony adres e-mail ma nieprawidłowy format.';
} /* If email field has Invalid format */

class ExceptionLoginFormatInvalid extends ExceptionRoot
{
  protected $statement_default = 'Pole Login ma nieprawidłowy format. Login powinien być dłuższy niż 3 znaki i nie zawierać w sobie znaków specjalnych (tylko litery i cyfry).';
} /* If login field has Invalid format */

class ExceptionPasswordsDoesntMatch extends ExceptionRoot {
  protected $statement_default = 'Podane hasła nie zgadzają się ze sobą.';
} /* Jeśli hasło i potwierdzenie hasła do siebie nie pasują. */

class ExceptionFieldCantBeEmpty extends ExceptionRoot
{
  protected $statement_default = 'Pole nie może pozostać puste.';
} /* If field is empty */

class ExceptionLoginCantBeEmpty extends ExceptionFieldCantBeEmpty
{
  protected $statement_default = 'Pole Login nie może pozostać puste.';
} /* If login field is empty */

class ExceptionEmailCantBeEmpty extends ExceptionFieldCantBeEmpty
{
  protected $statement_default = 'Pole E-mail nie może pozostać puste.';
} /* If email field is empty */

class ExceptionPasswordCantBeEmpty extends ExceptionFieldCantBeEmpty
{
  protected $statement_default = 'Pole Hasło nie może pozostać puste.';
} /* If password field is empty */



?>