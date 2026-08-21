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
      $HTML_crown = ' <img src="'.$directory['design'].'icon_crown.png" alt="1 miejsce" title="Tytuł najlepszego gracza" style="vertical-align:middle" /> ';
      $i = 0;
      foreach(getPlayersRank() as $wiersz)
      {
        $i++;
        $wiersz['scores_sum'] = intval($wiersz['scores_sum']);
        echo('<tr><td class="text_right">'.($i==1?$HTML_crown:'').' '.$i.' </td><td><a href="'.$path['profile'].'-'.$wiersz['login'].'">'.$wiersz['login'].'</a></td><td class="text_center">'.$wiersz['scores_sum'].'</td></tr>');
        if ($i>100) break;
      }
      ?>
      </table>
      
      <div style="text-align:right">Oglądnij również <a href="<?php echo($path['statistics']); ?>">statystyki serwisu</a>.</div>
    </div>
  </div>
	
<?php include_once($footer); ?>