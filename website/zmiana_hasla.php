<?php include("variables_local.php"); include_once($header); ?>

<?php

  echo('
  <div class="panel_lewy">
  ');

    WyswietlLewyPanel($_SESSION['account_type']);

  echo('
  </div>
  ');


if ($_SESSION['account_type'] != USER)
{

  echo('
  <div class="tresc">
    <div class="uwaga">Nie zalogowałeś się do tej pory. Jedynie zalogowani użytkownicy mają dostęp do tej strony.</div>
  </div>
  ');

}else
{
  echo('
  <div class="tresc">

  <h1>Zmiana Twojego hasła</h1>
  <h4>Poniższy formularz pozwoli Ci zmienić hasło Twojego konta.</h4>
  ');

  if (isset($_POST['stare_password']))
  {
    try
    {
      AccountChangePassword($_SESSION['id'],$_POST['old_password'],$_POST['new_password'], $_POST['new_password_confirm']))
      echo('<div class="positive">Gratulacje, zmiana hasła powiodła się.</div>');
      RedirectJavaScript($service_base_address, 1);
    }catch(Exception $e)
    {
      echo($e);
    }
  }

  echo('
  <form action="" method="post" class="formularz_wyrownany">
    <fieldset>
      <label for="old_password">Stare hasło: </label>
      <input type="password" name="old_password" id="old_password" /><br />
      <label for="new_password">Nowe hasło: <br /><small>Powinno mieć przynajmniej '.$minimal_password_length.' znaków.</small></label>
      <input type="password" name="new_password" id="new_password" /><br />
      <label for="new_password_confirm">Powtórz nowe hasło: </label>
      <input type="password" name="new_password_confirm" id="new_password_confirm" /><br />

      <input type="submit" name="nowe_password_OK" value="Zmień hasło" />
    </fieldset>
  </form>

  </div>
  ');

}

?>

<?php include_once($footer); ?>