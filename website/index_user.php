<?php

echo('
  <div class="tlo_glowna">
');

?>

  <?php
  
    // Jeśli próba logowania nie powiodła się
    if (isset($_POST['buttonLogin']))
    {
      if ($_SESSION['account_type']<USER)
      {
        echo('<div class="negative">
          <p><strong>Podałeś błędny login lub hasło.</strong></p>
          <p>
          Proszę spróbować ponownie zalogować się z danymi jakie podałeś podczas rejestracji.
          Jeżeli zapomniałeś swojego loginu i/lub hasła skorzystaj z opcji <a href="'.$path['przypomnij_password'].'">Zapomnialem 
          loginu i hasła</a>.
          Wpisz swój adres e-mail, który podałeś podczas rejestracji. Jeśli będzie prawidłowy, na wskazany 
          adres prześlemy Ci Twój login i nowe hasło.
          </p>
          <p>
          Jeśli podane powyżej czynności nie pomogły w rozwiązaniu problemu, napisz do nas w tej sprawie korzystajac z poniższego formularza kontaktowego.
          </p>

          <a href="#" onclick="otworzFormularzKontaktowy(this); return false;">Otworz formularz kontaktowy.</a>
          
          ');
          
          WyswietlFormularzKontaktowy('formularz_kontaktowy',$_POST['login']);
          
          echo('
          
          <script type="text/javascript">
            function otworzFormularzKontaktowy(ref)
            {
              jQuery("#formularz_kontaktowy").slideToggle("slow");
              jQuery(ref).hide("slow");
              jQuery("#formularz_kontaktowy textarea").focus();
            }
            
            jQuery("#formularz_kontaktowy").hide();
          </script>
          
          
        </div>');
      }
    }
    
    GryWyswietlNajpopularniejsze(4);      
    
    
  ?>
  



<?php 
  echo('</div>');
?>
