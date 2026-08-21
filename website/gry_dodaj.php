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
      <h1>Gry - dodaj grę</h1>

      <div class="warning">Do tej podstrony ma dostęp tylko administrator.</div>
      
      <?php
      if ($_SESSION['account_type']>=ADMINISTRATOR)
      {
        echo('Moduł dodawania gier nie został opracowany w ramach zlecenia. Gry należy dodawać ręcznie (umieścić w folderze i dodać odpowiedni rekord do tabeli `games` w bazie danych.');
      }
      ?>
    </div>
  </div>
	
<?php include_once($footer); ?>