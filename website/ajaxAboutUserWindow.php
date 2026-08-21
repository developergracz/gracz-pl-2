<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

      <?php

      if ($_SESSION['account_type']>=USER)
      {
        try{
          $row = getUserDataFromId($_REQUEST['id_user']);
          
          echo('
          <a href="'.$path['profile'].'-'.$row['login'].'" class="button_normal" id="visit_profile_button">Odwiedź profil</a>

          <h2><span class="profile_field"><img src="'.$directory['design'].'users.png" alt="" /> '.$row['login'].'</span></h2>
          
          <div id="tabs_profile_information">
            <div class="sex">'.($row['sex']==SEX_FEMALE?'kobieta':'mężczyzna').'</div>
          ');
          if ($row['last_seen']==0) $last_seen = 'Przed sekundką';
          if ($row['last_seen']>0) $last_seen = round($row['last_seen']).' sekund temu';
          if ($row['last_seen']>60) $last_seen = round($row['last_seen']/60).' minut temu';
          if ($row['last_seen']>3600) $last_seen = round($row['last_seen']/3600).' godzin temu';
          if ($row['last_seen']>3600*24) $last_seen = round($row['last_seen']/3600.0/24.0).' dni temu';
          if ($row['last_seen']>31536000) $last_seen = round($row['last_seen']/31536000).' lat temu';
          
          if ($row['plays_count']>0)
            $procent_wygranych = round((100*$row['won'])/$row['plays_count'],1);
          else
            $procent_wygranych = 0;
            
          if ($row['ranking_pos']=='') $row['ranking_pos'] = 'Użytkownik nie rozegrał jeszcze ani jednej partii.';
          $row['scores_sum'] = intval($row['scores_sum']);
          $row['won'] = intval($row['won']);
          $row['plays_count'] = intval($row['plays_count']);
          $row['lost'] = intval($row['lost']);
          
          echo('
          <table>
            <tr><td>Miejsce w rankingu</td><td>'.$row['ranking_pos'].'</td></tr>
            <tr><td>Punktacja</td><td>'.$row['scores_sum'].' pkt.</td></tr>
            <tr><td>Ilość rozgrywek</td><td>'.$row['plays_count'].'</td></tr>
            <tr><td class="indent">w tym wygranych</td><td>'.$row['won'].' ('.$procent_wygranych.'%)</td></tr>
            <tr><td class="indent">w tym przegranych</td><td>'.$row['lost'].'</td></tr>
            <tr><td>Ostatnio widziany</td><td>'.$last_seen.' (czas przybliżony)</td></tr>
            <tr><td>Data rejestracji</td><td>'.$row['date_register'].'</td></tr>
          </table>
          ');
          
          if ($row['id']!=$_SESSION['id'])
          {
            echo('
            <br />
            <a href="'.$path['conversation'].'-'.$row['login'].'" class="button_normal small">Wyślij wiadomość</a>
            ');
            
            if (!IsFriendship($row['id']))
            {
              echo('
              <a href="#" class="button_normal small friends" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Dodaj do znajomych</a>');
            }else
            {
              echo('
              <a href="#" class="button_hot small friends" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Usuń ze znajomych</a>');            
            }
            echo('
            <script type="text/javascript">
              jQuery(document).ready(function(){
                initiateControlsEvents();
              });
            </script>
            ');
            
            if (!IsInUserBlacklist($row['id']))
            {
              echo('
              <a href="#" class="button_normal small blacklist" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Zablokuj</a>
              ');
            }else
            {
              echo('
              <a href="#" class="button_hot small blacklist" data-id_user="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Odblokuj</a>');
            }
            
            echo('
            <script type="text/javascript">
              jQuery(document).ready(function(){
                initiateControlsEvents();
              });            
            </script>
            ');

          }
        }catch(ExceptionNoResults $e) 
        {
          echo('Podany użytkownik nie istnieje.');
        }catch(Exception $e)
        {
          echo($e);
        }
        
    }       
      
  ?>
  
    
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>