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
        try{
          $row = getUserDataFromLogin($_REQUEST['profile_login']);
          echo('
          <h1>Profil '.$row['login'].'</h1>
          ');

          // If the user visit he's own profile
          if ($_SESSION['id'] == $row['id'])
          {  // if user views his own profile
            echo('

            <div class="column_4">
              <h4>Dane personalne</h4>
                <h5>Imię</h5>
                <span class="profile_field">'.$row['name'].'</span>
                <h5>Nazwisko</h5>
                <span class="profile_field">'.$row['surname'].'</span>
            </div>

            <div class="column_4">
              <h4>Użytkownik</h4>
                <h5>Nazwa użytkownika</h5>
                <span class="profile_field"><img src="'.$directory['design'].'users.png" alt="" /> '.$row['login'].'</span>
                <h5>Płeć</h5>
                <span class="profile_field">'.($row['sex']==SEX_MALE?'mężczyzna':'kobieta').'</span>
            </div>

            <div class="column_4">
              <h4>Twój adres e-mail</h4>
                <h5>Adres e-mail</h5>
                <span class="profile_field">'.$row['email'].'</span>
            </div>

            <!--
            <div class="column_4">
              <h4>Komunikator</h4>
                <h5>Numer GG</h5>
                <span class="profile_field"><a href="gg:'.$row['gg_number'].'" title="Napisz do użytkownika na GG">
                  <img src="http://status.gadu-gadu.pl/users/status.asp?id='.$row['gg_number'].'" />'.$row['gg_number'].'</span>
                </a>
            </div>
            -->
            <!--
            <a href="'.$path['profile_edit'].'" class="button_normal" style="margin-top:20pt; margin-right:15pt; float:right;">Edytuj profil</a><br /><br style="clear:both" />
            -->

            <br /><br />
            ');
          }else
          { // if the user views other user profile
            $interval = ((new DateTime())->getTimestamp() - (new DateTime($row['date_last_visit']))->getTimestamp())/60.0;

            $is_avaiable = $interval<$player_active_state_time_period;

            echo('
            <a href="'.$path['conversation'].'-'.$row['login'].'" id="conversationWithUserButton" class="button_'.($is_avaiable?'hot':'normal').'">Rozmowa</a>

            <div class="column_4" style="float:left;">
              <h4>Użytkownik</h4>
                <h5>Nazwa użytkownika</h5>
                <span class="profile_field"><img src="'.$directory['design'].'users.png" alt="" /> '.$row['login'].'</span>
                <h5>Płeć</h5>
                <span class="profile_field">'.($row['sex']==SEX_MALE?'mężczyzna':'kobieta').'</span>
            ');

            echo('<h5>Znajomi</h5>');
            if (IsFriendship($row['id']))
            {
              echo('
                <a href="#" class="button_hot small friends" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Usuń ze znajomych</a>
              ');
            }else{
              echo('
                <a href="#" class="button_normal small friends" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Dodaj do znajomych</a>
              ');
            }

            echo('<h5>Zablokowany</h5>');
            if (IsInUserBlacklist($row['id']))
            {
              echo('
                <a href="#" class="button_hot small blacklist" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Odblokuj</a>
              ');
            }else{
              echo('
                <a href="#" class="button_normal small blacklist" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Zablokuj</a>
              ');
            }


            // If the user is administrative user, he have access to full user's personal data
            if ($_SESSION['account_type'] >= ADMINISTRATOR)
            {
              echo('
              <br /><br /><a href="#" onclick="jQuery(\'#secret_personal_info\').slideToggle(); return false;">Pokaż pełne dane osobowe</a>
              <div id="secret_personal_info" style="display:none">
              <h5>Identyfikator</h5>
              <span class="profile_field">#'.$row['id'].'</span>
              <h5>Imię</h5>
              <span class="profile_field">'.$row['name'].'</span>
              <h5>Nazwisko</h5>
              <span class="profile_field">'.$row['surname'].'</span>
              <h5>Adres e-mail</h5>
              <span class="profile_field"><a href="mailto:'.$row['email'].'">'.$row['email'].'</a></span>
              <h5>Ostatni adres IP</h5>
              <span class="profile_field"><a href="https://who.is/whois-ip/ip-address/'.$row['IP'].'" target="_blank">'.$row['IP'].'</a></span>
              <h5>Konto aktywowane?</h5>
              <span class="profile_field">'.($row['active']==1?'tak':'nie').'</span>
              <h5>Konto zablokowane?</h5>
              <span class="profile_field">'.($row['blocked']==1?'tak':'nie').'</span>
              <h5>Konto zarejestrowane przez Facebook?</h5>
              <span class="profile_field">'.($row['id_facebook']!=''?'tak':'nie').'</span>
              <h5>Data ostatniej wizyty</h5>
              <span class="profile_field">'.$row['date_last_visit'].'</span>
              <h5>Data ostatniego logowania</h5>
              <span class="profile_field">'.$row['date_last_login'].'</span>
              <h5>Data rejestracji</h5>
              <span class="profile_field">'.$row['date_register'].'</span>
              <h5>Kod aktywujący</h5>
              <span class="profile_field">'.$row['activation_code'].'<br /><a href="'.$path['activate_account'].'?id='.$row['id'].'&amp;kod='.$row['activation_code'].'">Aktywuj to konto ręcznie</a></span>
              </div>
              ');

            }


            echo('
            </div>
            ');

          }

          echo('
          <div id="tabs_profile" class="'.($_SESSION['id'] == $row['id']?'':'window_at_right').'" >
            <ul>
              <li><a href="#tabs_profile_information">Informacje</a></li>
              <li><a href="#tabs_profile_opponents">Przeciwnicy</a></li>
              <li><a href="#tabs_profile_plays">Rozgrywki</a></li>
              <li><a href="#tabs_profile_friends">Znajomi</a></li>
          ');
          // If user visit his own profile, then we show some additional tabs
          if ($_SESSION['id'] == $row['id'])
          {
            echo('<li><a href="#tabs_profile_blacklist">Czarna lista</a></li>');
            echo('<li><a href="#tabs_profile_last_interlocutors">Ostatnie rozmowy</a></li>');

            echo('<li style="float:right;" onclick="location.href=\''.$path['account_settings'].'\'; return false;"><a href="">Ustawienia konta</a></li>');
          }
          echo('
            </ul>
          ');


          echo('
            <div id="tabs_profile_information">
          ');
          if ($row['last_seen']==0) $last_seen = 'Przed sekundką';
          if ($row['last_seen']>0) $last_seen = round($row['last_seen']).' sekund temu';
          if ($row['last_seen']>60) $last_seen = round($row['last_seen']/60).' minut temu';
          if ($row['last_seen']>3600) $last_seen = round($row['last_seen']/3600).' godzin temu';
          if ($row['last_seen']>3600*24) $last_seen = round($row['last_seen']/3600.0/24.0).' dni temu';
          if ($row['last_seen']>31536000) $last_seen = round($row['last_seen']/31536000).' lat temu';

          if ($row['plays_count']>0)
            $procent_wygranych = round((100*$row['won'])/$row['plays_count'],1);
          else
            $procent_wygranych = 0;

          if ($row['ranking_pos']=='') $row['ranking_pos'] = 'Użytkownik nie rozegrał jeszcze ani jednej partii.';
          $row['scores_sum'] = intval($row['scores_sum']);
          $row['won'] = intval($row['won']);
          $row['plays_count'] = intval($row['plays_count']);
          $row['lost'] = intval($row['lost']);

          $HTML_crown = ' <img src="'.$directory['design'].'icon_crown.png" alt="1 miejsce" title="Tytuł najlepszego gracza" style="vertical-align:middle" />';

          echo('
          <table style="margin:15pt;">
            <tr><td>Miejsce w rankingu</td><td>'.$row['ranking_pos'].($row['ranking_pos']==1?$HTML_crown:'').'</td></tr>
            <tr><td>Punktacja</td><td>'.$row['scores_sum'].' pkt.</td></tr>
            <tr><td>Ilość rozgrywek</td><td>'.$row['plays_count'].'</td></tr>
            <tr><td class="indent">w tym wygranych</td><td>'.$row['won'].' ('.$procent_wygranych.'%)</td></tr>
            <tr><td class="indent">w tyn przegranych</td><td>'.$row['lost'].'</td></tr>
            <tr><td>Ostatnio widziany</td><td>'.$last_seen.' (czas przybliżony)</td></tr>
            <tr><td>Data rejestracji</td><td>'.$row['date_register'].'</td></tr>
          </table>
          ');
          echo('
            </div>

            <div id="tabs_profile_opponents">
            ');
            try{
              $opponents = getUserOpponents($_REQUEST['profile_login']);

              echo('Ilość dotychczasowych rywali: '.count($opponents).'<br /><br />');
              foreach($opponents as $opponent)
              {
                echo('<a href="'.$path['profile'].'-'.$opponent['login'].'" title="Ostatni bój stoczony '.$opponent['date'].'">'.$opponent['login'].'</a>');
                if (end($opponents)!=$opponent)
                  echo(', ');
              }

            }catch(ExceptionNoResults $e) {
              echo('<div class="information">Jak na razie nie masz żadnych rywali.</div>');

              echo('<blockquote>Siłę człowieka mierzy się ilością jego wrogów.<br />
              ~Władysław Stanisław Reymont
              </blockquote>');
            }catch(Exception $e) {
              echo($e);
            }


            echo('
            </div>

            <div id="tabs_profile_plays">

            ');

            try{
              $playsList = getPlaysList($_REQUEST['profile_login']);
              echo('
              <table>
                <thead>
                  <tr><th>Gra</th><th>Przeciwnik</th><th>Data rozpoczęcia/zakończonej rozgrywki</th><th>Przegrana/Wygrana</th></tr>
                </thead>
                <tbody>
              ');
              foreach($playsList as $playListPosition)
              {
                echo('<tr><td><a href="'.$path['games'].'?id_category='.$playListPosition['id_game_category'].'&amp;id_game='.$playListPosition['id_game'].'">'.$playListPosition['title'].'</a></td><td><a href="'.$path['profile'].'-'.$playListPosition['login'].'">'.$playListPosition['login'].'</a></td><td>Rozpoczęto: '.$playListPosition['date_gameplay_started'].'<br />Zakończono: '.$playListPosition['date_gameplay_ended'].'<br />
                <img src="'.$directory['design'].'icon_clock.png" style="vertical-align:-10%; opacity:0.5; " /> Czas trwania: '.(round($playListPosition['gameplay_duration']/60)).' min. '.($playListPosition['gameplay_duration']%60).' sek. </td><td>'.($playListPosition['score']>0?'przegrana':'wygrana').'<br /><a href="#" onclick="displayGameplayMovesWindow('.$playListPosition['id_gameplay'].'); return false;">Zobacz zapis z gry</a></td></tr>');
              }

              echo('
              <script type="text/javascript">

                function displayGameplayMovesWindow(id_gameplay)
                {
                  var gameplayMovesWindow = jQuery(\'<div class="gameplayMovesWindow"></div>\');
                  gameplayMovesWindow.load("'.$path['ajaxGameplayMovesWindow'].'?id_gameplay="+id_gameplay);

                  gameplayMovesWindow.dialog({
                    title: "Zapis rozgrywki #"+id_gameplay,
                    closeText: "Zamknij",
                    width: "50%",
                    minWidth: 250,
                    height: 410,
                    minHeight: 410
                  });
                }
              </script>
              ');



            }catch(ExceptionNoResults $e) {
              echo('<div class="information">Póki co brak listy rozgrywek. Zagraj w coś, a lista zacznie się wydłużać.</div>');
            }catch(Exception $e) { echo($e); }


            echo('
                </tbody>
              </table>

            </div>


            <div id="tabs_profile_friends">
              ');

            try{
              DisplayFriendList($row['id']);
            }catch(ExceptionNoResults $e) {
              echo('<div class="information">Brak znajomych.</div>');
            }catch(Exception $e) { echo($e); }

              echo('
            </div>
            ');

          // If user visit his own profile, then we show some additional tabs
          if ($_SESSION['id'] == $row['id'])
          {
            echo('
            <div id="tabs_profile_blacklist">
              ');
            try{
              DisplayUserBlackList();
            }catch(Exception $e)
            {
              echo($e);
            }
            echo('
            </div>
            ');

            $default_text = 'Wpisz nazwę gracza z którym chcesz rozmawiać';
            echo('
            <div id="tabs_profile_last_interlocutors">
              <form action="" class="form_new_conversation">
                <input type="text" name="conversation_interlocutor" value="'.$default_text.'" data-default_value="'.$default_text.'" size="50" />
                <button type="submit">Rozpocznij rozmowę</button>
              </form>

              <h3>Twoi ostatni rozmówcy</h3>
              <details>Na liście wyświetlane są jedynie nazwy graczy do których wysłałeś choć jedną wiadomość.</details>
              ');
            try{
              DisplayMyLastInterlocutors();
            }catch(Exception $e)
            {
              echo($e);
            }
            echo('
            </div>
            ');
          }

          echo('
          </div>
          <br style="clear:both" />

          <div style="text-align:right">Oglądnij również <a href="'.$path['statistics'].'">statystyki serwisu</a>.</div>

          <script type="text/javascript">
            jQuery("#tabs_profile").tabs();
          </script>
          ');

        }catch(ExceptionNoResults $e)
        {

        }catch(ExceptionAccessDenied $e)
        {
          echo('<div class="warning">Nie masz uprawnień do przeglądania tej podstrony. <a href="'.$path['login'].'">Zaloguj się</a>, aby móc ją przeglądać.</div><br />');
        }catch(Exception $e)
        {
          echo($e);
        }

        echo('
    </div>
  </div>
  ');
  ?>

<?php include_once($footer); ?>