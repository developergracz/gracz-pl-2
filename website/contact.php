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

      <div id="window_contact">
        <h1>Formularz kontaktowy</h1>
        <?php
          if (isset($_POST['contact_email'])&&isset($_POST['contact_email_content']))
          {
            try
            {
              SendContactMessage($_POST['contact_email'], $_POST['contact_email_content']);
              $_POST['contact_email'] = '';
              $_POST['contact_email_content'] = '';
              echo('<div class="positive">Wiadomość została pomyślnie wysłana.</div>');
            }catch (ExceptionRoot $e)
            {
              echo($e);
            }

            echo('<p>Wyślij <strong>kolejną</strong> wiadomość korzystając z prostego formularza kontaktowego.</p>');
          }else
          {
            echo('<p>Wyślij wiadomość korzystając z prostego formularza kontaktowego.</p>');
          }

          DisplayFormContact($_POST['contact_email'], $_POST['contact_email_content']);
        ?>

      </div>


      <h1>Kontakt</h1>
      <div id="contactInformations">
        <h2>Właściciel serwisu</h2>
        <p>
          Czesław Socha<br />
        </p>

        <h2>Uwagi i sugestie, informacje ogólne</h2>
        <p>Wszelkie uwagi, prośby, sugestie prosimy wysyłać pod adres <?php echo('<a href="mailto:'.$kontakt_email.'">'.$kontakt_email.'</a>'); ?></p>

        <h2>Współpraca, reklama</h2>
        <p>Oferty dotyczące współpracy lub reklamy prosimy wysyłać pod adres: <?php echo('<a href="mailto:'.$reklama_email.'">'.$reklama_email.'</a>'); ?></p>
      </div>
      <br style="clear:both;" />

    </div>
  </div>

<?php include_once($footer); ?>