<?php include("variables_local.php"); include_once($header); ?>

<?php

  echo('
  <div class="panel_lewy">
  ');
    WyswietlLewyPanel($_SESSION['account_type']);   
  echo('
  </div>
  ');   

   
if ($_SESSION['account_type'] < USER)
{

  echo('   
  <div class="tresc">
    <div class="uwaga">Nie zalogowałeś się do tej pory. Jedynie zalogowani użytkownicy mają dostęp do tej strony.</div>
  </div>
  ');   

}else
{
  echo('
  <div class="tresc">  
  ');
  
  echo('<h1>Ranking gier</h1>
  
  <div id="ranking_gier">
    <ul>
      <li><a href="#gry_najnowsze">Najnowsze gry</a></li>
      <li><a href="#gry_najpopularniejsze">Najpopularniejsze gry</a></li>
    </ul>

    <div id="gry_najnowsze">
    ');
    
    GryWyswietlNajnowsze();
    
    echo('
    </div>  
    <div id="gry_najpopularniejsze">
    ');
    
    GryWyswietlNajpopularniejsze();  

    echo('
    </div>
    
  </div>
  ');
  
  $karta = intval($_GET['karta']);
  if ($karta<0||$karta>1) $karta = 0;

  echo('  
  <script type="text/javascript">
  //<![CDATA[
    jQuery("#ranking_gier").tabs();
    jQuery("#ranking_gier").tabs().tabs("select",'.$karta.');
  //]]>
  </script>
  ');
  
  
  
  echo('<br /><br />');
  WyswietlLinkiNawigacyjne(true, false, true, true);
  
  echo('
  </div>
  ');
}
   
?>

<?php include_once($footer); ?>