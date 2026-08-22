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

      <h1>Zgłoszone błędy</h1>
      <p>Lista błędów zgłoszonych przez użytkowników.</p>

      <?php
        // Security: state-changing admin actions must never be triggered by GET.
        if (isset($_GET['delete_bug_report']))
        {
          http_response_code(405);
          echo('<span class="negative">Usuwanie przez link GET zostało wyłączone ze względów bezpieczeństwa. Użyj akcji POST w panelu administracyjnym.</span>');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_bug_report']))
        {
          try{
            DeleteBugReport($_POST['delete_bug_report'], isset($_POST['token']) ? $_POST['token'] : '');
            echo('<span class="positive">Zgłoszenie zostało pomyślnie usunięte.</span>');
          }catch(Exception $e)
          {
            echo(htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
          }
        }

        try{
          DisplayReportedBugs();
        }catch(Exception $e)
        {
          echo(htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
        }
      ?>

      <br style="clear:both;" />

    </div>
  </div>

<?php include_once($footer); ?>