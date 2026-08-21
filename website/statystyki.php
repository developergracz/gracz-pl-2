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
      <h1>Statystyki serwisu</h1>
      
      
      <?php
        $stats = getServiceStatistics();
        // print_r($stats);
      ?>
      
    
    
          
      <div class="column">
        <h2>Użytkownicy</h2>
        Ilość wszystkich użytkowników:
        <?php echo($stats['number_of_all_users'].' (w tym online '.$stats['number_of_online_users'].')'); ?><br />
        &bull; ilość wszystkich kobiet:
        <?php echo($stats['number_of_female_users']); ?><br />
        &bull; ilość wszystkich mężczyzn:
        <?php echo($stats['number_of_male_users']); ?><br />
        <div id="piechart" style="width: 500px; height: 300px;"></div>
        <script type="text/javascript">
          google.load("visualization", "1", {packages:["corechart"]});
          google.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['Task', 'Ilość'],
              ['Kobiety',     <?php echo($stats['number_of_female_users']); ?>],
              ['Mężczyźni',      <?php echo($stats['number_of_male_users']); ?>]
            ]);

            var options = {
              title: 'Rozkład płci użytkowników'
            };

            var chart = new google.visualization.PieChart(document.getElementById('piechart'));
            chart.draw(data, options);
          }
        </script>
      </div>

      <div class="column">
        <table>
        <caption>Ostatnio widziani użytkownicy (online)</caption>
        <thead><tr><th>Aktywny</th><th>Użytkownik</th><th>Punkty</th></tr></thead>
        <?php 
        $i = 0;
        foreach(getPlayersWhoAreOnline() as $wiersz)
        {
          if ($wiersz['is_online']==1)
            $HTML_is_online = '<img src="'.$directory['design'].'icon_status_online.png" alt="Online" />';
          else
            $HTML_is_online = '<img src="'.$directory['design'].'icon_status_offline.png" alt="Offline" />';
          
          echo('<tr><td>'.$HTML_is_online.'</td><td><a href="'.$path['profile'].'-'.$wiersz['login'].'">'.$wiersz['login'].'</a></td><td>'.$wiersz['scores_sum'].'</td></tr>');
          if ($i>100) break;
        }
        ?>
        </table>
                
        <!--<h2>Łączny czas gry</h2>
        <?php echo($stats['sumarizedPlaytime']); ?>
        <h2>Średni czas gry</h2>
        <?php echo($stats['averagePlaytime']); ?>-->
      </div>

      <div class="column">
        <h2>Rozgrywka</h2>
        Ilość dostępnych gier:
        <?php echo($stats['number_of_games']); ?><br />
        
        Ilość rozgrywek:
        <?php echo($stats['number_of_plays']); ?><br />
      </div>
      
      
    </div>
  </div>
	
<?php include_once($footer); ?>