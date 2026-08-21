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

      <h1>Ponowna aktywacja konta</h1>
      <p>Jeśli z jakiś przyczyn list z linkiem aktywującym konto nie dotarł do Ciebie, w tym miejscu możesz wysłać go ponownie. Przepraszamy za niedogodności.</p>
      
      <?php

      if (isset($_POST['email_resend']))
      {
        try
        {
          SendActivateMailToUserWithId(ZwrocIdKontaOEmail($_POST['email_resend']));
          echo('<h2>Gratulacje,</h2><p>został wysłany list z adresem aktywującym Twoje konto. Abyś mógł się zalogować, należy odwiedzić adres podany w liście jaki do Ciebie wysłaliśmy. <strong>Pamiętaj, że list mógł zostać przechwycony przez filtry reklamowe na Twojej poczcie - jeśli nie znajdziesz listu od nas w głównym folderze, pamiętaj aby sprawdzić pocztę w folderze SPAM twojego konta pocztowego.</strong><br /><br />Dziękujemy!</p>
          <br />');
        }catch(Exception $e)
        {
          echo($e);
        }
      }else
      {
        echo('
        <form method="post">
          <fieldset>
            <label for="email_resend">Wprowadź swój adres e-mail:</label>
            <input type="text" name="email_resend" id="email_resend" />
            <button type="submit">Wyślij ponownie list aktywujący konto</button>
          </fieldset>
        </form>
        ');
      }
      
      // Navigation links
      echo('<a href="'.$directory['base'].'index.php" class="button_normal">Powrót do strony głównej</a><a href="'.$path['login'].'" class="button_normal">Formularz logowania</a>');
      
      ?>
      <br style="clear:both;" />
    </div>
  </div>
  
<?php include_once($footer); ?>

