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
      try
      {
        if (isset($_REQUEST['conversation_login'])&&($_REQUEST['conversation_login']!=$_SESSION['login']))
        {

          $userData = getUserDataFromLogin($_REQUEST['conversation_login']);

          echo('
          <h1>Obecnie prowadzisz rozmowę z graczem <a href="'.$path['profile'].'-'.$userData['login'].'">'.$userData['login'].'</a> </h1>

          <form action="./" id="conversation_form">
            <div id="conversation_talk">
              <div class="loader"><img src="'.$directory['design'].'loader.gif" /><br />Ładowanie konwersacji.<br /><progress id="progress_downloaded_messages" value="1" max="100">Proszę czekać...</progress></div>
            </div><br />

            <div id="conversation_status_new_messages"><img src="'.$directory['design'].'icon_message.png" style="vertical-align:middle; padding-right:5px; " /> Są nowe, nieprzeczytane wiadomości...</div>

            <input type="text" name="conversation_message" id="conversation_message" maxlength="1024" size="105" data-id_interlocutor="'.$userData['id'].'" />
            <button type="submit">Wyślij</button><br />

            <span id="showDesktopNotifications"><input type="checkbox" name="showDesktopNotificationsCheckbox" id="showDesktopNotificationsCheckbox" '.($_SESSION['show_desktop_notifications']==1?'checked':'').' /><label for="showDesktopNotificationsCheckbox">Pokazuj powiadomienia na pulpicie</label></span><br />

            <span id="muteSoundNotifications"><input type="checkbox" name="muteSoundNotificationsCheckbox" id="muteSoundNotificationsCheckbox" '.($_SESSION['play_new_message_sound']==0?'checked':'').' /><label for="muteSoundNotificationsCheckbox">Wycisz dźwięki powiadomienia</label></span><br />

            <div id="conversation_status_sending"><img src="'.$directory['design'].'loader_2.gif" /> Wysyłanie wiadomości...</div>
            <div id="conversation_status_error"><img src="'.$directory['design'].'icon_error.png" /> <span></span></div>
          </form>
          ');
        }else{
          echo('<div class="warning">Login użytkownika, z którym konwersacje chcesz zobaczyć nie został prawidłowo podany.</div>');
        }

      }catch(ExceptionAccessDenied $e)
      {
        echo('Zaloguj się, aby móc rozmawiać na czacie z innymi graczami.');
      }catch(ExceptionNoResults $e)
      {
        echo('
        <h1>Wystąpił błąd</h1>
        Brak graczy o podanej nazwie.<br />
        <br />
        <details>
          Najprawdopodobniej wpisałeś złą nazwę gracza z którym chcesz rozmawiać.
        </details>
        <br /><br />

        <a href="'.$service_base_address.'" class="button_normal">Strona główna</a>
        <a href="'.$path['profile'].'" class="button_normal">Twój profil</a>
        ');
      }catch(Exception $e)
      {
        echo($e);
      }

      ?>


      <br style="clear:both;" />

    </div>
  </div>

<?php include_once($footer); ?>