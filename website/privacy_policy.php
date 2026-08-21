<?php include("variables_local.php"); include_once($header); ?>

<?php
  echo('
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
      <img src="'.$directory['design'].'cookie.jpg" alt="Cookie" style="float:right" />
      ');
      $content = file($path['privacy_policy_txt']);
      $content[0] = '<h1>'.$content[0].'</h1>';
      
      foreach($content as $row)
      {
       if (ord($row[0])==194) 
          $row = '<h2>'.$row.'</h2>';
        echo(nl2br($row));
      }
      
      echo('
      <h3>Zobacz też</h3>
      <ul>
        <li><a href="'.$path['terms_of_service'].'">Regulamin serwisu</a></li>
      </ul>

    </div>
  </div>
  ');

?>

<?php include_once($footer); ?>