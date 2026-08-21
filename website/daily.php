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

      <div>
        <h1>Dziennik zdarzeń</h1>
        <p>Pokazuje ostatnie zdarzenia systemowe.</p>
        
        <?php
        try
        {
          DailyDisplay();
        }catch(Exception $e)
        {
          echo($e);
        }
        
        echo('<br /><br /><a href="'.$path['admin_panel'].'" class="button_normal">Powrót do panelu administracyjnego</a>');

        ?>
                
      </div>

      <br style="clear:both;" />
          
    </div>
  </div>
	
<?php include_once($footer); ?>