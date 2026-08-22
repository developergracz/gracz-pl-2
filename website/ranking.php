<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light rank">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
      <h1>Ranking</h1>

      <table>
      <thead><tr><th>Miejsce</th><th>Użytkownik</th><th>Punktacja</th></tr></thead>
      <?php
      $HTML_crown = ' <img src="'.htmlspecialchars($directory['design'], ENT_QUOTES, 'UTF-8').'icon_crown.png" alt="1 miejsce" title="Tytuł najlepszego gracza" style="vertical-align:middle" /> ';
      $i = 0;
      foreach(getPlayersRank() as $wiersz)
      {
        $i++;
        $scores = intval(isset($wiersz['scores_sum']) ? $wiersz['scores_sum'] : 0);
        $loginRaw = isset($wiersz['login']) ? (string)$wiersz['login'] : '';
        $loginText = htmlspecialchars($loginRaw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $loginUrl = rawurlencode($loginRaw);
        echo('<tr><td class="text_right">'.($i==1?$HTML_crown:'').' '.$i.' </td><td><a href="'.htmlspecialchars($path['profile'], ENT_QUOTES, 'UTF-8').'-'.$loginUrl.'">'.$loginText.'</a></td><td class="text_center">'.$scores.'</td></tr>');
        if ($i>=100) break;
      }
      ?>
      </table>

      <div style="text-align:right">Oglądnij również <a href="<?php echo(htmlspecialchars($path['statistics'], ENT_QUOTES, 'UTF-8')); ?>">statystyki serwisu</a>.</div>
    </div>
  </div>

<?php include_once($footer); ?>