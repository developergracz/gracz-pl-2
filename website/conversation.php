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
        $conversationLogin = isset($_GET['conversation_login']) ? $_GET['conversation_login'] : '';
        if ($conversationLogin !== '' && $conversationLogin !== (isset($_SESSION['login']) ? $_SESSION['login'] : ''))
        {
          $userData = getUserDataFromLogin($conversationLogin);
          $safeLogin = htmlspecialchars($userData['login'], ENT_QUOTES, 'UTF-8');
          $safeProfileUrl = htmlspecialchars($path['profile'].'-'.rawurlencode($userData['login']), ENT_QUOTES, 'UTF-8');
          $safeUserId = intval($userData['id']);

          echo('
          <h1>Obecnie prowadzisz rozmowę z graczem <a href="'.$safeProfileUrl.'">'.$safeLogin.'</a> </h1>

          <form action="./" id="conversation_form">
            <div id="conversation_talk">
              <div class="loader"><img src="'.htmlspecialchars($directory['design'].'loader.gif', ENT_QUOTES, 'UTF-8').'" alt="" /><br />Ładowanie konwersacji.<br /><progress id="progress_downloaded_messages" value="1" max="100">Proszę czekać...</progress></div>
            </div><br />

            <div id="conversation_status_new_messages"><img src="'.htmlspecialchars($directory['design'].'icon_message.png', ENT_QUOTES, 'UTF-8').'" style="vertical-align:middle; padding-right:5px;" alt="" /> Są nowe, nieprzeczytane wiadomości...</div>

            <input type="text" name="conversation_message" id="conversation_message" maxlength="1024" size="105" data-id_interlocutor="'.$safeUserId.'" />
            <button type="submit">Wyślij</button><br />

            <span id="showDesktopNotifications"><input type="checkbox" name="showDesktopNotificationsCheckbox" id="showDesktopNotificationsCheckbox" '.($_SESSION['show_desktop_notifications']==1?'checked':'').' /><label for="showDesktopNotificationsCheckbox">Pokazuj powiadomienia na pulpicie</label></span><br />

            <span id="muteSoundNotifications"><input type="checkbox" name="muteSoundNotificationsCheckbox" id="muteSoundNotificationsCheckbox" '.($_SESSION['play_new_message_sound']==0?'checked':'').' /><label for="muteSoundNotificationsCheckbox">Wycisz dźwięki powiadomienia</label></span><br />

            <div id="conversation_status_sending"><img src="'.htmlspecialchars($directory['design'].'loader_2.gif', ENT_QUOTES, 'UTF-8').'" alt="" /> Wysyłanie wiadomości...</div>
            <div id="conversation_status_error"><img src="'.htmlspecialchars($directory['design'].'icon_error.png', ENT_QUOTES, 'UTF-8').'" alt="" /> <span></span></div>
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

        <a href="'.htmlspecialchars($service_base_address, ENT_QUOTES, 'UTF-8').'" class="button_normal">Strona główna</a>
        <a href="'.htmlspecialchars($path['profile'], ENT_QUOTES, 'UTF-8').'" class="button_normal">Twój profil</a>
        ');
      }catch(Exception $e)
      {
        echo(htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
      }

      ?>

      <br style="clear:both;" />

    </div>
  </div>

<?php include_once($footer); ?>