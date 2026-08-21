<?php
/**
 * Strona wylogowania
 *
 * Po wejściu na nią, użytkownik zostaje automatycznie wylogowany.
 */
include("variables_local.php"); include_once($header); ?>


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
        $login = $_SESSION['login'];
        
        if (Logout())
        {	
          // Zmienna $nazwa_typu_konta jest obecnie nieużywana
          echo('
            <h1 class="positive">Wylogowałeś się poprawnie</h1>

         
            <div style="margin-left:50pt; margin-bottom:50pt;">
            <p>Dziękujemy Ci, '.$login.', za skorzystanie z naszego serwisu.</p>

            <p>Mamy nadzieje, że dobrze się bawiłeś! Zapraszamy ponownie.</p>

            <a href="'.$directory['base'].'index.php">Zaloguj sie ponownie</a>
            </div>

          ');
        }else
        {
          echo('
          <div class="uwaga">Nie możesz się wylogować, ponieważ nie zalogowałeś się do tej pory ;)</div>
          ');
        }
      	
      	
        RedirectJavaScript($service_base_address,3);   
      ?>
    </div>
  </div>

<?php include_once($footer); ?>