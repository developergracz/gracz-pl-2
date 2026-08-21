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

    <?php
      echo('
      <div class="text_center">
        <h1>403</h1>
        <p>Przepraszamy...<br />
        Nie masz dostępu do strony o podanym adresie...<br />
        Prosimy sprawdzić poprawność adresu lub skorzystać z poniższych łączy.</p>
        <a href="'.$service_base_address.'">Przejdź do strony głównej</a><br />
        <a href="'.$path['gry'].'">Przejdź do gier</a><br />
        <a href="'.$path['rank'].'">Przejdź do rankingu</a><br />
        <a href="'.$path['contact'].'">Skontaktuj się z nami</a><br />      
      </div>
      ');
    ?>
              
    </div>
  </div>
  
<?php include_once($footer); ?>