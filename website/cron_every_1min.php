<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

  <?php
    //fopen("logi/A".(rand(1,1000)),"w");
    echo('<h1>Skrypt cron`u wywoływany co 1 minut</h1>');
    try{
      changeUsersOnlineStatus();
      echo('<div>&bull; Zaktualizowano status online użytkowników.</div>');
    }catch(Exception $e)
    {
      echo $e;
    }
  ?>  

<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>