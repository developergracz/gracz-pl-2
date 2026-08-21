<?php include("variables_local.php"); include_once($header); ?>

<?php
  echo('
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
  ');

  try {
    ActivateAccount($_GET['id'], $_GET['kod']);
        
    echo('<h1>Aktywacja konta</h1>
    <div class="positive"><p>Gratulację, aktywacja konta powiodła się. Możesz się teraz zalogować.</p></div>
    ');
    SetAfterLoginRedirect($service_base_address);
    DisplayFormLogin(false);
  }catch (ExceptionRoot $e)
  {
    echo('
    <h1>Aktywacja konta</h1>
    '.$e.'
    <br />
    <a href="'.$service_base_address.'" class="button_normal">Strona główna</a>
    ');
    //<div class="uwaga">Podany klucz lub identyfikator użytkownika jest nieprawidłowy. Konto nie zostało aktywowane.</div>
    
  }

  
  echo('
      <br style="clear:both;" />
    </div>
  </div>
  ');
?>

<?php include_once($footer); ?>