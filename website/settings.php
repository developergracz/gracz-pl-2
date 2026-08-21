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
        if ($_SESSION['account_type']<USER)
        {
          echo('<div class="warning">Zaloguj się aby zmienić ustawienia profilu.</div>');
        }else
        {
          echo('
          <h1>Ustawienia konta</h1>

          <form id="FormChangePassword" method="post" style="position:relative; top:-40px; float:right; width:30%;" onsubmit="if (this.password_old.value.length==0) { MessageBox(\'Wymagane hasło\',\'Proszę wprowadzić aktualne hasło aby autoryzować jego zmianę.\', false, function () { document.forms.FormChangePassword.password_old.focus(); }); return false; }">
            <h2>Zmiana hasła:</h2>
            ');

            try
            {
              if (isset($_POST['buttonChangePassword']))
              {
                AccountChangePassword(
                  $_SESSION['id'],
                  $_POST['password_old'],
                  $_POST['password_new'],
                  $_POST['password_new_confirm']
                );
                echo('<div class="positive">Hasło zostało zmienione. Trwa wylogowywanie...</div>');
                RedirectJavaScript($path['passwordChanged']);
              }
            }catch(ExceptionRoot $e)
            {
              echo($e);
            }

            echo('
            <label for="password_old">Aktualne hasło:</label><br />
            <input type="password" name="password_old" id="password_old" value="" />
            <br /><br />
            <label for="password_new">Nowe hasło:</label><br />
            <small>Powinno mieć przynajmniej '.$minimal_password_length.' znaków.</small>
            <br />
            <input type="password" name="password_new" id="password_new" value="" />
            <br /><br />
            <label for="password_new_confirm">Potwierdź nowe hasło:</label><br />
            <input type="password" name="password_new_confirm" id="password_new_confirm" value="" />
            <br /><br />
            <button type="submit" name="buttonChangePassword">Zmień hasło</button>
          </form>

          <form method="post" class="uniform_labels editProfile" onsubmit="if (this.password.value.length==0) { MessageBox(\'Wymagane hasło\',\'Proszę wprowadzić aktualne hasło aby autoryzować aktualizację profilu.\'); return false; }">
            ');

            try
            {
              if (isset($_POST['buttonSaveAccountInformation']))
              {
                $email_zmieniony = ($_SESSION['profile']['email']!=$_POST['email']);

                UpdateUserProfile(
                  $_POST['token'],
                  $_POST['email'],
                  $_POST['password'],
                  $_POST['name'],
                  $_POST['surname'],
                  $_POST['sex']
                );
                echo('<div class="positive">Pomyślnie zapisano ustawienia profilu.</div>');
                if ($email_zmieniony)
                  echo('<div class="warning">Zmieniłeś adres e-mail. Musisz teraz aktywować nowy adres e-mail, aby móc korzystać z konta. Na podany przez Ciebie adres e-mail został wysłany list z linkiem aktywującym konto. Kliknij go, aby potwierdzić swój nowy adres e-mail. W razie problemów - jesteśmy <a href="'.$path['contact'].'">do dyspozycji</a>.</div>');
              }
            }catch(ExceptionRoot $e)
            {
              echo($e);
            }
            echo('
            <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
            <label for="email">E-mail:</label>
            <input type="email" name="email" id="email" value="'.$_SESSION['profile']['email'].'" />
            <br /><br />
            <label for="password">Aktualne hasło:<br /><small>Aktualne hasło jest wymagane, aby dodatkowo autoryzować nowo wprowadzone dane.</small></label>
            <input type="password" name="password" id="password" value="" />
            <br /><br />
            <label for="name">Imię:</label>
            <input type="text" name="name" id="name" value="'.$_SESSION['profile']['name'].'" />
            <br /><br />
            <label for="surname">Nazwisko:</label>
            <input type="text" name="surname" id="surname" value="'.$_SESSION['profile']['surname'].'" />
            <br /><br />
            <label for="sex">Płeć:</label>
            <select name="sex" id="sex">
              <option value="'.SEX_FEMALE.'" '.($_SESSION['profile']['sex']==SEX_FEMALE?'selected="selected"':'').'>kobieta</option>
              <option value="'.SEX_MALE.'" '.($_SESSION['profile']['sex']==SEX_MALE?'selected="selected"':'').'>mężczyzna</option>
            </select>
            <br /><br />
            <button type="submit" name="buttonSaveAccountInformation">Zapisz wszystko</button>
          </form>
          <br style="clear:both" />
          ');
        }
      ?>


    </div>
  </div>

<?php include_once($footer); ?>