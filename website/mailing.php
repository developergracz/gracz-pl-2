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

      <h1>Masowy mailing</h1>
      <p>Spis adresów e-mail użytkowników serwisu</p>
      
      <?php
        echo('<img src="'.$directory['design'].'mailing_help.png" alt="Mailing help" />');
        
        try{
          echo('<h4>Lista adresów do wklejenia</h4>');
          DisplayUsersEmailsList();
        }catch(Exception $e)
        {
          echo($e);
        }      

        echo('
        <br /><br /><a href="'.$path['admin_panel'].'" class="button_normal">Powrót do panelu administracyjnego</a>');
      ?>
              
      <br style="clear:both;" />
          
    </div>
  </div>
	
<?php include_once($footer); ?>