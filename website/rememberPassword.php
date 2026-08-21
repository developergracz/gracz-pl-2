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
      <h1>Przypomnij hasło</h1>
       <?php
    	
      if (isset($_GET['id_account']))
    	{
        if(AccountActivateGeneratedPassword($_GET['id_account'], $_GET['activation_code']))
    		{
          echo('<div class="positive">Twoje nowe (wygenerowane) hasło zostało aktywowane. Prosimy zmień je na takie które będziesz pamiętał - możesz to zrobić <a href="'.$path['account_settings'].'">tutaj</a></div>');
    		}else
    		{
    		  echo('<div class="negative">Wystapił błąd przy próbie aktywacji nowego (wygenerowanego) hasła.</div>');		
    		}
    	}
    	

      if (isset($_POST['email']))
      {	
        if(AccountSendNewGeneratedPassword($_POST['email']))
    	 {
         echo("<p>Gratulacje, nowe hasło zostało wygenerowane i wysłane na podany adres e-mail.</p><p><a href=\"".$directory['base']."index.php\">&bull; Powrót do strony głównej</a></p>");
    	 }else
    	 {
    		 echo('<div class="negative">Wystąpił błąd podczas próby wygenerowania nowego hasła. Być może podałeś nieprawidłowy adres e-mail? Sprawdź poprawność danych i spróbuj ponownie.</div>');
    	 }		
      }else if (!isset($_REQUEST['activation_code']))
      {
        echo('
        <p>Aby wygenerować nowe hasło dla swojego konta, wpisz poniżej swój adres e-mail podany podczas rejestracji konta po czym kliknij przycisk &quot;Wyślij mi nowe hasło&quot;. Po tej operacji nowe hasło zostanie Ci dostarczone poprzez pocztę elektroniczną na podany adres e-mail.</p>	

        <form action="" method="post">
    	   <div>
           <label for="email">Wprowadź swój adres e-mail:</label>
    	     <input type="text" name="email" id="email" />
           <button type="submit">Wyślij mi nowe hasło</button>
    		</div>
    	 </form>
    	 ');
      }
      
      ?>
	
    </div>
  </div>

<?php include_once($footer); ?>