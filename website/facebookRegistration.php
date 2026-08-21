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
      <h1>Rejestracja przez Facebook</h1>
      ');

      if (isset($_REQUEST['response'])&&isset($_REQUEST['code']))
      {
        try
        {
          facebookGetUserAndRegister();
          echo('
          <div class="text_center">
            Rejestracja za pomocą konta Facebook przebiegła pomyślnie.<br />
            Pierwsze logowanie... Miłej zabawy!<br /><br />
            <img src="'.$directory['design'].'loader.gif" alt="Loading" />
          </div>
          ');
          
          RedirectJavaScript($service_base_address,3);

        }catch(ExceptionEmailAlreadyExists $ex)
        {
          // TODO: UWIERZYTELNIANIE już zarejestrowanego
        }catch(Exception $ex)
        {
          echo('<div class="error">'.$ex->getMessage().'</div>');
        }
      }
      

      echo('
    </div>
  </div>
  ');

?>

<?php include_once($footer); ?>