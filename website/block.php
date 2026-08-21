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

        <h1>Zablokowani użytkownicy</h1>
        
        <?php
          try{
            DisplayUserBlackList();
          }catch(Exception $e)
          {
            echo($e);
          }
        
        
          echo('<br /><br /><a href="'.$service_base_address.'" class="button_normal">Strona główna</a> 
          <a href="'.$path['profile'].'" class="button_normal">Twój profil</a>');
        ?>
        
    </div>
  </div>
	
<?php include_once($footer); ?>