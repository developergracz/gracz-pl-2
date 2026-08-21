<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">



<?php

  echo('
  <h1>Panel administracyjny</h1>
  ');

  if ($_SESSION['account_type']>=ADMINISTRATOR)
  {
    echo('<ul class="admin_buttons">
      <li><a href="#statystyka">Statystyka</a></li>
      <li><a href="#smartfox_administration">Smartfox - administracja</a></li>
      <li><a href="#phpmyadmin_administration">PhpMyAdmin - edycja bazy danych</a></li>
      <li><a href="#nagios_monitor">Nagios - monitorowanie serwera</a></li>
      <!-- <li><a href="#news_add">Dodaj newsa</a></li>  -->
      <li><a href="#user_details">Szczegóły kont użytkowników</a></li>
      <li><a href="#user_block">Blokowanie użytkowników</a></li>
      <li><a href="#admin_change_password">Zmiana hasła konta administratora</a></li>
      <li><a href="#advertisement_management" class="redirect">Zarządzanie jednostkami reklamowymi</a></li>
      <li><a href="#code_paste_management" class="redirect">Zarządzanie kodami śledzenia/reklamowymi</a></li>
      <li><a href="#mailing" class="redirect">Masowy mailing</a></li>
      <li><a href="#bugs" class="redirect">Zgłoszone błędy</a></li>
      <li><a href="#abuse" class="redirect">Zgłoszone nadużycia</a></li>
      <li><a href="#last_visitors">Ostatni odwiedzający</a></li>
      <li><a href="#other_settings">Inne ustawienia</a></li>
    </ul>


    <script type="text/javascript">
    //<![CDATA[

    jQuery(function(){
      jQuery(".admin_buttons>li").click(function(){

        jQuery(".admin_buttons>li>a img").css("border","");
        var id=jQuery(this).find("a").attr("href").substr(jQuery(this).find("a").attr("href").indexOf("#"));

        // Jeśli w pojemniku o podanym ID jest element z klasą "bezposrednie_przekierowanie", to nie pokazujemy okienka, tylko bezpośrednio przekierowujemy użytkownika pod adres, który jest zawarty w elemencie oznaczonym tą klasą
        if (jQuery(id).find(".redirect").length>0)
        {
          location.href = jQuery(id).find(".redirect").attr("href");
          return;
        }

        // Tworzenie kopii okna, dopiero ta kopia jest używana w oknie Dialog (przy jego zamknięciu jest niszczona)
        var okno = jQuery("<div>");
        okno.html(jQuery(id).html());
        jQuery(okno).dialog({
          width: 600,
          title: "Administracja",
          closeText: "Zamknij",
          maxHeight: 700
        });
        jQuery(this).children("img").css("borderColor","red");
        jQuery(this).children("img").css("borderStyle","solid");
        jQuery(this).children("img").css("borderWidth","2px");
        return false;
      });
    });


    //]]>
    </script>

    ');

      echo('<div id="statystyka" class="admin_box">');
      $load = sys_getloadavg();
      $load[0] = 'Średnia z 1 ostatniej minuty: '.($load[0]*100).'%';
      $load[1] = 'Średnia z 5 ostatnich minut: '.($load[1]*100).'%';
      $load[2] = 'Średnia z 15 ostatnich minut: '.($load[2]*100).'%';
      echo('<strong>Obecne obciążenie serwera: </strong><br />'.implode('<br />', $load).'<br />');
      $stats = getServiceStatistics();
      echo('<strong>Ilość użytkowników online: </strong>'.$stats['number_of_online_users'].'<br />');
      echo('<strong>Ilość wszystkich użytkowników serwisu: </strong>'.$stats['number_of_all_users'].' (w tym kobiet: '.$stats['number_of_female_users'].', mężczyzn: '.$stats['number_of_male_users'].')<br />');
      echo('<strong>Ilość użytkowników aktywnych: </strong>'.$stats['number_of_active_users'].'<br />');
      echo('<strong>Ilość użytkowników nieaktywnych: </strong>'.($stats['number_of_all_users']-$stats['number_of_active_users']).'<br />');
      echo('<strong>Ilość użytkowników zablokowanych: </strong>'.$stats['number_of_blocked_users'].'<br />');
      echo('<strong>Ilość gier w serwisie: </strong>'.$stats['number_of_games'].'<br />');
      echo('<ul>');
      echo('<li><a href="'.$path['daily'].'">Dziennik zdarzeń</a></li>');
      //echo('<li><a href="'.$path['awstats'].'">Panel statystyk Awstats</a></li>');
      echo('<li><a href="'.$path['webalizer'].'">Panel statystyk Webalizer</a></li>');
      echo('</ul>');
      echo('</div>');


      if (isset($_POST['dodaj_newsa_ok']))
      {
        if (DodajNewsa($_SESSION['id'],$_POST['news_tytul'],$_POST['news_tresc']))
         {
          echo('<div class="positive">News został dodany pomyślnie.</div>');
         }else
        {
          echo('<div class="negative">Wystąpił błąd przy dodawaniu newsa.</div>');
        }
      }

      echo('<div id="smartfox_administration" class="admin_box">
      <h1>Administracja Smartfox</h1>
      <p>Zostaniesz przekierowany do panelu zarządzania serwerem Smartfox.</p>
      <a href="http://'.$_SERVER['SERVER_ADDR'].':8080/admin" class="redirect">Kliknij tutaj aby przejść do panelu zarzadzania serwerem Smartfox</a>
      </div>
      ');

      echo('<div id="phpmyadmin_administration" class="admin_box">
      <h1>Edycja bazy danych poprzez PhpMyAdmin</h1>
      <p>Zostaniesz przekierowany do panelu zarządzania bazą danych.</p>
      <a href="'.$path['phpmyadmin'].'" class="redirect">Kliknij tutaj aby przejść do panelu PhpMyAdmin</a>
      </div>
      ');

      echo('<div id="nagios_monitor" class="admin_box">
      <h1>Monitorowanie serwera przy pomocy Nagios</h1>
      <p>Zostaniesz przekierowany do panelu monitorowania serwera.</p>
      <a href="http://'.$_SERVER['SERVER_ADDR'].'/'.$path['nagios'].'" class="redirect">Kliknij tutaj aby przejść do panelu Nagios</a>
      </div>
      ');

      echo('<div id="news_add" class="admin_box">
      <h1>Dodaj newsa</h1>');
      echo('
      <form action="" method="post">
        <div>
        <label for="news_tytul">Tytuł nowości:</label><br />
        <input type="text" name="news_tytul" id="news_tytul" size="40" /><br />
        <label for="news_tresc">Treść nowości:</label><br />
          <textarea name="news_tresc" id="news_tresc" cols=40" rows="10" ></textarea><br />
        <input type="submit" name="dodaj_newsa_ok" value="Dodaj newsa" />
        </div>
      </form>

      ');

      echo('
      <a href="'.$path['news'].'">Zobacz wszystkie newsy</a> (umożliwia wgląd, edycję i usunięcie nowości)
      </div>
      ');

      echo('<div id="user_details" class="admin_box">
      <h1>Szczegółowe dane o użytkownikach</h1>');
      echo('<p>Administratorzy mają możliwość wglądu w pełne dane osobowe użytkowników. Aby uzyskać pełne informacje o danym użytkowniku, przejdź do jego profilu i kliknij link &quot;Pokaż pełne dane osobowe&quot;. Aby link był widoczny, konieczne jest posiadanie co najmniej uprawnień administracyjnych.</p>');
      echo('</div>');


      if(isset($_GET['unblock']))
      {
        if(BlockUnblockUser($_GET['unblock'], $_GET['token'], UNBLOCK))
        {
          echo('<div class="positive">Użytkownik o podanym adresie został odblokowany.</div>'."\r\n");
        }
      }

      if(isset($_GET['block']))
      {
        if(BlockUnblockUser($_GET['block'], $_GET['token'], BLOCK))
        {
          echo('<div class="positive">Użytkownik o podanym adresie został blocked.</div>'."\r\n");
        }
      }
      echo('<div id="user_block" class="admin_box">
      <h1>Zablokowanie dostępu dla określonego użytkownika</h1>');
      echo('<p>Aby zabronić użytkownikowi korzystania z serwisu, wpisz nazwę użytkownika lub jego adres IP, po czym kliknij link &quot;Zablokuj dostęp do serwisu&quot;<br />
      <form action="" method="get" style="float:left">
        <input type="text" name="block" />
        <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
        <button type="submit">Zablokuj</button>
      </form>
      <form action="" method="get" style="float:right">
        <input type="text" name="unblock" />
        <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
        <button type="submit">Odblokuj</button>
      </form>
      <br style="clear:both" />
      <br />

      Lista blokowanych dotychczas użytkowników znajduje się poniżej (jeśli tacy użytkownicy istnieją).</p>

      <div style="font-size:80%;">');
      try
      {
        DisplayBlockedUsers();
      }catch(Exception $e)
      {
        echo($e);
      }

      echo('
      </div>
      </div>');



    // Skrypt odbierający informacje o zmianie hasła administratora
    if (isset($_POST['ZmianaHaslaAdministratoraOK']))
    {
      try
      {
        AccountChangePassword($_SESSION['id'],
                        $_POST['password_old'],
                        $_POST['password_new'],
                        $_POST['password_new_confirm']);
        echo('<div class="positive">Operacja zmiany hasła konta powiodła się. Trwa wylogowywanie...</div>'."\r\n");
        RedirectJavaScript($path['passwordChanged']);
      }catch(Exception $e)
      {
        echo($e);
      }
    }
    echo('<div id="admin_change_password" class="admin_box">
    <h1>Zmiana hasła administratora</h1>');
    echo('
    <p>Aby zmienić hasło dla niniejszego konta administratora, wypełnij i zatwierdź poniższy formularz.</p>

    <div>
      <form method="post" action="">
        <div>
        <table summary="Zmiana hasła dla konta administratora">
          <caption>Zmiana hasła dla konta administratora</caption>
          <tbody>
            <tr><td>Stare hasło:</td><td><input type="password" name="password_old" size="26" /></td></tr>
            <tr><td>Nowe hasło:</td><td><input type="password" name="password_new" size="26" /></td></tr>
            <tr><td>Potwierdź nowe hasło:</td><td><input type="password" name="password_new_confirm" size="26" /></td></tr>
            <tr><td></td><td><button type="submit" style="vertical-align:middle;" name="ZmianaHaslaAdministratoraOK">Modyfikuj dane</button></td></tr>
          </tbody>
          </table>
      </div>
      </form>
    </div>
    ');
    echo('</div>');

    echo('<div id="advertisement_management" class="admin_box">
    <h1>Zarządzanie jednostkami reklamowymi</h1>');
    echo('<p>Aby przejść do modułu zarządzania powierzchnią reklamową kliknij poniższy link.</p>');
    echo('<a href="'.$path['advertisement_management'].'" class="redirect">Moduł zarządzania reklamami &gt;&gt;</a>');
    echo('</div>');

    echo('<div id="code_paste_management" class="admin_box">
    <h1>Zarządzanie kodami śledzenia i kodami reklamowymi</h1>');
    echo('<p>Aby przejść do modułu zarządzania kodami śledzenia lub kodami reklamowymi kliknij poniższy link.</p>');
    echo('<a href="'.$path['code_paste_management'].'" class="redirect">Moduł zarządzania kodami śledzenia/reklamowymi &gt;&gt;</a>');
    echo('</div>');

    echo('<div id="mailing" class="admin_box">
    <h1>Masowe wysyłanie poczty</h1>');
    echo('<p>Aby przejść do modułu masowego wysyłania poczty do użytkowników serwisu, kliknij poniższy link.</p>');
    echo('<a href="'.$path['mailing'].'" class="redirect">Moduł masowego wysyłania poczty do użytkowników &gt;&gt;</a>');
    echo('</div>');

    echo('<div id="bugs" class="admin_box">
    <h1>Zgłoszenia nadużyć</h1>');
    echo('<a href="'.$path['admin_reported_bugs'].'" class="redirect">Przejdź do modułu zgłoszonych błędów</a>');
    echo('</div>');

    echo('<div id="abuse" class="admin_box">
    <h1>Zgłoszenia nadużyć</h1>');
    echo('<a href="'.$path['admin_reported_abuses'].'" class="redirect">Przejdź do modułu zgłoszonych nadużyć</a>');
    echo('</div>');

    echo('<div id="last_visitors" class="admin_box">
    <h1>Adresy dziesięciu ostatnich użytkowników</h1>');
    WypiszOstatnieAdresyIP(10);
    echo('</div>');

    echo('<div id="other_settings" class="admin_box">
    <h1>Inne opcje i ustawienia zaawansowane</h1>');
    echo('<p>Inne opcje, ustawienia zaawansowane, opcje instalacyjne są zapisywane podczas instalacji do pliku &quot;variables_global.php&quot;. Aby zmienić te właściwości należy wyedytować ten plik i zapisać go na serwerze.</p>');
    echo('</div>');

  }else{

    echo('<div class="negative">Nie posiadasz wystarczających uprawnień do zobaczenia zawartości tej strony.</div>');

  }


  ?>


    <br style="clear:both;" />
    </div>

  </div>

<?php include_once($footer); ?>