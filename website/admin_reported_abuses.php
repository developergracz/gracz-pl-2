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

      <h1>Zgłoszone nadużycia</h1>
      <p>Lista nadużyć zgłoszonych przez użytkowników.</p>
       
      <?php
        if ($_GET['delete_abuse_report'])
        {
          try{
            DeleteAbuseReport($_GET['delete_abuse_report'], $_GET['token']);
            echo('<span class="positive">Zgłoszenie zostało pomyślnie usunięte.</span>');
          }catch(Exception $e)
          {
            echo($e);
          }
        }
        
        try{
          DisplayReportedAbuses();
        }catch(Exception $e)
        {
          echo($e);
        }
      
      ?>

      
      <br style="clear:both;" />
          
    </div>
  </div>
	
<?php include_once($footer); ?>