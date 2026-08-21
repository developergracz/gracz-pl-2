<?php include("variables_local.php"); include_once($header); ?>

<?php
  //echo('<h1 style="text-align:center; color:red; background:white; padding:10pt; border-radius:10pt;">Przerwa techniczna, aktualizacja oprogramowanie serwera.<br />Serwis może być czasowo niedostępny.</h1>');


switch ($_SESSION['account_type'])
  {
   case ADMINISTRATOR : { include("index_user.php"); break; }
   case USER : { include("index_user.php"); break; }
   default : { include("index_nobody.php"); break; }
  }
?>

<?php include_once($footer); ?>