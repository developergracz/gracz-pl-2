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
      <h1>Reset hasła</h1>

      <?php
        // Security hardening: the historical reset flow generated and emailed a temporary password
        // and activated it with a predictable numeric code. It is intentionally disabled.
        // Use the modern one-time, hashed, expiring reset-token service instead.
        http_response_code(503);
        echo('<div class="warning">Reset hasła w starej wersji serwisu został tymczasowo wyłączony ze względów bezpieczeństwa. Bezpieczny reset zostanie obsłużony przez nowy mechanizm jednorazowych tokenów.</div>');
      ?>

    </div>
  </div>

<?php include_once($footer); ?>