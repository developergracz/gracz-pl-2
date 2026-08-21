<?php include("variables_local.php"); include_once($header); ?>

<?php

  if (!isset($_GET['id_category']))
  {
    //echo('<h1>Najpopularniejsze</h1>');
    GryWyswietlNajpopularniejsze(4);
  }else
  {
    if (!isset($_GET['id_game']))
    {
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
      ');

      GryWyswietlPozycjeKategorii($_GET['id_category']);

      echo('
          <br style="clear:both;" />
        </div>
      </div>

      ');
    }else
    {

      if (isset($_GET['roomName']))
      {
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
        ');
        if ($_SESSION['account_type']<USER)
        {
          echo('<h1>Logowanie</h1>');
          DisplayFormLogin();
        }else{
          JavaScriptZaladujSkrypt('swfobject');
          GryWyswietlGre($_GET['id_game'], $_GET['roomName'], $_POST['gameNotInRank'], $_POST['roomVisibility'], $_POST['gameDuration']);
        }

        echo('<br /><br />

            <div id="aktualnie_grajacy">
              <!-- Pojemnik na treść AJAXową -->
        ');
       // GryObecnieGraja($_GET['id_game'],$_GET['roomName']);
        echo('

            </div>
          </div>
        </div>
        ');
      }else{
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
        ');

        if ($_SESSION['account_type']<USER)
        {
          echo('<h1>Logowanie</h1>');
          SetAfterLoginRedirect($_SERVER['REQUEST_URI']);
          DisplayFormLogin();
        }else{
          GryWyswietlPokojeDlaGry($_GET['id_category'], $_GET['id_game']);
        }
        echo('
          </div>
        </div>
        ');
      }

    }
  }


  if ($_SESSION['account_type']>=ADMINISTRATOR)
  {
    echo('<br /><a href="'.$path['admin_game_add'].(isset($_GET['id_category'])?'?id_category='.intval($_GET['id_category']):'').'" class="button_normal">Dodaj grę</a>');
  }

  echo('
  <script type="text/javascript">
  //<![CDATA[
    function odswiezAktualnieGrajacych()
    {

    }

    if (jQuery("#aktualnie_grajacy").length>0)
    {
      jQuery("#aktualnie_grajacy").hide();
      setInterval("odswiezAktualnieGrajacych()", 5000);
    }
  //]]>
  </script>
  ');

?>

<?php include_once($footer); ?>