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

      <h1>Hasło zostało zmienione</h1>
  
      <p>Dziękujemy, Twoje hasło zostało zmienione.</p>
  
      <?php
        echo('<a href="'.$path['login'].'" class="button_normal">Zaloguj się</a>');
      ?>

      <br style="clear:both;" />
          
    </div>
  </div>
	
<?php include_once($footer); ?>